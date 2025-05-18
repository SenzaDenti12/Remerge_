import redis
import json
import time
import os
import requests # For Twelve Labs API calls and Creatomate
from openai import OpenAI, OpenAIError # For GPT and Moderation
from dotenv import load_dotenv
import boto3 # To get S3 object URLs or download
# Remove uuid import if no longer needed elsewhere
# import uuid 
from typing import Optional
from supabase_client import supabase # Import the Supabase client
from postgrest.exceptions import APIError # For Supabase errors
import logging

from redis_client import redis_client, MEME_JOB_STREAM, REDIS_URL # Use the shared client

# Load environment variables from the script's directory
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=dotenv_path)

# Configure basic logging
# You can customize the format and level further if needed
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s',
                    datefmt='%Y-%m-%d %H:%M:%S')

# --- Configuration --- 
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
logging.info(f"[DEBUG] Loaded OPENAI_API_KEY: '{OPENAI_API_KEY[:5]}...{OPENAI_API_KEY[-4:] if OPENAI_API_KEY else 'Not Loaded or Empty'}'")
TWELVE_LABS_API_KEY = os.getenv("TWELVE_LABS_API_KEY")
TWELVE_LABS_API_URL = "https://api.twelvelabs.io/v1.3"
LEMON_SLICE_API_KEY = os.getenv("LEMON_SLICE_API_KEY") # Add Lemon Slice Key
CREATOMATE_API_KEY = os.getenv("CREATOMATE_API_KEY") # Add Creatomate key
BRANDED_OUTRO_IMAGE_URL = os.getenv("BRANDED_OUTRO_IMAGE_URL") # Add Outro URL
CREATOMATE_API_URL = "https://api.creatomate.com/v1" # Define base URL
CREATOMATE_TEMPLATE_ID = os.getenv("CREATOMATE_TEMPLATE_ID") # Add Template ID

AWS_S3_BUCKET_NAME = os.getenv("AWS_S3_BUCKET_NAME")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_S3_REGION = os.getenv("AWS_S3_REGION", "us-east-1")

# Validate mandatory config
if not OPENAI_API_KEY:
    logging.error("Error: OPENAI_API_KEY not found in environment variables.")
    exit(1)
if not TWELVE_LABS_API_KEY:
    logging.error("Error: TWELVE_LABS_API_KEY not found in environment variables.")
    exit(1)
if not AWS_S3_BUCKET_NAME:
     logging.error("Error: AWS_S3_BUCKET_NAME not found in environment variables.")
     exit(1)
if not LEMON_SLICE_API_KEY:
    logging.warning("Warning: LEMON_SLICE_API_KEY not found in environment variables. Lip sync step will fail.")
    # Decide if this is fatal depending on if Lemon Slice is core
if not CREATOMATE_API_KEY:
    logging.warning("Warning: CREATOMATE_API_KEY not found. Video rendering step will fail.")
if not BRANDED_OUTRO_IMAGE_URL:
     logging.warning("Warning: BRANDED_OUTRO_IMAGE_URL not found. Outro cannot be added.")
if not CREATOMATE_TEMPLATE_ID:
     logging.warning("Warning: CREATOMATE_TEMPLATE_ID not found. Video rendering will use basic sequence fallback (if implemented) or fail.")

# --- Initialize Clients ---
openai_client = OpenAI(api_key=OPENAI_API_KEY)
s3_client = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_S3_REGION,
    config=boto3.session.Config(signature_version='s3v4')
)

# --- Helper Functions ---

def get_s3_presigned_url(bucket, key, expiration=3600):
    """Generates a temporary S3 GET URL."""
    try:
        response = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket, 'Key': key},
            ExpiresIn=expiration
        )
        return response
    except Exception as e:
        logging.error(f"Error generating presigned S3 URL for {key}: {e}")
        return None

def call_twelve_labs_summarize(video_url: str, custom_job_id: str) -> tuple[Optional[str], Optional[str]]:
    """Calls Twelve Labs API to index and summarize a video using a persistent index."""
    logging.info(f"[Job: {custom_job_id}] Starting Twelve Labs processing...")
    headers = {
        "x-api-key": TWELVE_LABS_API_KEY
    }
    
    # Use a single persistent index
    index_name = "default_meme_index"
    index_id = None
    index_was_created = False

    # 1. Check if the persistent index exists
    try:
        logging.info(f"[Job: {custom_job_id}] Checking for index: {index_name}")
        list_params = {"index_name": index_name}
        indexes_response = requests.get(f"{TWELVE_LABS_API_URL}/indexes", headers=headers, params=list_params)
        indexes_response.raise_for_status()
        indexes_data = indexes_response.json().get('data', [])
        
        if indexes_data:
            # Found the index
            default_index = indexes_data[0] # Assuming name filter returns unique or first is fine
            index_id = default_index.get('_id')
            logging.info(f"[Job: {custom_job_id}] Found existing index '{index_name}' with ID: {index_id}")
        else:
            # Index not found, proceed to create it
            logging.info(f"[Job: {custom_job_id}] Index '{index_name}' not found. Creating...")
            create_index_payload = {
                "index_name": index_name,
                "models": [
                    {
                        "model_name": "marengo2.7",
                        "model_options": ["visual", "audio"]
                    },
                    {
                        "model_name": "pegasus1.2",
                        "model_options": ["visual", "audio"]
                    }
                ],
                "addons": ["thumbnail"]
            }
            try:
                create_response = requests.post(
                    f"{TWELVE_LABS_API_URL}/indexes",
                    headers=headers,
                    json=create_index_payload
                )
                create_response.raise_for_status() # Raises HTTPError for 4xx/5xx
                index_id = create_response.json().get('_id')
                if not index_id:
                     raise ValueError(f"Failed to get ID after creating index '{index_name}'.")
                logging.info(f"[Job: {custom_job_id}] Successfully created index '{index_name}' with ID: {index_id}")
                index_was_created = True # Flag that we just created it
            except requests.exceptions.HTTPError as http_err:
                if http_err.response.status_code == 409:
                    # Conflict: Highly unlikely if check above worked, but handle defensively
                    logging.info(f"[Job: {custom_job_id}] Index '{index_name}' already exists (409 Conflict during creation attempt). Refetching...")
                    # Refetch specifically by name again
                    refetch_response = requests.get(f"{TWELVE_LABS_API_URL}/indexes", headers=headers, params=list_params)
                    refetch_response.raise_for_status()
                    refetch_data = refetch_response.json().get('data', [])
                    if refetch_data:
                        index_id = refetch_data[0].get('_id')
                        logging.info(f"[Job: {custom_job_id}] Found existing index ID after 409: {index_id}")
                    else:
                         raise ValueError(f"Failed to find index '{index_name}' even after 409 conflict.")
                else:
                    # Re-raise other HTTP errors
                    logging.error(f"[Job: {custom_job_id}][ERROR] HTTP error creating index '{index_name}': {http_err} - {http_err.response.text}")
                    raise ConnectionError(f"Twelve Labs Index Creation Error: {http_err}") from http_err

        # If we just created the index, give it time to provision
        if index_was_created:
            logging.info(f"[Job: {custom_job_id}] [DEBUG] Waiting 5 seconds after creating index '{index_name}' for provisioning...")
            time.sleep(5)

        if not index_id:
            raise ValueError(f"Failed to retrieve or create index ID for '{index_name}'.")

    except requests.exceptions.RequestException as e:
        logging.error(f"[Job: {custom_job_id}][ERROR] Error checking or creating index '{index_name}': {e}")
        raise ConnectionError(f"Twelve Labs Index Management Error: {e}") from e

    # Short wait after index creation
    logging.info(f"[Job: {custom_job_id}] [DEBUG] Ensuring index is ready for video submission...")
    time.sleep(5)

    # 2. Submit video for indexing (upload by URL)
    task_files = {
        "index_id": (None, index_id),
        "video_url": (None, video_url),
        "enable_video_stream": (None, "true")
    }

    try:
        logging.info(f"[Job: {custom_job_id}] Submitting video to Twelve Labs for indexing (Index ID: {index_id})...")
        logging.info(f"[Job: {custom_job_id}] Video URL: {video_url}") 
        logging.info(f"[Job: {custom_job_id}][DEBUG] Payload for /tasks: {json.dumps({k: v[1] for k, v in task_files.items()}, indent=2)}")

        task_response = requests.post(
            f"{TWELVE_LABS_API_URL}/tasks",
            headers=headers,  # Only the API key header; Content-Type is set automatically
            files=task_files
        )
        
        if task_response.status_code == 201: # Specifically handle 201 as INFO
            logging.info(f"[Job: {custom_job_id}] Twelve Labs /tasks responded {task_response.status_code} (Created): {task_response.text}")
            try:
                logging.info(f"[Job: {custom_job_id}] Response JSON: {task_response.json()}")
            except Exception:
                logging.warning("[Job: {custom_job_id}][WARN] Response is not valid JSON for 201 status.")
        elif task_response.status_code != 200: # Handle other non-200s as errors
            logging.error(f"[Job: {custom_job_id}][ERROR] Twelve Labs /tasks responded {task_response.status_code}: {task_response.text}")
            try:
                logging.error(f"[Job: {custom_job_id}][ERROR] Response JSON: {task_response.json()}")
            except Exception:
                logging.error("[Job: {custom_job_id}][ERROR] Response is not valid JSON.")
            task_response.raise_for_status()
        task_id = task_response.json().get('_id')
        if not task_id:
             logging.error(f"[Job: {custom_job_id}][ERROR] Twelve Labs task submission did not return a task_id.")
             raise ValueError("Failed to get task ID from Twelve Labs.")
        logging.info(f"[Job: {custom_job_id}] Twelve Labs indexing task created: {task_id}")
    except requests.exceptions.RequestException as e:
        if hasattr(e, 'response') and e.response is not None:
            logging.error(f"[Job: {custom_job_id}][ERROR] Twelve Labs exception response: {e.response.text}")
        import traceback
        logging.error(f"[Job: {custom_job_id}][TRACEBACK] Exception during /tasks submission:")
        logging.error(traceback.format_exc())
        raise ConnectionError(f"Twelve Labs Task Submission Error: {e}") from e

    # 3. Poll task status until ready
    video_id = None
    status_endpoint = f"{TWELVE_LABS_API_URL}/tasks/{task_id}"
    max_retries = 20 # e.g., 20 * 5 seconds = 100 seconds timeout
    retries = 0
    thumbnail_url = None # Initialize thumbnail url within function scope
    while retries < max_retries:
        try:
            logging.info(f"[Job: {custom_job_id}] Checking Twelve Labs task status ({retries+1}/{max_retries}), Task ID: {task_id}...")
            status_res = requests.get(status_endpoint, headers=headers)
            status_res.raise_for_status()
            status_data = status_res.json()
            status = status_data.get('status')
            logging.info(f"[Job: {custom_job_id}] Task status: {status}")

            if status == "ready":
                video_id = status_data.get('video_id')
                if not video_id:
                    raise ValueError("Task ready but no video_id found.")
                logging.info(f"[Job: {custom_job_id}] Video indexed successfully. Twelve Labs Video ID: {video_id}")

                # --- Verification Step ---
                try:
                    verify_url = f"{TWELVE_LABS_API_URL}/indexes/{index_id}/videos/{video_id}"
                    logging.info(f"[Job: {custom_job_id}][DEBUG] Verifying video metadata at: {verify_url}")
                    verify_res = requests.get(verify_url, headers=headers)
                    verify_res.raise_for_status()
                    video_metadata = verify_res.json()
                    # v1.3 migration guide says metadata is renamed to system_metadata or user_metadata
                    logging.info(f"[Job: {custom_job_id}][DEBUG] Verified Video Metadata: system_metadata={video_metadata.get('system_metadata')}, user_metadata={video_metadata.get('user_metadata')}, hls={video_metadata.get('hls')}") 
                except requests.exceptions.RequestException as verify_err:
                    logging.warning(f"[Job: {custom_job_id}][WARN] Failed to verify video metadata for {video_id}: {verify_err}")
                except Exception as json_err:
                    logging.warning(f"[Job: {custom_job_id}][WARN] Failed to parse video metadata JSON for {video_id}: {json_err}")

                # --- Extract Thumbnail URL ---
                hls_data = video_metadata.get('hls')
                if hls_data and isinstance(hls_data, dict):
                    thumbnail_urls = hls_data.get('thumbnail_urls')
                    if thumbnail_urls and isinstance(thumbnail_urls, list) and len(thumbnail_urls) > 0:
                        thumbnail_url = thumbnail_urls[0]
                        logging.info(f"[Job: {custom_job_id}] Extracted thumbnail URL: {thumbnail_url}")
                    else:
                         logging.warning(f"[Job: {custom_job_id}][WARN] No thumbnail URLs found in hls data. Full hls_data: {hls_data}")
                else:
                     logging.warning(f"[Job: {custom_job_id}][WARN] HLS data missing or not a dict in video metadata. Full video_metadata: {video_metadata}")
                # --- End Thumbnail Extraction ---

                break # Exit polling loop once ready
            elif status in ["failed", "error"]:
                raise RuntimeError(f"Twelve Labs indexing failed: {status_data.get('process', {}).get('status')}")
            
            retries += 1
            time.sleep(5) # Wait before polling again
        except requests.exceptions.RequestException as e:
             logging.error(f"[Job: {custom_job_id}][ERROR] Error polling Twelve Labs task status: {e}")
             # Allow retries on temporary polling errors
             retries += 1
             time.sleep(5)
    
    if not video_id:
        logging.error(f"[Job: {custom_job_id}][ERROR] Twelve Labs indexing timed out or failed to produce video_id.")
        return None, None

    # Add a short delay before summarizing, relying on the retry loop for robustness
    logging.info(f"[Job: {custom_job_id}][DEBUG] Waiting 5 seconds before requesting summary...")
    time.sleep(5)

    # 4. Generate Summary – try up to 3 times with a better prompt
    summarize_payload = {
        "video_id": video_id,
        "type": "summary",
        # Enhanced prompt that's more specific about capturing visual content accurately
        "prompt": (
            "This is a short video clip being analyzed for a meme generator. "
            "Describe ONLY what you can visually see in the video - the subjects, their actions, and the setting. "
            "Be extremely specific and accurate about what's actually shown. "
            "If you see animals, specify the exact animals. If you see people, describe their actions precisely. "
            "Do not make assumptions beyond what is visually present."
        ),
        "temperature": 0.1  # Lower temperature for more deterministic results
    }

    max_summary_attempts = 3
    for attempt in range(1, max_summary_attempts + 1):
        try:
            logging.info(f"[Job: {custom_job_id}] Requesting summary from Twelve Labs for video ID: {video_id} (attempt {attempt})...")
            summary_response = requests.post(
                f"{TWELVE_LABS_API_URL}/summarize",
                headers=headers,
                json=summarize_payload,
                timeout=90
            )

            summary_response.raise_for_status()

            summary = summary_response.json().get('summary')
            if summary:
                logging.info(f"[Job: {custom_job_id}] Received summary: {summary[:100]}...")
                return summary, thumbnail_url
            else:
                raise ValueError("No 'summary' field in response.")
        except (requests.exceptions.RequestException, ValueError) as err:
            # Only retry if attempts remain
            logging.warning(f"[Job: {custom_job_id}][WARN] Summary attempt {attempt} failed: {err}")
            if attempt >= max_summary_attempts:
                logging.error(f"[Job: {custom_job_id}][ERROR] Failed to get summary after {max_summary_attempts} attempts.")
                return None, thumbnail_url
            logging.warning("[Job: {custom_job_id}][WARN] Waiting 15s before retrying summary request...")
            time.sleep(15)

def generate_script(summary: str, user_id: str, custom_job_id: str) -> str:
    """Generates a meme script using OpenAI GPT-4o."""
    logging.info(f"[Job: {custom_job_id}] Generating script for user {user_id} from summary...")
    system_prompt = "You are a witty meme creator. Given a summary of a video, you create a funny narrator-style script spoken by one person. The script should be fully speakable (no parenthetical stage directions or narrator colons like 'Narrator:'). The script must be less than 900 characters long. Aim for engaging and concise content suitable for a talking head meme."
    user_prompt = f"Video Summary:\n```\n{summary}\n```\nGenerate a short, funny meme script (less than 900 characters) based on this summary:"

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o", # Or preferred model
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=300,
            user=user_id # Pass user ID for monitoring
        )
        script = response.choices[0].message.content.strip()
        if not script:
            logging.error(f"[Job: {custom_job_id}][ERROR] GPT generated an empty script.")
            raise ValueError("GPT generated an empty script.")
        logging.info(f"[Job: {custom_job_id}] Generated script: {script[:100]}...")
        return script
    except OpenAIError as e:
        logging.error(f"[Job: {custom_job_id}][ERROR] OpenAI GPT API error: {e}")
        raise ConnectionError(f"OpenAI API Error: {e}") from e
    except (IndexError, KeyError, AttributeError) as e:
        logging.error(f"[Job: {custom_job_id}][ERROR] Error parsing GPT response: {e}")
        raise ValueError(f"Could not parse script from OpenAI: {e}") from e

def call_lemon_slice(avatar_image_s3_key: str, script_text: str, voice_id: Optional[str], custom_job_id: str) -> Optional[str]:
    """
    Calls the Lemon Slice API to generate a talking head video.
    - Needs the S3 key for the user's uploaded avatar image.
    - Needs the generated script text (max 900 chars enforced).
    - Accepts an optional voice_id.
    - Returns a URL to the generated talking head video upon completion.
    """
    logging.info(f"[Job: {custom_job_id}] --- Calling Lemon Slice API ---")
    logging.info(f"[Job: {custom_job_id}] Avatar S3 Key: {avatar_image_s3_key}")
    # Enforce 900 character limit for LemonSlice
    if len(script_text) > 900:
        logging.warning(f"[Job: {custom_job_id}][WARN] Script text exceeds 900 characters ({len(script_text)}). Truncating for LemonSlice.")
        script_text = script_text[:900]
    logging.info(f"[Job: {custom_job_id}] Script (first 100 chars for LemonSlice): {script_text[:100]}...")
    logging.info(f"[Job: {custom_job_id}] Voice ID: {voice_id if voice_id else 'Default (Sam)'}")
    
    if not LEMON_SLICE_API_KEY:
        logging.warning("Lemon Slice API Key missing, cannot proceed.")
        raise ValueError("Lemon Slice API Key not configured.")

    # 1. Get a readable URL for the avatar image
    avatar_url = get_s3_presigned_url(AWS_S3_BUCKET_NAME, avatar_image_s3_key)
    if not avatar_url:
        raise ValueError(f"[Job: {custom_job_id}][ERROR] Could not get presigned URL for avatar: {avatar_image_s3_key}")
    logging.info(f"[Job: {custom_job_id}] Got presigned S3 URL for avatar: {avatar_url[:100]}...")
        
    # 2. Construct Lemon Slice API request payload
    lemon_slice_generate_endpoint = "https://lemonslice.com/api/v2/generate"
    # Use provided voice_id or default
    selected_voice_id = voice_id if voice_id else "ZRwrL4id6j1HPGFkeCzO" # Default: Sam - American male
    
    payload = {
        "img_url": avatar_url,
        "text": script_text,
        "voice_id": selected_voice_id,
        "resolution": "512", # Default as per docs
        # Add other optional params like model, expressiveness if needed
    }
    headers = {
        "Authorization": f"Bearer {LEMON_SLICE_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    # 3. Make the POST request to start generation
    job_id = None
    try:
        logging.info(f"[Job: {custom_job_id}] Submitting generation request to Lemon Slice...")
        response = requests.post(lemon_slice_generate_endpoint, headers=headers, json=payload, timeout=30)
        
        if not response.ok:
            logging.error(f"[Job: {custom_job_id}][ERROR] Lemon Slice /generate responded {response.status_code}: {response.text}")
        response.raise_for_status() # Check for HTTP errors
        
        response_data = response.json()
        job_id = response_data.get('job_id') # Assuming the response contains a job_id
        if not job_id:
             # If no job_id, maybe it failed synchronously or structure is different
             logging.warning(f"[Job: {custom_job_id}][WARN] Lemon Slice /generate response missing job_id: {response_data}")
             # Try to get a video URL directly if available (unlikely for async)
             direct_url = response_data.get('video_url')
             if direct_url:
                 logging.info("Lemon Slice returned URL directly.")
                 return direct_url
             else:
                 raise ValueError("Lemon Slice did not return job_id or video_url.")
                 
        logging.info(f"[Job: {custom_job_id}] Lemon Slice generation job submitted. Lemon Job ID: {job_id}")

    except requests.exceptions.RequestException as e:
        logging.error(f"[Job: {custom_job_id}][ERROR] Lemon Slice /generate request error: {e}")
        raise ConnectionError(f"Lemon Slice API Error (Submit): {e}") from e
    except Exception as e:
         logging.error(f"[Job: {custom_job_id}][ERROR] Error parsing Lemon Slice /generate response: {e}")
         raise ValueError(f"Error parsing Lemon Slice response: {e}") from e

    # 4. Poll the GET /generations/{job_id} endpoint for completion
    status_endpoint = f"https://lemonslice.com/api/v2/generations/{job_id}"
    max_retries = 90 # Increased timeout to 90 * 5s = 450s = 7.5 minutes
    retries = 0
    final_video_url = None

    while retries < max_retries:
        try:
            # Update status in Redis during polling
            update_payload = {"status": "processing", "stage": f"lip_sync_polling_{retries+1}"}
            # Need job_id and user_id here - Assume they are accessible or need to be passed
            # For now, let's assume custom_job_id is available in this scope (will need adjustment)
            # update_job_status(custom_job_id, update_payload) 
            
            logging.info(f"[Job: {custom_job_id}] Checking Lemon Slice job status ({retries+1}/{max_retries}). Lemon Job ID: {job_id}")
            status_response = requests.get(status_endpoint, headers=headers, timeout=15)
            
            if status_response.status_code == 404:
                 # Job might not be findable immediately after creation
                 logging.warning(f"[Job: {custom_job_id}][WARN] Lemon Slice job not found yet (404), retrying...")
                 retries += 1
                 time.sleep(5) # Wait longer if 404
                 continue
            
            if not status_response.ok:
                logging.error(f"[Job: {custom_job_id}][ERROR] Lemon Slice /generations/{job_id} responded {status_response.status_code}: {status_response.text}")
            status_response.raise_for_status()

            status_data = status_response.json()
            status = status_data.get('status')
            logging.info(f"[Job: {custom_job_id}] Lemon Slice Job Status: {status}")

            if status == "completed":
                final_video_url = status_data.get('video_url')
                if not final_video_url:
                     logging.error(f"[Job: {custom_job_id}][ERROR] Lemon Slice job completed but no video_url found.")
                     raise ValueError("Lemon Slice job completed but no video_url found.")
                logging.info(f"[Job: {custom_job_id}] Lemon Slice generation complete! Video URL: {final_video_url}")
                break # Exit polling loop
            elif status == "failed":
                error_message = status_data.get('error_message', 'Unknown error')
                raise RuntimeError(f"Lemon Slice generation failed: {error_message}")
            elif status in ["processing", "queued", "pending"]: # Assumed statuses
                # Continue polling
                pass
            else:
                logging.warning(f"[Job: {custom_job_id}][WARN] Unknown Lemon Slice job status received: {status}")
                # Continue polling cautiously

            retries += 1
            time.sleep(5) # Wait 5 seconds before polling again
        
        except requests.exceptions.RequestException as e:
            logging.error(f"[Job: {custom_job_id}][ERROR] Error polling Lemon Slice job status: {e}")
            # Allow retries on temporary polling errors
            retries += 1
            time.sleep(5)
    
    if not final_video_url:
        logging.error(f"[Job: {custom_job_id}][ERROR] Lemon Slice generation timed out or failed.")
        return None

    return final_video_url

def call_creatomate(lemon_slice_video_url: str, original_video_s3_key: Optional[str], script_text: str, custom_job_id: str) -> Optional[str]:
    """
    Uses Creatomate REST API (via requests) and a Template ID 
    to generate the final video with split screen, subtitles, and outro.
    Returns the URL of the final rendered video after verifying it's accessible.
    """
    logging.info(f"[Job: {custom_job_id}] --- Calling Creatomate REST API using Template ---")
    if not CREATOMATE_API_KEY:
         raise ValueError("Creatomate API Key not configured.")
    if not CREATOMATE_TEMPLATE_ID:
         raise ValueError("Creatomate Template ID not configured.")
    
    headers = {
        "Authorization": f"Bearer {CREATOMATE_API_KEY}",
        "Content-Type": "application/json",
    }

    # Get presigned URL for the original video if its key was provided
    original_video_url = None
    if original_video_s3_key:
        original_video_url = get_s3_presigned_url(AWS_S3_BUCKET_NAME, original_video_s3_key)
        if not original_video_url:
             logging.warning(f"[Job: {custom_job_id}][WARN] Could not get presigned URL for original video {original_video_s3_key}. It might not appear.")
             # Decide if this should be a fatal error
             # raise ValueError(f"Could not get presigned URL for original video: {original_video_s3_key}")
        else:
             logging.info(f"[Job: {custom_job_id}] Got presigned S3 URL for original video: {original_video_url[:100]}...")

    # Construct the modifications payload for the template
    modifications = {
        # Map keys to the placeholder names you used in the template editor
        "TalkingHeadVideo": lemon_slice_video_url,
        "Subtitles": script_text, 
    }
    # Only include the original video if we have a valid URL for it
    if original_video_url:
         modifications["OriginalVideo"] = original_video_url
    else: 
        # Optional: If no original video, maybe hide that element or use a default?
        # modifications["OriginalVideo"] = None # Or use Creatomate features to hide it
        logging.info(f"[Job: {custom_job_id}][INFO] Original video URL not available, sending modifications without it.")

    # Construct the main payload using the template ID and modifications
    payload = {
        "template_id": CREATOMATE_TEMPLATE_ID,
        "modifications": modifications,
    }

    try:
        logging.info(f"[Job: {custom_job_id}] Sending render request to Creatomate using Template ID: {CREATOMATE_TEMPLATE_ID}...")
        response = requests.post(f"{CREATOMATE_API_URL}/renders", headers=headers, json=payload, timeout=30)
        
        if not response.ok:
             logging.error(f"[Job: {custom_job_id}][ERROR] Creatomate /renders responded {response.status_code}: {response.text}")
        response.raise_for_status() 

        renders = response.json()
        logging.info(f"[Job: {custom_job_id}] Creatomate render initiated. Response: {renders}")

        if renders and isinstance(renders, list) and len(renders) > 0:
            final_video_url = renders[0].get('url')
            if final_video_url:
                logging.info(f"[Job: {custom_job_id}] Creatomate render URL obtained: {final_video_url}")
                return final_video_url
            else:
                logging.error(f"[Job: {custom_job_id}][ERROR] Creatomate render response missing URL.")
                raise ValueError("Creatomate render response missing URL in the first element.")
        else:
            logging.error(f"[Job: {custom_job_id}][ERROR] Creatomate rendering returned unexpected response: {renders}")
            raise RuntimeError(f"Creatomate rendering returned unexpected response: {renders}")

    except requests.exceptions.RequestException as e:
        logging.error(f"[Job: {custom_job_id}][ERROR] Creatomate API Request Error: {e}")
        # Consider returning None or re-raising a specific error
        return None 
    except Exception as e:
        logging.error(f"[Job: {custom_job_id}][ERROR] Unexpected error during Creatomate processing: {e}")
        return None 

def verify_url_accessible(url: str, timeout_seconds: int = 120, check_interval: int = 10) -> bool:
    """Polls a URL with HEAD requests until it gets a 2xx status or times out."""
    logging.info(f"Verifying URL accessibility: {url} (Timeout: {timeout_seconds}s, Interval: {check_interval}s)")
    start_time = time.time()
    while time.time() - start_time < timeout_seconds:
        try:
            # Use HEAD request to avoid downloading the whole file
            # Increased request timeout slightly as well
            response = requests.head(url, timeout=15, allow_redirects=True)
            if 200 <= response.status_code < 300:
                logging.info(f"URL is accessible (Status: {response.status_code}).")
                return True
            else:
                logging.warning(f"URL check failed (Status: {response.status_code}), retrying in {check_interval}s...")

        except requests.exceptions.Timeout:
            logging.warning(f"URL check request timed out, retrying in {check_interval}s...")
        except requests.exceptions.RequestException as e:
            logging.warning(f"URL check error: {e}, retrying in {check_interval}s...")
        
        time.sleep(check_interval)
        
    logging.error(f"[ERROR] URL verification timed out after {timeout_seconds} seconds.")
    return False

def update_job_status(job_id: str, status_data: dict, user_id: Optional[str] = None):
    """Updates the job status hash in Redis, optionally including user_id."""
    try:
        status_key = f"job_status:{job_id}"
        
        # Add user_id to the status data if provided and not already present
        if user_id and 'user_id' not in status_data:
            status_data['user_id'] = user_id
            
        # Ensure all values are strings or primitive types suitable for Redis hash
        update_payload = {k: str(v) if v is not None else '' for k, v in status_data.items()}
            
        redis_client.hset(status_key, mapping=update_payload)
        redis_client.expire(status_key, 3600 * 24) 
        logging.info(f"[Status Update] Job {job_id}: {update_payload}")
    except redis.exceptions.RedisError as e:
        logging.error(f"[ERROR] Failed to update Redis job status for {job_id}: {e}")
    except Exception as e:
         logging.error(f"[ERROR] Unexpected error updating job status for {job_id}: {e}")

# --- Main Worker Loop --- 

# Renamed the original function
def process_continue_job(redis_message_id: str, job_data: dict):
    """Processes the continuation of a job after script review."""
    custom_job_id = job_data.get('job_id')
    if not custom_job_id:
        logging.error("[ERROR] process_continue_job missing custom_job_id.")
        return

    logging.info(f"\n--- Continuing Job ID: {custom_job_id} (Redis Msg ID: {redis_message_id}) ---")
    user_id = None
    thumbnail_url = None
    try:
        status_key = f"job_status:{custom_job_id}"
        saved_status = redis_client.hgetall(status_key)
        if not saved_status:
            raise ValueError(f"No status found in Redis for job {custom_job_id}")
        if isinstance(next(iter(saved_status.values())), bytes):
            saved_status = {k.decode('utf-8'): v.decode('utf-8') for k, v in saved_status.items()}
        user_id = saved_status.get('user_id')
        if not user_id:
            raise ValueError(f"Missing user_id in saved status for job {custom_job_id}")
        script = job_data.get('script')
        if not script:
            raise ValueError(f"Missing 'script' in continue job data for job {custom_job_id}")
        avatar_s3_key = saved_status.get('avatar_s3_key')
        if not avatar_s3_key:
            raise ValueError(f"Missing 'avatar_s3_key' in saved status for job {custom_job_id}")
        video_s3_key = saved_status.get('video_s3_key')
        thumbnail_url = saved_status.get('thumbnail_url')
        voice_id = job_data.get('voice_id')
        logging.info(f"Retrieved Data - User: {user_id}, Avatar: {avatar_s3_key}, Video: {video_s3_key}, Voice: {voice_id}")
        logging.info(f"Using Script: {script[:100]}...")
        # Only LemonSlice and Creatomate are called here, never any summarization or moderation.
        def get_user_credits(user_id):
            response = supabase.table('profiles').select('credits').eq('id', user_id).maybe_single().execute()
            return response.data.get('credits', 0) if response.data else 0
        current_credits = get_user_credits(user_id)
        if current_credits <= 0:
            try:
                update_job_status(custom_job_id, {"status": "failed", "error_message": "Insufficient credits.", "stage": "error"}, user_id)
            except Exception as e:
                logging.error(f"[ERROR] Failed to update status to failed for insufficient credits: {e}")
            logging.info(f"[WORKER][CREDITS] User {user_id} has insufficient credits. Job {custom_job_id} failed.")
            return
        supabase.table('profiles').update({'credits': current_credits - 1}).eq('id', user_id).execute()
        logging.info(f"[WORKER][CREDITS] Deducted 1 credit from user {user_id} for job {custom_job_id}.")
        try:
            update_job_status(custom_job_id, {"stage": "lip_syncing"})
        except Exception as e:
            logging.error(f"[ERROR] Failed to update status to lip_syncing: {e}")
        lemon_slice_video_url = call_lemon_slice(avatar_s3_key, script, voice_id, custom_job_id)
        if not lemon_slice_video_url:
            logging.error(f"[Job: {custom_job_id}][ERROR] Lemon Slice video generation failed.")
            raise ValueError("Failed to generate Lemon Slice video.")
        try:
            update_job_status(custom_job_id, {"stage": "rendering_final"})
        except Exception as e:
            logging.error(f"[ERROR] Failed to update status to rendering_final: {e}")
        final_video_url = call_creatomate(
            lemon_slice_video_url=lemon_slice_video_url,
            original_video_s3_key=video_s3_key,
            script_text=script,
            custom_job_id=custom_job_id
        )
        if not final_video_url:
            logging.error(f"[Job: {custom_job_id}][ERROR] Creatomate video rendering failed.")
            raise ValueError("Failed to render final video with Creatomate.")
        try:
            update_job_status(custom_job_id, {"stage": "verifying_url"})
        except Exception as e:
            logging.error(f"[ERROR] Failed to update status to verifying_url: {e}")
        if not verify_url_accessible(final_video_url):
            raise RuntimeError("Generated video URL did not become accessible.")
        logging.info(f"Job {custom_job_id} completed successfully. Final URL: {final_video_url}")

        # Update Redis job status to completed with final URL before saving to Supabase
        try:
            update_job_status(custom_job_id, {
                "status": "completed", 
                "stage": "finished",
                "final_url": final_video_url
            })
            logging.info(f"Updated job status to completed with final URL for job {custom_job_id}")
        except Exception as e:
            logging.error(f"[ERROR] Failed to update final job status for job {custom_job_id}: {e}")
        
        try:
            insert_data = {
                "user_id": user_id,
                "video_url": final_video_url,
                "job_id": custom_job_id,
                "title": "Untitled Video",
                "thumbnail_url": thumbnail_url if thumbnail_url and thumbnail_url.strip() else None
            }
            db_response = supabase.table("generated_videos").insert(insert_data).execute()
            if db_response.data:
                logging.info(f"Successfully saved video details to Supabase for job {custom_job_id}")
            else:
                logging.error(f"[ERROR] Failed to save video details to Supabase for job {custom_job_id}. Response: {db_response}")
        except APIError as e:
            logging.error(f"[ERROR] Supabase API Error saving video details for job {custom_job_id}: {e}")
        except Exception as e:
            logging.error(f"[ERROR] Unexpected error saving video details to Supabase for job {custom_job_id}: {e}")
    except Exception as e:
        error_message = f"Continue Job failed: {type(e).__name__} - {str(e)}"
        logging.error(f"[ERROR] {error_message}")
        fail_user_id = user_id if 'user_id' in locals() and user_id else None
        try:
            update_job_status(custom_job_id, {"status": "failed", "error_message": str(e), "stage": "error"}, fail_user_id)
        except Exception as ex:
            logging.error(f"[ERROR] Failed to update status to failed in exception handler: {ex}")

def process_new_job(redis_message_id: str, job_data_str: str):
    """Processes the initial part of a job: Upload -> Script Gen -> Stop for Review."""
    logging.info(f"\n[WORKER_NEW_JOB] --- Starting to process NEW job from Redis Stream. Message ID: {redis_message_id} ---") # Log entry
    logging.info(f"[WORKER_NEW_JOB] Raw job_data_str from stream: {job_data_str}") # Log raw data
    custom_job_id = None 
    user_id = None
    thumbnail_url = None # Initialize thumbnail_url for the job scope
    
    try:
        job_data = json.loads(job_data_str)
        user_id = job_data.get('user_id') # Use .get for safety
        custom_job_id = job_data.get('job_id') 
        logging.info(f"[WORKER_NEW_JOB] Parsed job_data. User ID: {user_id}, Custom Job ID: {custom_job_id}") # Log parsed IDs
        
        if not user_id:
             logging.error(f"[WORKER_NEW_JOB][ERROR] Job data missing required 'user_id'. Message ID: {redis_message_id}") # Log error
             # Do not raise immediately, try to update status as 'error_parsing' if custom_job_id is available
             if custom_job_id:
                 update_job_status(custom_job_id, {"status": "error", "stage": "parsing_payload", "error_message": "Missing user_id"}, "SYSTEM_ERROR")
             return # Exit if essential data is missing

        if not custom_job_id:
             logging.error(f"[WORKER_NEW_JOB][ERROR] Job data missing required 'job_id'. Message ID: {redis_message_id}") # Log error
             # If job_id is missing, we can't reliably update status. Acknowledge and exit.
             # update_job_status(redis_message_id, {"status": "error", "stage": "parsing_payload", "error_message": "Missing job_id"}, user_id if user_id else "SYSTEM_ERROR") # Cannot do this without job_id
             return # Exit if essential data is missing

        # --- BEGIN TEMPORARY DEBUGGING STATUS UPDATE ---
        logging.info(f"[WORKER_NEW_JOB][DEBUG] Attempting PRELIMINARY status update for job_id: {custom_job_id}")
        update_job_status(custom_job_id, {"status": "received_by_worker", "stage": "initial_parse_complete", "redis_message_id": redis_message_id}, user_id)
        logging.info(f"[WORKER_NEW_JOB][DEBUG] PRELIMINARY status update for job_id: {custom_job_id} attempted.")
        # --- END TEMPORARY DEBUGGING STATUS UPDATE ---

        # Initial status update (this was the original one, now serves as a second update)
        logging.info(f"[WORKER_NEW_JOB] Attempting to write 'processing' status for job {custom_job_id}: {{'status': 'processing', 'stage': 'starting', 'user_id': '{user_id}'}}") # Log status update
        update_job_status(custom_job_id, {"status": "processing", "stage": "starting"}, user_id)
        logging.info(f"[WORKER_NEW_JOB] Successfully wrote 'processing' status for job {custom_job_id}.") # Log success
        
        video_s3_key = job_data.get('video_s3_key') 
        avatar_s3_key = job_data.get('avatar_s3_key')
        manual_script_mode = job_data.get('manual_script_mode', False)
        logging.info(f"[WORKER_NEW_JOB] manual_script_mode: {manual_script_mode} (type: {type(manual_script_mode)})")
        
        if not avatar_s3_key:
             logging.error(f"[WORKER_NEW_JOB][ERROR] Job data for {custom_job_id} missing required 'avatar_s3_key'.") # Log error
             raise ValueError("Job data missing required 'avatar_s3_key'")
        logging.info(f"[WORKER_NEW_JOB] Job {custom_job_id} details - User ID: {user_id}, Video Key: {video_s3_key}, Avatar Key: {avatar_s3_key}") # Log details

        # --- Pipeline Steps up to Script Generation --- 
        script = None
        summary = None # Initialize summary
        if manual_script_mode:
            logging.info(f"[WORKER_NEW_JOB] Manual script mode enabled. Skipping all video analysis and script generation. Proceeding to script review with empty script.")
            script = ""
            thumbnail_url = None
        elif video_s3_key:
            # Only call Twelve Labs if NOT manual_script_mode
            logging.info(f"[WORKER_NEW_JOB] Job {custom_job_id}: Starting video summarization.")
            try:
                update_job_status(custom_job_id, {"stage": "summarizing"})
            except Exception as e:
                logging.error(f"[ERROR] Failed to update status to summarizing: {e}")
            video_url = get_s3_presigned_url(AWS_S3_BUCKET_NAME, video_s3_key)
            if not video_url:
                logging.error(f"[WORKER_NEW_JOB][ERROR] Job {custom_job_id}: Failed to get S3 presigned URL for input video {video_s3_key}.")
                raise ValueError("Failed to get S3 presigned URL for input video.")
            summary, thumbnail_url = call_twelve_labs_summarize(video_url, custom_job_id)
            if summary is None:
                logging.error(f"[Job: {custom_job_id}][ERROR] Twelve Labs summarization failed. Cannot generate script.")
                raise ValueError("Failed to get video summary from Twelve Labs.")
            logging.info(f"[WORKER_NEW_JOB] Job {custom_job_id}: Video summarization complete. Summary length: {len(summary) if summary else 0}")
            try:
                update_job_status(custom_job_id, {"stage": "generating_script"})
            except Exception as e:
                logging.error(f"[ERROR] Failed to update status to generating_script: {e}")
            script = generate_script(summary, user_id, custom_job_id)
            logging.info(f"[WORKER_NEW_JOB] Job {custom_job_id}: Script generation from summary complete. Script length: {len(script) if script else 0}")
        else:
            # Avatar-only flow: Generate default script
            logging.info(f"[WORKER_NEW_JOB][INFO] Job {custom_job_id}: Video S3 key not provided. Generating default script.") # Log info
            update_job_status(custom_job_id, {"stage": "generating_script"}) # Update stage
            script = "Hello from ReMerge AI! This video was generated using just an avatar."
            thumbnail_url = None # No thumbnail for avatar-only
            logging.info(f"[WORKER_NEW_JOB] Job {custom_job_id}: Default script generated.") # Log step result

        # --- Stop for Review ---
        logging.info(f"[WORKER_NEW_JOB] Job {custom_job_id} paused for script review. Storing to Redis.") # Log step
        update_job_status(custom_job_id, {
            "status": "pending_review", 
            "stage": "script_ready_for_review",
            "generated_script": script, 
            "avatar_s3_key": avatar_s3_key, # Save needed keys for continuation
            "video_s3_key": video_s3_key if video_s3_key else "", # Save optional key
            "thumbnail_url": thumbnail_url if thumbnail_url and thumbnail_url.strip() else None, # Save optional thumbnail
            "summary": summary if summary else "" # Save summary for context if available
        }, user_id)
        logging.info(f"[WORKER_NEW_JOB] Job {custom_job_id}: Status updated to pending_review in Redis.") # Log step result

    except Exception as e:
        error_message = f"New Job failed: {type(e).__name__} - {str(e)}"
        # Ensure custom_job_id is defined for logging, even if parsing failed early
        job_id_for_status_log = custom_job_id if custom_job_id else redis_message_id
        logging.error(f"[WORKER_NEW_JOB][ERROR] Processing for job {job_id_for_status_log} failed: {error_message}") # Log error
        
        # Log full traceback for better debugging
        import traceback
        logging.error(f"[WORKER_NEW_JOB][TRACEBACK] for job {job_id_for_status_log}:")
        logging.error(traceback.format_exc())
        
        # Ensure user_id is available for failure update, even if parsing failed
        fail_user_id = user_id if 'user_id' in locals() and user_id else None
        update_job_status(job_id_for_status_log, {"status": "failed", "error_message": str(e), "stage": "error"}, fail_user_id)
        logging.error(f"[WORKER_NEW_JOB] Job {job_id_for_status_log} status updated to failed in Redis.") # Log error status update
        # Do not re-raise, allow worker to acknowledge and continue

if __name__ == "__main__":
    logging.info("Starting worker...")
    # Check Redis connection on startup
    try:
        # Now REDIS_URL and MEME_JOB_STREAM are in scope
        logging.info(f"Worker attempting to connect to Redis at {REDIS_URL.replace('://', '://*:*@').split('@')[-1]} and listen to stream '{MEME_JOB_STREAM}'...")
        redis_client.ping()
        logging.info(f"Worker successfully connected to Redis. Listening to stream '{MEME_JOB_STREAM}'.")
        
        # Debug: Check if stream exists and has entries
        try:
            stream_info = redis_client.xinfo_stream(MEME_JOB_STREAM)
            logging.info(f"[DEBUG] Stream info: Length={stream_info.get('length')}, First entry ID={stream_info.get('first-entry')[0] if stream_info.get('first-entry') else 'none'}")
        except redis.exceptions.ResponseError as e:
            if "no such key" in str(e).lower():
                logging.info(f"[DEBUG] Stream '{MEME_JOB_STREAM}' does not exist yet. Will be created when first job arrives.")
            else:
                logging.info(f"[DEBUG] Error checking stream info: {e}")
    except redis.exceptions.ConnectionError as e:
        logging.critical(f"FATAL: Worker could not connect to Redis. Exiting. Error: {e}")
        exit(1)

    # Use a unique consumer ID for this worker instance
    consumer_name = f"worker-{os.getpid()}"
    group_name = "meme_job_consumers"

    # Ensure the consumer group exists
    try:
        redis_client.xgroup_create(MEME_JOB_STREAM, group_name, id='$', mkstream=True)
        logging.info(f"Consumer group '{group_name}' created or already exists.")
    except redis.exceptions.ResponseError as e:
        if "BUSYGROUP Consumer Group name already exists" not in str(e):
            logging.error(f"Error creating/checking consumer group: {e}")
            # Decide if fatal or not
        else:
             logging.info(f"Consumer group '{group_name}' already exists.")

    while True:
        try:
            logging.debug("[DEBUG] Waiting for new jobs...")
            # Read from the stream, block for up to 5 seconds if no new messages
            # '>' means read new messages not yet delivered to this group
            # Use count=1 to process one job at a time
            response = redis_client.xreadgroup(
                group_name, 
                consumer_name, 
                {MEME_JOB_STREAM: '>'}, 
                count=1, 
                block=5000 # Block for 5000ms (5 seconds)
            )

            if not response:
                pending = redis_client.xpending(MEME_JOB_STREAM, group_name)
                if pending and isinstance(pending, dict) and pending.get('count', 0) > 0:
                    logging.debug(f"[DEBUG] {pending['count']} pending jobs found. Oldest: {pending.get('min')}, newest: {pending.get('max')}")
                continue

            # Response format: [[stream_name, [[message_id, {field: value}]]]]
            stream_name, messages = response[0]
            message_id, message_data_bytes = messages[0]

            logging.info(f"\nReceived Job - Stream: {stream_name}, Message ID: {message_id}")
            
            # message_data_bytes should already be decoded by redis-py
            message_data = message_data_bytes 

            # Extract job data string and job type
            job_data_str = message_data.get('job_data')
            job_type = message_data.get('job_type', 'new') # Default to 'new' if type is missing

            if not job_data_str:
                 logging.error(f"[ERROR] Message {message_id} missing 'job_data'. Skipping and Acknowledging.")
                 redis_client.xack(MEME_JOB_STREAM, group_name, message_id)
                 continue

            # Dispatch based on job_type
            if job_type == 'continue':
                 # Parse job_data string for continue job
                 job_data_dict = json.loads(job_data_str) 
                 process_continue_job(message_id, job_data_dict)
            elif job_type == 'new':
                 process_new_job(message_id, job_data_str)
            else:
                 logging.warning(f"[WARN] Unknown job_type '{job_type}' for message {message_id}. Treating as 'new'.")
                 process_new_job(message_id, job_data_str) # Fallback to new job processing

            redis_client.xack(MEME_JOB_STREAM, group_name, message_id)
            logging.info(f"Acknowledged job {message_id}.")

        except redis.exceptions.ConnectionError as e:
            logging.error(f"Redis connection error in main loop: {e}. Attempting to reconnect...")
            time.sleep(5) # Wait before retrying connection/read
        except Exception as e:
            logging.error(f"Unexpected error in worker loop: {e}", exc_info=True)
            # No longer need to manually print traceback if exc_info=True is used with logging.error or logging.exception
            time.sleep(2) # Brief pause before trying again

 
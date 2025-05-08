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

from redis_client import redis_client, MEME_JOB_STREAM # Use the shared client

# Load environment variables from the script's directory
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=dotenv_path)

# --- Configuration --- 
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
print(f"[DEBUG] Loaded OPENAI_API_KEY: '{OPENAI_API_KEY[:5]}...{OPENAI_API_KEY[-4:] if OPENAI_API_KEY else 'Not Loaded or Empty'}'")
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
    print("Error: OPENAI_API_KEY not found in environment variables.")
    exit(1)
if not TWELVE_LABS_API_KEY:
    print("Error: TWELVE_LABS_API_KEY not found in environment variables.")
    exit(1)
if not AWS_S3_BUCKET_NAME:
     print("Error: AWS_S3_BUCKET_NAME not found in environment variables.")
     exit(1)
if not LEMON_SLICE_API_KEY:
    print("Warning: LEMON_SLICE_API_KEY not found in environment variables. Lip sync step will fail.")
    # Decide if this is fatal depending on if Lemon Slice is core
if not CREATOMATE_API_KEY:
    print("Warning: CREATOMATE_API_KEY not found. Video rendering step will fail.")
if not BRANDED_OUTRO_IMAGE_URL:
     print("Warning: BRANDED_OUTRO_IMAGE_URL not found. Outro cannot be added.")
if not CREATOMATE_TEMPLATE_ID:
     print("Warning: CREATOMATE_TEMPLATE_ID not found. Video rendering will use basic sequence fallback (if implemented) or fail.")

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
        print(f"Error generating presigned S3 URL for {key}: {e}")
        return None

def call_twelve_labs_summarize(video_url: str, job_id: str) -> tuple[str, Optional[str]]:
    """Calls Twelve Labs API to index and summarize a video using a persistent index."""
    headers = {
        "x-api-key": TWELVE_LABS_API_KEY
    }
    
    # Use a single persistent index
    index_name = "default_meme_index"
    index_id = None
    index_was_created = False

    # 1. Check if the persistent index exists
    try:
        print(f"Checking for index: {index_name}")
        list_params = {"index_name": index_name}
        indexes_response = requests.get(f"{TWELVE_LABS_API_URL}/indexes", headers=headers, params=list_params)
        indexes_response.raise_for_status()
        indexes_data = indexes_response.json().get('data', [])
        
        if indexes_data:
            # Found the index
            default_index = indexes_data[0] # Assuming name filter returns unique or first is fine
            index_id = default_index.get('_id')
            print(f"Found existing index '{index_name}' with ID: {index_id}")
        else:
            # Index not found, proceed to create it
            print(f"Index '{index_name}' not found. Creating...")
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
                print(f"Successfully created index '{index_name}' with ID: {index_id}")
                index_was_created = True # Flag that we just created it
            except requests.exceptions.HTTPError as http_err:
                if http_err.response.status_code == 409:
                    # Conflict: Highly unlikely if check above worked, but handle defensively
                    print(f"Index '{index_name}' already exists (409 Conflict during creation attempt). Refetching...")
                    # Refetch specifically by name again
                    refetch_response = requests.get(f"{TWELVE_LABS_API_URL}/indexes", headers=headers, params=list_params)
                    refetch_response.raise_for_status()
                    refetch_data = refetch_response.json().get('data', [])
                    if refetch_data:
                        index_id = refetch_data[0].get('_id')
                        print(f"Found existing index ID after 409: {index_id}")
                    else:
                         raise ValueError(f"Failed to find index '{index_name}' even after 409 conflict.")
                else:
                    # Re-raise other HTTP errors
                    print(f"HTTP error creating index '{index_name}': {http_err} - {http_err.response.text}")
                    raise ConnectionError(f"Twelve Labs Index Creation Error: {http_err}") from http_err

        # If we just created the index, give it time to provision
        if index_was_created:
            print(f"[DEBUG] Waiting 5 seconds after creating index '{index_name}' for provisioning...")
            time.sleep(5)

        if not index_id:
            raise ValueError(f"Failed to retrieve or create index ID for '{index_name}'.")

    except requests.exceptions.RequestException as e:
        print(f"Error checking or creating index '{index_name}': {e}")
        raise ConnectionError(f"Twelve Labs Index Management Error: {e}") from e

    # Short wait after index creation
    print(f"[DEBUG] Ensuring index is ready for video submission...")
    time.sleep(5)

    # 2. Submit video for indexing (upload by URL)
    task_files = {
        "index_id": (None, index_id),
        "video_url": (None, video_url),
        "enable_video_stream": (None, "true")
    }

    try:
        print(f"Submitting video to Twelve Labs for indexing (Index ID: {index_id})...")
        print(f"Video URL: {video_url}") 

        task_response = requests.post(
            f"{TWELVE_LABS_API_URL}/tasks",
            headers=headers,  # Only the API key header; Content-Type is set automatically
            files=task_files
        )
        
        if task_response.status_code != 200:
            # Log full response for debugging before raising
            print(f"[ERROR] Twelve Labs /tasks responded {task_response.status_code}: {task_response.text}")
            task_response.raise_for_status()
        task_id = task_response.json().get('_id')
        if not task_id:
             raise ValueError("Failed to get task ID from Twelve Labs.")
        print(f"Twelve Labs indexing task created: {task_id}")
    except requests.exceptions.RequestException as e:
        print(f"Error submitting video to Twelve Labs: {e.response.text if e.response else 'No response'}") # Log response text on error
        raise ConnectionError(f"Twelve Labs Task Submission Error: {e}") from e

    # 3. Poll task status until ready
    video_id = None
    status_endpoint = f"{TWELVE_LABS_API_URL}/tasks/{task_id}"
    max_retries = 20 # e.g., 20 * 5 seconds = 100 seconds timeout
    retries = 0
    thumbnail_url = None # Initialize thumbnail url within function scope
    while retries < max_retries:
        try:
            print(f"Checking Twelve Labs task status ({retries+1}/{max_retries})...")
            status_res = requests.get(status_endpoint, headers=headers)
            status_res.raise_for_status()
            status_data = status_res.json()
            status = status_data.get('status')
            print(f"Task status: {status}")

            if status == "ready":
                video_id = status_data.get('video_id')
                if not video_id:
                    raise ValueError("Task ready but no video_id found.")
                print(f"Video indexed successfully. Video ID: {video_id}")

                # --- Verification Step ---
                try:
                    verify_url = f"{TWELVE_LABS_API_URL}/indexes/{index_id}/videos/{video_id}"
                    print(f"[DEBUG] Verifying video metadata at: {verify_url}")
                    verify_res = requests.get(verify_url, headers=headers)
                    verify_res.raise_for_status()
                    video_metadata = verify_res.json()
                    # v1.3 migration guide says metadata is renamed to system_metadata or user_metadata
                    print(f"[DEBUG] Verified Video Metadata: system_metadata={video_metadata.get('system_metadata')}, user_metadata={video_metadata.get('user_metadata')}, hls={video_metadata.get('hls')}") 
                except requests.exceptions.RequestException as verify_err:
                    print(f"[WARN] Failed to verify video metadata for {video_id}: {verify_err}")
                except Exception as json_err:
                    print(f"[WARN] Failed to parse video metadata JSON for {video_id}: {json_err}")

                # --- Extract Thumbnail URL ---
                hls_data = video_metadata.get('hls')
                if hls_data and isinstance(hls_data, dict):
                    thumbnail_urls = hls_data.get('thumbnail_urls')
                    if thumbnail_urls and isinstance(thumbnail_urls, list) and len(thumbnail_urls) > 0:
                        thumbnail_url = thumbnail_urls[0]
                        print(f"Extracted thumbnail URL: {thumbnail_url}")
                    else:
                         print("[WARN] No thumbnail URLs found in hls data.")
                else:
                     print("[WARN] HLS data missing or not a dict in video metadata.")
                # --- End Thumbnail Extraction ---

                break # Exit polling loop once ready
            elif status in ["failed", "error"]:
                raise RuntimeError(f"Twelve Labs indexing failed: {status_data.get('process', {}).get('status')}")
            
            retries += 1
            time.sleep(5) # Wait before polling again
        except requests.exceptions.RequestException as e:
             print(f"Error polling Twelve Labs task status: {e}")
             # Allow retries on temporary polling errors
             retries += 1
             time.sleep(5)
    
    if not video_id:
        raise TimeoutError("Twelve Labs indexing timed out or failed.")

    # Add a short delay before summarizing, relying on the retry loop for robustness
    print("[DEBUG] Waiting 5 seconds before requesting summary...")
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
            print(f"Requesting summary from Twelve Labs for video ID: {video_id} (attempt {attempt})...")
            summary_response = requests.post(
                f"{TWELVE_LABS_API_URL}/summarize",
                headers=headers,
                json=summarize_payload,
                timeout=90
            )

            summary_response.raise_for_status()

            summary = summary_response.json().get('summary')
            if summary:
                print(f"Received summary: {summary[:100]}...")
                return summary, thumbnail_url
            else:
                raise ValueError("No 'summary' field in response.")
        except (requests.exceptions.RequestException, ValueError) as err:
            # Only retry if attempts remain
            print(f"[WARN] Summary attempt {attempt} failed: {err}")
            if attempt >= max_summary_attempts:
                raise  # re-raise on final failure
            print("Waiting 15s before retrying summary request...")
            time.sleep(15)

def moderate_text(text: str, user_id: str) -> bool:
    """Checks text using OpenAI Moderation API. Returns True if safe, False otherwise."""
    if not text:
        print("[WARN] Moderation received empty text. Skipping.")
        return True # Or False, depending on policy for empty inputs
    try:
        print(f"Moderating text for user {user_id}: '{text[:50]}...' ")
        response = openai_client.moderations.create(input=text, model="text-moderation-latest")
        result = response.results[0]
        if result.flagged:
            print(f"[WARN] Moderation Flagged for user {user_id}. Categories: {[cat for cat, flagged in result.categories.model_dump().items() if flagged]}")
            return False
        print("Text passed moderation.")
        return True
    except OpenAIError as e:
        print(f"[ERROR] OpenAI Moderation API error: {e}")
        # Fail safe: if moderation fails, consider it unsafe or handle differently
        return False 

def generate_script(summary: str, user_id: str) -> str:
    """Generates a meme script using OpenAI GPT-4o."""
    system_prompt = "You are a witty meme creator. Given a summary of a video, you create a funny narrator-style script spoken by one person (no brackets or colons - the text should be fully speakable), suitable for a talking head meme."
    user_prompt = f"Video Summary:\n```\n{summary}\n```\nGenerate a short, funny meme script based on this summary:"

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
            raise ValueError("GPT generated an empty script.")
        print(f"Generated script: {script[:100]}...")
        return script
    except OpenAIError as e:
        print(f"OpenAI GPT API error: {e}")
        raise ConnectionError(f"OpenAI API Error: {e}") from e
    except (IndexError, KeyError, AttributeError) as e:
        print(f"Error parsing GPT response: {e}")
        raise ValueError(f"Could not parse script from OpenAI: {e}") from e

def call_lemon_slice(avatar_image_s3_key: str, script_text: str, voice_id: Optional[str] = None) -> str:
    """
    Calls the Lemon Slice API to generate a talking head video.
    - Needs the S3 key for the user's uploaded avatar image.
    - Needs the generated script text.
    - Accepts an optional voice_id.
    - Returns a URL to the generated talking head video upon completion.
    """
    print(f"--- Calling Lemon Slice API ---")
    print(f"Avatar S3 Key: {avatar_image_s3_key}")
    print(f"Script: {script_text[:100]}...")
    print(f"Voice ID: {voice_id if voice_id else 'Default (Sam)'}")
    
    if not LEMON_SLICE_API_KEY:
        print("Lemon Slice API Key missing, cannot proceed.")
        raise ValueError("Lemon Slice API Key not configured.")

    # 1. Get a readable URL for the avatar image
    avatar_url = get_s3_presigned_url(AWS_S3_BUCKET_NAME, avatar_image_s3_key)
    if not avatar_url:
        raise ValueError(f"Could not get presigned URL for avatar: {avatar_image_s3_key}")
    print(f"Got presigned S3 URL for avatar: {avatar_url[:100]}...")
        
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
        print(f"Submitting generation request to Lemon Slice...")
        response = requests.post(lemon_slice_generate_endpoint, headers=headers, json=payload, timeout=30)
        
        if not response.ok:
            print(f"[ERROR] Lemon Slice /generate responded {response.status_code}: {response.text}")
        response.raise_for_status() # Check for HTTP errors
        
        response_data = response.json()
        job_id = response_data.get('job_id') # Assuming the response contains a job_id
        if not job_id:
             # If no job_id, maybe it failed synchronously or structure is different
             print(f"[WARN] Lemon Slice /generate response missing job_id: {response_data}")
             # Try to get a video URL directly if available (unlikely for async)
             direct_url = response_data.get('video_url')
             if direct_url:
                 print("Lemon Slice returned URL directly.")
                 return direct_url
             else:
                 raise ValueError("Lemon Slice did not return job_id or video_url.")
                 
        print(f"Lemon Slice generation job submitted. Job ID: {job_id}")

    except requests.exceptions.RequestException as e:
        print(f"Lemon Slice /generate request error: {e}")
        raise ConnectionError(f"Lemon Slice API Error (Submit): {e}") from e
    except Exception as e:
         print(f"Error parsing Lemon Slice /generate response: {e}")
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
            
            print(f"Checking Lemon Slice job status ({retries+1}/{max_retries})... Job ID: {job_id}")
            status_response = requests.get(status_endpoint, headers=headers, timeout=15)
            
            if status_response.status_code == 404:
                 # Job might not be findable immediately after creation
                 print("[WARN] Lemon Slice job not found yet (404), retrying...")
                 retries += 1
                 time.sleep(5) # Wait longer if 404
                 continue
            
            if not status_response.ok:
                print(f"[ERROR] Lemon Slice /generations/{job_id} responded {status_response.status_code}: {status_response.text}")
            status_response.raise_for_status()

            status_data = status_response.json()
            status = status_data.get('status')
            print(f"Lemon Slice Job Status: {status}")

            if status == "completed":
                final_video_url = status_data.get('video_url')
                if not final_video_url:
                     raise ValueError("Lemon Slice job completed but no video_url found.")
                print(f"Lemon Slice generation complete! Video URL: {final_video_url}")
                break # Exit polling loop
            elif status == "failed":
                error_message = status_data.get('error_message', 'Unknown error')
                raise RuntimeError(f"Lemon Slice generation failed: {error_message}")
            elif status in ["processing", "queued", "pending"]: # Assumed statuses
                # Continue polling
                pass
            else:
                print(f"[WARN] Unknown Lemon Slice job status received: {status}")
                # Continue polling cautiously

            retries += 1
            time.sleep(5) # Wait 5 seconds before polling again
        
        except requests.exceptions.RequestException as e:
            print(f"Error polling Lemon Slice job status: {e}")
            # Allow retries on temporary polling errors
            retries += 1
            time.sleep(5)
    
    if not final_video_url:
        raise TimeoutError("Lemon Slice generation timed out or failed to complete.")

    return final_video_url

def call_creatomate(lemon_slice_video_url: str, original_video_s3_key: Optional[str], script_text: str) -> str:
    """
    Uses Creatomate REST API (via requests) and a Template ID 
    to generate the final video with split screen, subtitles, and outro.
    Returns the URL of the final rendered video after verifying it's accessible.
    """
    print("--- Calling Creatomate REST API using Template ---")
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
             print(f"[WARN] Could not get presigned URL for original video {original_video_s3_key}. It might not appear.")
             # Decide if this should be a fatal error
             # raise ValueError(f"Could not get presigned URL for original video: {original_video_s3_key}")
        else:
             print(f"Got presigned S3 URL for original video: {original_video_url[:100]}...")

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
        print("[INFO] Original video URL not available, sending modifications without it.")

    # Construct the main payload using the template ID and modifications
    payload = {
        "template_id": CREATOMATE_TEMPLATE_ID,
        "modifications": modifications,
    }

    try:
        print(f"Sending render request to Creatomate using Template ID: {CREATOMATE_TEMPLATE_ID}...")
        response = requests.post(f"{CREATOMATE_API_URL}/renders", headers=headers, json=payload, timeout=30)
        
        if not response.ok:
             print(f"[ERROR] Creatomate /renders responded {response.status_code}: {response.text}")
        response.raise_for_status() 

        renders = response.json()
        print(f"Creatomate render initiated. Response: {renders}")

        if renders and isinstance(renders, list) and len(renders) > 0:
            final_video_url = renders[0].get('url')
            if final_video_url:
                print(f"Creatomate render URL obtained: {final_video_url}")
                return final_video_url
            else:
                raise ValueError("Creatomate render response missing URL in the first element.")
        else:
            raise RuntimeError(f"Creatomate rendering returned unexpected response: {renders}")

    except requests.exceptions.RequestException as e:
        print(f"Creatomate API Request Error: {e}")
        raise ConnectionError(f"Creatomate API Request Error: {e}") from e
    except Exception as e:
        print(f"Unexpected error during Creatomate processing: {e}")
        raise

def verify_url_accessible(url: str, timeout_seconds: int = 120, check_interval: int = 10) -> bool:
    """Polls a URL with HEAD requests until it gets a 2xx status or times out."""
    print(f"Verifying URL accessibility: {url} (Timeout: {timeout_seconds}s, Interval: {check_interval}s)")
    start_time = time.time()
    while time.time() - start_time < timeout_seconds:
        try:
            # Use HEAD request to avoid downloading the whole file
            # Increased request timeout slightly as well
            response = requests.head(url, timeout=15, allow_redirects=True)
            if 200 <= response.status_code < 300:
                print(f"URL is accessible (Status: {response.status_code}).")
                return True
            else:
                print(f"URL check failed (Status: {response.status_code}), retrying in {check_interval}s...")

        except requests.exceptions.Timeout:
            print(f"URL check request timed out, retrying in {check_interval}s...")
        except requests.exceptions.RequestException as e:
            print(f"URL check error: {e}, retrying in {check_interval}s...")
        
        time.sleep(check_interval)
        
    print(f"[ERROR] URL verification timed out after {timeout_seconds} seconds.")
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
        print(f"[Status Update] Job {job_id}: {update_payload}")
    except redis.exceptions.RedisError as e:
        print(f"[ERROR] Failed to update Redis job status for {job_id}: {e}")
    except Exception as e:
         print(f"[ERROR] Unexpected error updating job status for {job_id}: {e}")

# --- Main Worker Loop --- 

# Renamed the original function
def process_continue_job(redis_message_id: str, job_data: dict):
    """Processes the continuation of a job after script review."""
    custom_job_id = job_data.get('job_id')
    if not custom_job_id:
        print("[ERROR] process_continue_job missing custom_job_id.")
        # Acknowledge message to prevent loop, but mark as failed?
        return # Cannot proceed without job ID

    print(f"\n--- Continuing Job ID: {custom_job_id} (Redis Msg ID: {redis_message_id}) ---")
    user_id = None # Need user_id for updates
    thumbnail_url = None
    try:
        # 1. Retrieve necessary data from Redis status hash
        status_key = f"job_status:{custom_job_id}"
        saved_status = redis_client.hgetall(status_key)
        if not saved_status:
            raise ValueError(f"No status found in Redis for job {custom_job_id}")
        
        # Check if we need to decode bytes - some Redis clients return bytes, others return strings
        if isinstance(next(iter(saved_status.values())), bytes):
            # Decode bytes from Redis hash
            saved_status = {k.decode('utf-8'): v.decode('utf-8') for k, v in saved_status.items()}
        
        user_id = saved_status.get('user_id')
        if not user_id:
             raise ValueError(f"Missing user_id in saved status for job {custom_job_id}")
             
        script = job_data.get('script') # Get the (potentially edited) script from the new message
        if not script:
            raise ValueError(f"Missing 'script' in continue job data for job {custom_job_id}")
            
        avatar_s3_key = saved_status.get('avatar_s3_key')
        if not avatar_s3_key:
            raise ValueError(f"Missing 'avatar_s3_key' in saved status for job {custom_job_id}")

        video_s3_key = saved_status.get('video_s3_key') # Optional original video
        thumbnail_url = saved_status.get('thumbnail_url') # Retrieve saved thumbnail
        voice_id = job_data.get('voice_id') # Get selected voice_id

        print(f"Retrieved Data - User: {user_id}, Avatar: {avatar_s3_key}, Video: {video_s3_key}, Voice: {voice_id}")
        print(f"Using Script: {script[:100]}...")

        # --- Start processing from Moderation/Lip Sync ---
        
        # Moderate the final script
        update_job_status(custom_job_id, {"stage": "moderating_final_script"})
        if not moderate_text(script, user_id):
            raise RuntimeError("Final script flagged by moderation.")

        # Lip Sync (Lemon Slice) - Pass voice_id
        update_job_status(custom_job_id, {"stage": "lip_syncing"})
        # Pass custom_job_id and user_id to call_lemon_slice for progress updates (needs modification)
        lemon_slice_video_url = call_lemon_slice(avatar_s3_key, script, voice_id)
        
        # Render Final Video (Creatomate)
        update_job_status(custom_job_id, {"stage": "rendering_final"})
        final_video_url = call_creatomate(
            lemon_slice_video_url=lemon_slice_video_url, 
            original_video_s3_key=video_s3_key, 
            script_text=script
        )

        # Verify URL Accessibility
        update_job_status(custom_job_id, {"stage": "verifying_url"})
        if not verify_url_accessible(final_video_url):
             raise RuntimeError("Generated video URL did not become accessible.")

        # Success
        print(f"Job {custom_job_id} completed successfully. Final URL: {final_video_url}")
        # Include thumbnail_url when updating final status
        update_job_status(custom_job_id, {
            "status": "completed", 
            "final_url": final_video_url, 
            "thumbnail_url": thumbnail_url, # Pass thumbnail URL
            "stage": "done"
        }, user_id)

        # Save result to Supabase
        try:
            insert_data = {
                "user_id": user_id,
                "video_url": final_video_url,
                "job_id": custom_job_id,
                "title": "Untitled Video", 
                "thumbnail_url": thumbnail_url # Save thumbnail URL
            }
            db_response = supabase.table("generated_videos").insert(insert_data).execute()
            if db_response.data:
                 print(f"Successfully saved video details to Supabase for job {custom_job_id}")
            else:
                 print(f"[ERROR] Failed to save video details to Supabase for job {custom_job_id}. Response: {db_response}")
        except APIError as e:
            print(f"[ERROR] Supabase API Error saving video details for job {custom_job_id}: {e}")
        except Exception as e:
             print(f"[ERROR] Unexpected error saving video details to Supabase for job {custom_job_id}: {e}")

    except Exception as e:
        error_message = f"Continue Job failed: {type(e).__name__} - {str(e)}"
        print(f"[ERROR] {error_message}")
        # Ensure user_id is available for failure update if retrieved
        fail_user_id = user_id if 'user_id' in locals() and user_id else None 
        update_job_status(custom_job_id, {"status": "failed", "error_message": str(e), "stage": "error"}, fail_user_id)

def process_new_job(redis_message_id: str, job_data_str: str):
    """Processes the initial part of a job: Upload -> Script Gen -> Stop for Review."""
    print(f"\n--- Processing NEW Job ID (Redis Msg ID): {redis_message_id} ---")
    custom_job_id = None 
    user_id = None
    thumbnail_url = None # Initialize thumbnail_url for the job scope
    
    try:
        job_data = json.loads(job_data_str)
        user_id = job_data.get('user_id') # Use .get for safety
        custom_job_id = job_data.get('job_id') 
        
        if not user_id:
             raise ValueError("Job data missing required 'user_id'")
        if not custom_job_id:
             print("[WARN] Custom job_id missing in job_data, using Redis message ID for status key.")
             custom_job_id = redis_message_id # Fallback

        # Initial status update
        update_job_status(custom_job_id, {"status": "processing", "stage": "starting"}, user_id)
        
        video_s3_key = job_data.get('video_s3_key') 
        avatar_s3_key = job_data.get('avatar_s3_key')
        
        if not avatar_s3_key:
             raise ValueError("Job data missing required 'avatar_s3_key'")
        print(f"User ID: {user_id}, Video Key: {video_s3_key}, Avatar Key: {avatar_s3_key}")

        # --- Pipeline Steps up to Script Generation --- 
        script = None
        summary = None # Initialize summary
        if video_s3_key:
            # 1. Summarize Video (includes thumbnail extraction)
            update_job_status(custom_job_id, {"stage": "summarizing"})
            video_url = get_s3_presigned_url(AWS_S3_BUCKET_NAME, video_s3_key)
            if not video_url: raise ValueError("Failed to get S3 presigned URL for input video.")
            summary, thumbnail_url = call_twelve_labs_summarize(video_url, custom_job_id)

            # 2. Generate Script from Summary
            update_job_status(custom_job_id, {"stage": "generating_script"})
            script = generate_script(summary, user_id)
        else:
             # Avatar-only flow: Generate default script
             print("[INFO] Video S3 key not provided. Generating default script.")
             update_job_status(custom_job_id, {"stage": "generating_script"}) # Update stage
             script = "Hello from ReMerge AI! This video was generated using just an avatar." 
             thumbnail_url = None # No thumbnail for avatar-only

        # Moderate the generated script before showing to user
        update_job_status(custom_job_id, {"stage": "moderating_initial_script"})
        if not moderate_text(script, user_id):
             raise RuntimeError("Initial script flagged by moderation.")

        # --- Stop for Review ---
        print(f"Job {custom_job_id} paused for script review.")
        update_job_status(custom_job_id, {
            "status": "pending_review", 
            "stage": "script_ready_for_review",
            "generated_script": script, 
            "avatar_s3_key": avatar_s3_key, # Save needed keys for continuation
            "video_s3_key": video_s3_key if video_s3_key else "", # Save optional key
            "thumbnail_url": thumbnail_url if thumbnail_url else "", # Save optional thumbnail
            "summary": summary if summary else "" # Save summary for context if available
        }, user_id)

    except Exception as e:
        error_message = f"New Job failed: {type(e).__name__} - {str(e)}"
        print(f"[ERROR] {error_message}")
        job_id_for_status = custom_job_id if custom_job_id else redis_message_id
        # Ensure user_id is available for failure update
        fail_user_id = user_id if 'user_id' in locals() and user_id else None 
        update_job_status(job_id_for_status, {"status": "failed", "error_message": str(e), "stage": "error"}, fail_user_id)
        # Do not re-raise

if __name__ == "__main__":
    print("Starting worker...")
    # Check Redis connection on startup
    try:
        redis_client.ping()
        print(f"Worker connected to Redis. Listening to stream '{MEME_JOB_STREAM}'...")
    except redis.exceptions.ConnectionError as e:
        print(f"FATAL: Worker could not connect to Redis. Exiting. Error: {e}")
        exit(1)

    # Use a unique consumer ID for this worker instance
    consumer_name = f"worker-{os.getpid()}"
    group_name = "meme_job_consumers"

    # Ensure the consumer group exists
    try:
        redis_client.xgroup_create(MEME_JOB_STREAM, group_name, id='$', mkstream=True)
        print(f"Consumer group '{group_name}' created or already exists.")
    except redis.exceptions.ResponseError as e:
        if "BUSYGROUP Consumer Group name already exists" not in str(e):
            print(f"Error creating/checking consumer group: {e}")
            # Decide if fatal or not
        else:
             print(f"Consumer group '{group_name}' already exists.")

    while True:
        try:
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
                # print("No new jobs, waiting...") # Optional: verbose logging
                continue

            # Response format: [[stream_name, [[message_id, {field: value}]]]]
            stream_name, messages = response[0]
            message_id, message_data_bytes = messages[0]

            print(f"\nReceived Job - Stream: {stream_name}, Message ID: {message_id}")
            
            # message_data_bytes should already be decoded by redis-py
            message_data = message_data_bytes 

            # Extract job data string and job type
            job_data_str = message_data.get('job_data')
            job_type = message_data.get('job_type', 'new') # Default to 'new' if type is missing

            if not job_data_str:
                 print(f"[ERROR] Message {message_id} missing 'job_data'. Skipping and Acknowledging.")
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
                 print(f"[WARN] Unknown job_type '{job_type}' for message {message_id}. Treating as 'new'.")
                 process_new_job(message_id, job_data_str) # Fallback to new job processing

            redis_client.xack(MEME_JOB_STREAM, group_name, message_id)
            print(f"Acknowledged job {message_id}.")

        except redis.exceptions.ConnectionError as e:
            print(f"Redis connection error in main loop: {e}. Attempting to reconnect...")
            time.sleep(5) # Wait before retrying connection/read
        except Exception as e:
            print(f"Unexpected error in worker loop: {e}")
            # Decide whether to continue or exit on other errors
            time.sleep(2) # Brief pause before trying again

 
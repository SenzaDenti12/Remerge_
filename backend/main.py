from fastapi import FastAPI, Depends, HTTPException, Request, Header # Add Request, Header
from fastapi.middleware.cors import CORSMiddleware # Import CORS middleware
# Use direct import for modules in the same directory when running script directly
from auth import get_current_active_user, get_current_user_id # Import the dependency
# from gotrue.types import User # No longer directly returning User type
from typing import Dict, Optional, List # Import Dict, Optional, and List
import boto3
from botocore.exceptions import ClientError
import os
from dotenv import load_dotenv
import uuid # For generating unique object keys
from supabase_client import supabase # Import the synchronous client
from pydantic import BaseModel, Field # Import BaseModel and Field
from postgrest.exceptions import APIError
from redis_client import redis_client, MEME_JOB_STREAM
import json # For serializing job data
import stripe # Import stripe
import redis # Import redis
from worker import update_job_status # <-- Import the function
from openai import OpenAI, OpenAIError # Import OpenAI client
import time
import datetime

load_dotenv() # Ensure env vars are loaded

app = FastAPI()

# --- OpenAI Configuration ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
openai_client = OpenAI(api_key=OPENAI_API_KEY)

# --- Pydantic Models --- 
class UploadURLRequest(BaseModel):
    filename: str
    content_type: str
    upload_type: str = 'video' # Add type: 'video' or 'avatar'
    duration: Optional[float] = None # Add duration in seconds

class GenerateMemeRequest(BaseModel):
    avatar_s3_key: str # Avatar is mandatory
    video_s3_key: Optional[str] = None # Video is optional for now
    # user_script: Optional[str] = None # Add later if needed

class CheckoutSessionRequest(BaseModel):
    price_id: str
    # Add quantity or other fields if needed later

class PortalSessionRequest(BaseModel):
    customer_id: str # Need to store this in our DB later

class VideoCreation(BaseModel):
    id: uuid.UUID # Assuming the table uses UUID for id
    created_at: str # Keep as string for ISO format compatibility
    title: Optional[str] = None # Make optional for now
    url: str
    thumbnail: Optional[str] = None # Make optional for now

class PastVideosResponse(BaseModel):
    videos: List[VideoCreation]

class UpdateVideoRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=100) # Add validation

# --- New Continue Generation Endpoint --- 
class ContinueGenerationRequest(BaseModel):
    script: str = Field(..., min_length=1)
    voice_id: Optional[str] = None # Optional voice selection

# --- Script Regeneration Request ---
class RegenerateScriptRequest(BaseModel):
    current_script: str = Field(..., min_length=1)
    prompt: str = Field(..., min_length=1)
    context: Optional[str] = None # Optional context from the original summary

# --- CORS Configuration --- 
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://rmerge.com",
    "https://www.rmerge.com",
    "https://api.rmerge.com", # if you ever call the API from the API (Internal)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Allow all methods (GET, POST, PUT, etc.)
    allow_headers=["*"], # Allow all headers (including Authorization)
)

# --- AWS S3 Configuration --- 
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_S3_BUCKET_NAME = os.getenv("AWS_S3_BUCKET_NAME")
AWS_S3_REGION = os.getenv("AWS_S3_REGION", "us-east-1") # Default region if not set

# Validate AWS config
if not all([AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET_NAME]):
    print("Warning: AWS credentials or bucket name not fully configured in .env")
    # Optionally raise an error if S3 upload is critical at startup
    # raise EnvironmentError("AWS S3 credentials or bucket name missing.")

s3_client = boto3.client(
    's3',
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    region_name=AWS_S3_REGION,
    config=boto3.session.Config(signature_version='s3v4') # Required for presigned URLs
)

# --- Stripe Configuration --- 
stripe.api_key = os.getenv("STRIPE_API_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
STRIPE_PRICE_ID_CREATOR = os.getenv("STRIPE_PRICE_ID_CREATOR")
STRIPE_PRICE_ID_PRO = os.getenv("STRIPE_PRICE_ID_PRO")
STRIPE_PRICE_ID_GROWTH = os.getenv("STRIPE_PRICE_ID_GROWTH")
DOMAIN_URL = os.getenv("DOMAIN_URL", "http://localhost:3000")

# Validate Stripe config (basic)
if not stripe.api_key:
    print("Warning: STRIPE_API_KEY not found. Payment endpoints will fail.")
if not STRIPE_WEBHOOK_SECRET:
    print("Warning: STRIPE_WEBHOOK_SECRET not found. Webhook verification will fail.")
if not STRIPE_PRICE_ID_CREATOR:
    print("Warning: STRIPE_PRICE_ID_CREATOR not found. Checkout for creator plan will fail.")

# --- API Endpoints --- 

@app.get("/")
async def read_root():
    return {"message": "AI Meme Generator Backend"}

# Add a basic endpoint for testing
@app.get("/ping")
async def ping():
    return {"message": "pong"}

# Add a protected endpoint
@app.get("/api/me")
# Use the dependency. It will handle validation or return 401
async def read_users_me(user_payload: Dict = Depends(get_current_active_user)):
    # The payload contains JWT claims, including 'sub' (user_id)
    user_id = user_payload.get('sub') 
    email = user_payload.get('email') # Email might also be in the token
    return {"user_id": user_id, "email": email, "payload": user_payload}

# Example endpoint getting just the user ID
@app.get("/api/my-id")
async def read_my_id(user_id: str = Depends(get_current_user_id)):
    return {"user_id": user_id}

# --- Updated Upload URL Endpoint --- 
@app.post("/api/upload-url")
async def create_upload_url(request_body: UploadURLRequest, user_id: str = Depends(get_current_user_id)):
    """
    Generates a presigned URL for uploading either a video or avatar image.
    Requires filename, content_type, upload_type ('video' or 'avatar'), and (for video) duration in seconds in body.
    """
    filename = request_body.filename
    content_type = request_body.content_type
    upload_type = request_body.upload_type
    # Optionally get duration from request_body if present
    duration = getattr(request_body, 'duration', None)

    if upload_type not in ['video', 'avatar']:
        raise HTTPException(status_code=400, detail="Invalid upload_type. Must be 'video' or 'avatar'.")

    if not filename or not content_type:
        raise HTTPException(status_code=400, detail="Filename and content_type in body are required.")

    if '/' in filename or '\\' in filename: 
        raise HTTPException(status_code=400, detail="Invalid filename.")

    # Define allowed types and size based on upload_type
    if upload_type == 'video':
        allowed_content_types = ["video/mp4", "video/quicktime", "video/webm", "video/mov"]
        max_size_bytes = 100 * 1024 * 1024 # 100MB
        if content_type not in allowed_content_types:
            raise HTTPException(status_code=400, detail=f"Unsupported video type: {content_type}")
        if duration is not None and duration > 60:
            raise HTTPException(status_code=400, detail="Video must be 1 minute or less.")
    elif upload_type == 'avatar':
        allowed_content_types = ["image/jpeg", "image/png", "image/webp"]
        max_size_bytes = 5 * 1024 * 1024 # 5MB
        if content_type not in allowed_content_types:
           raise HTTPException(status_code=400, detail=f"Unsupported avatar image type: {content_type}")
    else:
         # Should not happen due to earlier check, but defensive
         raise HTTPException(status_code=400, detail="Invalid upload type specified.")

    # Generate a unique object key based on type
    _, file_extension = os.path.splitext(filename)
    folder = "uploads/videos" if upload_type == 'video' else "uploads/avatars"
    object_key = f"{folder}/{user_id}/{uuid.uuid4()}{file_extension}"
    
    # Conditions could also be adapted based on type if needed
    conditions = [
        {"bucket": AWS_S3_BUCKET_NAME},
        ["starts-with", "$key", f"{folder}/{user_id}/"], 
        # {"acl": "private"}, # Usually handled by bucket policy
        {"Content-Type": content_type},
        ["content-length-range", 1, max_size_bytes] 
    ]

    try:
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': AWS_S3_BUCKET_NAME,
                'Key': object_key,
                'ContentType': content_type,
            },
            ExpiresIn=3600 
        )
        return {"upload_url": presigned_url, "object_key": object_key}
    except ClientError as e:
        print(f"Error generating presigned URL: {e}")
        raise HTTPException(status_code=500, detail="Could not generate upload URL.")
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error.")

# --- Credits Endpoint --- 
async def get_user_credits(user_id: str) -> int:
    """Helper function to get current credits for a user."""
    try:
        response = supabase.table('profiles').select('credits').eq('id', user_id).maybe_single().execute()
        if response.data:
            return response.data.get('credits', 0)
        else:
            print(f"Warning: Profile not found for credit check, user {user_id}")
            return 0 # Return 0 if profile doesn't exist
    except APIError as e:
        print(f"Supabase API Error fetching credits for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error fetching credits.")
    except Exception as e:
        print(f"Error fetching credits for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Could not fetch credit balance.")

@app.get("/api/credits")
async def get_credits_endpoint(user_id: str = Depends(get_current_user_id)):
    """Fetches the current user's credits and plan."""
    credits = await get_user_credits(user_id)
    # Fetch plan
    try:
        response = supabase.table('profiles').select('subscription_plan').eq('id', user_id).maybe_single().execute()
        plan = (response.data or {}).get('subscription_plan', 'free')
    except Exception as e:
        print(f"[CREDITS] Error fetching plan for user {user_id}: {e}")
        plan = 'free'
    return {"credits": credits, "subscription": {"plan": plan}}

# --- Setup New User Profile ---
async def ensure_user_profile(user_id: str, initial_credits: int = 1) -> None:
    """
    Creates or updates a user profile with the specified number of initial credits.
    This is used to ensure new users get the correct number of free credits.
    """
    try:
        # Check if profile exists
        profile_response = supabase.table('profiles').select('id, credits, subscription_status').eq('id', user_id).maybe_single().execute()
        
        if not profile_response.data:
            # Create new profile with initial credits (always 1)
            print(f"[USER_SETUP] Creating new profile for user {user_id} with 1 credit")
            supabase.table('profiles').insert({
                'id': user_id,
                'credits': 1,
                'subscription_status': 'free'
            }).execute()
        else:
            print(f"[USER_SETUP] Profile exists for user {user_id}")
            # Get current credits
            current_credits = profile_response.data.get('credits')
            subscription_status = profile_response.data.get('subscription_status')
            # If this is a free account with exactly 3 credits (the old default), update to 1
            if current_credits == 3 and (not subscription_status or subscription_status == 'free'):
                print(f"[USER_SETUP] Updating user {user_id} from 3 credits to 1 credit (fixing old default)")
                supabase.table('profiles').update({
                    'credits': 1
                }).eq('id', user_id).execute()
    except Exception as e:
        print(f"[ERROR] Error ensuring user profile for {user_id}: {e}")
        # Don't raise exception, just log it - this is a background operation

@app.post("/api/auth/callback")
async def auth_callback(user_id: str = Depends(get_current_user_id)):
    """
    Endpoint to be called after successful authentication.
    Ensures the user has a profile with the correct initial free credits.
    """
    await ensure_user_profile(user_id, initial_credits=1)
    return {"success": True}

# --- Updated Generate Meme Endpoint --- 
@app.post("/api/generate-meme")
async def generate_meme(
    request_data: GenerateMemeRequest, # Use updated model
    user_id: str = Depends(get_current_user_id)
):
    """
    Trigger the meme generation pipeline.
    Requires avatar_s3_key, optionally video_s3_key.
    Enqueues job. Credits are now deducted in the worker, not here.
    """
    # Extract keys from the request body model
    avatar_s3_key = request_data.avatar_s3_key
    video_s3_key = request_data.video_s3_key 
    manual_script_mode = getattr(request_data, 'manual_script_mode', False)
    print(f"[API] Received manual_script_mode: {manual_script_mode} (type: {type(manual_script_mode)})")

    # 1. Prepare and Enqueue Job (including both keys)
    job_id = str(uuid.uuid4()) 
    print(f"[GENERATE_MEME] Generated job_id: {job_id} for user {user_id}") # Log job_id creation
    job_data = {
        "job_id": job_id,
        "user_id": user_id,
        "avatar_s3_key": avatar_s3_key, # Mandatory avatar key
        "video_s3_key": video_s3_key, # Optional video key
        "manual_script_mode": manual_script_mode,
        "status": "queued",
        # Add other params as needed
    }

    try:
        redis_stream_id = redis_client.xadd(MEME_JOB_STREAM, {"job_data": json.dumps(job_data)})
        print(f"[GENERATE_MEME] Enqueued job {job_id} to stream {MEME_JOB_STREAM} with Redis Stream ID: {redis_stream_id}") # Log enqueue
    except redis.exceptions.ConnectionError as e:
         print(f"[GENERATE_MEME] Redis Connection Error during enqueue for job {job_id}: {e}") # Log specific error
         raise HTTPException(status_code=503, detail="Job queue unavailable.") 
    except Exception as e:
        print(f"[GENERATE_MEME] Error enqueuing job {job_id}: {e}") # Log specific error
        raise HTTPException(status_code=500, detail="Failed to enqueue generation job.")

    # 2. Return Job ID
    print(f"[GENERATE_MEME] Returning job_id: {job_id} to frontend.") # Log job_id return
    return {"job_id": job_id, "message": "Meme generation job queued successfully."} 

# Note: Need to import get_current_active_user if it's used above
from auth import get_current_active_user

# --- Stripe Webhook Endpoint --- 
@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request, stripe_signature: Optional[str] = Header(None)):
    """Handles incoming Stripe webhook events."""
    if not stripe_signature:
        raise HTTPException(status_code=400, detail="Missing Stripe-Signature header")
    if not STRIPE_WEBHOOK_SECRET:
        # Check if secret is loaded, crucial for verification
        print("[ERROR] STRIPE_WEBHOOK_SECRET is not configured in the environment!")
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    payload = await request.body()
    try:
        # Verify the event using the secret from the environment (set from CLI output)
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        # Invalid payload
        print(f"Webhook ValueError: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature - This likely means the STRIPE_WEBHOOK_SECRET in .env doesn't match the one from 'stripe listen'
        print(f"Webhook SignatureVerificationError: {e} - Check if STRIPE_WEBHOOK_SECRET matches 'stripe listen' output!")
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        print(f"Webhook generic error: {e}")
        raise HTTPException(status_code=500, detail="Webhook processing error")

    # Handle the event
    print(f"[WEBHOOK] Received Stripe event ID: {event.id}, Type: {event.type}") # Log event ID and Type

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        # Log the entire session object - CAUTION: Contains sensitive data, remove after debugging
        # print(f"[WEBHOOK] Full session object: {json.dumps(session, indent=2)}") 
        
        user_id = session.get('client_reference_id') # Our user ID
        stripe_customer_id = session.get('customer')
        stripe_subscription_id = session.get('subscription')
        checkout_session_id = session.get('id') # Get the session ID for logging
        payment_status = session.get('payment_status')
        
        print(f"[WEBHOOK] Checkout Session ID: {checkout_session_id}, Payment Status: {payment_status}")
        print(f"[WEBHOOK] Extracted client_reference_id (user_id): {user_id}")
        print(f"[WEBHOOK] Extracted stripe_customer_id: {stripe_customer_id}")
        print(f"[WEBHOOK] Extracted stripe_subscription_id: {stripe_subscription_id}")

        if not user_id:
            print("[WEBHOOK][ERROR] checkout.session.completed missing client_reference_id! Cannot update user profile.")
            # It's important to return 200 OK to Stripe even if we can't process,
            # to prevent Stripe from retrying indefinitely for this specific error.
            # We've logged it, and need to investigate why client_reference_id is missing.
            return {"received_but_client_ref_missing": True}
        
        print(f"[WEBHOOK] Processing checkout.session.completed for user_id: {user_id}, Stripe Session ID: {checkout_session_id}")

        # --- Determine Price ID and Credits ---
        price_id_from_webhook = None
        credits_to_add = 0
        subscription_plan_name = "Unknown"
        
        # Attempt to get line items directly from the event if available and payment was successful
        # This is often more reliable than a separate retrieve if the webhook payload is complete.
        if payment_status == "paid" and session.get('line_items') and session['line_items'].get('data'):
            print("[WEBHOOK] Found line_items directly in webhook session data.")
            try:
                price_id_from_webhook = session['line_items']['data'][0]['price']['id']
                print(f"[WEBHOOK] Price ID from webhook line_items: {price_id_from_webhook}")
            except (IndexError, KeyError, TypeError) as e:
                print(f"[WEBHOOK][WARN] Could not extract price_id from webhook line_items: {e}")
        
        # Fallback or primary: Retrieve session with line_items if not directly available or for verification
        if not price_id_from_webhook and payment_status == "paid":
            print(f"[WEBHOOK] Price ID not in webhook or payment status not 'paid'. Attempting Session.retrieve for session {checkout_session_id}")
            try:
                # Ensure your Stripe API key is loaded for this call
                if not stripe.api_key: # Should be set globally when stripe is imported if STRIPE_SECRET_KEY is in env
                     print("[WEBHOOK][ERROR] Stripe API key not configured for Session.retrieve!")
                     # Handle error appropriately - maybe don't try to update DB
                else:
                    session_with_line_items = stripe.checkout.Session.retrieve(
                        checkout_session_id, # Use the session ID from the webhook event
                        expand=["line_items"]
                    )
                    line_items = session_with_line_items.get('line_items')
                    if not line_items or not line_items.data:
                        print(f"[WEBHOOK][WARN] Retrieved session {checkout_session_id} missing line_items data.")
                    else:
                        price_id_from_webhook = line_items.data[0].price.id
                        print(f"[WEBHOOK] Price ID from retrieved session line_items: {price_id_from_webhook}")
            except stripe.error.StripeError as e:
                 print(f"[WEBHOOK][ERROR] Stripe API error retrieving session {checkout_session_id}: {e}")
            except Exception as e:
                 print(f"[WEBHOOK][ERROR] Unexpected error retrieving session {checkout_session_id}: {e}")
        
        if not price_id_from_webhook:
            print(f"[WEBHOOK][ERROR] Could not determine Price ID for user {user_id} from session {checkout_session_id}. Cannot assign credits or plan.")
            # Decide if we should still update stripe_customer_id and stripe_subscription_id if available
            # For now, we will only proceed if we have a price_id to determine credits/plan.
        else:
            # Determine credits based on the determined Price ID
            print(f"[WEBHOOK] Determining credits for Price ID: {price_id_from_webhook}")
            if price_id_from_webhook == STRIPE_PRICE_ID_CREATOR:
                credits_to_add = 10 
                subscription_plan_name = "Creator"
            elif price_id_from_webhook == STRIPE_PRICE_ID_PRO:
                credits_to_add = 30
                subscription_plan_name = "Pro"
            elif price_id_from_webhook == STRIPE_PRICE_ID_GROWTH:
                credits_to_add = 90
                subscription_plan_name = "Growth"
            else:
                print(f"[WEBHOOK][WARN] Unrecognized Price ID {price_id_from_webhook} for user {user_id}. No credits will be added for this price_id.")
                # Keep subscription_plan_name as "Unknown" or set to a special value
                # credits_to_add remains 0

        # --- DB Update Logic ---     
        print(f"[WEBHOOK][DB_PREP] For User ID: {user_id}")
        print(f"  - Stripe Customer ID: {stripe_customer_id}")
        print(f"  - Stripe Subscription ID: {stripe_subscription_id}")
        print(f"  - Determined Plan Name: {subscription_plan_name}")
        print(f"  - Credits to Add: {credits_to_add}")
        print(f"  - Final Price ID used for logic: {price_id_from_webhook}")

        # Prepare data for Supabase update.
        # Only include fields that have actual values.
        # Ensure credits are handled correctly (e.g., increment existing or set new).
        # For simplicity, this example sets credits directly. Consider fetching existing credits and adding.
        
        update_payload = {}
        if stripe_customer_id:
            update_payload['stripe_customer_id'] = stripe_customer_id
        if stripe_subscription_id:
            update_payload['stripe_subscription_id'] = stripe_subscription_id
        if subscription_plan_name != "Unknown": # Only update if a known plan was matched
            update_payload['subscription_plan'] = subscription_plan_name
            update_payload['subscription_status'] = 'active' # Assume active on checkout completion
        
        # Handle credits: Fetch current credits and add, or just set if that's the logic.
        # This example just sets the credits_to_add if > 0.
        # A more robust way is to fetch user's current credits and add to them.
        if credits_to_add > 0:
            # To add to existing credits:
            # current_profile = supabase.table('profiles').select('credits').eq('id', user_id).maybe_single().execute()
            # current_credits = current_profile.data.get('credits', 0) if current_profile.data else 0
            # update_payload['credits'] = current_credits + credits_to_add
            update_payload['credits'] = credits_to_add # Simplified: sets credits directly based on plan

        if not update_payload:
            print(f"[WEBHOOK][DB_UPDATE] No valid data to update in Supabase for user {user_id} from session {checkout_session_id}.")
        else:
            print(f"[WEBHOOK][DB_UPDATE] Attempting to update Supabase for user {user_id} with payload: {update_payload}")
            try: 
                db_response = supabase.table('profiles').update(update_payload).eq('id', user_id).execute()
                
                # Proper check for PostgREST response
                if db_response.data: # Successful update typically returns a list with the updated record(s)
                    print(f"[WEBHOOK][DB_SUCCESS] Successfully updated profile for user {user_id}. Response data: {db_response.data}")
                else: # db_response.data might be empty list if RLS prevented update or record not found, or on error.
                      # db_response.error will be set if there was a PostgREST error.
                    if db_response.error:
                        print(f"[WEBHOOK][DB_ERROR] Error from Supabase updating profile for user {user_id}: {db_response.error}")
                        # Consider raising HTTPException here to make Stripe retry if it's a transient DB issue
                    else:
                        # This case means no data returned, no error object. Could be RLS or record not found.
                        print(f"[WEBHOOK][DB_WARN] Supabase update for user {user_id} returned no data and no explicit error. Checking if profile exists...")
                        profile_check = supabase.table('profiles').select('id').eq('id', user_id).maybe_single().execute()
                        if not profile_check.data:
                            print(f"[WEBHOOK][DB_ERROR] Profile for user {user_id} does not exist! Cannot update.")
                        else:
                            print(f"[WEBHOOK][DB_WARN] Profile for user {user_id} exists, but update returned no data. Possible RLS issue or data was identical?")
                            
            except APIError as e: # More specific PostgREST errors
                print(f"[WEBHOOK][DB_API_ERROR] Supabase APIError updating profile for user {user_id}: {e}")
                # Consider raising HTTPException to make Stripe retry
                # raise HTTPException(status_code=500, detail=f"Webhook DB update APIError: {e}")
            except Exception as e: # Catch any other unexpected errors during DB update
                print(f"[WEBHOOK][DB_UNEXPECTED_ERROR] Unexpected error updating Supabase for user {user_id}: {e}")
                # Consider raising HTTPException
                # raise HTTPException(status_code=500, detail=f"Webhook DB update unexpected error: {e}")
    
    elif event['type'] == 'customer.subscription.updated':
        print(f"[WEBHOOK] Received Stripe event: {event.type}")
        # Handle subscription updates, e.g., plan changes, cancellations that are pending
        # Extract necessary data from event['data']['object']
        # Update your Supabase 'profiles' table accordingly
        # Example:
        # subscription = event['data']['object']
        # stripe_customer_id = subscription.get('customer')
        # status = subscription.get('status') # e.g., 'active', 'past_due', 'canceled'
        # current_period_end = datetime.datetime.fromtimestamp(subscription.get('current_period_end')) if subscription.get('current_period_end') else None
        # Find user by stripe_customer_id and update their subscription_status, plan, etc.
        # print(f"[WEBHOOK] Subscription updated for customer {stripe_customer_id}, status: {status}, period_end: {current_period_end}")

    elif event['type'] == 'customer.subscription.deleted':
        print(f"[WEBHOOK] Received Stripe event: {event.type}")
        # Handle subscription cancellations immediately
        # Extract stripe_customer_id from event['data']['object']
        # Update your Supabase 'profiles' table: set subscription_status to 'canceled', clear plan, maybe set credits to 0 or a grace amount.
        # subscription = event['data']['object']
        # stripe_customer_id = subscription.get('customer')
        # print(f"[WEBHOOK] Subscription deleted for customer {stripe_customer_id}. Update DB to reflect cancellation.")

    # ... other event types like invoice.payment_succeeded, invoice.payment_failed ...
    else:
        print(f"[WEBHOOK] Unhandled event type: {event.type}")

    return {"received": True}

# --- Stripe Checkout Session Endpoint --- 
@app.post("/api/create-checkout-session")
async def create_checkout_session(request_data: CheckoutSessionRequest, user_id: str = Depends(get_current_user_id)):
    """Creates a Stripe Checkout session for subscription."""
    price_id = request_data.price_id
    print(f"[DEBUG] Received checkout request with price_id: {price_id}")
    print(f"[DEBUG] Available price IDs: CREATOR={STRIPE_PRICE_ID_CREATOR}, PRO={STRIPE_PRICE_ID_PRO}, GROWTH={STRIPE_PRICE_ID_GROWTH}")
    
    # For testing, allow any price_id that starts with "price_"
    if price_id.startswith("price_"):
        print(f"[DEBUG] Price ID {price_id} starts with 'price_', allowing checkout")
        try:
            checkout_session = stripe.checkout.Session.create(
                success_url=f"{DOMAIN_URL}/dashboard?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{DOMAIN_URL}/billing?canceled=true",
                mode='subscription',
                line_items=[{'price': price_id, 'quantity': 1}],
                client_reference_id=user_id, 
            )
            return {"sessionId": checkout_session.id, "url": checkout_session.url}
        except stripe.error.StripeError as e:
            print(f"Stripe error creating checkout session: {e}")
            raise HTTPException(status_code=500, detail=str(e))
        except Exception as e:
            print(f"Error creating checkout session: {e}")
            raise HTTPException(status_code=500, detail="Could not create checkout session.")
    else:
        print(f"[DEBUG] Price ID {price_id} rejected - doesn't match expected format")
        raise HTTPException(status_code=400, detail=f"Invalid Price ID specified: {price_id}")

# --- Debug Endpoint for Pricing IDs ---
@app.get("/api/debug/price-ids")
async def debug_price_ids():
    """Debug endpoint to check the configured Stripe price IDs."""
    return {
        "creator": STRIPE_PRICE_ID_CREATOR,
        "pro": STRIPE_PRICE_ID_PRO,
        "growth": STRIPE_PRICE_ID_GROWTH,
        "all_valid": all([
            STRIPE_PRICE_ID_CREATOR and STRIPE_PRICE_ID_CREATOR.startswith("price_"),
            STRIPE_PRICE_ID_PRO and STRIPE_PRICE_ID_PRO.startswith("price_"),
            STRIPE_PRICE_ID_GROWTH and STRIPE_PRICE_ID_GROWTH.startswith("price_")
        ])
    }

# --- Stripe Customer Portal Endpoint --- 
@app.post("/api/create-portal-session")
async def create_portal_session(request_data: PortalSessionRequest, user_id: str = Depends(get_current_user_id)):
    """Creates a Stripe Customer Portal session."""
    customer_id = request_data.customer_id
    # TODO: Add security check: Ensure user_id matches customer_id owner in DB
    
    try:
        portal_session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{DOMAIN_URL}/dashboard", 
        )
        return {"url": portal_session.url}
    except stripe.error.StripeError as e:
        print(f"Stripe error creating portal session: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        print(f"Error creating portal session: {e}")
        raise HTTPException(status_code=500, detail="Could not create customer portal session.")

# --- Get Subscription Status Endpoint --- 
@app.get("/api/subscription-status")
async def get_subscription_status(user_id: str = Depends(get_current_user_id)):
    """Fetches the current user's subscription details from the profiles table."""
    try:
        # Select the relevant columns needed by the frontend
        response = supabase.table('profiles')\
            .select('subscription_status', 'stripe_customer_id', 'subscription_plan')\
            .eq('id', user_id)\
            .maybe_single()\
            .execute()
        
        if response.data:
            status = response.data.get('subscription_status')
            customer_id = response.data.get('stripe_customer_id')
            plan = response.data.get('subscription_plan')
            # Determine if considered active (can add more statuses later like 'past_due')
            is_active = status == 'active' 
            return {
                "isActive": is_active,
                "status": status,
                "stripeCustomerId": customer_id,
                "planName": plan
            }
        else:
            # Profile exists but maybe no subscription info yet (or profile missing - handle gracefully)
            print(f"No subscription profile data found for user {user_id}")
            return {
                 "isActive": False,
                 "status": None,
                 "stripeCustomerId": None,
                 "planName": None
            }
    except APIError as e:
        print(f"Supabase API Error fetching subscription status for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error fetching subscription status.")
    except Exception as e:
        print(f"Error fetching subscription status for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Could not fetch subscription status.")

# --- Get Job Status Endpoint --- 
@app.get("/api/job-status/{job_id}")
async def get_job_status(job_id: str, user_id: str = Depends(get_current_user_id)):
    """Fetches the status of a generation job from Redis."""
    status_key = f"job_status:{job_id}"
    print(f"[DEBUG] Fetching status for job {job_id} using key {status_key}") # Add logging
    try:
        status_data_bytes = redis_client.hgetall(status_key)
        print(f"[DEBUG] Raw Redis response for {job_id}: {status_data_bytes}") # Add logging

        if not status_data_bytes:
            print(f"[WARN] Job {job_id} not found in Redis (key: {status_key}).") # Add logging
            raise HTTPException(status_code=404, detail="Job not found or status expired.")

        status_data = {}
        try:
            # Decode bytes -> str safely
            for k, v in status_data_bytes.items():
                key_str = k.decode("utf-8") if isinstance(k, bytes) else str(k)
                val_str = v.decode("utf-8") if isinstance(v, bytes) else str(v)
                status_data[key_str] = val_str
            print(f"[DEBUG] Decoded status data for {job_id}: {status_data}") # Add logging
        except Exception as decode_err:
            print(f"[ERROR] Failed to decode Redis hash for job {job_id}: {decode_err}") # Add logging
            # If decoding fails, we can't proceed reliably
            raise HTTPException(status_code=500, detail="Internal server error reading job status format.")

        # Verify user owns this job
        owner_user_id = status_data.get("user_id")
        if owner_user_id and owner_user_id != user_id:
             print(f"[AUTHZ ERROR] User {user_id} tried to access job {job_id} owned by {owner_user_id}") # Add logging
             raise HTTPException(status_code=403, detail="Not authorized to view this job status.")
        elif not owner_user_id:
             # This case might be valid if user_id wasn't stored, but log it
             print(f"[WARN] Job status for {job_id} does not contain a user_id field.") # Add logging
             # Depending on requirements, you might allow access or deny it here.

        print(f"[DEBUG] Returning status for job {job_id}: {status_data}") # Add logging
        return status_data

    except redis.exceptions.ConnectionError as e: # Specific Redis connection errors
        print(f"Redis Connection Error fetching status for job {job_id}: {e}") # Add logging
        raise HTTPException(status_code=503, detail="Status check unavailable - Redis connection error.")
    except redis.exceptions.RedisError as e: # Other Redis errors
        print(f"Redis error fetching status for job {job_id}: {e}") # Add logging
        raise HTTPException(status_code=503, detail="Status check unavailable - Redis error.")
    except HTTPException as http_exc: # Re-raise HTTPExceptions
        raise http_exc
    except Exception as e: # Catch-all for other unexpected errors
        # Log the full traceback for detailed debugging
        import traceback
        print(f"!!! Unexpected error in get_job_status for job {job_id} !!!")
        print(traceback.format_exc())
        print(f"!!! Error details: {e} !!!")
        # The frontend sees this generic message
        raise HTTPException(status_code=500, detail="Internal server error fetching job status.")\

# --- Get Past Videos Endpoint --- 
@app.get("/api/past-videos", response_model=PastVideosResponse)
async def get_past_videos(user_id: str = Depends(get_current_user_id)):
    """Fetches the list of generated videos for the current user from Supabase."""
    try:
        # Query the generated_videos table, filtering by user_id and ordering by creation date
        db_response = supabase.table('generated_videos')\
            .select('id, created_at, title, video_url, thumbnail_url') \
            .eq('user_id', user_id)\
            .order('created_at', desc=True)\
            .limit(50) \
            .execute()

        if db_response.data:
            # Map database results to the VideoCreation model
            # Handle potential missing optional fields like title/thumbnail
            videos = [
                VideoCreation(
                    id=item['id'],
                    created_at=item['created_at'], 
                    title=item.get('title'), # Use .get() for optional fields
                    url=item['video_url'], # Rename video_url to url
                    thumbnail=item.get('thumbnail_url') # Rename thumbnail_url to thumbnail
                )
                for item in db_response.data
            ]
            return PastVideosResponse(videos=videos)
        else:
            # No videos found for the user
            return PastVideosResponse(videos=[])

    except APIError as e:
        print(f"Supabase API Error fetching past videos for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error fetching past videos.")
    except Exception as e:
        print(f"Unexpected error fetching past videos for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Could not fetch past videos.")

# --- Update Video Title Endpoint --- 
@app.patch("/api/past-videos/{video_id}")
async def update_video_title(
    video_id: uuid.UUID, 
    request_data: UpdateVideoRequest, 
    user_id: str = Depends(get_current_user_id)
):
    """Updates the title of a specific generated video for the current user."""
    new_title = request_data.title

    try:
        # Update the title only if the video_id exists AND belongs to the user_id
        db_response = supabase.table('generated_videos')\
            .update({'title': new_title})\
            .eq('id', str(video_id)) \
            .eq('user_id', user_id)\
            .execute()

        # Check if any rows were actually updated
        # Note: PostgREST update doesn't typically return the updated row count directly in data
        # A more robust check might involve selecting first, then updating, 
        # but this is simpler for now. We rely on RLS to prevent unauthorized updates.
        # If db_response.data is empty, it likely means no matching row was found (or RLS blocked).
        if not db_response.data or len(db_response.data) == 0:
             # Check if the video exists at all for this user to differentiate errors
            check_response = supabase.table('generated_videos')\
                 .select('id')\
                 .eq('id', str(video_id))\
                 .eq('user_id', user_id)\
                 .maybe_single()\
                 .execute()
            if not check_response.data:
                 raise HTTPException(status_code=404, detail="Video not found or not owned by user.")
            else:
                 # This case is less likely if RLS is correct, but handle defensively
                 print(f"[WARN] Update for video {video_id} by user {user_id} affected 0 rows, but video exists.")
                 # We can consider this a success if the video exists, maybe the title was the same?
                 # Or raise 500 if we expect data back.

        return {"message": "Video title updated successfully"}

    except APIError as e:
        print(f"Supabase API Error updating video title for video {video_id}, user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error updating video title.")
    except Exception as e:
        print(f"Unexpected error updating video title for video {video_id}, user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Could not update video title.")

# --- New Continue Generation Endpoint --- 
@app.post("/api/continue-generation/{job_id}")
async def continue_generation(
    job_id: str, 
    request_data: ContinueGenerationRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Continues a generation job after script review.
    Requires the final script and optionally a voice_id.
    Verifies user ownership and job status before enqueuing 'continue' task.
    Enforces voice access rules based on user's plan.
    """
    status_key = f"job_status:{job_id}"
    try:
        # 1. Retrieve current job status from Redis
        status_data_bytes = redis_client.hgetall(status_key)
        if not status_data_bytes:
            raise HTTPException(status_code=404, detail="Job not found or status expired.")
        # Check if values are bytes and decode if necessary
        if isinstance(next(iter(status_data_bytes.values())), bytes):
            status_data = {k.decode('utf-8'): v.decode('utf-8') for k, v in status_data_bytes.items()}
        else:
            status_data = status_data_bytes

        # 2. Verify Ownership and Status
        if status_data.get('user_id') != user_id:
             print(f"[AUTHZ ERROR] User {user_id} tried to continue job {job_id} owned by {status_data.get('user_id')}")
             raise HTTPException(status_code=403, detail="Not authorized to continue this job.")
        if status_data.get('status') != 'pending_review':
            current_status = status_data.get('status', 'unknown')
            raise HTTPException(status_code=400, detail=f"Job is not awaiting review (current status: {current_status}).")

        # 3. ENFORCE VOICE ACCESS RULES
        # --- Voice ID lists (from frontend) ---
        BASIC_VOICES = {
            "ZRwrL4id6j1HPGFkeCzO", # Sam - American male (Default)
            "NFG5qt843uXKj4pFvR7C", # Adam - British male
            "CBHdTdZwkV4jYoCyMV1B", # African American - Female
            "gYr8yTP0q4RkX1HnzQfX", # African American - Male
            "LXVY607YcjqxFS3mcult", # Alex - Male
            "ZF6FPAbjXT4488VcRRnw", # Amelia - British female
        }
        CREATOR_VOICES = BASIC_VOICES | {
            "ZkXXWlhJO3CtSXof2ujN", # Ava - American female
            "JBFqnCBsd6RMkjVDRZzb", # George - British male
            "i4CzbCVWoqvD0P1QJCUL", # Ivy - American female
            "7p1Ofvcwsv7UBPoFNcpI", # Julian - British male
            "JEAgwU0JZFGxl2KjC3if", # Maribeth - American female
            "FMQtISLdv5RvjpHBgf60", # Neil - British male
            "hKUnzqLzU3P9IVhYHREu", # Tex - American male
            "rCuVrCHOUMY3OwyJBJym", # Mia - Raspy American female
            "LtPsVjX1k0Kl4StEMZPK", # Sophia - Female
            "luVEyhT3CocLZaLBps8v", # Vivian - Australian Female
        }
        PREMIUM_VOICES = CREATOR_VOICES | {
            "41534e16-2966-4c6b-9670-111411def906", # 1920s Radioman
            "NYC9WEgkq1u4jiqBseQ9", # Announcer - British man
            "L0Dsvb3SLTyegXwtm47J", # Archer - British male
            "kPzsL2i3teMYv0FxEYQ6", "PDJZDHevWkwdKwWFKj34", "ngiiW8FFLIdMew1cqwSB", "gAMZphRyrWJnLMDnom6H", "qNkzaJoHLLdpvgh5tISm", "FVQMzxJGPUBtfz1Azdoy", "L5Oo1OjjHdbIvJDQFgmN", "vfaqCOvlrKi4Zp7C2IAm", "eVItLK1UvXctxuaRV2Oq", "txtf1EDouKke753vN8SL", "IHngRooVccHyPqB4uQkG", "AnvlJBAqSLDzEevYr9Ap", "NOpBlnGInO9m6vDvFkFC", "c99d36f3-5ffd-4253-803a-535c1bc9c306", "BY77WcifAQZkoI7EftFd", "siw1N9V8LmYeEWKyWBxv", "BZc8d1MPTdZkyGbE9Sin", "t3hJ92dgZhDVtsff084B", "pO3rCaEbT3xVc0h3pPoG", "cccc21e8-5bcf-4ff0-bc7f-be4e40afc544", "50d6beb4-80ea-4802-8387-6c948fe84208", "A8rwEcJwudjohY1gjPfa", "236bb1fb-dc41-4a2b-84d6-d22d2a2aaae1", "JoYo65swyP8hH6fVMeTO", "224126de-034c-429b-9fde-71031fba9a59", "8f091740-3df1-4795-8bd9-dc62d88e5131", "185c2177-de10-4848-9c0a-ae6315ac1493", "gbLy9ep70G3JW53cTzFC", "LT7npgnEogysurF7U8GR", "bf0a246a-8642-498a-9950-80c35e9276b5", "sTgjlXyTKe3nwbzzjDAZ", "d7862948-75c3-4c7c-ae28-2959fe166f49", "bn5HJAJ1igu4dFplCXkQ", "mLJVsC2pwqCmmrBUAzg6", "flHkNRp1BlvT73UL6gyz", "INDKfphIpZiLCUiXae4o", "nbk2esDn4RRk4cVDdoiE"
        }

        # 4. Fetch user's plan from Supabase
        try:
            profile_response = supabase.table('profiles').select('subscription_plan').eq('id', user_id).maybe_single().execute()
            plan = (profile_response.data or {}).get('subscription_plan', 'free')
            plan = (plan or 'free').lower()
        except Exception as e:
            print(f"[VOICE PLAN] Error fetching user plan for {user_id}: {e}")
            plan = 'free'

        # 5. Determine allowed voices
        allowed_voices = BASIC_VOICES
        if plan == 'creator':
            allowed_voices = CREATOR_VOICES
        elif plan in ('pro', 'growth'):
            allowed_voices = PREMIUM_VOICES

        # 6. Validate requested voice_id
        requested_voice_id = request_data.voice_id
        if requested_voice_id and requested_voice_id not in allowed_voices:
            print(f"[VOICE PLAN] User {user_id} with plan '{plan}' tried to use forbidden voice_id: {requested_voice_id}")
            raise HTTPException(status_code=403, detail="Your plan does not allow this voice. Please upgrade to access more voices.")

        # 7. Prepare and Enqueue 'continue' Job
        continue_job_data = {
            "job_id": job_id, # Pass the original job ID
            "user_id": user_id, # Include user ID for worker context
            "script": request_data.script, # The final script from user
            "voice_id": request_data.voice_id # The selected voice (or None)
        }

        # Add a 'job_type' field to the message for the worker
        message_payload = {
             "job_type": "continue",
             "job_data": json.dumps(continue_job_data)
        }
        # Update status immediately to prevent double-continuation
        update_job_status(job_id, {"status": "processing", "stage": "continuation_triggered"}, user_id)
        redis_stream_id = redis_client.xadd(MEME_JOB_STREAM, message_payload)
        print(f"Enqueued 'continue' job {job_id} with Redis Stream ID: {redis_stream_id}")
        return {"message": "Generation continuation job queued successfully.", "job_id": job_id}
    except redis.exceptions.RedisError as e:
        print(f"Redis error continuing job {job_id}: {e}")
        update_job_status(job_id, {"status": "failed", "error_message": "Failed to queue continuation task.", "stage": "error"}, user_id)
        raise HTTPException(status_code=503, detail="Job queue unavailable.")
    except Exception as e:
        print(f"Unexpected error continuing job {job_id}: {e}")
        update_job_status(job_id, {"status": "failed", "error_message": f"Internal error: {e}", "stage": "error"}, user_id)
        raise HTTPException(status_code=500, detail="Internal server error continuing job.")

# --- New Regenerate Script Endpoint ---
@app.post("/api/regenerate-script")
async def regenerate_script(
    request_data: RegenerateScriptRequest,
    user_id: str = Depends(get_current_user_id)
):
    """
    Regenerates a script using OpenAI based on the current script and a user prompt.
    """
    try:
        # Extract data from request
        current_script = request_data.current_script
        user_prompt = request_data.prompt
        context = request_data.context

        # Check if OpenAI API key is configured
        if not OPENAI_API_KEY:
            raise HTTPException(status_code=500, detail="OpenAI API not configured")

        # Create system prompt
        system_prompt = """You are a creative script writer for short, entertaining video memes. 
Your task is to modify an existing script based on the user's request.
Keep the spirit of the original script while incorporating the requested changes.
The output should be purely the modified script without any explanations, notes, or formatting.
Keep the length similar to the original script."""

        # Create user message that includes the current script and the modification request
        user_message = f"""CURRENT SCRIPT:
{current_script}

MODIFICATION REQUEST:
{user_prompt}
"""

        # Add context if provided
        if context:
            user_message += f"\nCONTEXT ABOUT THE VIDEO:\n{context}"

        # Call OpenAI API
        try:
            response = openai_client.chat.completions.create(
                model="gpt-4o",  # Or other suitable model
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.7,
                max_tokens=500,
                user=user_id  # For OpenAI monitoring
            )
            
            # Extract and return the generated script
            regenerated_script = response.choices[0].message.content.strip()
            return {
                "regenerated_script": regenerated_script,
                "message": "Script regenerated successfully"
            }
            
        except OpenAIError as e:
            print(f"OpenAI API Error: {e}")
            raise HTTPException(status_code=500, detail=f"OpenAI API Error: {str(e)}")
            
    except Exception as e:
        print(f"Unexpected error regenerating script: {e}")
        raise HTTPException(status_code=500, detail=f"Error regenerating script: {str(e)}")

# --- Debug Endpoints --- 

@app.get("/api/debug/redis-status")
async def debug_redis_status():
    """Debug endpoint to check Redis connection and stream status."""
    try:
        # Check Redis connection
        ping_result = redis_client.ping()
        
        # Check if stream exists
        try:
            stream_info = redis_client.xinfo_stream(MEME_JOB_STREAM)
            stream_exists = True
            stream_length = stream_info.get('length', 0)
            first_entry = stream_info.get('first-entry', ['none'])[0] if stream_info.get('first-entry') else 'none'
            last_entry = stream_info.get('last-entry', ['none'])[0] if stream_info.get('last-entry') else 'none'
        except redis.exceptions.ResponseError as e:
            if "no such key" in str(e).lower():
                stream_exists = False
                stream_length = 0
                first_entry = 'n/a'
                last_entry = 'n/a'
            else:
                raise

        # Count job status keys
        job_status_count = len(redis_client.keys("job_status:*"))
        
        # Return status information
        return {
            "redis_connected": bool(ping_result),
            "stream_exists": stream_exists,
            "stream_length": stream_length,
            "stream_first_entry": first_entry,
            "stream_last_entry": last_entry,
            "job_status_count": job_status_count
        }
    except Exception as e:
        print(f"[ERROR] Redis status check failed: {e}")
        raise HTTPException(status_code=500, detail=f"Redis status check failed: {str(e)}")

@app.post("/api/debug/publish-test-job")
async def debug_publish_test_job(user_id: str = Depends(get_current_user_id)):
    """Debug endpoint to directly publish a test job to Redis."""
    try:
        job_id = str(uuid.uuid4())
        job_data = {
            "job_id": job_id,
            "user_id": user_id,
            "avatar_s3_key": "test/avatar.jpg",
            "video_s3_key": None,
            "status": "queued",
            "test_job": True
        }
        
        # Add the job to the stream
        stream_id = redis_client.xadd(MEME_JOB_STREAM, {"job_data": json.dumps(job_data)})
        
        # Create a job status entry manually
        status_key = f"job_status:{job_id}"
        redis_client.hset(status_key, mapping={
            "status": "test_created",
            "stage": "test",
            "user_id": user_id,
            "created_at": datetime.datetime.now().isoformat()
        })
        redis_client.expire(status_key, 3600 * 24)  # 24 hour expiry
        
        return {
            "success": True,
            "job_id": job_id,
            "stream_id": stream_id,
            "message": "Test job published to Redis stream and status created"
        }
    except Exception as e:
        print(f"[ERROR] Failed to publish test job: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to publish test job: {str(e)}")

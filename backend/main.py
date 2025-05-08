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
    "http://localhost:3000", # Allow your frontend origin
    # Add your deployed frontend origin here later, e.g.:
    # "https://your-app-domain.com", 
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
    Requires filename, content_type, and upload_type ('video' or 'avatar') in body.
    """
    filename = request_body.filename
    content_type = request_body.content_type
    upload_type = request_body.upload_type

    if upload_type not in ['video', 'avatar']:
        raise HTTPException(status_code=400, detail="Invalid upload_type. Must be 'video' or 'avatar'.")

    if not filename or not content_type:
        raise HTTPException(status_code=400, detail="Filename and content_type in body are required.")

    if '/' in filename or '\\' in filename: 
        raise HTTPException(status_code=400, detail="Invalid filename.")

    # Define allowed types and size based on upload_type
    if upload_type == 'video':
        # allowed_content_types = ["video/mp4", "video/quicktime", ...]
        max_size_bytes = 50 * 1024 * 1024 # 50MB
        # Add content type validation if needed
        # if content_type not in allowed_content_types:
        #    raise HTTPException(status_code=400, detail=f"Unsupported video type: {content_type}")
    elif upload_type == 'avatar':
        allowed_content_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
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
    """Fetches the current user's credits."""
    credits = await get_user_credits(user_id)
    return {"credits": credits}

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
            # Create new profile with initial credits
            print(f"[USER_SETUP] Creating new profile for user {user_id} with {initial_credits} credit")
            supabase.table('profiles').insert({
                'id': user_id,
                'credits': initial_credits,
                'subscription_status': 'free'
            }).execute()
        else:
            print(f"[USER_SETUP] Profile exists for user {user_id}")
            
            # Get current credits
            current_credits = profile_response.data.get('credits')
            subscription_status = profile_response.data.get('subscription_status')
            
            # Check if this is a free account with exactly 3 credits (the old default)
            if current_credits == 3 and (not subscription_status or subscription_status == 'free'):
                print(f"[USER_SETUP] Updating user {user_id} from 3 credits to 1 credit (fixing old default)")
                supabase.table('profiles').update({
                    'credits': initial_credits
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
    Checks credits, deducts 1, enqueues job.
    """
    # Extract keys from the request body model
    avatar_s3_key = request_data.avatar_s3_key
    video_s3_key = request_data.video_s3_key 

    # 1. Check Credits (using helper function)
    current_credits = await get_user_credits(user_id)
    if current_credits <= 0:
        raise HTTPException(status_code=402, detail="Insufficient credits.") 

    # 2. Deduct Credit (using simple update - consider RPC for production)
    try:
        update_response = supabase.table('profiles')\
            .update({'credits': current_credits - 1})\
            .eq('id', user_id)\
            .execute()
        if not update_response.data:
             raise HTTPException(status_code=500, detail="Failed to update credit balance.")
    except APIError as e:
        print(f"Supabase API Error deducting credit for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Database error updating credits.")
    except Exception as e:
        print(f"Error deducting credit for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Could not update credit balance.")
    
    # 3. Prepare and Enqueue Job (including both keys)
    job_id = str(uuid.uuid4()) 
    job_data = {
        "job_id": job_id,
        "user_id": user_id,
        "avatar_s3_key": avatar_s3_key, # Mandatory avatar key
        "video_s3_key": video_s3_key, # Optional video key
        "status": "queued",
        # Add other params as needed
    }

    try:
        redis_stream_id = redis_client.xadd(MEME_JOB_STREAM, {"job_data": json.dumps(job_data)})
        print(f"Enqueued job {job_id} with Redis Stream ID: {redis_stream_id}")
    except redis.exceptions.ConnectionError as e:
         print(f"Redis Connection Error during enqueue: {e}")
         # TODO: Implement credit refund logic here
         raise HTTPException(status_code=503, detail="Job queue unavailable.") 
    except Exception as e:
        print(f"Error enqueuing job {job_id}: {e}")
        # TODO: Implement credit refund logic here
        raise HTTPException(status_code=500, detail="Failed to enqueue generation job.")

    # 4. Return Job ID
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
    print(f"Received Stripe event: {event['type']}")

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        user_id = session.get('client_reference_id') # Our user ID
        stripe_customer_id = session.get('customer')
        stripe_subscription_id = session.get('subscription')
        checkout_session_id = session.get('id') # Get the session ID for logging

        if not user_id:
            print("[ERROR] checkout.session.completed missing client_reference_id! Cannot update user profile.")
            return {"received": True}
        
        print(f"Processing checkout completion for user_id: {user_id}, Session ID: {checkout_session_id}")

        # --- Simplified Price ID logic for CLI Testing ---        
        price_id = None
        credits_to_add = 0
        subscription_plan_name = "Unknown"

        # Check if this looks like a test session from the CLI (IDs often start with cs_test_)
        is_test_session = checkout_session_id and checkout_session_id.startswith('cs_test_')

        if is_test_session:
            # For CLI-triggered events, assume Creator plan for testing DB update logic
            print("[INFO] Test session detected (CLI trigger?). Assuming Creator plan for DB update test.")
            price_id = STRIPE_PRICE_ID_CREATOR 
            credits_to_add = 10 # Credits for Creator
            subscription_plan_name = "Creator"
        else:
            # For real events, attempt to retrieve the session to get the actual Price ID
            try:
                print(f"Attempting Session.retrieve for real session {session.id}")
                session_with_line_items = stripe.checkout.Session.retrieve(
                    session.id,
                    expand=["line_items"]
                )
                line_items = session_with_line_items.get('line_items')
                if not line_items or not line_items.data:
                    raise ValueError("Real checkout session missing line_items data after retrieve")
                price_id = line_items.data[0].price.id
                print(f"Retrieved Price ID {price_id} via Session.retrieve.")

                # Determine credits based on real Price ID
                if price_id == STRIPE_PRICE_ID_CREATOR:
                    credits_to_add = 10 
                    subscription_plan_name = "Creator"
                elif price_id == STRIPE_PRICE_ID_PRO:
                    credits_to_add = 30
                    subscription_plan_name = "Pro"
                elif price_id == STRIPE_PRICE_ID_GROWTH:
                    credits_to_add = 90
                    subscription_plan_name = "Growth"
                else:
                    print(f"[WARN] Unrecognized Price ID {price_id} for user {user_id}.")
            
            except (ValueError, stripe.error.StripeError) as e:
                 print(f"[ERROR] Failed to retrieve real session or Price ID for {user_id}: {e}")
                 # Cannot determine plan, maybe grant 0 credits or handle error?
                 credits_to_add = 0 # Default to 0 if retrieve fails
                 subscription_plan_name = "ErrorFetchingPlan"

        # --- DB Update Logic ---     
        print(f"[DEBUG] Webhook Data Extracted - User: {user_id}, Customer: {stripe_customer_id}, Sub: {stripe_subscription_id}, Price: {price_id}, Credits: {credits_to_add}, Plan: {subscription_plan_name}")

        # If it was a test session and IDs are None, assign placeholders for DB update test
        if is_test_session and stripe_customer_id is None:
            stripe_customer_id = "cus_TESTFROMCLI"
            print("[DEBUG] Assigning placeholder test customer ID.")
        if is_test_session and stripe_subscription_id is None:
            stripe_subscription_id = "sub_TESTFROMCLI"
            print("[DEBUG] Assigning placeholder test subscription ID.")

        if price_id: # Proceed only if we determined a price/credits somehow       
            try: 
                update_data = {
                    'credits': credits_to_add,
                    'stripe_customer_id': stripe_customer_id,
                    'stripe_subscription_id': stripe_subscription_id,
                    'subscription_plan': subscription_plan_name, 
                    'subscription_status': 'active' 
                }
                # Log the data BEFORE filtering None values
                print(f"[DEBUG] Update data before filtering: {update_data}") 
                update_data = {k: v for k, v in update_data.items() if v is not None} 
                print(f"[DEBUG] Update data AFTER filtering: {update_data}") # See what's left

                if not update_data: # Check if anything is left to update
                     print("[WARN] No data to update after filtering None values. Skipping DB call.")
                     # Return success to Stripe as there's nothing to do, but log it.
                     return {"received": True}

                db_response = supabase.table('profiles').update(update_data).eq('id', user_id).execute()
                
                if not db_response.data and len(db_response.data) == 0:
                    profile_check = supabase.table('profiles').select('id').eq('id', user_id).maybe_single().execute()
                    if not profile_check.data:
                        print(f"[ERROR] Profile for user {user_id} does not exist!")
                    else:
                        print(f"[ERROR] Failed to update profile for user {user_id}, response: {db_response}")
                else:
                    print(f"Successfully updated profile for user {user_id}.")
            except APIError as e:
                print(f"[ERROR] Supabase DB error updating profile for user {user_id}: {e}")
                # Raise exception to potentially trigger Stripe retry?
                raise HTTPException(status_code=500, detail=f"Webhook DB update failed: {e}")
        else:
             print(f"[ERROR] Could not determine Price ID for user {user_id}. Skipping DB update.")
    elif event['type'] == 'invoice.payment_failed':
        print("Invoice payment failed event received.")
        # TODO: Handle failed payment
        pass
    elif event['type'] == 'customer.subscription.deleted':
        print("Subscription deleted event received.")
        # TODO: Handle cancellation
        pass
    else:
        print(f"Unhandled event type {event['type']}")

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
    try:
        status_data_bytes = redis_client.hgetall(status_key)
        
        if not status_data_bytes:
            # Could mean job doesn't exist, hasn't started, or expired
            raise HTTPException(status_code=404, detail="Job not found or status expired.")
            
        # Optional: Verify user owns this job (requires user_id stored in status hash)
        if status_data_bytes.get('user_id') != user_id:
             print(f"[AUTHZ ERROR] User {user_id} tried to access job {job_id} owned by {status_data_bytes.get('user_id')}")
             raise HTTPException(status_code=403, detail="Not authorized to view this job status.")

        return status_data_bytes
        
    except redis.exceptions.RedisError as e:
        print(f"Redis error fetching status for job {job_id}: {e}")
        raise HTTPException(status_code=503, detail="Status check unavailable.")
    except Exception as e:
        print(f"Unexpected error fetching status for job {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error fetching job status.")

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

        # 3. Prepare and Enqueue 'continue' Job
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
        # Revert status? Difficult state management. For now, report error.
        update_job_status(job_id, {"status": "failed", "error_message": "Failed to queue continuation task.", "stage": "error"}, user_id)
        raise HTTPException(status_code=503, detail="Job queue unavailable.")
    except Exception as e:
        print(f"Unexpected error continuing job {job_id}: {e}")
        # Revert status?
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

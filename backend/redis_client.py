import redis
import os
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

if not REDIS_URL:
    raise EnvironmentError("REDIS_URL environment variable not set.")

print(f"[REDIS] Connecting to Redis at: {REDIS_URL.replace('://', '://*:*@').split('@')[-1]}")  # Hide credentials in logs

# Use decode_responses=True to get strings back instead of bytes
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

# Define the stream name we'll use for jobs
MEME_JOB_STREAM = "meme_jobs"

try:
    redis_client.ping()
    print("Successfully connected to Redis!")
    
    # Debug additional Redis details
    redis_info = redis_client.info()
    print(f"[REDIS] Connected to Redis version: {redis_info.get('redis_version', 'unknown')}")
    print(f"[REDIS] Used memory: {redis_info.get('used_memory_human', 'unknown')}")
    print(f"[REDIS] Connected clients: {redis_info.get('connected_clients', 'unknown')}")
    
    # Check stream existence
    try:
        stream_info = redis_client.xinfo_stream(MEME_JOB_STREAM)
        print(f"[REDIS] Stream '{MEME_JOB_STREAM}' exists with {stream_info.get('length', 0)} entries")
    except redis.exceptions.ResponseError as e:
        if "no such key" in str(e).lower():
            print(f"[REDIS] Stream '{MEME_JOB_STREAM}' does not exist yet. Will be created when needed.")
        else:
            print(f"[REDIS] Error checking stream: {e}")
except redis.exceptions.ConnectionError as e:
    print(f"Warning: Could not connect to Redis at {REDIS_URL.replace('://', '://*:*@').split('@')[-1]}. Background jobs will not work. Error: {e}")
    # Depending on requirements, you might want to raise an exception here
    # raise ConnectionError(f"Could not connect to Redis: {e}") from e 
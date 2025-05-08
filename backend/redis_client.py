import redis
import os
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

if not REDIS_URL:
    raise EnvironmentError("REDIS_URL environment variable not set.")

# Use decode_responses=True to get strings back instead of bytes
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

# Define the stream name we'll use for jobs
MEME_JOB_STREAM = "meme_jobs"

try:
    redis_client.ping()
    print("Successfully connected to Redis!")
except redis.exceptions.ConnectionError as e:
    print(f"Warning: Could not connect to Redis at {REDIS_URL}. Background jobs will not work. Error: {e}")
    # Depending on requirements, you might want to raise an exception here
    # raise ConnectionError(f"Could not connect to Redis: {e}") from e 
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv() # Load environment variables from .env file

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")

if not url or not key:
    raise EnvironmentError("Supabase URL or Service Key environment variables not set.")

supabase: Client = create_client(url, key) 
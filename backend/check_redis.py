#!/usr/bin/env python3
"""
Redis Job Diagnostics Tool
--------------------------
Checks Redis status, streams, and job status entries.
Run with:
  python check_redis.py
"""

import os
import sys
import json
import redis
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
MEME_JOB_STREAM = "meme_jobs"

if not REDIS_URL:
    print("[ERROR] REDIS_URL environment variable not set")
    sys.exit(1)

print(f"[INFO] Using Redis URL: {REDIS_URL.replace('://', '://*:*@').split('@')[-1]}")

try:
    # Create Redis client
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    
    # Check Redis connection
    if redis_client.ping():
        print("[OK] Successfully connected to Redis")
    else:
        print("[ERROR] Redis connection failed")
        sys.exit(1)
    
    # Check basic Redis info
    redis_info = redis_client.info()
    print(f"[INFO] Redis version: {redis_info.get('redis_version', 'unknown')}")
    print(f"[INFO] Used memory: {redis_info.get('used_memory_human', 'unknown')}")
    print(f"[INFO] Connected clients: {redis_info.get('connected_clients', 'unknown')}")
    
    # Check stream existence
    try:
        stream_info = redis_client.xinfo_stream(MEME_JOB_STREAM)
        print(f"[OK] Stream '{MEME_JOB_STREAM}' exists with {stream_info.get('length', 0)} entries")
        
        # Check stream details
        print(f"[INFO] First entry ID: {stream_info.get('first-entry')[0] if stream_info.get('first-entry') else 'none'}")
        print(f"[INFO] Last entry ID: {stream_info.get('last-entry')[0] if stream_info.get('last-entry') else 'none'}")
        
        # Check consumer groups
        consumer_groups = redis_client.xinfo_groups(MEME_JOB_STREAM)
        print(f"[INFO] Found {len(consumer_groups)} consumer group(s)")
        
        for group in consumer_groups:
            group_name = group.get('name', 'unknown')
            print(f"[INFO] Consumer group: {group_name}, Pending: {group.get('pending', 0)}, Consumers: {group.get('consumers', 0)}")
            
            # Check consumers in this group
            consumers = redis_client.xinfo_consumers(MEME_JOB_STREAM, group_name)
            for consumer in consumers:
                print(f"    - Consumer: {consumer.get('name', 'unknown')}, Pending: {consumer.get('pending', 0)}, Idle: {consumer.get('idle', 0)}ms")
        
        # Get recent stream entries
        stream_entries = redis_client.xrevrange(MEME_JOB_STREAM, count=5)
        print(f"[INFO] Recent stream entries (up to 5):")
        
        for entry_id, entry_data in stream_entries:
            job_data = entry_data.get('job_data', '{}')
            try:
                parsed_job = json.loads(job_data)
                job_id = parsed_job.get('job_id', 'unknown')
                print(f"    - Entry ID: {entry_id}, Job ID: {job_id}, User: {parsed_job.get('user_id', 'unknown')}")
            except json.JSONDecodeError:
                print(f"    - Entry ID: {entry_id}, Data parsing error")
    
    except redis.exceptions.ResponseError as e:
        if "no such key" in str(e).lower():
            print(f"[WARN] Stream '{MEME_JOB_STREAM}' does not exist yet")
        else:
            print(f"[ERROR] Error checking stream: {e}")
    
    # Check job status keys
    job_status_keys = redis_client.keys("job_status:*")
    print(f"[INFO] Found {len(job_status_keys)} job status keys")
    
    # Show details for up to 5 most recent jobs
    if job_status_keys:
        for key in job_status_keys[:5]:
            job_data = redis_client.hgetall(key)
            job_id = key.split(":")[-1]
            status = job_data.get('status', 'unknown')
            stage = job_data.get('stage', 'unknown')
            user_id = job_data.get('user_id', 'unknown')
            print(f"    - Job ID: {job_id}, Status: {status}, Stage: {stage}, User: {user_id}")
    
    print("\n[INFO] Diagnostics completed successfully")

except redis.exceptions.ConnectionError as e:
    print(f"[ERROR] Redis connection error: {e}")
    sys.exit(1)
except Exception as e:
    print(f"[ERROR] Unexpected error: {e}")
    sys.exit(1) 
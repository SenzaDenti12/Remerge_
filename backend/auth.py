from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from gotrue.types import User # Keep User type for annotation
import jwt # Import PyJWT
import os
from dotenv import load_dotenv
from typing import Optional

# We don't need the supabase client here directly for JWT validation
# from supabase_client import supabase

load_dotenv()

SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET")

if not SUPABASE_JWT_SECRET:
    raise EnvironmentError("SUPABASE_JWT_SECRET environment variable not set.")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token") # Dummy tokenUrl

def decode_jwt(token: str) -> Optional[dict]:
    """Decodes the JWT using the project's secret and validates audience."""
    try:
        # Explicitly verify the audience expected for Supabase authenticated users
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"], 
            audience="authenticated" # Add audience validation
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        print(f"Unexpected error decoding JWT: {e}") # Log unexpected errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during token decoding",
        )

async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """
    FastAPI dependency to decode and validate Supabase JWT 
    and return the token payload containing user info (like sub/user_id).
    """
    payload = decode_jwt(token)
    if not payload:
        # This case should theoretically be handled by decode_jwt raising errors,
        # but added for robustness.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # Return the whole payload, the endpoint can extract user ID ('sub') or other details
    return payload

async def get_current_active_user(payload: dict = Depends(get_current_user)) -> dict:
    """
    Example of a dependency that builds on get_current_user.
    You could add checks here (e.g., is user banned?)
    For now, it just returns the payload.
    """
    # You could add checks here based on payload contents, e.g., 
    # user_id = payload.get('sub')
    # Check if user is active in your DB using user_id
    # is_active = await check_user_activity(user_id)
    # if not is_active:
    #     raise HTTPException(status_code=400, detail="Inactive user")
    return payload

# You can also define a dependency that specifically returns the user ID (sub)
async def get_current_user_id(payload: dict = Depends(get_current_user)) -> str:
    user_id = payload.get('sub')
    if not user_id:
         raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not extract user ID from token",
        )
    return user_id 
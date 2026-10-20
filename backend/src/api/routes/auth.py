## `backend/src/api/routes/auth.py`

"""
Authentication endpoints (NEW: login/logout)

    POST /api/auth/register   create an account (+ copies of the example profiles)
    POST /api/auth/login      email + password -> session token
    POST /api/auth/logout     end the current session
    GET  /api/auth/me         who is logged in (used to restore a login on refresh)

Other routes protect themselves with `Depends(get_current_user)`.
The browser sends the token as:  Authorization: Bearer <token>
"""

import re

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, field_validator

from backend.src.services import auth
from backend.src.services.data_collector import data_collector
from backend.src.storage import db_manager
from backend.src.utils.logger import logger

router = APIRouter(prefix="/api/auth", tags=["auth"])

# auto_error=False: we raise our own 401 with a clear message
_bearer = HTTPBearer(auto_error=False)

# Deliberately simple: something@something.something. Avoids an extra dependency
# (pydantic's EmailStr needs the email-validator package).
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


#  REQUEST / RESPONSE MODELS 

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    email: str = Field(..., max_length=254)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        return v

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("Enter a valid email address")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class UserOut(BaseModel):
    id: int
    name: str
    email: str


class LoginResponse(BaseModel):
    token: str
    expires_in_hours: int
    user: UserOut


# DEPENDENCIES 

async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """
    Use in any route that needs a logged-in user:
        async def route(user: dict = Depends(get_current_user)): ...
    401 if the token is missing, unknown, logged out or expired.
    """
    if creds is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not logged in",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = await db_manager.get_session_user(auth.hash_token(creds.credentials))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def get_optional_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict | None:
    """Like get_current_user, but None instead of 401 (for public routes)."""
    if creds is None:
        return None
    return await db_manager.get_session_user(auth.hash_token(creds.credentials))


# ROUTES 

@router.post("/register", status_code=201, response_model=UserOut)
async def register(body: RegisterRequest):
    """
    Create an account. The new user starts with their own copy of every
    example threshold profile; what they add or delete later only affects them.
    """
    try:
        user_id = await db_manager.create_user(
            body.name, body.email, auth.hash_password(body.password)
        )
    except aiosqlite.IntegrityError:
        raise HTTPException(
            status_code=409, detail="An account with this email already exists"
        )

    await db_manager.seed_user_profiles(user_id)
    data_collector.invalidate_config()  # new user's active profile -> start alerting
    return UserOut(id=user_id, name=body.name, email=body.email)


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    """Check email + password and start a session."""
    user = await db_manager.get_user_by_email(body.email)

    # Same work and same message whether the email or the password is wrong,
    # so the form can't be used to find out who has an account.
    stored = user["password_hash"] if user else auth.DUMMY_HASH
    if not auth.verify_password(body.password, stored) or user is None:
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = auth.new_session_token()
    await db_manager.create_session(
        auth.hash_token(token), user["id"], auth.SESSION_HOURS
    )
    logger.info(f"User {user['id']} logged in")

    return LoginResponse(
        token=token,
        expires_in_hours=auth.SESSION_HOURS,
        user=UserOut(id=user["id"], name=user["name"], email=user["email"]),
    )


@router.post("/logout")
async def logout(
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
    user: dict = Depends(get_current_user),
):
    """End this session. The token stops working immediately."""
    await db_manager.delete_session(auth.hash_token(creds.credentials))
    logger.info(f"User {user['id']} logged out")
    return {"status": "success", "message": "Logged out"}


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    """The logged-in user. 401 means the saved token is no longer valid."""
    return UserOut(id=user["id"], name=user["name"], email=user["email"])
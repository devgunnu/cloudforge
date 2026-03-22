from datetime import datetime, timedelta, timezone
from secrets import token_urlsafe

import httpx
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings
from app.core.dependencies import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.encryption import encrypt
from app.db.mongo import users_col
from app.schemas.auth import AuthResponse, LoginRequest, RefreshResponse, RegisterRequest, UserPublic

router = APIRouter(prefix="/auth", tags=["auth"])

limiter = Limiter(key_func=get_remote_address)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# state -> {"user_id": str, "expires_at": datetime}
_github_states: dict[str, dict] = {}


def _user_to_public(user: dict) -> UserPublic:
    return UserPublic(
        id=str(user["_id"]),
        email=user["email"],
        username=user["username"],
        github_connected=bool(user.get("github_token_encrypted")),
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, payload: RegisterRequest) -> AuthResponse:
    col = users_col()

    if await col.find_one({"email": payload.email}):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    if await col.find_one({"username": payload.username}):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")

    now = datetime.now(timezone.utc)
    result = await col.insert_one(
        {
            "email": payload.email,
            "username": payload.username,
            "hashed_password": hash_password(payload.password),
            "github_token_encrypted": None,
            "github_login": None,
            "created_at": now,
            "updated_at": now,
        }
    )

    user_id = str(result.inserted_id)
    access_token = create_access_token({"sub": user_id, "token_type": "access"})
    refresh_token = create_refresh_token({"sub": user_id})

    user = await col.find_one({"_id": result.inserted_id})
    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_user_to_public(user),
    )


@router.post("/login", response_model=AuthResponse)
@limiter.limit("10/minute")
async def login(request: Request, payload: LoginRequest) -> AuthResponse:
    col = users_col()
    user = await col.find_one({"email": payload.email})

    if not user or not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = str(user["_id"])
    access_token = create_access_token({"sub": user_id, "token_type": "access"})
    refresh_token = create_refresh_token({"sub": user_id})

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=_user_to_public(user),
    )


@router.post("/refresh", response_model=RefreshResponse)
@limiter.limit("20/minute")
async def refresh_token(request: Request, token: str = Depends(oauth2_scheme)) -> RefreshResponse:
    payload = decode_token(token)

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await users_col().find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token({"sub": user_id, "token_type": "access"})
    return RefreshResponse(access_token=access_token)


@router.get("/me", response_model=UserPublic)
async def me(current_user: dict = Depends(get_current_user)) -> UserPublic:
    return _user_to_public(current_user)


@router.get("/github")
@limiter.limit("10/minute")
async def github_oauth_init(request: Request, current_user: dict = Depends(get_current_user)) -> dict:
    state = token_urlsafe(32)
    _github_states[state] = {
        "user_id": str(current_user["_id"]),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
    }
    auth_url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={settings.github_client_id}"
        f"&redirect_uri={settings.github_redirect_uri}"
        f"&scope=repo"
        f"&state={state}"
    )
    return {"auth_url": auth_url}


@router.get("/github/callback")
@limiter.limit("10/minute")
async def github_oauth_callback(request: Request, code: str, state: str) -> dict:
    entry = _github_states.get(state)
    if not entry:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired state")

    if datetime.now(timezone.utc) > entry["expires_at"]:
        del _github_states[state]
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="State expired")

    user_id = entry["user_id"]
    del _github_states[state]

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            json={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": settings.github_redirect_uri,
            },
        )
        token_data = token_resp.json()
        github_access_token = token_data.get("access_token")
        if not github_access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="GitHub token exchange failed",
            )

        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"token {github_access_token}"},
        )
        github_user = user_resp.json()
        login = github_user.get("login")

    encrypted_token = encrypt(github_access_token)
    now = datetime.now(timezone.utc)

    await users_col().update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {
                "github_token_encrypted": encrypted_token,
                "github_login": login,
                "updated_at": now,
            }
        },
    )

    return {"github_connected": True, "github_login": login}

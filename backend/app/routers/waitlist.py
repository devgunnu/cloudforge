from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.db.mongo import waitlist_col
from app.schemas.waitlist import WaitlistRequest, WaitlistResponse, has_mx_record

router = APIRouter(prefix="/waitlist", tags=["waitlist"])

# Follow the same pattern used in auth.py — local limiter instance with the
# same key function as the app-level limiter registered on app.state.
limiter = Limiter(key_func=get_remote_address)


@router.post("/", response_model=WaitlistResponse, status_code=201)
@limiter.limit("5/minute")
async def join_waitlist(request: Request, body: WaitlistRequest) -> WaitlistResponse:
    """Add an email to the waitlist.

    Validation order (fail fast):
    1. Pydantic EmailStr — format check (handled by schema).
    2. Disposable domain blocklist — in-memory set lookup (handled by schema).
    3. MX record check — async DNS lookup (handled here to avoid blocking event loop).
    4. Duplicate check — MongoDB lookup.

    Rate-limited to 5 requests per IP per minute.
    """
    domain = body.email.split("@", 1)[1].lower()
    if not await has_mx_record(domain):
        raise HTTPException(
            status_code=422,
            detail=[{"msg": "Invalid email domain — no mail server found."}],
        )

    col = waitlist_col()
    existing = await col.find_one({"email": body.email})
    if existing:
        return WaitlistResponse(message="already_registered")

    await col.insert_one({"email": body.email, "created_at": datetime.utcnow()})
    return WaitlistResponse(message="success")

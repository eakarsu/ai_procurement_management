"""Deeper RPA bridge (Zapier, Make, n8n) with credential vaulting.

v0 scaffold: registers integration targets, exposes a trigger endpoint that
posts to a configured webhook URL. Credentials are loaded from environment
variables (vault integration TODO).
"""
import os
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import User

router = APIRouter(prefix="/api/rpa-bridge", tags=["rpa-bridge"])

PROVIDER_ENV_MAP = {
    "zapier": "ZAPIER_HOOK_URL",
    "make": "MAKE_HOOK_URL",
    "n8n": "N8N_HOOK_URL",
}


class TriggerRequest(BaseModel):
    provider: str
    payload: dict
    target: Optional[str] = None  # specific hook key if multiple


@router.get("/providers")
def providers(current_user: User = Depends(get_current_user)):
    return {
        "providers": [
            {"name": p, "configured": bool(os.getenv(env))}
            for p, env in PROVIDER_ENV_MAP.items()
        ],
        "note": "Credentials loaded from env. TODO: integrate a secret vault.",
    }


@router.post("/trigger")
async def trigger(req: TriggerRequest,
                  current_user: User = Depends(get_current_user)):
    env_var = PROVIDER_ENV_MAP.get(req.provider.lower())
    if not env_var:
        raise HTTPException(status_code=400, detail=f"unsupported provider: {req.provider}")
    url = os.getenv(env_var)
    if not url:
        # TODO: configure credentials
        return {"status": "not_configured", "provider": req.provider, "env_var": env_var}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(url, json=req.payload)
        return {"status": "delivered", "http": r.status_code, "provider": req.provider}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"upstream error: {e}")

import os
from datetime import datetime, timedelta, timezone
import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from .db import get_db
from .models import User

bearer = HTTPBearer()


def secret():
    value = os.getenv("JWT_SECRET", "")
    if len(value) < 24 or value.startswith("change-this"):
        raise RuntimeError("JWT_SECRET must be a changed random secret of at least 24 characters")
    return value


def hash_password(value: str):
    return bcrypt.hashpw(value.encode(), bcrypt.gensalt()).decode()


def verify_password(value: str, digest: str):
    return bcrypt.checkpw(value.encode(), digest.encode())


def token_for(user: User):
    return jwt.encode({"sub": user.id, "exp": datetime.now(timezone.utc) + timedelta(hours=8)}, secret(), algorithm="HS256")


def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(credentials.credentials, secret(), algorithms=["HS256"])
        user = db.get(User, payload["sub"])
    except (jwt.PyJWTError, KeyError):
        user = None
    if not user or not user.active:
        raise HTTPException(401, "Недійсний токен")
    return user


def admin(user: User = Depends(current_user)):
    if user.role != "admin":
        raise HTTPException(403, "Потрібна роль адміністратора")
    return user

"""NetShield AI — Cryptographic Security and Validation Utilities.

Implements Argon2id password hashing, strict password policy enforcement,
case-insensitive username/email validation, cryptographically secure token generation,
SHA-256 token hashing for database storage, and JWT token handling.
"""

from __future__ import annotations

import hashlib
import re
import secrets
from datetime import datetime, timezone, timedelta
from typing import Any, Optional, Tuple

import argon2
import jwt

# ── Argon2id Password Hasher ───────────────────────────────────────────────
# Recommended OWASP parameters for Argon2id:
# - Type: Argon2id
# - Memory cost: 65536 KiB (64 MiB)
# - Time cost: 2 iterations
# - Parallelism: 1 lane
# - Hash length: 32 bytes
_PASSWORD_HASHER = argon2.PasswordHasher(
    time_cost=2,
    memory_cost=65536,
    parallelism=1,
    hash_len=32,
    type=argon2.Type.ID,
)

# ── Common / Compromised Passwords Blacklist ───────────────────────────────
# Passwords in this set will be rejected even if they meet character requirements.
COMMON_PASSWORDS_BLACKLIST = {
    "password1234!",
    "password12345!",
    "password123456!",
    "admin1234567!",
    "welcome12345!",
    "netshield123!",
    "netshield2026!",
    "iloveyou1234!",
    "123456789012!",
    "qwertyuiop12!",
    "administrator!",
    "letmein12345!",
    "monkey123456!",
    "dragon123456!",
    "master123456!",
    "access123456!",
    "security1234!",
    "trustnoone12!",
    "changeme1234!",
    "sunshine1234!",
    "princess1234!",
    "superman1234!",
    "batman123456!",
    "football1234!",
    "baseball1234!",
    "shadow123456!",
    "default12345!",
    "testpassword!",
    "hunter2hunter2!",
    "starwars1234!",
}

# Regex for strict validation
USERNAME_REGEX = re.compile(r"^[a-zA-Z0-9_-]{3,32}$")
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


def validate_username(username: str) -> Tuple[bool, Optional[str]]:
    """Validate username according to security requirements.

    Requirements:
    - 3 to 32 characters long
    - Alphanumeric characters, underscores, and hyphens only
    - No spaces or dangerous characters
    """
    if not username or not isinstance(username, str):
        return False, "Username is required."
    clean = username.strip()
    if len(clean) < 3:
        return False, "Username must be at least 3 characters long."
    if len(clean) > 32:
        return False, "Username cannot exceed 32 characters."
    if not USERNAME_REGEX.match(clean):
        return False, "Username can only contain letters, numbers, underscores, and hyphens."
    return True, None


def validate_email(email: str) -> Tuple[bool, Optional[str]]:
    """Validate email address format and length.

    Requirements:
    - Valid RFC email format
    - Maximum 255 characters
    """
    if not email or not isinstance(email, str):
        return False, "Email address is required."
    clean = email.strip()
    if len(clean) > 255:
        return False, "Email address cannot exceed 255 characters."
    if not EMAIL_REGEX.match(clean):
        return False, "Please enter a valid email address (e.g. analyst@netshield.ai)."
    return True, None


def validate_password_strength(password: str) -> Tuple[bool, Optional[str]]:
    """Validate password against strict security requirements.

    Requirements:
    - Minimum 12 characters
    - At least one uppercase letter (A-Z)
    - At least one lowercase letter (a-z)
    - At least one numeric digit (0-9)
    - At least one special symbol (!@#$%^&*()_+-=[]{};':"|,.<>/?`~)
    - Not in the common password blacklist
    """
    if not password or not isinstance(password, str):
        return False, "Password is required."
    if len(password) < 12:
        return False, "Password must be at least 12 characters long."
    if len(password) > 128:
        return False, "Password cannot exceed 128 characters."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter (A-Z)."
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter (a-z)."
    if not re.search(r"[0-9]", password):
        return False, "Password must contain at least one number (0-9)."
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?`~]", password):
        return False, "Password must contain at least one special character (e.g. !@#$%^&*)."
    
    # Check blacklist (case-insensitive)
    if password.lower() in COMMON_PASSWORDS_BLACKLIST:
        return False, "This password is too common or easily guessed. Please choose a more unique password."

    return True, None


def hash_password(password: str) -> str:
    """Hash a password using Argon2id with high cryptographic parameters."""
    return _PASSWORD_HASHER.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a plain password against an Argon2id hash in constant time."""
    try:
        return _PASSWORD_HASHER.verify(password_hash, password)
    except (argon2.exceptions.VerifyMismatchError, argon2.exceptions.VerificationError, argon2.exceptions.InvalidHash):
        return False


def needs_rehash(password_hash: str) -> bool:
    """Check if the password hash needs to be upgraded to newer Argon2id parameters."""
    try:
        return _PASSWORD_HASHER.check_needs_rehash(password_hash)
    except Exception:
        return True


def generate_api_key() -> str:
    """Generate a cryptographically secure NetShield Agent API key.

    Format: ns_live_<32_hex_characters>
    """
    return f"ns_live_{secrets.token_hex(16)}"


def generate_secure_token(length_bytes: int = 32) -> str:
    """Generate a URL-safe cryptographically random token string."""
    return secrets.token_urlsafe(length_bytes)


def hash_token(token: str) -> str:
    """Compute a SHA-256 hash of a token for safe database indexing and storage.

    Never store raw tokens in the database.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_access_token(
    user_id: int,
    username: str,
    email: str,
    role: str,
    secret_key: str,
    algorithm: str = "HS256",
    expires_minutes: int = 60,
) -> str:
    """Generate a signed JWT access token for authentication."""
    now = datetime.now(timezone.utc)
    expires = now + timedelta(minutes=expires_minutes)

    payload = {
        "sub": str(user_id),
        "user_id": user_id,
        "username": username,
        "email": email,
        "role": role,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
    }

    return jwt.encode(payload, secret_key, algorithm=algorithm)


def decode_access_token(
    token: str,
    secret_key: str,
    algorithm: str = "HS256",
) -> Optional[dict[str, Any]]:
    """Decode and verify a JWT access token.

    Returns the payload dictionary if valid, or None if expired or invalid.
    """
    try:
        payload = jwt.decode(
            token,
            secret_key,
            algorithms=[algorithm],
            options={"require": ["exp", "sub", "type"]},
        )
        if payload.get("type") != "access":
            return None
        return payload
    except (jwt.PyJWTError, Exception):
        return None


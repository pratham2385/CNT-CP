"""NetShield AI — FastAPI Authentication Router and Dependencies.

Provides production-grade endpoints for:
- User registration with strict validation and Argon2id password hashing
- Secure login with rate-limiting and brute-force protection
- Session termination and refresh token rotation
- Case-insensitive identity queries
- Secure password reset and email verification via single-use expiring tokens
- Profile editing and password changes
- Agent API key rotation
- HttpOnly cookie and Bearer token support
- Role-based access control (RBAC)
"""

from __future__ import annotations

import logging
import time
from typing import Any, Callable, Optional

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Request, Response, status

from auth.rate_limiter import rate_limiter
from auth.schemas import (
    ApiKeyResponse,
    AuthResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    UpdateProfileRequest,
    UserResponse,
    VerifyEmailRequest,
)
from auth.security import (
    create_access_token,
    decode_access_token,
    generate_api_key,
    generate_secure_token,
    hash_password,
    hash_token,
    validate_email,
    validate_password_strength,
    validate_username,
    verify_password,
)
from config import Settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

ACCESS_COOKIE_NAME = "netshield_access_token"
REFRESH_COOKIE_NAME = "netshield_refresh_token"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7


def _get_db(request: Request):
    """Retrieve Database instance from application state."""
    return request.app.state.app.db


def _get_settings(request: Request) -> Settings:
    """Retrieve Settings instance from application state."""
    return request.app.state.app.settings


def _get_client_ip(request: Request) -> str:
    """Extract real client IP address considering proxy headers."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


def _set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
    cookie_secure: bool = False,
) -> None:
    """Set secure HttpOnly cookies on the HTTP response."""
    # Access token cookie (1 hour)
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=access_token,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=cookie_secure,
        samesite="lax",
        path="/",
    )
    # Refresh token cookie (7 days)
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        httponly=True,
        secure=cookie_secure,
        samesite="lax",
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    """Clear authentication cookies on logout."""
    response.delete_cookie(key=ACCESS_COOKIE_NAME, path="/", samesite="lax")
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/", samesite="lax")


def _format_user_response(user: dict[str, Any]) -> UserResponse:
    """Format sanitized user object for API responses."""
    return UserResponse(
        id=user["id"],
        username=user["username"],
        email=user["email"],
        role=user.get("role", "analyst"),
        is_verified=bool(user.get("is_verified", 0)),
        api_key=user.get("api_key", ""),
        created_at=user.get("created_at", 0.0),
        updated_at=user.get("updated_at", 0.0),
        last_login=user.get("last_login"),
    )


# ── Dependency: Get Current Authenticated User ──────────────────────────────

async def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    netshield_access_token: Optional[str] = Cookie(None),
) -> dict[str, Any]:
    """Authenticate request using Bearer header or HttpOnly cookie.

    Raises:
        HTTPException: 401 if missing, invalid, or expired.
    """
    token: Optional[str] = None

    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    elif netshield_access_token:
        token = netshield_access_token

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    settings = _get_settings(request)
    secret_key = getattr(settings, "jwt_secret", "netshield_ai_secure_jwt_secret_key_2026")
    algorithm = getattr(settings, "jwt_algorithm", "HS256")

    payload = decode_access_token(token, secret_key=secret_key, algorithm=algorithm)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("user_id") or payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token payload.",
        )

    db = _get_db(request)
    user = db.get_user_by_id(int(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists.",
        )

    return user


async def get_optional_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    netshield_access_token: Optional[str] = Cookie(None),
) -> Optional[dict[str, Any]]:
    """Return authenticated user if valid token present, or None."""
    try:
        return await get_current_user(request, authorization, netshield_access_token)
    except HTTPException:
        return None


def require_role(allowed_roles: list[str]) -> Callable:
    """Dependency factory enforcing role-based authorization."""
    async def _role_checker(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        user_role = user.get("role", "analyst").lower()
        allowed = [r.lower() for r in allowed_roles]
        if user_role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {', '.join(allowed_roles)}.",
            )
        return user
    return _role_checker


def require_verified(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Dependency requiring verified email address."""
    if not user.get("is_verified", 0):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address to access this feature.",
        )
    return user


# ── POST /api/auth/register ─────────────────────────────────────────────────

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    req: RegisterRequest,
    request: Request,
    response: Response,
) -> AuthResponse:
    """Register a new user account with strict security validation."""
    db = _get_db(request)
    settings = _get_settings(request)

    # 1. Validate username
    valid_u, u_err = validate_username(req.username)
    if not valid_u:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=u_err)

    # 2. Validate email
    valid_e, e_err = validate_email(req.email)
    if not valid_e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e_err)

    # 3. Validate password strength
    valid_p, p_err = validate_password_strength(req.password)
    if not valid_p:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=p_err)

    # 4. Check for existing user (case-insensitive)
    clean_username = req.username.strip()
    clean_email = req.email.strip().lower()

    if db.get_user_by_email(clean_email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )
    if db.get_user_by_username(clean_username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This username is already taken. Please choose another.",
        )

    # 5. Determine initial role: first user is admin, others analyst
    user_count = db.count_users()
    initial_role = "admin" if user_count == 0 else "analyst"

    # 6. Hash password with Argon2id
    password_hash = hash_password(req.password)
    api_key = generate_api_key()

    # 7. Create user in database
    new_user = db.create_user(
        username=clean_username,
        email=clean_email,
        password_hash=password_hash,
        role=initial_role,
        is_verified=False,
        api_key=api_key,
    )

    # 8. Generate single-use email verification token
    verify_token = generate_secure_token(32)
    verify_hash = hash_token(verify_token)
    db.create_auth_token(
        user_id=new_user["id"],
        token_type="verify_email",
        token_hash=verify_hash,
        expires_at=time.time() + (24 * 3600),  # 24 hours
    )

    # 9. Create access and refresh tokens
    secret_key = getattr(settings, "jwt_secret", "netshield_ai_secure_jwt_secret_key_2026")
    algorithm = getattr(settings, "jwt_algorithm", "HS256")

    access_token = create_access_token(
        user_id=new_user["id"],
        username=new_user["username"],
        email=new_user["email"],
        role=new_user["role"],
        secret_key=secret_key,
        algorithm=algorithm,
        expires_minutes=ACCESS_TOKEN_EXPIRE_MINUTES,
    )

    refresh_token = generate_secure_token(48)
    refresh_hash = hash_token(refresh_token)
    db.store_refresh_token(
        user_id=new_user["id"],
        token_hash=refresh_hash,
        user_agent=request.headers.get("user-agent"),
        ip_address=_get_client_ip(request),
        expires_at=time.time() + (REFRESH_TOKEN_EXPIRE_DAYS * 86400),
    )

    # Set HttpOnly cookies
    _set_auth_cookies(response, access_token, refresh_token)

    logger.info("New user registered: %s (%s) [role=%s]", clean_username, clean_email, initial_role)

    return AuthResponse(
        message="Account created successfully. Please verify your email address.",
        token=access_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=_format_user_response(new_user),
        refresh_token=refresh_token,
    )


# ── POST /api/auth/login ────────────────────────────────────────────────────

@router.post("/login", response_model=AuthResponse)
async def login(
    req: LoginRequest,
    request: Request,
    response: Response,
) -> AuthResponse:
    """Log in with rate-limiting and Argon2id verification."""
    client_ip = _get_client_ip(request)
    identifier = req.identifier.strip()
    rate_key = f"ip:{client_ip}:id:{identifier.lower()}"

    # 1. Check rate limiter
    is_locked, remaining_secs = rate_limiter.is_locked(rate_key)
    if is_locked:
        minutes = max(1, remaining_secs // 60)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Account temporarily locked. Try again in {minutes} minutes.",
        )

    # 2. Find user by username or email
    db = _get_db(request)
    user = db.get_user_by_identifier(identifier)

    # 3. Verify credentials
    valid_password = False
    if user and user.get("password_hash"):
        valid_password = verify_password(req.password, user["password_hash"])

    if not user or not valid_password:
        # Record failed attempt
        is_locked_now, lock_secs, attempts = rate_limiter.record_failure(rate_key)
        if is_locked_now:
            minutes = max(1, lock_secs // 60)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many failed login attempts. Account temporarily locked for {minutes} minutes.",
            )
        remaining = 5 - attempts
        msg = "Invalid username/email or password."
        if remaining > 0 and remaining <= 3:
            msg += f" {remaining} attempt(s) remaining before temporary lockout."
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=msg)

    # Reset rate limiter upon success
    rate_limiter.reset(rate_key)
    db.update_user_last_login(user["id"])

    # 4. Generate access & refresh tokens
    settings = _get_settings(request)
    secret_key = getattr(settings, "jwt_secret", "netshield_ai_secure_jwt_secret_key_2026")
    algorithm = getattr(settings, "jwt_algorithm", "HS256")

    access_token = create_access_token(
        user_id=user["id"],
        username=user["username"],
        email=user["email"],
        role=user["role"],
        secret_key=secret_key,
        algorithm=algorithm,
        expires_minutes=ACCESS_TOKEN_EXPIRE_MINUTES,
    )

    refresh_token = generate_secure_token(48)
    refresh_hash = hash_token(refresh_token)
    db.store_refresh_token(
        user_id=user["id"],
        token_hash=refresh_hash,
        user_agent=request.headers.get("user-agent"),
        ip_address=client_ip,
        expires_at=time.time() + (REFRESH_TOKEN_EXPIRE_DAYS * 86400),
    )

    # Set cookies
    _set_auth_cookies(response, access_token, refresh_token)

    logger.info("User login successful: %s (ID=%d)", user["username"], user["id"])

    return AuthResponse(
        message="Login successful",
        token=access_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=_format_user_response(user),
        refresh_token=refresh_token,
    )


# ── POST /api/auth/logout ───────────────────────────────────────────────────

@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    response: Response,
    netshield_refresh_token: Optional[str] = Cookie(None),
) -> MessageResponse:
    """Invalidate session, revoke refresh token, and clear cookies."""
    db = _get_db(request)

    # Check for refresh token in cookie or headers/body
    token_val = netshield_refresh_token or request.headers.get("x-refresh-token")
    if token_val:
        token_hash = hash_token(token_val)
        db.revoke_refresh_token(token_hash)

    _clear_auth_cookies(response)
    return MessageResponse(status="ok", message="Logged out successfully.")


# ── POST /api/auth/refresh ──────────────────────────────────────────────────

@router.post("/refresh", response_model=AuthResponse)
async def refresh_session(
    request: Request,
    response: Response,
    body: Optional[RefreshRequest] = None,
    netshield_refresh_token: Optional[str] = Cookie(None),
) -> AuthResponse:
    """Rotate refresh token and issue new access token."""
    db = _get_db(request)
    settings = _get_settings(request)

    token_val: Optional[str] = None
    if body and body.refresh_token:
        token_val = body.refresh_token.strip()
    elif request.headers.get("x-refresh-token"):
        token_val = request.headers.get("x-refresh-token").strip()
    elif netshield_refresh_token:
        token_val = netshield_refresh_token.strip()

    if not token_val:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token required.",
        )

    token_hash = hash_token(token_val)
    stored_token = db.get_valid_refresh_token(token_hash)
    if not stored_token:
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or revoked. Please sign in again.",
        )

    user = db.get_user_by_id(stored_token["user_id"])
    if not user:
        _clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")

    # Token rotation: revoke old token and issue new one
    db.revoke_refresh_token(token_hash)

    new_refresh = generate_secure_token(48)
    new_hash = hash_token(new_refresh)
    db.store_refresh_token(
        user_id=user["id"],
        token_hash=new_hash,
        user_agent=request.headers.get("user-agent"),
        ip_address=_get_client_ip(request),
        expires_at=time.time() + (REFRESH_TOKEN_EXPIRE_DAYS * 86400),
    )

    secret_key = getattr(settings, "jwt_secret", "netshield_ai_secure_jwt_secret_key_2026")
    algorithm = getattr(settings, "jwt_algorithm", "HS256")

    new_access = create_access_token(
        user_id=user["id"],
        username=user["username"],
        email=user["email"],
        role=user["role"],
        secret_key=secret_key,
        algorithm=algorithm,
        expires_minutes=ACCESS_TOKEN_EXPIRE_MINUTES,
    )

    _set_auth_cookies(response, new_access, new_refresh)

    return AuthResponse(
        message="Session refreshed successfully",
        token=new_access,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=_format_user_response(user),
        refresh_token=new_refresh,
    )


# ── GET /api/auth/me ────────────────────────────────────────────────────────

@router.get("/me", response_model=dict[str, Any])
async def get_profile(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Retrieve profile data for the current authenticated user."""
    return {"user": _format_user_response(user).model_dump()}


# ── PUT /api/auth/profile & PATCH /api/auth/me ──────────────────────────────

@router.patch("/me", response_model=dict[str, Any])
@router.put("/profile", response_model=dict[str, Any])
async def update_profile(
    req: UpdateProfileRequest,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Update profile information (username or email) with collision checks."""
    db = _get_db(request)

    new_username: Optional[str] = None
    new_email: Optional[str] = None

    if req.username is not None:
        valid_u, u_err = validate_username(req.username)
        if not valid_u:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=u_err)
        clean_u = req.username.strip()
        if clean_u.lower() != user["username"].lower():
            existing = db.get_user_by_username(clean_u)
            if existing and existing["id"] != user["id"]:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already taken.")
            new_username = clean_u

    if req.email is not None:
        valid_e, e_err = validate_email(req.email)
        if not valid_e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=e_err)
        clean_e = req.email.strip().lower()
        if clean_e != user["email"].lower():
            existing = db.get_user_by_email(clean_e)
            if existing and existing["id"] != user["id"]:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already in use.")
            new_email = clean_e

    updated_user = db.update_user_profile(user["id"], username=new_username, email=new_email)
    return {
        "message": "Profile updated successfully.",
        "user": _format_user_response(updated_user or user).model_dump(),
    }


# ── POST /api/auth/change-password ──────────────────────────────────────────

@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    req: ChangePasswordRequest,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> MessageResponse:
    """Change password for authenticated user and invalidate other sessions."""
    db = _get_db(request)

    # 1. Verify current password
    if not verify_password(req.current_password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")

    # 2. Validate new password strength
    valid_p, p_err = validate_password_strength(req.new_password)
    if not valid_p:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=p_err)

    # 3. Ensure new password is not the same as current
    if verify_password(req.new_password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password cannot be the same as your current password.",
        )

    # 4. Hash and update
    new_hash = hash_password(req.new_password)
    db.update_user_password(user["id"], new_hash)

    # 5. Revoke other refresh tokens
    db.revoke_all_user_refresh_tokens(user["id"])

    logger.info("Password changed for user %s (ID=%d)", user["username"], user["id"])
    return MessageResponse(
        status="ok",
        message="Password changed successfully. All other active sessions have been signed out.",
    )


# ── POST /api/auth/forgot-password ──────────────────────────────────────────

@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    req: ForgotPasswordRequest,
    request: Request,
) -> MessageResponse:
    """Generate a single-use expiring password reset token."""
    db = _get_db(request)
    clean_email = req.email.strip().lower()

    user = db.get_user_by_email(clean_email)
    raw_token: Optional[str] = None

    if user:
        raw_token = generate_secure_token(32)
        token_hash = hash_token(raw_token)
        # 1-hour expiration
        db.create_auth_token(
            user_id=user["id"],
            token_type="password_reset",
            token_hash=token_hash,
            expires_at=time.time() + 3600.0,
        )
        logger.info("Password reset requested for %s", clean_email)

    # Always return a generic success message to prevent user enumeration
    return MessageResponse(
        status="ok",
        message="If that email address is registered, password reset instructions have been sent.",
        reset_token=raw_token,  # Facilitates testing/offline verification
    )


# ── POST /api/auth/reset-password ───────────────────────────────────────────

@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    req: ResetPasswordRequest,
    request: Request,
) -> MessageResponse:
    """Reset password using an unexpired single-use reset token."""
    db = _get_db(request)

    token_hash = hash_token(req.token.strip())
    valid_token = db.get_valid_auth_token("password_reset", token_hash)

    if not valid_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid, expired, or already used password reset token.",
        )

    # Validate new password
    valid_p, p_err = validate_password_strength(req.new_password)
    if not valid_p:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=p_err)

    # Hash with Argon2id and update
    new_hash = hash_password(req.new_password)
    db.update_user_password(valid_token["user_id"], new_hash)

    # Consume token & revoke existing sessions
    db.consume_auth_token(token_hash)
    db.revoke_all_user_refresh_tokens(valid_token["user_id"])

    logger.info("Password reset executed for user ID=%d", valid_token["user_id"])
    return MessageResponse(
        status="ok",
        message="Your password has been reset successfully. You can now log in with your new password.",
    )


# ── POST /api/auth/verify-email ─────────────────────────────────────────────

@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(
    req: VerifyEmailRequest,
    request: Request,
) -> MessageResponse:
    """Verify an email address using a single-use token."""
    db = _get_db(request)

    token_hash = hash_token(req.token.strip())
    valid_token = db.get_valid_auth_token("verify_email", token_hash)

    if not valid_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid, expired, or already used email verification token.",
        )

    db.set_user_verified(valid_token["user_id"], True)
    db.consume_auth_token(token_hash)

    logger.info("Email verified for user ID=%d", valid_token["user_id"])
    return MessageResponse(status="ok", message="Email address verified successfully!")


# ── POST /api/auth/resend-verification ──────────────────────────────────────

@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification(
    req: ResendVerificationRequest,
    request: Request,
) -> MessageResponse:
    """Generate and send a fresh email verification token."""
    db = _get_db(request)
    clean_email = req.email.strip().lower()

    user = db.get_user_by_email(clean_email)
    raw_token: Optional[str] = None

    if user and not user.get("is_verified", 0):
        raw_token = generate_secure_token(32)
        token_hash = hash_token(raw_token)
        db.create_auth_token(
            user_id=user["id"],
            token_type="verify_email",
            token_hash=token_hash,
            expires_at=time.time() + (24 * 3600.0),
        )
        logger.info("Resent email verification for %s", clean_email)

    return MessageResponse(
        status="ok",
        message="If an unverified account exists for that email, a verification link has been sent.",
        verification_token=raw_token,
    )


# ── POST /api/auth/regenerate-api-key ───────────────────────────────────────

@router.post("/regenerate-api-key", response_model=ApiKeyResponse)
async def regenerate_user_api_key(
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> ApiKeyResponse:
    """Generate and assign a new Agent API key for the current user."""
    db = _get_db(request)
    new_api_key = generate_api_key()
    db.update_user_api_key(user["id"], new_api_key)

    logger.info("API key rotated for user %s (ID=%d)", user["username"], user["id"])
    return ApiKeyResponse(
        status="ok",
        api_key=new_api_key,
        message="Agent API key regenerated successfully.",
    )

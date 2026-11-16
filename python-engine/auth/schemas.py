"""NetShield AI — Authentication Request and Response Schemas.

Pydantic models for authentication, profile management, and token exchange.
"""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    """Payload for user registration."""
    username: str = Field(..., description="Unique username (3-32 characters)")
    email: str = Field(..., description="Unique email address")
    password: str = Field(..., description="Password (min 12 chars, upper, lower, digit, special)")


class LoginRequest(BaseModel):
    """Payload for user login."""
    identifier: str = Field(..., description="Username or email address")
    password: str = Field(..., description="Account password")


class ForgotPasswordRequest(BaseModel):
    """Payload to request a password reset email/token."""
    email: str = Field(..., description="Account email address")


class ResetPasswordRequest(BaseModel):
    """Payload to execute a password reset with an expiring token."""
    token: str = Field(..., description="Password reset token")
    new_password: str = Field(..., description="New password meeting complexity rules")


class VerifyEmailRequest(BaseModel):
    """Payload to verify an email address using a single-use token."""
    token: str = Field(..., description="Email verification token")


class ResendVerificationRequest(BaseModel):
    """Payload to resend the email verification token."""
    email: str = Field(..., description="Account email address")


class ChangePasswordRequest(BaseModel):
    """Payload to change password for an authenticated user."""
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., description="New password meeting complexity rules")


class UpdateProfileRequest(BaseModel):
    """Payload to update profile information for the current user."""
    username: Optional[str] = Field(None, description="New username")
    email: Optional[str] = Field(None, description="New email address")


class RefreshRequest(BaseModel):
    """Payload to refresh an access token."""
    refresh_token: Optional[str] = Field(None, description="Active refresh token")


class UserResponse(BaseModel):
    """Sanitized public user representation (never exposes password hashes or secret tokens)."""
    id: int
    username: str
    email: str
    role: str
    is_verified: bool
    api_key: str
    created_at: float
    updated_at: float
    last_login: Optional[float] = None


class AuthResponse(BaseModel):
    """Response returned upon successful authentication (register, login, refresh)."""
    message: str
    token: str
    token_type: str = "Bearer"
    expires_in: int
    user: UserResponse
    refresh_token: Optional[str] = None


class MessageResponse(BaseModel):
    """Generic status and message response."""
    status: str = "ok"
    message: str
    verification_token: Optional[str] = None  # Returned for local testing if SMTP not configured
    reset_token: Optional[str] = None         # Returned for local testing if SMTP not configured


class ApiKeyResponse(BaseModel):
    """Response returned when an API key is generated or rotated."""
    status: str = "ok"
    api_key: str
    message: str

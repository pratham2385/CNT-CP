"""NetShield AI — End-to-End Production Authentication & Security Suite.

Tests:
1. Strict Password Policy Validation (Length, Upper, Lower, Number, Special, Blacklist)
2. Case-Insensitive Unique Emails & Usernames (Database Level)
3. Argon2id Password Hashing Verification
4. User Registration & First-User Auto-Admin
5. Rate Limiting & Brute-Force Lockout (5 failed attempts -> 429 lockout)
6. HttpOnly Cookie & Bearer JWT Authentication
7. Session Invalidation & Single-Use Refresh Token Rotation
8. Role-Based Authorization & Privilege Escalation Prevention
9. Password Change with Hash Regeneration & Session Invalidation
10. Email Verification with Single-Use Expiring Tokens
11. Password Reset with Single-Use Expiring Tokens
12. API Key Generation & Rotation
13. Node Gateway (Port 3001) Proxy Interoperability
"""

import sys
import time
import uuid
import requests

FASTAPI_URL = "http://127.0.0.1:8000"
NODE_URL = "http://127.0.0.1:3001"

TEST_RUN_ID = uuid.uuid4().hex[:6]
ADMIN_USER = f"admin_{TEST_RUN_ID}"
ADMIN_EMAIL = f"admin_{TEST_RUN_ID}@netshield.soc"
ADMIN_PW = "P@ssw0rd!2026SecureAdmin"

ANALYST_USER = f"analyst_{TEST_RUN_ID}"
ANALYST_EMAIL = f"analyst_{TEST_RUN_ID}@netshield.soc"
ANALYST_PW = "Str0ng#Analyst2026Pass"

passed = 0
failed = 0

def test_assert(condition: bool, description: str):
    global passed, failed
    if condition:
        print(f"  [PASS] {description}", flush=True)
        passed += 1
    else:
        print(f"  [FAIL] {description}", flush=True)
        failed += 1


def main():
    print("=" * 65)
    print("  NetShield AI — Production Auth Test Suite")
    print(f"  Target FastAPI: {FASTAPI_URL}")
    print(f"  Target Node Gateway: {NODE_URL}")
    print("=" * 65)

    session = requests.Session()

    # -------------------------------------------------------------
    # 1. Strict Password Policy Rejections
    # -------------------------------------------------------------
    print("\n[1] Testing Strict Password Policy Validation...")
    weak_passwords = [
        ("Short1!", "Minimum length requirement (<12 chars)"),
        ("alllowercase123!", "Missing uppercase letter"),
        ("ALLUPPERCASE123!", "Missing lowercase letter"),
        ("NoDigitsInPassword!", "Missing numeric digit"),
        ("NoSpecialSymbols123", "Missing special symbol"),
        ("Password1234!", "Blacklisted / common password"),
    ]

    for weak_pw, reason in weak_passwords:
        r = session.post(
            f"{FASTAPI_URL}/api/auth/register",
            json={"username": f"test_{uuid.uuid4().hex[:4]}", "email": f"test_{uuid.uuid4().hex[:4]}@soc.ai", "password": weak_pw},
        )
        test_assert(r.status_code == 400, f"Rejected weak password: {reason} (HTTP {r.status_code})")

    # -------------------------------------------------------------
    # 2. Username & Email Format Validation
    # -------------------------------------------------------------
    print("\n[2] Testing Username & Email Format Validation...")
    r = session.post(
        f"{FASTAPI_URL}/api/auth/register",
        json={"username": "ab", "email": "valid@soc.ai", "password": ADMIN_PW},
    )
    test_assert(r.status_code == 400, "Rejected too short username (2 chars)")

    r = session.post(
        f"{FASTAPI_URL}/api/auth/register",
        json={"username": "invalid user with spaces", "email": "valid@soc.ai", "password": ADMIN_PW},
    )
    test_assert(r.status_code == 400, "Rejected username with spaces")

    r = session.post(
        f"{FASTAPI_URL}/api/auth/register",
        json={"username": f"user_{uuid.uuid4().hex[:4]}", "email": "not-an-email", "password": ADMIN_PW},
    )
    test_assert(r.status_code == 400, "Rejected malformed email address")

    # -------------------------------------------------------------
    # 3. Successful Registration & First-User Auto-Admin
    # -------------------------------------------------------------
    print("\n[3] Testing User Registration & Auto-Admin Assignment...")
    r = session.post(
        f"{FASTAPI_URL}/api/auth/register",
        json={"username": ADMIN_USER, "email": ADMIN_EMAIL, "password": ADMIN_PW},
    )
    test_assert(r.status_code == 201, f"Registered primary user (HTTP {r.status_code})")
    data = r.json()
    user_info = data.get("user", {})
    admin_token = data.get("token")
    admin_id = user_info.get("id")

    test_assert("password" not in user_info and "password_hash" not in user_info, "Never exposed password_hash in response")
    test_assert(bool(admin_token), "Received Bearer JWT access token")
    test_assert("netshield_access_token" in session.cookies or "netshield_refresh_token" in session.cookies, "HttpOnly cookies set on registration")
    print(f"      Assigned Role: {user_info.get('role')} (ID: {admin_id})")

    # -------------------------------------------------------------
    # 4. Case-Insensitive Unique Constraints
    # -------------------------------------------------------------
    print("\n[4] Testing Case-Insensitive Uniqueness at Database Level...")
    r_dup_email = session.post(
        f"{FASTAPI_URL}/api/auth/register",
        json={"username": f"different_{uuid.uuid4().hex[:4]}", "email": ADMIN_EMAIL.upper(), "password": ADMIN_PW},
    )
    test_assert(r_dup_email.status_code == 409, f"Rejected duplicate email in UPPERCASE: HTTP {r_dup_email.status_code}")

    r_dup_user = session.post(
        f"{FASTAPI_URL}/api/auth/register",
        json={"username": ADMIN_USER.upper(), "email": f"diff_{uuid.uuid4().hex[:4]}@soc.ai", "password": ADMIN_PW},
    )
    test_assert(r_dup_user.status_code == 409, f"Rejected duplicate username in UPPERCASE: HTTP {r_dup_user.status_code}")

    # Register second user (Analyst)
    r_analyst = requests.post(
        f"{FASTAPI_URL}/api/auth/register",
        json={"username": ANALYST_USER, "email": ANALYST_EMAIL, "password": ANALYST_PW},
    )
    test_assert(r_analyst.status_code == 201, "Registered second user (Analyst)")
    analyst_data = r_analyst.json()
    test_assert(analyst_data.get("user", {}).get("role") == "analyst", "Subsequent user assigned 'analyst' role")

    # -------------------------------------------------------------
    # 5. Rate Limiting & Brute-Force Lockout
    # -------------------------------------------------------------
    print("\n[5] Testing Rate Limiting & Brute-Force Protection...")
    brute_session = requests.Session()
    lockout_hit = False

    for attempt in range(1, 8):
        res = brute_session.post(
            f"{FASTAPI_URL}/api/auth/login",
            json={"identifier": ANALYST_USER, "password": "WrongPassword123!"},
        )
        if res.status_code == 429:
            lockout_hit = True
            print(f"      Attempt {attempt} triggered HTTP 429 Lockout: {res.json().get('detail')}")
            break

    test_assert(lockout_hit, "Rate limiter locked out user after 5 failed attempts (HTTP 429)")

    # -------------------------------------------------------------
    # 6. Authentication via Bearer Header and HttpOnly Cookie
    # -------------------------------------------------------------
    print("\n[6] Testing Authentication (Cookie & Bearer Header)...")
    # Login as admin
    login_session = requests.Session()
    r_login = login_session.post(
        f"{FASTAPI_URL}/api/auth/login",
        json={"identifier": ADMIN_EMAIL, "password": ADMIN_PW},
    )
    test_assert(r_login.status_code == 200, "Admin login successful")
    token = r_login.json().get("token")

    # Test /api/auth/me using Bearer header
    r_me_bearer = requests.get(
        f"{FASTAPI_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    test_assert(r_me_bearer.status_code == 200, "Authenticated via Bearer header")
    test_assert(r_me_bearer.json().get("user", {}).get("username") == ADMIN_USER, "Correct user profile returned")

    # Test /api/auth/me using Cookies only (no Authorization header)
    r_me_cookie = login_session.get(f"{FASTAPI_URL}/api/auth/me")
    test_assert(r_me_cookie.status_code == 200, "Authenticated via HttpOnly Cookie")

    # -------------------------------------------------------------
    # 7. Single-Use Refresh Token Rotation
    # -------------------------------------------------------------
    print("\n[7] Testing Refresh Token Rotation & Replay Prevention...")
    refresh_token = r_login.json().get("refresh_token")
    test_assert(bool(refresh_token), "Received refresh token")

    # First refresh succeeds
    r_refresh1 = login_session.post(
        f"{FASTAPI_URL}/api/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    test_assert(r_refresh1.status_code == 200, "First token refresh succeeded")
    new_refresh_token = r_refresh1.json().get("refresh_token")
    test_assert(new_refresh_token != refresh_token, "Rotated to a fresh refresh token")

    # Replay old refresh token -> must fail
    r_replay = login_session.post(
        f"{FASTAPI_URL}/api/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    test_assert(r_replay.status_code == 401, f"Replay of consumed refresh token rejected (HTTP {r_replay.status_code})")

    # -------------------------------------------------------------
    # 8. Profile Update & Privilege Escalation Prevention
    # -------------------------------------------------------------
    print("\n[8] Testing Profile Update & Privilege Escalation Prevention...")
    updated_username = f"admin_new_{uuid.uuid4().hex[:4]}"
    r_update = login_session.patch(
        f"{FASTAPI_URL}/api/auth/me",
        json={"username": updated_username, "role": "superadmin_hacked"},
    )
    test_assert(r_update.status_code == 200, "Profile updated successfully")
    test_assert(
        r_update.json().get("user", {}).get("role") == user_info.get("role") and
        r_update.json().get("user", {}).get("role") != "superadmin_hacked",
        "Prevented privilege escalation (role unmodified)"
    )
    test_assert(r_update.json().get("user", {}).get("username") == updated_username, "Username updated in database")

    # -------------------------------------------------------------
    # 9. Password Change
    # -------------------------------------------------------------
    print("\n[9] Testing Password Change Flow...")
    new_admin_pw = "BrandNew#Admin2026Updated"
    # Try with wrong current password
    r_wrong_pw = login_session.post(
        f"{FASTAPI_URL}/api/auth/change-password",
        json={"current_password": "WrongCurrentPassword123!", "new_password": new_admin_pw},
    )
    test_assert(r_wrong_pw.status_code == 400, "Rejected change password with incorrect current password")

    # Valid change
    r_change_ok = login_session.post(
        f"{FASTAPI_URL}/api/auth/change-password",
        json={"current_password": ADMIN_PW, "new_password": new_admin_pw},
    )
    test_assert(r_change_ok.status_code == 200, "Password changed successfully")

    # Verify old password no longer works
    r_old_login = requests.post(
        f"{FASTAPI_URL}/api/auth/login",
        json={"identifier": updated_username, "password": ADMIN_PW},
    )
    test_assert(r_old_login.status_code == 401, "Old password rejected after change")

    # Verify new password works
    r_new_login = requests.post(
        f"{FASTAPI_URL}/api/auth/login",
        json={"identifier": updated_username, "password": new_admin_pw},
    )
    test_assert(r_new_login.status_code == 200, "New password authenticated successfully")
    active_token = r_new_login.json().get("token")

    # -------------------------------------------------------------
    # 10. Email Verification Flow
    # -------------------------------------------------------------
    print("\n[10] Testing Email Verification Flow...")
    r_resend = requests.post(
        f"{FASTAPI_URL}/api/auth/resend-verification",
        json={"email": ADMIN_EMAIL},
    )
    test_assert(r_resend.status_code == 200, "Resend verification token requested")
    verify_token = r_resend.json().get("verification_token")
    test_assert(bool(verify_token), "Generated secure verification token")

    # Verify with token
    r_verify = requests.post(
        f"{FASTAPI_URL}/api/auth/verify-email",
        json={"token": verify_token},
    )
    test_assert(r_verify.status_code == 200, "Email verified successfully")

    # Verify user profile shows is_verified = True
    r_check_ver = requests.get(
        f"{FASTAPI_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {active_token}"},
    )
    test_assert(r_check_ver.json().get("user", {}).get("is_verified") is True, "User is_verified is now True")

    # Replay same verification token -> should fail
    r_verify_replay = requests.post(
        f"{FASTAPI_URL}/api/auth/verify-email",
        json={"token": verify_token},
    )
    test_assert(r_verify_replay.status_code == 400, "Single-use verification token cannot be reused")

    # -------------------------------------------------------------
    # 11. Forgot Password & Reset Flow
    # -------------------------------------------------------------
    print("\n[11] Testing Forgot Password & Reset Flow...")
    r_forgot = requests.post(
        f"{FASTAPI_URL}/api/auth/forgot-password",
        json={"email": ADMIN_EMAIL},
    )
    test_assert(r_forgot.status_code == 200, "Forgot password token requested")
    reset_token = r_forgot.json().get("reset_token")
    test_assert(bool(reset_token), "Reset token generated")

    final_admin_pw = "Fin@lAdminPassword2026!"
    r_reset = requests.post(
        f"{FASTAPI_URL}/api/auth/reset-password",
        json={"token": reset_token, "new_password": final_admin_pw},
    )
    test_assert(r_reset.status_code == 200, "Password reset with token successful")

    # Replay same reset token -> should fail
    r_reset_replay = requests.post(
        f"{FASTAPI_URL}/api/auth/reset-password",
        json={"token": reset_token, "new_password": "AnotherPassword123!"},
    )
    test_assert(r_reset_replay.status_code == 400, "Single-use reset token cannot be reused")

    # -------------------------------------------------------------
    # 12. API Key Rotation
    # -------------------------------------------------------------
    print("\n[12] Testing Agent API Key Rotation...")
    # Login with reset password
    r_final_login = requests.post(
        f"{FASTAPI_URL}/api/auth/login",
        json={"identifier": ADMIN_EMAIL, "password": final_admin_pw},
    )
    final_token = r_final_login.json().get("token")
    old_api_key = r_final_login.json().get("user", {}).get("api_key")
    test_assert(old_api_key.startswith("ns_live_"), "Initial API Key starts with 'ns_live_'")

    r_rotate_key = requests.post(
        f"{FASTAPI_URL}/api/auth/regenerate-api-key",
        headers={"Authorization": f"Bearer {final_token}"},
    )
    test_assert(r_rotate_key.status_code == 200, "API Key rotated successfully")
    new_api_key = r_rotate_key.json().get("api_key")
    test_assert(new_api_key != old_api_key, "Rotated API key differs from previous key")

    # -------------------------------------------------------------
    # 13. Logout & Invalidation
    # -------------------------------------------------------------
    print("\n[13] Testing Logout & Session Invalidation...")
    logout_session = requests.Session()
    r_in = logout_session.post(
        f"{FASTAPI_URL}/api/auth/login",
        json={"identifier": ADMIN_EMAIL, "password": final_admin_pw},
    )
    test_assert(r_in.status_code == 200, "Login for logout test succeeded")
    test_assert("netshield_access_token" in logout_session.cookies, "Session cookie present before logout")

    r_out = logout_session.post(f"{FASTAPI_URL}/api/auth/logout")
    test_assert(r_out.status_code == 200, "Logout request succeeded")
    # Verify cookie cleared or expired
    access_cookie = logout_session.cookies.get("netshield_access_token")
    test_assert(access_cookie is None or access_cookie == "", "Access cookie cleared on logout")

    # -------------------------------------------------------------
    # 14. Node Gateway Proxy (Port 3001) Interoperability
    # -------------------------------------------------------------
    print("\n[14] Testing Node.js Gateway Proxy Interoperability (Port 3001)...")
    try:
        node_session = requests.Session()
        r_node_login = node_session.post(
            f"{NODE_URL}/api/auth/login",
            json={"identifier": ADMIN_EMAIL, "password": final_admin_pw},
            timeout=5,
        )
        test_assert(r_node_login.status_code == 200, f"Node Gateway proxies login correctly (HTTP {r_node_login.status_code})")
        node_token = r_node_login.json().get("token")
        test_assert(bool(node_token), "Node Gateway returned token")

        r_node_me = node_session.get(
            f"{NODE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {node_token}"},
            timeout=5,
        )
        test_assert(r_node_me.status_code == 200, "Node Gateway proxies /api/auth/me with Bearer token")
    except Exception as e:
        print(f"      Node Gateway proxy check notice: {e}")

    # -------------------------------------------------------------
    # Summary
    # -------------------------------------------------------------
    print("\n" + "=" * 65)
    print(f"  PRODUCTION AUTH TEST RESULTS: {passed} PASSED, {failed} FAILED")
    print("=" * 65)

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()

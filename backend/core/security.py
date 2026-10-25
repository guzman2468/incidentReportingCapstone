import base64
import hashlib
import hmac
import json
import os
import time

from dotenv import load_dotenv


load_dotenv()


SESSION_COOKIE = "incident_session"
SESSION_MAX_AGE = 60 * 60 * 8
_session_secret = os.getenv("SESSION_SECRET")
if not _session_secret:
    raise RuntimeError("SESSION_SECRET is not set")
SESSION_SECRET = _session_secret.encode("utf-8")


def hash_password(password: str) -> str:
    """Return a salted, one-way password hash suitable for database storage."""
    salt = os.urandom(16)
    password_bytes = password.encode("utf-8")
    digest = hashlib.scrypt(password_bytes, salt=salt, n=2**14, r=8, p=1)

    encoded_salt = base64.urlsafe_b64encode(salt).decode("ascii")
    encoded_digest = base64.urlsafe_b64encode(digest).decode("ascii")
    return f"scrypt${encoded_salt}${encoded_digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against a hash produced by :func:`hash_password`."""
    try:
        algorithm, encoded_salt, encoded_digest = stored_hash.split("$", 2)
        if algorithm != "scrypt":
            return False

        salt_bytes = encoded_salt.encode("ascii")
        digest_bytes = encoded_digest.encode("ascii")
        salt = base64.urlsafe_b64decode(salt_bytes)
        expected_digest = base64.urlsafe_b64decode(digest_bytes)

        password_bytes = password.encode("utf-8")
        actual_digest = hashlib.scrypt(
            password_bytes,
            salt=salt,
            n=2**14,
            r=8,
            p=1,
        )
        return hmac.compare_digest(actual_digest, expected_digest)
    except (TypeError, ValueError):
        return False


def create_session_token(email: str) -> str:
    expiration_time = int(time.time()) + SESSION_MAX_AGE
    payload_data = {"email": email, "expires": expiration_time}
    payload_json = json.dumps(payload_data, separators=(",", ":"))
    payload = payload_json.encode("utf-8")

    encoded_payload = base64.urlsafe_b64encode(payload).decode("ascii")
    payload_bytes = encoded_payload.encode("ascii")
    signature = hmac.new(SESSION_SECRET, payload_bytes, hashlib.sha256).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).decode("ascii")

    return f"{encoded_payload}.{encoded_signature}"


def get_session_email(token: str | None) -> str | None:
    if not token or "." not in token:
        return None

    encoded_payload, encoded_signature = token.split(".", 1)
    payload_bytes = encoded_payload.encode("ascii")
    expected_signature = hmac.new(SESSION_SECRET, payload_bytes, hashlib.sha256).digest()

    try:
        signature_bytes = encoded_signature.encode("ascii")
        supplied_signature = base64.urlsafe_b64decode(signature_bytes)

        encoded_payload_bytes = encoded_payload.encode("ascii")
        decoded_payload = base64.urlsafe_b64decode(encoded_payload_bytes)
        payload = json.loads(decoded_payload)
    except (ValueError, TypeError):
        return None

    if not hmac.compare_digest(supplied_signature, expected_signature):
        return None
    if payload.get("expires", 0) < time.time():
        return None
    return payload.get("email")

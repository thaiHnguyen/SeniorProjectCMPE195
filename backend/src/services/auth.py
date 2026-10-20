"""
Password hashing and session tokens (NEW: login/logout)

Uses only the Python standard library, so there is nothing new to install
and no secret key to keep in .env:
- Passwords: scrypt with a random salt per user. Only the hash is stored.
- Sessions: a random token is handed to the browser; the database keeps
    only its SHA-256, so a copy of the DB can't be used to log in.
"""

import hashlib
import hmac
import secrets

# How long a login lasts. The frontend decides where it keeps the token:
# "Remember me" checked -> localStorage (survives closing the browser, up to this limit)
# unchecked             -> sessionStorage (gone when the browser closes)
SESSION_HOURS = 6

# scrypt cost settings (OWASP minimum). ~50 ms per hash on a Raspberry Pi 5:
# slow enough to make guessing expensive, fast enough for a login.
_SCRYPT_N = 2**14
_SCRYPT_R = 8
_SCRYPT_P = 1


def hash_password(password: str) -> str:
    """
    Hash a password for storage.
    Format: scrypt$<n>$<r>$<p>$<salt hex>$<hash hex>, so the settings can
    change later without breaking existing accounts.
    """
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"), salt=salt, n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P
    )
    return f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Check a password against a stored hash. Never raises on bad input."""
    try:
        scheme, n, r, p, salt_hex, digest_hex = stored.split("$")
        if scheme != "scrypt":
            return False
        digest = hashlib.scrypt(
            password.encode("utf-8"),
            salt=bytes.fromhex(salt_hex),
            n=int(n), r=int(r), p=int(p),
        )
        # constant-time compare: response time doesn't reveal how close a guess was
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


# A real hash of a random password. Login checks wrong emails against it, so
# "no such email" takes as long as "wrong password" and can't be told apart.
DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


def new_session_token() -> str:
    """Random token for the browser (256 bits, URL-safe)."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """What the sessions table stores instead of the token itself."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
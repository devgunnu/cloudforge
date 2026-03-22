from cryptography.fernet import Fernet, MultiFernet

from app.config import settings


def _get_fernet() -> MultiFernet:
    """
    Build a MultiFernet from FERNET_KEYS (comma-separated, newest first).
    Falls back to FERNET_KEY for backward compatibility.
    """
    raw = settings.fernet_keys if settings.fernet_keys else settings.fernet_key
    keys = [k.strip() for k in raw.split(",") if k.strip()]
    if not keys:
        raise ValueError("No Fernet keys configured")
    return MultiFernet([Fernet(k.encode()) for k in keys])


def encrypt(plaintext: str) -> str:
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    return _get_fernet().decrypt(ciphertext.encode()).decode()

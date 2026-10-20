"""Utilidades de seguridad compartidas por la API y los scripts de terminal."""
import hashlib
import os


def hash_password(password: str) -> str:
    """PBKDF2-SHA256 con sal aleatoria. Formato guardado: 'sal_hex:hash_hex'."""
    salt = os.urandom(16)
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
    return salt.hex() + ":" + h.hex()

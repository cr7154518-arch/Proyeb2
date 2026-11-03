from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class RolUsuario(str, Enum):
    MESERO = "mesero"
    COCINA = "cocina"
    ADMIN = "admin"


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str
    correo: str = Field(unique=True, index=True)
    contrasena_hash: str
    rol: RolUsuario


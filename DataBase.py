import os
from typing import Generator

from sqlmodel import Session, SQLModel, create_engine
from models.Inventory import Inventory
from models.Order import Order
from models.Order_Detail import OrderDetail
from models.Product_Category import ProductCategory, Product
from models.Table import Table
from models.User import User

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# En Render la variable DATABASE_URL ya viene configurada.
# En tu PC defínela en un archivo .env (ver .env.example) o en el entorno.
# Formato: postgresql+psycopg2://USUARIO:CLAVE@HOST:5432/NOMBRE_BD
# No se deja ninguna contraseña por defecto en el código.
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "Falta la variable DATABASE_URL. Copia .env.example a .env y "
        "coloca tu contraseña de PostgreSQL."
    )

# Render y SQLAlchemy: asegurarse de usar el driver psycopg2
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

# Para ver el SQL generado: SQL_ECHO=true en el .env
SQL_ECHO = os.getenv("SQL_ECHO", "false").lower() == "true"
engine = create_engine(DATABASE_URL, echo=SQL_ECHO, pool_pre_ping=True)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session

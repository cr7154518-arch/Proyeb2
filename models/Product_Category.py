from typing import Optional
from sqlmodel import Field, SQLModel


class ProductCategory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str  # Ej: Entradas, Platos Fuertes, Bebidas, Postres


class Product(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    nombre: str
    descripcion: Optional[str] = None
    precio: float
    disponibilidad: bool = True
    categoria_id: int = Field(foreign_key="productcategory.id")
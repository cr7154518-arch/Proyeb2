from typing import Optional
from sqlmodel import Field, SQLModel


class Inventory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    nombre_insumo: str
    cantidad: float
    unidad_medida: str  # Ej: "kg", "litros", "unidades"
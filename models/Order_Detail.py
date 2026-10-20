from typing import Optional
from sqlmodel import Field, SQLModel


# Asegúrate de que se llame OrderDetail (sin _)
class OrderDetail(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    order_id: int = Field(foreign_key="order.id")
    product_id: int = Field(foreign_key="product.id")
    cantidad: int
    precio_unitario: float
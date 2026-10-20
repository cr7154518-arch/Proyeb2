from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from sqlalchemy import DateTime
from sqlmodel import Field, SQLModel


class EstadoPedido(str, Enum):
    PENDIENTE = "PENDIENTE"
    EN_PREPARACION = "EN PREPARACIÓN"
    LISTO = "LISTO"
    ENTREGADO = "ENTREGADO"
    CANCELADO = "CANCELADO"


class TipoPedido(str, Enum):
    SALON = "salon"
    PARA_LLEVAR = "para_llevar"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Order(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    mesa_id: Optional[int] = Field(default=None, foreign_key="table.id")
    mesero_id: int = Field(foreign_key="user.id")
    tipo_pedido: TipoPedido = TipoPedido.SALON
    estado: EstadoPedido = EstadoPedido.PENDIENTE
    fecha_creacion: datetime = Field(
        default_factory=utcnow,
        sa_type=DateTime(timezone=True),
    )
    fecha_ultima_actualizacion: datetime = Field(
        default_factory=utcnow,
        sa_type=DateTime(timezone=True),
    )

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from DataBase import get_session
from models.Order import EstadoPedido, Order

router = APIRouter(prefix="/cocina", tags=["Cocina"])


@router.get("/orders", response_model=list[Order])
def list_orders(estado: EstadoPedido | None = None, session: Session = Depends(get_session)):
    query = select(Order)
    if estado:
        query = query.where(Order.estado == estado)
    return session.exec(query).all()


@router.get("/orders/pending", response_model=list[Order])
def get_pending_orders(session: Session = Depends(get_session)):
    return session.exec(select(Order).where(Order.estado == EstadoPedido.PENDIENTE)).all()


@router.put("/orders/{order_id}/status", response_model=Order)
def update_order_status(order_id: int, estado: EstadoPedido, session: Session = Depends(get_session)):
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    order.estado = estado
    order.fecha_ultima_actualizacion = datetime.now(timezone.utc)
    session.add(order)
    session.commit()
    session.refresh(order)
    return order

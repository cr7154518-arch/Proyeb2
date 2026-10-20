from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Field, Session, SQLModel, select

from DataBase import get_session
from models.Order import EstadoPedido, Order, TipoPedido
from models.Order_Detail import OrderDetail
from models.Product_Category import Product
from models.Table import Table
from models.User import User

router = APIRouter(prefix="/mesero", tags=["Mesero"])


# ---------- esquemas de entrada ----------
class OrderCreate(SQLModel):
    """HU-08: el pedido siempre nace en PENDIENTE; el cliente no envía estado ni fechas."""
    mesa_id: Optional[int] = None
    mesero_id: int
    tipo_pedido: TipoPedido = TipoPedido.SALON


class OrderUpdate(SQLModel):
    """HU-10: se pueden modificar mesa, mesero, tipo y estado (solo lo enviado)."""
    mesa_id: Optional[int] = None
    mesero_id: Optional[int] = None
    tipo_pedido: Optional[TipoPedido] = None
    estado: Optional[EstadoPedido] = None


class OrderItemCreate(SQLModel):
    product_id: int
    cantidad: int = Field(gt=0)


class OrderItemUpdate(SQLModel):
    cantidad: int = Field(gt=0)


# ---------- utilidades ----------
def get_order_or_404(session: Session, order_id: int) -> Order:
    order = session.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return order


def get_item_or_404(session: Session, order_id: int, item_id: int) -> OrderDetail:
    item = session.get(OrderDetail, item_id)
    if not item or item.order_id != order_id:
        raise HTTPException(status_code=404, detail="Ítem no encontrado en este pedido")
    return item


def touch(order: Order):
    order.fecha_ultima_actualizacion = datetime.now(timezone.utc)


def validate_order_refs(session: Session, mesa_id: Optional[int], mesero_id: int,
                        tipo_pedido: TipoPedido):
    """Verifica que la mesa y el mesero existan y que un pedido de salón tenga mesa."""
    if not session.get(User, mesero_id):
        raise HTTPException(status_code=404, detail="Mesero no encontrado")
    if mesa_id is not None and not session.get(Table, mesa_id):
        raise HTTPException(status_code=404, detail="Mesa no encontrada")
    if tipo_pedido == TipoPedido.SALON and mesa_id is None:
        raise HTTPException(status_code=400, detail="Un pedido de salón requiere una mesa")


# ---------- Consulta (menú y mesas) ----------
@router.get("/menu", response_model=list[Product])
def get_menu(session: Session = Depends(get_session)):
    return session.exec(select(Product)).all()


@router.get("/tables", response_model=list[Table])
def get_tables(session: Session = Depends(get_session)):
    return session.exec(select(Table)).all()


# ---------- CRUD de pedidos ----------
@router.post("/orders", response_model=Order, status_code=status.HTTP_201_CREATED)
def create_order(data: OrderCreate, session: Session = Depends(get_session)):
    validate_order_refs(session, data.mesa_id, data.mesero_id, data.tipo_pedido)
    order = Order(mesa_id=data.mesa_id, mesero_id=data.mesero_id,
                  tipo_pedido=data.tipo_pedido, estado=EstadoPedido.PENDIENTE)
    session.add(order)
    session.commit()
    session.refresh(order)
    return order


@router.get("/orders", response_model=list[Order])
def list_orders(estado: EstadoPedido | None = None, session: Session = Depends(get_session)):
    query = select(Order)
    if estado:
        query = query.where(Order.estado == estado)
    return session.exec(query).all()


@router.get("/orders/{order_id}", response_model=Order)
def get_order(order_id: int, session: Session = Depends(get_session)):
    return get_order_or_404(session, order_id)


@router.put("/orders/{order_id}", response_model=Order)
def update_order(order_id: int, data: OrderUpdate, session: Session = Depends(get_session)):
    order = get_order_or_404(session, order_id)
    cambios = data.model_dump(exclude_unset=True)
    if "mesero_id" in cambios and cambios["mesero_id"] is None:
        raise HTTPException(status_code=400, detail="mesero_id no puede ser nulo")
    if cambios.get("tipo_pedido") is None:
        cambios.pop("tipo_pedido", None)
    if cambios.get("estado") is None:
        cambios.pop("estado", None)
    # valores finales tras aplicar los cambios (mesa_id=null explícito limpia la mesa)
    mesa_id = cambios.get("mesa_id", order.mesa_id)
    mesero_id = cambios.get("mesero_id", order.mesero_id)
    tipo = cambios.get("tipo_pedido", order.tipo_pedido)
    validate_order_refs(session, mesa_id, mesero_id, tipo)
    for k, v in cambios.items():
        setattr(order, k, v)
    touch(order)
    session.add(order)
    session.commit()
    session.refresh(order)
    return order


@router.delete("/orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(order_id: int, session: Session = Depends(get_session)):
    order = get_order_or_404(session, order_id)
    for d in session.exec(select(OrderDetail).where(OrderDetail.order_id == order_id)).all():
        session.delete(d)
    session.delete(order)
    session.commit()


# ---------- CRUD de ítems del pedido ----------
@router.post("/orders/{order_id}/items", response_model=OrderDetail, status_code=status.HTTP_201_CREATED)
def add_order_item(order_id: int, data: OrderItemCreate, session: Session = Depends(get_session)):
    order = get_order_or_404(session, order_id)
    product = session.get(Product, data.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    detail = OrderDetail(order_id=order_id, product_id=product.id, cantidad=data.cantidad,
                         precio_unitario=product.precio)  # el precio lo fija el servidor
    touch(order)
    session.add(detail)
    session.add(order)
    session.commit()
    session.refresh(detail)
    return detail


@router.get("/orders/{order_id}/items", response_model=list[OrderDetail])
def list_order_items(order_id: int, session: Session = Depends(get_session)):
    get_order_or_404(session, order_id)
    return session.exec(select(OrderDetail).where(OrderDetail.order_id == order_id)).all()


@router.get("/orders/{order_id}/items/{item_id}", response_model=OrderDetail)
def get_order_item(order_id: int, item_id: int, session: Session = Depends(get_session)):
    get_order_or_404(session, order_id)
    return get_item_or_404(session, order_id, item_id)


@router.put("/orders/{order_id}/items/{item_id}", response_model=OrderDetail)
def update_order_item(order_id: int, item_id: int, data: OrderItemUpdate,
                      session: Session = Depends(get_session)):
    order = get_order_or_404(session, order_id)
    item = get_item_or_404(session, order_id, item_id)
    item.cantidad = data.cantidad
    touch(order)
    session.add(item)
    session.add(order)
    session.commit()
    session.refresh(item)
    return item


@router.delete("/orders/{order_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order_item(order_id: int, item_id: int, session: Session = Depends(get_session)):
    order = get_order_or_404(session, order_id)
    item = get_item_or_404(session, order_id, item_id)
    session.delete(item)
    touch(order)
    session.add(order)
    session.commit()

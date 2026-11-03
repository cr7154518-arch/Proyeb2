"""
Manager de Reglas de Negocio para PoliRestaurante.
Coordina la interacción entre entidades (especialmente Table y Order)
y aplica validaciones de negocio del restaurante.
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException, status
from sqlmodel import Session, select, func

from models.Table import Table
from models.Order import Order, EstadoPedido, TipoPedido
from models.User import User


class RestaurantManager:
    MAX_MESAS: int = 20  # Límite máximo de mesas permitido en el restaurante

    @classmethod
    def validar_limite_mesas(cls, session: Session):
        """Regla de negocio: no permitir más de MAX_MESAS mesas en el restaurante."""
        total_mesas = session.exec(select(func.count(Table.id))).one()
        if total_mesas >= cls.MAX_MESAS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Límite alcanzado: El restaurante tiene un máximo permitido de {cls.MAX_MESAS} mesas."
            )

    @classmethod
    def crear_mesa(cls, session: Session, numero: int, capacidad: int, estado: str = "disponible") -> Table:
        """Crea una mesa validando unicidad de número y el cupo máximo de mesas."""
        cls.validar_limite_mesas(session)
        if session.exec(select(Table).where(Table.numero == numero)).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El número de mesa ya está registrado"
            )
        mesa = Table(numero=numero, capacidad=capacidad, estado=estado)
        session.add(mesa)
        session.commit()
        session.refresh(mesa)
        return mesa

    @classmethod
    def crear_pedido_con_mesa(
        cls,
        session: Session,
        mesa_id: Optional[int],
        mesero_id: int,
        tipo_pedido: TipoPedido
    ) -> Order:
        """
        Interacción entre dos entidades: Order y Table.
        - Verifica que el mesero y la mesa existan.
        - Si es pedido de salón, verifica que la mesa esté 'disponible'.
        - Al crear la orden, cambia automáticamente el estado de la mesa a 'ocupada'.
        """
        # Validar mesero
        if not session.get(User, mesero_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mesero no encontrado")

        mesa = None
        if tipo_pedido == TipoPedido.SALON:
            if mesa_id is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Un pedido de salón requiere una mesa asignada"
                )
            mesa = session.get(Table, mesa_id)
            if not mesa:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mesa no encontrada")
            if mesa.estado.lower() == "ocupada":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"La mesa {mesa.numero} ya está ocupada por otro pedido activo"
                )

        # Crear orden
        order = Order(
            mesa_id=mesa_id,
            mesero_id=mesero_id,
            tipo_pedido=tipo_pedido,
            estado=EstadoPedido.PENDIENTE
        )
        session.add(order)

        # Interacción con la entidad Table: actualizar a ocupada
        if mesa:
            mesa.estado = "ocupada"
            session.add(mesa)

        session.commit()
        session.refresh(order)
        return order

    @classmethod
    def actualizar_estado_pedido(cls, session: Session, order_id: int, nuevo_estado: EstadoPedido) -> Order:
        """
        Interacción entre dos entidades: Al cambiar el estado de la Order,
        si el pedido finaliza (ENTREGADO o CANCELADO) y tiene mesa asignada,
        libera automáticamente la mesa cambiando su estado a 'disponible'.
        """
        order = session.get(Order, order_id)
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")

        order.estado = nuevo_estado
        order.fecha_ultima_actualizacion = datetime.now(timezone.utc)

        # Si el pedido finaliza o se cancela, y no hay otros pedidos activos en esa mesa, liberarla
        if nuevo_estado in (EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO) and order.mesa_id:
            pedidos_activos = session.exec(
                select(Order).where(
                    Order.mesa_id == order.mesa_id,
                    Order.id != order.id,
                    Order.estado.notin_([EstadoPedido.ENTREGADO, EstadoPedido.CANCELADO])
                )
            ).all()

            if not pedidos_activos:
                mesa = session.get(Table, order.mesa_id)
                if mesa:
                    mesa.estado = "disponible"
                    session.add(mesa)

        session.add(order)
        session.commit()
        session.refresh(order)
        return order


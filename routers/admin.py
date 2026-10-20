from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlmodel import Session, SQLModel, select

from DataBase import get_session
from models.Inventory import Inventory
from models.Order import Order
from models.Order_Detail import OrderDetail
from models.Product_Category import Product, ProductCategory
from models.Table import Table
from models.User import RolUsuario, User
from security import hash_password

router = APIRouter(prefix="/admin", tags=["Administrador"])


# ---------- utilidades ----------
def get_or_404(session: Session, model, obj_id: int, nombre: str):
    obj = session.get(model, obj_id)
    if not obj:
        raise HTTPException(status_code=404, detail=f"{nombre} no encontrado")
    return obj


def replace_fields(obj, body):
    """PUT = reemplazo completo de los campos (menos el id)."""
    for k, v in body.model_dump(exclude={"id"}).items():
        setattr(obj, k, v)


def save(session: Session, obj):
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


# ---------- USUARIOS ----------
class UserCreate(SQLModel):
    nombre: str
    correo: str
    contrasena: str
    rol: RolUsuario


class UserUpdate(SQLModel):
    nombre: Optional[str] = None
    correo: Optional[str] = None
    contrasena: Optional[str] = None
    rol: Optional[RolUsuario] = None


class UserRead(SQLModel):
    id: int
    nombre: str
    correo: str
    rol: RolUsuario


@router.post("/users", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(data: UserCreate, session: Session = Depends(get_session)):
    if session.exec(select(User).where(User.correo == data.correo)).first():
        raise HTTPException(status_code=400, detail="El correo ya está registrado")
    user = User(nombre=data.nombre, correo=data.correo, rol=data.rol,
                contrasena_hash=hash_password(data.contrasena))
    return save(session, user)


@router.get("/users", response_model=list[UserRead])
def list_users(session: Session = Depends(get_session)):
    return session.exec(select(User)).all()


@router.get("/users/{user_id}", response_model=UserRead)
def get_user(user_id: int, session: Session = Depends(get_session)):
    return get_or_404(session, User, user_id, "Usuario")


@router.put("/users/{user_id}", response_model=UserRead)
def update_user(user_id: int, data: UserUpdate, session: Session = Depends(get_session)):
    user = get_or_404(session, User, user_id, "Usuario")
    cambios = data.model_dump(exclude_unset=True)
    if "correo" in cambios:
        otro = session.exec(select(User).where(User.correo == cambios["correo"])).first()
        if otro and otro.id != user_id:
            raise HTTPException(status_code=400, detail="El correo ya está registrado")
    if "contrasena" in cambios:
        user.contrasena_hash = hash_password(cambios.pop("contrasena"))
    for k, v in cambios.items():
        setattr(user, k, v)
    return save(session, user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, session: Session = Depends(get_session)):
    user = get_or_404(session, User, user_id, "Usuario")
    if session.exec(select(Order).where(Order.mesero_id == user_id)).first():
        raise HTTPException(status_code=409, detail="El usuario tiene pedidos asociados")
    session.delete(user)
    session.commit()


# ---------- MESAS ----------
@router.post("/tables", response_model=Table, status_code=status.HTTP_201_CREATED)
def create_table(table: Table, session: Session = Depends(get_session)):
    if session.exec(select(Table).where(Table.numero == table.numero)).first():
        raise HTTPException(status_code=400, detail="El número de mesa ya está registrado")
    table.id = None
    return save(session, table)


@router.get("/tables", response_model=list[Table])
def list_tables(session: Session = Depends(get_session)):
    return session.exec(select(Table)).all()


@router.get("/tables/{table_id}", response_model=Table)
def get_table(table_id: int, session: Session = Depends(get_session)):
    return get_or_404(session, Table, table_id, "Mesa")


@router.put("/tables/{table_id}", response_model=Table)
def update_table(table_id: int, body: Table, session: Session = Depends(get_session)):
    table = get_or_404(session, Table, table_id, "Mesa")
    otra = session.exec(select(Table).where(Table.numero == body.numero)).first()
    if otra and otra.id != table_id:
        raise HTTPException(status_code=400, detail="El número de mesa ya está registrado")
    replace_fields(table, body)
    return save(session, table)


@router.delete("/tables/{table_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_table(table_id: int, session: Session = Depends(get_session)):
    table = get_or_404(session, Table, table_id, "Mesa")
    if session.exec(select(Order).where(Order.mesa_id == table_id)).first():
        raise HTTPException(status_code=409, detail="La mesa tiene pedidos asociados")
    session.delete(table)
    session.commit()


# ---------- CATEGORÍAS ----------
@router.post("/categories", response_model=ProductCategory, status_code=status.HTTP_201_CREATED)
def create_category(category: ProductCategory, session: Session = Depends(get_session)):
    category.id = None
    return save(session, category)


@router.get("/categories", response_model=list[ProductCategory])
def list_categories(session: Session = Depends(get_session)):
    return session.exec(select(ProductCategory)).all()


@router.get("/categories/{cat_id}", response_model=ProductCategory)
def get_category(cat_id: int, session: Session = Depends(get_session)):
    return get_or_404(session, ProductCategory, cat_id, "Categoría")


@router.put("/categories/{cat_id}", response_model=ProductCategory)
def update_category(cat_id: int, body: ProductCategory, session: Session = Depends(get_session)):
    cat = get_or_404(session, ProductCategory, cat_id, "Categoría")
    replace_fields(cat, body)
    return save(session, cat)


@router.delete("/categories/{cat_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(cat_id: int, session: Session = Depends(get_session)):
    cat = get_or_404(session, ProductCategory, cat_id, "Categoría")
    if session.exec(select(Product).where(Product.categoria_id == cat_id)).first():
        raise HTTPException(status_code=400, detail="La categoría tiene productos asociados")
    session.delete(cat)
    session.commit()


# ---------- PRODUCTOS ----------
def ensure_category(session: Session, categoria_id: int):
    # Mantiene el comportamiento del front: si no existe, crea "General"
    if not session.get(ProductCategory, categoria_id):
        session.add(ProductCategory(id=categoria_id, nombre="General"))
        session.commit()
        if session.get_bind().dialect.name == "postgresql":  # sincroniza la secuencia SERIAL
            session.execute(text(
                "SELECT setval(pg_get_serial_sequence('productcategory', 'id'), "
                "(SELECT MAX(id) FROM productcategory))"))
            session.commit()


@router.post("/products", response_model=Product, status_code=status.HTTP_201_CREATED)
def create_product(product: Product, session: Session = Depends(get_session)):
    ensure_category(session, product.categoria_id)
    product.id = None
    return save(session, product)


@router.get("/products", response_model=list[Product])
def list_products(session: Session = Depends(get_session)):
    return session.exec(select(Product)).all()


@router.get("/products/{product_id}", response_model=Product)
def get_product(product_id: int, session: Session = Depends(get_session)):
    return get_or_404(session, Product, product_id, "Producto")


@router.put("/products/{product_id}", response_model=Product)
def update_product(product_id: int, body: Product, session: Session = Depends(get_session)):
    product = get_or_404(session, Product, product_id, "Producto")
    ensure_category(session, body.categoria_id)
    replace_fields(product, body)
    return save(session, product)


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, session: Session = Depends(get_session)):
    product = get_or_404(session, Product, product_id, "Producto")
    if session.exec(select(OrderDetail).where(OrderDetail.product_id == product_id)).first():
        raise HTTPException(status_code=409, detail="El producto está en pedidos existentes")
    session.delete(product)
    session.commit()


# ---------- INVENTARIO ----------
@router.post("/inventory", response_model=Inventory, status_code=status.HTTP_201_CREATED)
def create_inventory_item(item: Inventory, session: Session = Depends(get_session)):
    item.id = None
    return save(session, item)


@router.get("/inventory", response_model=list[Inventory])
def list_inventory(session: Session = Depends(get_session)):
    return session.exec(select(Inventory)).all()


@router.get("/inventory/{item_id}", response_model=Inventory)
def get_inventory_item(item_id: int, session: Session = Depends(get_session)):
    return get_or_404(session, Inventory, item_id, "Insumo")


@router.put("/inventory/{item_id}", response_model=Inventory)
def update_inventory_item(item_id: int, body: Inventory, session: Session = Depends(get_session)):
    item = get_or_404(session, Inventory, item_id, "Insumo")
    replace_fields(item, body)
    return save(session, item)


@router.delete("/inventory/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_inventory_item(item_id: int, session: Session = Depends(get_session)):
    session.delete(get_or_404(session, Inventory, item_id, "Insumo"))
    session.commit()

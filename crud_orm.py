"""
CRUD con acceso a través de ORM (SQLModel / SQLAlchemy).
Entidades: Mesas, Productos y Usuarios. Usa los mismos modelos de la carpeta models/.
Ejecutar desde la raíz del proyecto:  py crud_orm.py
"""
from sqlalchemy import text
from sqlmodel import Session, select

from DataBase import create_db_and_tables, engine
from models.Order import Order
from models.Product_Category import Product, ProductCategory
from models.Table import Table
from models.User import RolUsuario, User
from security import hash_password


# ======================= MESAS =======================
def crear_mesa(numero, capacidad, estado="disponible"):
    with Session(engine) as session:
        mesa = Table(numero=numero, capacidad=capacidad, estado=estado)
        session.add(mesa)
        session.commit()
        session.refresh(mesa)
        return mesa


def listar_mesas():
    with Session(engine) as session:
        return session.exec(select(Table).order_by(Table.id)).all()


def obtener_mesa(mesa_id):
    with Session(engine) as session:
        return session.get(Table, mesa_id)


def actualizar_mesa(mesa_id, numero, capacidad, estado):
    with Session(engine) as session:
        mesa = session.get(Table, mesa_id)
        if not mesa:
            return None
        mesa.numero, mesa.capacidad, mesa.estado = numero, capacidad, estado
        session.add(mesa)
        session.commit()
        session.refresh(mesa)
        return mesa


def eliminar_mesa(mesa_id):
    with Session(engine) as session:
        mesa = session.get(Table, mesa_id)
        if not mesa:
            return False
        session.delete(mesa)
        session.commit()
        return True


# ======================= PRODUCTOS =======================
def asegurar_categoria(session, categoria_id):
    if not session.get(ProductCategory, categoria_id):
        session.add(ProductCategory(id=categoria_id, nombre="General"))
        session.commit()
        if engine.dialect.name == "postgresql":  # sincroniza la secuencia SERIAL
            session.execute(text(
                "SELECT setval(pg_get_serial_sequence('productcategory', 'id'), "
                "(SELECT MAX(id) FROM productcategory))"))
            session.commit()


def crear_producto(nombre, descripcion, precio, categoria_id=1, disponibilidad=True):
    with Session(engine) as session:
        asegurar_categoria(session, categoria_id)
        prod = Product(nombre=nombre, descripcion=descripcion, precio=precio,
                       disponibilidad=disponibilidad, categoria_id=categoria_id)
        session.add(prod)
        session.commit()
        session.refresh(prod)
        return prod


def listar_productos():
    with Session(engine) as session:
        return session.exec(select(Product).order_by(Product.id)).all()


def obtener_producto(prod_id):
    with Session(engine) as session:
        return session.get(Product, prod_id)


def actualizar_producto(prod_id, nombre, descripcion, precio, disponibilidad, categoria_id):
    with Session(engine) as session:
        prod = session.get(Product, prod_id)
        if not prod:
            return None
        asegurar_categoria(session, categoria_id)
        prod.nombre, prod.descripcion, prod.precio = nombre, descripcion, precio
        prod.disponibilidad, prod.categoria_id = disponibilidad, categoria_id
        session.add(prod)
        session.commit()
        session.refresh(prod)
        return prod


def eliminar_producto(prod_id):
    with Session(engine) as session:
        prod = session.get(Product, prod_id)
        if not prod:
            return False
        session.delete(prod)
        session.commit()
        return True


# ======================= USUARIOS =======================
def validar_rol(texto):
    try:
        return RolUsuario(texto.strip().lower())
    except ValueError:
        raise ValueError("Rol inválido: use mesero, cocina o admin")


def usuario_a_dict(u):
    """Nunca se muestra el hash de la contraseña."""
    return {"id": u.id, "nombre": u.nombre, "correo": u.correo, "rol": u.rol.value}


def crear_usuario(nombre, correo, contrasena, rol):
    if not contrasena:
        raise ValueError("La contraseña es obligatoria")
    rol = validar_rol(rol)
    with Session(engine) as session:
        if session.exec(select(User).where(User.correo == correo)).first():
            raise ValueError("El correo ya está registrado")
        user = User(nombre=nombre, correo=correo, rol=rol,
                    contrasena_hash=hash_password(contrasena))
        session.add(user)
        session.commit()
        session.refresh(user)
        return usuario_a_dict(user)


def listar_usuarios():
    with Session(engine) as session:
        return [usuario_a_dict(u) for u in session.exec(select(User).order_by(User.id)).all()]


def obtener_usuario(user_id):
    with Session(engine) as session:
        u = session.get(User, user_id)
        return usuario_a_dict(u) if u else None


def actualizar_usuario(user_id, nombre=None, correo=None, contrasena=None, rol=None):
    """Solo cambia los campos que se envían (los None se dejan igual)."""
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            return None
        if correo:
            otro = session.exec(select(User).where(User.correo == correo)).first()
            if otro and otro.id != user_id:
                raise ValueError("El correo ya está registrado")
            user.correo = correo
        if nombre:
            user.nombre = nombre
        if contrasena:
            user.contrasena_hash = hash_password(contrasena)
        if rol:
            user.rol = validar_rol(rol)
        session.add(user)
        session.commit()
        session.refresh(user)
        return usuario_a_dict(user)


def eliminar_usuario(user_id):
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            return False
        if session.exec(select(Order).where(Order.mesero_id == user_id)).first():
            raise ValueError("El usuario tiene pedidos asociados; no se puede eliminar")
        session.delete(user)
        session.commit()
        return True


# ======================= MENÚ DE CONSOLA =======================
def mostrar(objs):
    if not objs:
        print("  (sin registros)")
    for o in objs if isinstance(objs, list) else [objs]:
        print("  ", o.model_dump())


def mostrar_usuarios(u):
    if not u:
        print("  (sin registros)")
    for x in u if isinstance(u, list) else [u]:
        print("  ", x)


def menu_mesas():
    while True:
        print("\n--- MESAS ---\n1 Crear  2 Listar  3 Buscar por id  4 Actualizar  5 Eliminar  0 Volver")
        op = input("Opción: ").strip()
        try:
            if op == "1":
                print("Creada:", crear_mesa(int(input("Número: ")), int(input("Capacidad: "))).model_dump())
            elif op == "2":
                mostrar(listar_mesas())
            elif op == "3":
                m = obtener_mesa(int(input("Id: ")))
                mostrar(m) if m else print("No existe")
            elif op == "4":
                m = actualizar_mesa(int(input("Id: ")), int(input("Nuevo número: ")),
                                    int(input("Nueva capacidad: ")),
                                    input("Estado (disponible/ocupada): "))
                mostrar(m) if m else print("No existe")
            elif op == "5":
                print("Eliminada" if eliminar_mesa(int(input("Id: "))) else "No existe")
            elif op == "0":
                return
        except Exception as e:
            print("Error:", e)


def menu_productos():
    while True:
        print("\n--- PRODUCTOS ---\n1 Crear  2 Listar  3 Buscar por id  4 Actualizar  5 Eliminar  0 Volver")
        op = input("Opción: ").strip()
        try:
            if op == "1":
                p = crear_producto(input("Nombre: "), input("Descripción: "),
                                   float(input("Precio: ")), int(input("Id categoría (1): ") or 1))
                print("Creado:", p.model_dump())
            elif op == "2":
                mostrar(listar_productos())
            elif op == "3":
                p = obtener_producto(int(input("Id: ")))
                mostrar(p) if p else print("No existe")
            elif op == "4":
                p = actualizar_producto(int(input("Id: ")), input("Nombre: "), input("Descripción: "),
                                        float(input("Precio: ")), True,
                                        int(input("Id categoría (1): ") or 1))
                mostrar(p) if p else print("No existe")
            elif op == "5":
                print("Eliminado" if eliminar_producto(int(input("Id: "))) else "No existe")
            elif op == "0":
                return
        except Exception as e:
            print("Error:", e)


def menu_usuarios():
    while True:
        print("\n--- USUARIOS ---\n1 Crear  2 Listar  3 Buscar por id  4 Actualizar  5 Eliminar  0 Volver")
        op = input("Opción: ").strip()
        try:
            if op == "1":
                u = crear_usuario(input("Nombre: ").strip(), input("Correo: ").strip(),
                                  input("Contraseña: "), input("Rol (mesero/cocina/admin): "))
                print("Creado:", u)
            elif op == "2":
                mostrar_usuarios(listar_usuarios())
            elif op == "3":
                u = obtener_usuario(int(input("Id: ")))
                mostrar_usuarios(u) if u else print("No existe")
            elif op == "4":
                print("(Deja vacío lo que no quieras cambiar)")
                u = actualizar_usuario(int(input("Id: ")),
                                       input("Nuevo nombre: ").strip() or None,
                                       input("Nuevo correo: ").strip() or None,
                                       input("Nueva contraseña: ") or None,
                                       input("Nuevo rol (mesero/cocina/admin): ").strip() or None)
                mostrar_usuarios(u) if u else print("No existe")
            elif op == "5":
                print("Eliminado" if eliminar_usuario(int(input("Id: "))) else "No existe")
            elif op == "0":
                return
        except Exception as e:
            print("Error:", e)


if __name__ == "__main__":
    create_db_and_tables()
    while True:
        print("\n===== CRUD CON ORM (SQLModel) =====\n1 Mesas  2 Productos  3 Usuarios  0 Salir")
        op = input("Opción: ").strip()
        if op == "1":
            menu_mesas()
        elif op == "2":
            menu_productos()
        elif op == "3":
            menu_usuarios()
        elif op == "0":
            break

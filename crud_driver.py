"""
CRUD con acceso directo a las tablas mediante DRIVER (psycopg2 / PostgreSQL)
y SQL puro. Sin ORM. Entidades: Mesas, Productos y Usuarios.

Configura la conexión con la variable de entorno DATABASE_URL, o edita el
valor por defecto de abajo.  Ejecutar:  py crud_driver.py
"""
import os

import psycopg2
from psycopg2.extras import RealDictCursor

from security import hash_password

try:
    from dotenv import load_dotenv
    load_dotenv()  # lee el archivo .env
except ImportError:
    pass

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:TU_PASSWORD@127.0.0.1:5432/polirestaurante",
)

DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg2://", "postgresql://", 1)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)


def conectar():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def ejecutar(sql, params=(), fetch=None):
    """Ejecuta una sentencia en su propia transacción (commit automático)."""
    conn = conectar()
    try:
        with conn:  # commit si todo sale bien, rollback si hay error
            with conn.cursor() as cur:
                cur.execute(sql, params)
                if fetch == "all":
                    return cur.fetchall()
                if fetch == "one":
                    return cur.fetchone()
                return cur.rowcount
    finally:
        conn.close()


def crear_tablas():
    """Crea las tablas si todavía no existen (mismo esquema que el ORM)."""
    ejecutar(
        """
        CREATE TABLE IF NOT EXISTS "table" (
            id SERIAL PRIMARY KEY,
            numero INTEGER NOT NULL UNIQUE,
            capacidad INTEGER NOT NULL,
            estado VARCHAR NOT NULL DEFAULT 'disponible'
        );
        CREATE TABLE IF NOT EXISTS productcategory (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR NOT NULL
        );
        CREATE TABLE IF NOT EXISTS product (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR NOT NULL,
            descripcion VARCHAR,
            precio DOUBLE PRECISION NOT NULL,
            disponibilidad BOOLEAN NOT NULL DEFAULT TRUE,
            categoria_id INTEGER NOT NULL REFERENCES productcategory(id)
        );
        DO $$ BEGIN
            CREATE TYPE rolusuario AS ENUM ('MESERO', 'COCINA', 'ADMIN');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
        CREATE TABLE IF NOT EXISTS "user" (
            id SERIAL PRIMARY KEY,
            nombre VARCHAR NOT NULL,
            correo VARCHAR NOT NULL,
            contrasena_hash VARCHAR NOT NULL,
            rol rolusuario NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS ix_user_correo ON "user" (correo);
        """
    )


# ======================= MESAS =======================
def crear_mesa(numero, capacidad, estado="disponible"):
    fila = ejecutar(
        'INSERT INTO "table" (numero, capacidad, estado) VALUES (%s, %s, %s) RETURNING id',
        (numero, capacidad, estado),
        fetch="one",
    )
    return fila["id"]


def listar_mesas():
    return ejecutar('SELECT * FROM "table" ORDER BY id', fetch="all")


def obtener_mesa(mesa_id):
    return ejecutar('SELECT * FROM "table" WHERE id = %s', (mesa_id,), fetch="one")


def actualizar_mesa(mesa_id, numero, capacidad, estado):
    return ejecutar(
        'UPDATE "table" SET numero = %s, capacidad = %s, estado = %s WHERE id = %s',
        (numero, capacidad, estado, mesa_id),
    ) > 0


def eliminar_mesa(mesa_id):
    return ejecutar('DELETE FROM "table" WHERE id = %s', (mesa_id,)) > 0


# ======================= PRODUCTOS =======================
def asegurar_categoria(cur, categoria_id):
    cur.execute("SELECT 1 FROM productcategory WHERE id = %s", (categoria_id,))
    if not cur.fetchone():
        cur.execute("INSERT INTO productcategory (id, nombre) VALUES (%s, 'General')", (categoria_id,))
        # sincroniza la secuencia SERIAL tras insertar un id explícito
        cur.execute(
            "SELECT setval(pg_get_serial_sequence('productcategory', 'id'), "
            "(SELECT MAX(id) FROM productcategory))"
        )


def crear_producto(nombre, descripcion, precio, categoria_id=1, disponibilidad=True):
    conn = conectar()
    try:
        with conn, conn.cursor() as cur:
            asegurar_categoria(cur, categoria_id)
            cur.execute(
                "INSERT INTO product (nombre, descripcion, precio, disponibilidad, categoria_id) "
                "VALUES (%s, %s, %s, %s, %s) RETURNING id",
                (nombre, descripcion, precio, disponibilidad, categoria_id),
            )
            return cur.fetchone()["id"]
    finally:
        conn.close()


def listar_productos():
    return ejecutar("SELECT * FROM product ORDER BY id", fetch="all")


def obtener_producto(prod_id):
    return ejecutar("SELECT * FROM product WHERE id = %s", (prod_id,), fetch="one")


def actualizar_producto(prod_id, nombre, descripcion, precio, disponibilidad, categoria_id):
    conn = conectar()
    try:
        with conn, conn.cursor() as cur:
            asegurar_categoria(cur, categoria_id)
            cur.execute(
                "UPDATE product SET nombre = %s, descripcion = %s, precio = %s, "
                "disponibilidad = %s, categoria_id = %s WHERE id = %s",
                (nombre, descripcion, precio, disponibilidad, categoria_id, prod_id),
            )
            return cur.rowcount > 0
    finally:
        conn.close()


def eliminar_producto(prod_id):
    return ejecutar("DELETE FROM product WHERE id = %s", (prod_id,)) > 0


# ======================= USUARIOS =======================
ROLES = ("mesero", "cocina", "admin")


def validar_rol(texto):
    rol = texto.strip().lower()
    if rol not in ROLES:
        raise ValueError("Rol inválido: use mesero, cocina o admin")
    return rol.upper()  # el tipo ENUM de PostgreSQL guarda los nombres en mayúscula


def crear_usuario(nombre, correo, contrasena, rol):
    if not contrasena:
        raise ValueError("La contraseña es obligatoria")
    rol = validar_rol(rol)
    try:
        fila = ejecutar(
            'INSERT INTO "user" (nombre, correo, contrasena_hash, rol) '
            "VALUES (%s, %s, %s, %s::rolusuario) RETURNING id",
            (nombre, correo, hash_password(contrasena), rol),
            fetch="one",
        )
    except psycopg2.errors.UniqueViolation:
        raise ValueError("El correo ya está registrado")
    return fila["id"]


def listar_usuarios():
    # Nunca se selecciona contrasena_hash
    return ejecutar('SELECT id, nombre, correo, lower(rol::text) AS rol FROM "user" ORDER BY id', fetch="all")


def obtener_usuario(user_id):
    return ejecutar('SELECT id, nombre, correo, lower(rol::text) AS rol FROM "user" WHERE id = %s', (user_id,), fetch="one")


def actualizar_usuario(user_id, nombre=None, correo=None, contrasena=None, rol=None):
    """Solo cambia los campos que se envían (los None se dejan igual)."""
    campos, valores = [], []
    if nombre:
        campos.append("nombre = %s"); valores.append(nombre)
    if correo:
        campos.append("correo = %s"); valores.append(correo)
    if contrasena:
        campos.append("contrasena_hash = %s"); valores.append(hash_password(contrasena))
    if rol:
        campos.append("rol = %s::rolusuario"); valores.append(validar_rol(rol))
    if not campos:
        return obtener_usuario(user_id) is not None
    try:
        return ejecutar(f'UPDATE "user" SET {", ".join(campos)} WHERE id = %s',
                        (*valores, user_id)) > 0
    except psycopg2.errors.UniqueViolation:
        raise ValueError("El correo ya está registrado")


def eliminar_usuario(user_id):
    try:
        return ejecutar('DELETE FROM "user" WHERE id = %s', (user_id,)) > 0
    except psycopg2.errors.ForeignKeyViolation:
        raise ValueError("El usuario tiene pedidos asociados; no se puede eliminar")


# ======================= MENÚ DE CONSOLA =======================
def mostrar(filas):
    if not filas:
        print("  (sin registros)")
    for f in filas if isinstance(filas, list) else [filas]:
        print("  ", dict(f))


def menu_mesas():
    while True:
        print("\n--- MESAS ---\n1 Crear  2 Listar  3 Buscar por id  4 Actualizar  5 Eliminar  0 Volver")
        op = input("Opción: ").strip()
        try:
            if op == "1":
                i = crear_mesa(int(input("Número: ")), int(input("Capacidad: ")))
                print(f"Mesa creada con id {i}")
            elif op == "2":
                mostrar(listar_mesas())
            elif op == "3":
                m = obtener_mesa(int(input("Id: ")))
                mostrar(m) if m else print("No existe")
            elif op == "4":
                ok = actualizar_mesa(int(input("Id: ")), int(input("Nuevo número: ")),
                                     int(input("Nueva capacidad: ")),
                                     input("Estado (disponible/ocupada): "))
                print("Actualizada" if ok else "No existe")
            elif op == "5":
                print("Eliminada" if eliminar_mesa(int(input("Id: "))) else "No existe")
            elif op == "0":
                return
        except (ValueError, psycopg2.Error) as e:
            print("Error:", e)


def menu_productos():
    while True:
        print("\n--- PRODUCTOS ---\n1 Crear  2 Listar  3 Buscar por id  4 Actualizar  5 Eliminar  0 Volver")
        op = input("Opción: ").strip()
        try:
            if op == "1":
                i = crear_producto(input("Nombre: "), input("Descripción: "),
                                   float(input("Precio: ")), int(input("Id categoría (1): ") or 1))
                print(f"Producto creado con id {i}")
            elif op == "2":
                mostrar(listar_productos())
            elif op == "3":
                p = obtener_producto(int(input("Id: ")))
                mostrar(p) if p else print("No existe")
            elif op == "4":
                ok = actualizar_producto(int(input("Id: ")), input("Nombre: "), input("Descripción: "),
                                         float(input("Precio: ")), True,
                                         int(input("Id categoría (1): ") or 1))
                print("Actualizado" if ok else "No existe")
            elif op == "5":
                print("Eliminado" if eliminar_producto(int(input("Id: "))) else "No existe")
            elif op == "0":
                return
        except (ValueError, psycopg2.Error) as e:
            print("Error:", e)


def menu_usuarios():
    while True:
        print("\n--- USUARIOS ---\n1 Crear  2 Listar  3 Buscar por id  4 Actualizar  5 Eliminar  0 Volver")
        op = input("Opción: ").strip()
        try:
            if op == "1":
                i = crear_usuario(input("Nombre: ").strip(), input("Correo: ").strip(),
                                  input("Contraseña: "), input("Rol (mesero/cocina/admin): "))
                print(f"Usuario creado con id {i}")
            elif op == "2":
                mostrar(listar_usuarios())
            elif op == "3":
                u = obtener_usuario(int(input("Id: ")))
                mostrar(u) if u else print("No existe")
            elif op == "4":
                print("(Deja vacío lo que no quieras cambiar)")
                ok = actualizar_usuario(int(input("Id: ")),
                                        input("Nuevo nombre: ").strip() or None,
                                        input("Nuevo correo: ").strip() or None,
                                        input("Nueva contraseña: ") or None,
                                        input("Nuevo rol (mesero/cocina/admin): ").strip() or None)
                print("Actualizado" if ok else "No existe")
            elif op == "5":
                print("Eliminado" if eliminar_usuario(int(input("Id: "))) else "No existe")
            elif op == "0":
                return
        except (ValueError, psycopg2.Error) as e:
            print("Error:", e)


if __name__ == "__main__":
    crear_tablas()
    while True:
        print("\n===== CRUD CON DRIVER (psycopg2 / PostgreSQL) =====\n1 Mesas  2 Productos  3 Usuarios  0 Salir")
        op = input("Opción: ").strip()
        if op == "1":
            menu_mesas()
        elif op == "2":
            menu_productos()
        elif op == "3":
            menu_usuarios()
        elif op == "0":
            break

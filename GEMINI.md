# PoliRestaurante — Contexto del Proyecto

## Descripción General
**PoliRestaurante** es un sistema backend de gestión de restaurante para un proyecto universitario de Desarrollo Web (2026-2). Implementa una API REST con roles de **Admin**, **Cocina** y **Mesero**, con soporte completo de operaciones CRUD en frontend y un patrón de negocio con `RestaurantManager`.

## Stack Tecnológico
- **Backend:** Python 3.10+ con **FastAPI**
- **ORM:** SQLModel (sobre SQLAlchemy)
- **Base de Datos:** PostgreSQL (psycopg2 como driver)
- **Frontend:** HTML5 + Bootstrap 5 + Bootstrap Icons + Vanilla JS (SPA con pestañas)
- **Lógica de Negocio:** `RestaurantManager` en `manager.py` (coordina `Table` y `Order`, límite de 20 mesas)
- **Despliegue:** preparado para Render (variable `DATABASE_URL`)
- **Seguridad:** Hashing de contraseñas con PBKDF2-SHA256 + sal aleatoria

## Arquitectura del Proyecto
```
Proyeb2/
├── main.py              → Punto de entrada FastAPI, lifespan, CORS, montaje estático
├── DataBase.py          → Conexión PostgreSQL (SQLModel engine, sesión)
├── manager.py           → RestaurantManager (reglas de negocio e interacción Table <-> Order)
├── security.py          → hash_password() con PBKDF2-SHA256
├── models/              → Modelos SQLModel (tablas de la BD)
│   ├── Inventory.py     → Inventory (id, nombre_insumo, cantidad, unidad_medida)
│   ├── Order.py         → Order (id, mesa_id FK→table, mesero_id FK→user, tipo, estado, fechas)
│   ├── Order_Detail.py  → OrderDetail (id, order_id, product_id, cantidad, precio_unitario)
│   ├── Product_Category.py → ProductCategory + Product
│   ├── Table.py         → Table (id, numero unique, capacidad, estado)
│   └── User.py          → User (id, nombre, correo unique, contrasena_hash, rol)
├── routers/             → Endpoints agrupados por rol
│   ├── admin.py         → CRUD completo: Users, Tables, Categories, Products, Inventory
│   ├── cocina.py        → Consulta pedidos, cambiar estado de pedidos (libera mesa al entregar/cancelar)
│   └── mesero.py        → Consultar menú/mesas, CRUD pedidos (marca mesa ocupada) + ítems
├── static/              → Frontend web (SPA moderna con pestañas)
│   ├── index.html       → Dashboard Bootstrap 5 con tabs para Mesas, Menú, Categorías, Usuarios, Pedidos, Inventario
│   ├── app.js           → Operaciones CRUD completas para todas las entidades
│   └── styles.css       → Estilos personalizados (Poppins, variables CSS, nav-pills)
├── crud_driver.py       → Script CLI con SQL puro (psycopg2): mesas, productos, usuarios
├── crud_orm.py          → Script CLI con ORM (SQLModel): mesas, productos, usuarios
├── requirements.txt     → Dependencias del proyecto
├── .env.example         → Plantilla de variables de entorno
├── postman/             → Colección Postman para testing de la API
└── README.md            → Documentación del proyecto
```

## Requisitos Cumplidos
1. **Frontend CRUD completo para todas las entidades**:
   - Mesas: Crear, Listar, Editar (número, capacidad, estado), Eliminar.
   - Productos: Crear, Listar, Editar (nombre, precio, categoría, disponibilidad, descripción), Eliminar.
   - Categorías: Crear, Listar, Editar, Eliminar.
   - Usuarios: Crear, Listar, Editar, Eliminar.
   - Inventario: Crear, Listar, Editar, Eliminar.
   - Pedidos: Crear, Listar (con filtro por estado), Cambiar estado (Cocina/Mesero).

2. **Manager con interacción entre entidades (`RestaurantManager`)**:
   - **Regla del límite:** Máximo 20 mesas en el restaurante.
   - **Interacción Table <-> Order:**
     - Al crear un pedido de salón, verifica que la mesa esté disponible y cambia su estado a `ocupada`.
     - Al cambiar el estado de un pedido a `ENTREGADO` o `CANCELADO`, libera automáticamente la mesa y la pasa a `disponible`.

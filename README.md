# PoliRestaurante API 🍽️

Sistema backend para la gestión de restaurante con FastAPI, SQLModel y PostgreSQL.

## 🚀 Requisitos Previos

- Python 3.10+
- PostgreSQL en ejecución (puerto 5432)
- Base de datos creada: `polirestaurante`

## 📦 Instalación

1. **Crear y activar entorno virtual**:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

2. **Instalar dependencias**:
   ```powershell
   pip install -r requirements.txt
   ```

3. **Configurar base de datos**:
   Copia el archivo `.env.example` a `.env` y coloca tu contraseña:
   ```powershell
   cp .env.example .env
   ```
   La variable `DATABASE_URL` es obligatoria (no hay contraseña por defecto en el código).
   También puedes configurarla como variable de entorno:
   ```powershell
   $env:DATABASE_URL = "postgresql+psycopg2://postgres:TU_PASSWORD@127.0.0.1:5432/polirestaurante"
   ```

## ▶️ Ejecución del Servidor

```powershell
python -m uvicorn main:app --reload
```

## 🌐 Endpoints y Documentación

- **Frontend / Vista Web:** [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- **Documentación Swagger UI:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Documentación ReDoc:** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

## 📁 Estructura del Proyecto

```text
pyt_web/
├── .env.example         # Plantilla de variables de entorno
├── .gitignore           # Archivos ignorados por Git
├── requirements.txt     # Dependencias del proyecto
├── README.md            # Documentación del proyecto
├── main.py              # Punto de entrada FastAPI
├── DataBase.py          # Conexión y sesión de base de datos
├── security.py          # Hash de contraseñas (compartido por API y scripts)
├── models/              # Modelos de SQLModel (User, Table, Product, etc.)
├── routers/             # Rutas por rol (admin, cocina, mesero)
├── static/              # Frontend web (HTML, CSS, JS)
├── crud_driver.py       # Script de terminal (SQL puro): mesas, productos y usuarios
├── crud_orm.py          # Script de terminal (ORM): mesas, productos y usuarios
└── postman/             # Colecciones de pruebas API
```

## 👥 Gestión de usuarios (HU-01)

- **Web:** en `http://127.0.0.1:8000/` está la sección "Usuarios" (crear, listar, editar y eliminar). Al editar, la contraseña vacía conserva la actual.
- **Terminal:** `python crud_orm.py` o `python crud_driver.py` → opción `3 Usuarios`.
- **API:** `/admin/users` (ver Swagger en `/docs`).

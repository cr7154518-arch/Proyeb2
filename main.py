from contextlib import asynccontextmanager
from DataBase import create_db_and_tables
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from routers import admin, cocina, mesero


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(
    title="PoliRestaurante API",
    description="Backend para la gestión de restaurante con roles de Admin, Cocina y Mesero",
    version="1.0.0",
    lifespan=lifespan,
)

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montar carpeta estática
app.mount("/static", StaticFiles(directory="static"), name="static")

# Inclusión de routers por rol
app.include_router(admin.router)
app.include_router(cocina.router)
app.include_router(mesero.router)


@app.get("/", tags=["Inicio"])
def read_root():
    return FileResponse("static/index.html")
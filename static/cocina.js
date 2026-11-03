// static/cocina.js - Módulo de Cocina: cola de pedidos y cambio de estado rápido
let pedidosCocinaCache = [];

const ESTADOS_ORDENADOS = [
    { key: "PENDIENTE", label: "Pendiente", badge: "bg-secondary" },
    { key: "EN_PREPARACION", label: "En Preparación", badge: "bg-warning text-dark" },
    { key: "LISTO", label: "Listo para Servir", badge: "bg-info text-dark" },
    { key: "ENTREGADO", label: "Entregado", badge: "bg-success" }
];

async function cargarCocina() {
    const contenedor = document.getElementById("cola-pedidos-cocina");
    const filtro = document.getElementById("filtro-estado-cocina")?.value || "PENDIENTE";
    if (!contenedor) return;

    try {
        let endpoint = "/cocina/orders";
        if (filtro === "PENDIENTES_TODOS") {
            // Consulta general y filtra en front pendientes/preparacion
            const todos = await apiFetch("/cocina/orders");
            pedidosCocinaCache = todos.filter(o => o.estado === "PENDIENTE" || o.estado === "EN_PREPARACION");
        } else if (filtro) {
            pedidosCocinaCache = await apiFetch(`/cocina/orders?estado=${filtro}`);
        } else {
            pedidosCocinaCache = await apiFetch("/cocina/orders");
        }

        if (pedidosCocinaCache.length === 0) {
            contenedor.innerHTML = `
                <div class="col-12 text-center text-muted py-5">
                    <h5>✨ No hay pedidos en esta sección</h5>
                    <p class="small">La cocina está al día.</p>
                </div>`;
            return;
        }

        // Cargar ítems de cada orden para mostrarlos en la comanda
        const ordenesConItems = await Promise.all(
            pedidosCocinaCache.map(async o => {
                try {
                    const items = await apiFetch(`/mesero/orders/${o.id}/items`);
                    return { ...o, items };
                } catch {
                    return { ...o, items: [] };
                }
            })
        );

        contenedor.innerHTML = ordenesConItems.map(o => renderComanda(o)).join("");
    } catch (err) {
        contenedor.innerHTML = `<div class="col-12 text-danger text-center py-4">Error al cargar comandas: ${esc(err.message)}</div>`;
    }
}

function renderComanda(o) {
    const hora = o.fecha_creacion ? new Date(o.fecha_creacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--";
    const mesaTexto = o.mesa_id ? `Mesa #${o.mesa_id}` : `Para Llevar`;

    let listaItemsHtml = "";
    if (!o.items || o.items.length === 0) {
        listaItemsHtml = `<li class="list-group-item text-muted small py-1">Sin ítems aún</li>`;
    } else {
        listaItemsHtml = o.items.map(it => {
            const prod = (typeof productosMenuCache !== "undefined" && productosMenuCache) 
                ? productosMenuCache.find(p => p.id === it.product_id) 
                : null;
            const nombre = prod ? prod.nombre : `Ítem #${it.product_id}`;
            return `
                <li class="list-group-item d-flex justify-content-between align-items-center py-1">
                    <span><strong>${it.cantidad}x</strong> ${esc(nombre)}</span>
                </li>
            `;
        }).join("");
    }

    // Botones de acción según el estado
    let botonesAccion = "";
    if (o.estado === "PENDIENTE") {
        botonesAccion = `
            <button class="btn btn-warning btn-sm w-100 fw-bold mb-1" onclick="cambiarEstadoCocina(${o.id}, 'EN_PREPARACION')">
                🍳 Empezar a Preparar
            </button>
        `;
    } else if (o.estado === "EN_PREPARACION") {
        botonesAccion = `
            <button class="btn btn-info btn-sm w-100 fw-bold text-dark mb-1" onclick="cambiarEstadoCocina(${o.id}, 'LISTO')">
                🔔 Marcar LISTO
            </button>
        `;
    } else if (o.estado === "LISTO") {
        botonesAccion = `
            <button class="btn btn-success btn-sm w-100 fw-bold mb-1" onclick="cambiarEstadoCocina(${o.id}, 'ENTREGADO')">
                ✅ Marcar ENTREGADO
            </button>
        `;
    }

    return `
        <div class="col-md-6 col-lg-4 mb-3">
            <div class="card shadow-sm h-100 border-top border-4 ${o.estado === 'EN_PREPARACION' ? 'border-warning' : (o.estado === 'LISTO' ? 'border-info' : 'border-secondary')}">
                <div class="card-header bg-white d-flex justify-content-between align-items-center">
                    <div>
                        <span class="badge bg-dark">Pedido #${o.id}</span>
                        <strong class="ms-1">${esc(mesaTexto)}</strong>
                    </div>
                    <small class="text-muted">🕒 ${hora}</small>
                </div>
                <div class="card-body p-2">
                    <ul class="list-group list-group-flush mb-2">
                        ${listaItemsHtml}
                    </ul>
                </div>
                <div class="card-footer bg-light p-2">
                    ${botonesAccion}
                    <div class="dropdown mt-1">
                        <button class="btn btn-outline-secondary btn-sm dropdown-toggle w-100 py-0" type="button" data-bs-toggle="dropdown">
                            Estado: ${esc(o.estado)}
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><a class="dropdown-item" href="#" onclick="cambiarEstadoCocina(${o.id}, 'PENDIENTE')">Pendiente</a></li>
                            <li><a class="dropdown-item" href="#" onclick="cambiarEstadoCocina(${o.id}, 'EN_PREPARACION')">En Preparación</a></li>
                            <li><a class="dropdown-item" href="#" onclick="cambiarEstadoCocina(${o.id}, 'LISTO')">Listo</a></li>
                            <li><a class="dropdown-item" href="#" onclick="cambiarEstadoCocina(${o.id}, 'ENTREGADO')">Entregado</a></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item text-danger" href="#" onclick="cambiarEstadoCocina(${o.id}, 'CANCELADO')">Cancelar Pedido</a></li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function cambiarEstadoCocina(orderId, nuevoEstado) {
    try {
        await apiFetch(`/cocina/orders/${orderId}/status?estado=${nuevoEstado}`, {
            method: "PUT"
        });
        cargarCocina();
        if (typeof cargarPedidos === "function") cargarPedidos();
    } catch (err) {
        notifyError("No se pudo cambiar el estado: " + err.message);
    }
}

function initCocinaModule() {
    cargarCocina();
}


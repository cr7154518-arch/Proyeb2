// static/mesero.js - Módulo de Mesero: pedidos, menú, mesas e ítems de pedido
let pedidosCache = [];
let meserosCache = [];
let mesasMeseroCache = [];
let productosMenuCache = [];
let pedidoActualModal = null;

const ESTADO_BADGES = {
    PENDIENTE: "bg-secondary",
    EN_PREPARACION: "bg-warning text-dark",
    LISTO: "bg-info text-dark",
    ENTREGADO: "bg-success",
    CANCELADO: "bg-danger"
};

// ===================== SELECTORES DE APOYO =====================
async function cargarMeserosSelect() {
    try {
        const users = await apiFetch("/admin/users");
        meserosCache = users.filter(u => u.rol === "mesero" || u.rol === "admin");
        const sel = document.getElementById("pedido-mesero");
        if (!sel) return;
        if (meserosCache.length === 0) {
            sel.innerHTML = `<option value="">Sin meseros registrados (Crea uno en Admin)</option>`;
            return;
        }
        sel.innerHTML = meserosCache.map(m => `
            <option value="${m.id}">${esc(m.nombre)} (${esc(m.rol)})</option>
        `).join("");
    } catch (err) {
        console.warn("No se cargaron meseros para el selector:", err);
    }
}

async function cargarMesasMesero() {
    try {
        mesasMeseroCache = await apiFetch("/mesero/tables");
        const sel = document.getElementById("pedido-mesa");
        if (sel) {
            sel.innerHTML = `<option value="">-- Sin mesa (Para llevar) --</option>` +
                mesasMeseroCache.map(m => `
                    <option value="${m.id}">Mesa #${m.numero} (Capacidad: ${m.capacidad})</option>
                `).join("");
        }
    } catch (err) {
        console.warn("No se cargaron mesas para selector:", err);
    }
}

async function cargarMenuMesero() {
    try {
        productosMenuCache = await apiFetch("/mesero/menu");
        const sel = document.getElementById("item-producto");
        if (sel) {
            sel.innerHTML = productosMenuCache
                .filter(p => p.disponibilidad)
                .map(p => `
                    <option value="${p.id}">${esc(p.nombre)} - $${Number(p.precio).toFixed(2)}</option>
                `).join("");
        }
    } catch (err) {
        console.warn("No se cargó menú para selector de ítems:", err);
    }
}

// ===================== CRUD PEDIDOS =====================
async function cargarPedidos() {
    const tbody = document.getElementById("tabla-pedidos");
    if (!tbody) return;
    const filtro = document.getElementById("filtro-estado-pedidos")?.value || "";

    try {
        const url = filtro ? `/mesero/orders?estado=${filtro}` : "/mesero/orders";
        pedidosCache = await apiFetch(url);

        if (pedidosCache.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-muted text-center py-3">No hay pedidos registrados con este filtro.</td></tr>`;
            return;
        }

        tbody.innerHTML = pedidosCache.map(p => {
            const fecha = p.fecha_creacion ? new Date(p.fecha_creacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-";
            const mesaTexto = p.mesa_id ? `Mesa #${p.mesa_id}` : '<span class="text-muted">Para llevar</span>';
            return `
                <tr>
                    <td><strong>#${p.id}</strong></td>
                    <td>${mesaTexto}</td>
                    <td>Mesero #${p.mesero_id}</td>
                    <td><span class="badge bg-light text-dark border">${esc(p.tipo_pedido)}</span></td>
                    <td><span class="badge ${ESTADO_BADGES[p.estado] || "bg-secondary"}">${esc(p.estado)}</span></td>
                    <td><small class="text-muted">${fecha}</small></td>
                    <td class="text-end text-nowrap">
                        <button class="btn btn-outline-success btn-sm me-1" onclick="abrirModalItems(${p.id})">🍽️ Ítems</button>
                        <button class="btn btn-outline-primary btn-sm me-1" onclick="editarPedido(${p.id})">Editar</button>
                        <button class="btn btn-outline-danger btn-sm" onclick="eliminarPedido(${p.id})">Eliminar</button>
                    </td>
                </tr>
            `;
        }).join("");
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-danger text-center py-3">Error al cargar pedidos: ${esc(err.message)}</td></tr>`;
    }
}

async function guardarPedido(e) {
    e.preventDefault();
    const id = document.getElementById("pedido-id").value;
    const tipo = document.getElementById("pedido-tipo").value;
    const mesaVal = document.getElementById("pedido-mesa").value;
    const meseroVal = document.getElementById("pedido-mesero").value;

    if (!meseroVal) {
        notifyError("Debes seleccionar un mesero.");
        return;
    }

    if (tipo === "salon" && !mesaVal) {
        notifyError("Un pedido de tipo Salón requiere seleccionar una mesa.");
        return;
    }

    const payload = {
        mesero_id: parseInt(meseroVal),
        tipo_pedido: tipo,
        mesa_id: mesaVal ? parseInt(mesaVal) : null
    };

    try {
        if (id) {
            const estadoVal = document.getElementById("pedido-estado").value;
            payload.estado = estadoVal;
            await apiFetch(`/mesero/orders/${id}`, { method: "PUT", body: payload });
            notifySuccess("¡Pedido actualizado!");
        } else {
            const nuevo = await apiFetch("/mesero/orders", { method: "POST", body: payload });
            notifySuccess(`¡Pedido #${nuevo.id} creado con éxito! Ahora puedes agregar sus ítems.`);
            cancelarEdicionPedido();
            cargarPedidos();
            abrirModalItems(nuevo.id);
            return;
        }
        cancelarEdicionPedido();
        cargarPedidos();
    } catch (err) {
        notifyError("Error al procesar pedido: " + err.message);
    }
}

function editarPedido(id) {
    const p = pedidosCache.find(x => x.id === id);
    if (!p) return;
    document.getElementById("pedido-id").value = p.id;
    document.getElementById("pedido-tipo").value = p.tipo_pedido;
    document.getElementById("pedido-mesero").value = p.mesero_id;
    document.getElementById("pedido-mesa").value = p.mesa_id || "";

    const campoEstado = document.getElementById("campo-pedido-estado");
    if (campoEstado) {
        campoEstado.classList.remove("d-none");
        document.getElementById("pedido-estado").value = p.estado;
    }

    document.getElementById("pedido-titulo").textContent = `✏️ Editar Pedido #${p.id}`;
    document.getElementById("pedido-guardar").textContent = "Actualizar Pedido";
    document.getElementById("pedido-cancelar").classList.remove("d-none");
    document.getElementById("form-pedido").scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelarEdicionPedido() {
    document.getElementById("form-pedido").reset();
    document.getElementById("pedido-id").value = "";
    const campoEstado = document.getElementById("campo-pedido-estado");
    if (campoEstado) campoEstado.classList.add("d-none");

    document.getElementById("pedido-titulo").textContent = "📝 Tomar Nuevo Pedido";
    document.getElementById("pedido-guardar").textContent = "Crear Pedido";
    document.getElementById("pedido-cancelar").classList.add("d-none");
}

async function eliminarPedido(id) {
    if (!confirm(`¿Estás seguro de eliminar el Pedido #${id} y todos sus ítems?`)) return;
    try {
        await apiFetch(`/mesero/orders/${id}`, { method: "DELETE" });
        if (document.getElementById("pedido-id").value === String(id)) cancelarEdicionPedido();
        notifySuccess("Pedido eliminado.");
        cargarPedidos();
    } catch (err) {
        notifyError("No se pudo eliminar el pedido: " + err.message);
    }
}

// ===================== MODAL DE ÍTEMS DEL PEDIDO =====================
let modalItemsInstance = null;

function getModalItems() {
    if (!modalItemsInstance) {
        const modalEl = document.getElementById("modalItemsPedido");
        if (modalEl && window.bootstrap) {
            modalItemsInstance = new bootstrap.Modal(modalEl);
        }
    }
    return modalItemsInstance;
}

async function abrirModalItems(orderId) {
    pedidoActualModal = orderId;
    document.getElementById("modal-items-pedido-id").textContent = orderId;
    cargarMenuMesero();
    cancelarEdicionItem();
    await cargarItemsDelPedido(orderId);
    const m = getModalItems();
    if (m) m.show();
}

async function cargarItemsDelPedido(orderId) {
    const tbody = document.getElementById("tabla-items-pedido");
    const totalEl = document.getElementById("total-pedido-modal");
    if (!tbody) return;

    try {
        const items = await apiFetch(`/mesero/orders/${orderId}/items`);
        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-3">No hay productos agregados a este pedido aún.</td></tr>`;
            if (totalEl) totalEl.textContent = "$0.00";
            return;
        }

        let total = 0;
        tbody.innerHTML = items.map(it => {
            const subtotal = Number(it.precio_unitario) * it.cantidad;
            total += subtotal;
            const prod = productosMenuCache.find(p => p.id === it.product_id);
            const nombreProd = prod ? prod.nombre : `Producto #${it.product_id}`;

            return `
                <tr>
                    <td><strong>${esc(nombreProd)}</strong></td>
                    <td>$${Number(it.precio_unitario).toFixed(2)}</td>
                    <td><span class="badge bg-light text-dark border px-2 py-1">${it.cantidad}</span></td>
                    <td><strong>$${subtotal.toFixed(2)}</strong></td>
                    <td class="text-end text-nowrap">
                        <button class="btn btn-outline-primary btn-sm py-0 px-2" onclick="editarItemPedido(${it.id}, ${it.product_id}, ${it.cantidad})">✏️</button>
                        <button class="btn btn-outline-danger btn-sm py-0 px-2" onclick="eliminarItemPedido(${it.id})">🗑️</button>
                    </td>
                </tr>
            `;
        }).join("");

        if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center py-3">Error al cargar ítems: ${esc(err.message)}</td></tr>`;
    }
}

async function guardarItemPedido(e) {
    e.preventDefault();
    if (!pedidoActualModal) return;

    const itemId = document.getElementById("item-id").value;
    const cantidad = parseInt(document.getElementById("item-cantidad").value);

    try {
        if (itemId) {
            await apiFetch(`/mesero/orders/${pedidoActualModal}/items/${itemId}`, {
                method: "PUT",
                body: { cantidad }
            });
            notifySuccess("Cantidad actualizada");
        } else {
            const productId = parseInt(document.getElementById("item-producto").value);
            await apiFetch(`/mesero/orders/${pedidoActualModal}/items`, {
                method: "POST",
                body: { product_id: productId, cantidad }
            });
            notifySuccess("Producto agregado al pedido");
        }
        cancelarEdicionItem();
        cargarItemsDelPedido(pedidoActualModal);
    } catch (err) {
        notifyError("Error al guardar ítem: " + err.message);
    }
}

function editarItemPedido(itemId, productId, cantidadActual) {
    document.getElementById("item-id").value = itemId;
    document.getElementById("item-producto").value = productId;
    document.getElementById("item-producto").disabled = true;
    document.getElementById("item-cantidad").value = cantidadActual;
    document.getElementById("item-btn-guardar").textContent = "Actualizar Cantidad";
    document.getElementById("item-btn-cancelar").classList.remove("d-none");
}

function cancelarEdicionItem() {
    document.getElementById("form-item-pedido").reset();
    document.getElementById("item-id").value = "";
    document.getElementById("item-producto").disabled = false;
    document.getElementById("item-cantidad").value = "1";
    document.getElementById("item-btn-guardar").textContent = "Agregar Ítem";
    document.getElementById("item-btn-cancelar").classList.add("d-none");
}

async function eliminarItemPedido(itemId) {
    if (!confirm("¿Eliminar este producto del pedido?")) return;
    try {
        await apiFetch(`/mesero/orders/${pedidoActualModal}/items/${itemId}`, { method: "DELETE" });
        cancelarEdicionItem();
        cargarItemsDelPedido(pedidoActualModal);
    } catch (err) {
        notifyError("Error al eliminar ítem: " + err.message);
    }
}

function initMeseroModule() {
    cargarMeserosSelect();
    cargarMesasMesero();
    cargarMenuMesero();
    cargarPedidos();
}


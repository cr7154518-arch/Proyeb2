const API_URL = window.location.origin;

// ----------------- UTILIDADES COMUNES -----------------
function esc(texto) {
    return String(texto ?? "").replace(/[&<>"']/g, c => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
}

function mostrarAlerta(mensaje, tipo = "success") {
    const alerta = document.getElementById("alerta-global");
    const texto = document.getElementById("alerta-mensaje");
    if (!alerta || !texto) return;
    alerta.className = `alert alert-${tipo} alert-dismissible fade show mb-3`;
    texto.innerHTML = mensaje;
    alerta.classList.remove("d-none");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => { cerrarAlerta(); }, 5000);
}

function cerrarAlerta() {
    const alerta = document.getElementById("alerta-global");
    if (alerta) alerta.classList.add("d-none");
}

async function parsearError(res) {
    try {
        const data = await res.json();
        const d = data.detail ?? data;
        if (Array.isArray(d)) return d.map(e => (e.loc ? e.loc.slice(1).join(".") + ": " : "") + e.msg).join("\n");
        return typeof d === "string" ? d : JSON.stringify(d);
    } catch {
        return "Error " + res.status;
    }
}

// ========================================================
// 1. MESAS (CRUD COMPLETO + REGLA MANAGER)
// ========================================================
let mesasCache = [];

async function cargarMesas() {
    const tbody = document.getElementById("tabla-mesas");
    const contador = document.getElementById("contador-mesas");
    const selectMesaPedido = document.getElementById("pedido-mesa-select");

    try {
        const res = await fetch(`${API_URL}/admin/tables`);
        if (!res.ok) throw new Error(await parsearError(res));
        mesasCache = await res.json();

        if (contador) contador.textContent = mesasCache.length;

        // Actualizar select de mesas en pedidos (solo disponibles)
        if (selectMesaPedido) {
            selectMesaPedido.innerHTML = `<option value="">Seleccione una mesa...</option>` +
                mesasCache.map(m => `
                    <option value="${m.id}" ${m.estado.toLowerCase() === 'ocupada' ? 'disabled' : ''}>
                        Mesa ${m.numero} (${m.capacidad} pers.) - ${m.estado.toUpperCase()}
                    </option>
                `).join("");
        }

        if (mesasCache.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-3">No hay mesas configuradas.</td></tr>`;
            return;
        }

        tbody.innerHTML = mesasCache.map(m => {
            const esOcupada = (m.estado || "").toLowerCase() === "ocupada";
            const badgeClass = esOcupada ? "bg-danger" : "bg-success";
            return `
                <tr>
                    <td><strong>#${m.id}</strong></td>
                    <td>Mesa ${m.numero}</td>
                    <td>${m.capacidad} personas</td>
                    <td><span class="badge ${badgeClass}">${m.estado.toUpperCase()}</span></td>
                    <td class="text-end text-nowrap">
                        <button class="btn btn-outline-primary btn-sm me-1" onclick="editarMesa(${m.id})">Editar</button>
                        <button class="btn btn-outline-danger btn-sm" onclick="eliminarMesa(${m.id})">Eliminar</button>
                    </td>
                </tr>
            `;
        }).join("");
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center py-3">Error al cargar mesas: ${esc(err.message)}</td></tr>`;
    }
}

async function guardarMesa(e) {
    e.preventDefault();
    const id = document.getElementById("mesa-id").value;
    const numero = parseInt(document.getElementById("mesa-numero").value);
    const capacidad = parseInt(document.getElementById("mesa-capacidad").value);
    const estado = document.getElementById("mesa-estado") ? document.getElementById("mesa-estado").value : "disponible";

    const payload = { numero, capacidad, estado };

    try {
        const res = await fetch(`${API_URL}/admin/tables${id ? "/" + id : ""}`, {
            method: id ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            mostrarAlerta(await parsearError(res), "danger");
            return;
        }

        cancelarEdicionMesa();
        await cargarMesas();
        mostrarAlerta(id ? "¡Mesa actualizada correctamente!" : "¡Mesa creada con éxito!", "success");
    } catch (err) {
        mostrarAlerta("Error de conexión al guardar la mesa.", "danger");
    }
}

function editarMesa(id) {
    const m = mesasCache.find(x => x.id === id);
    if (!m) return;
    document.getElementById("mesa-id").value = m.id;
    document.getElementById("mesa-numero").value = m.numero;
    document.getElementById("mesa-capacidad").value = m.capacidad;

    const grupoEstado = document.getElementById("grupo-mesa-estado");
    if (grupoEstado) {
        grupoEstado.style.display = "block";
        document.getElementById("mesa-estado").value = m.estado.toLowerCase();
    }

    document.getElementById("mesa-titulo").textContent = `Editar Mesa #${m.numero}`;
    document.getElementById("mesa-btn-guardar").textContent = "Actualizar Mesa";
    document.getElementById("mesa-btn-cancelar").classList.remove("d-none");
    document.getElementById("form-mesa").scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelarEdicionMesa() {
    document.getElementById("form-mesa").reset();
    document.getElementById("mesa-id").value = "";
    const grupoEstado = document.getElementById("grupo-mesa-estado");
    if (grupoEstado) grupoEstado.style.display = "none";
    document.getElementById("mesa-titulo").textContent = "Agregar Mesa";
    document.getElementById("mesa-btn-guardar").textContent = "Guardar Mesa";
    document.getElementById("mesa-btn-cancelar").classList.add("d-none");
}

async function eliminarMesa(id) {
    const m = mesasCache.find(x => x.id === id);
    if (!confirm(`¿Eliminar la Mesa ${m ? m.numero : id}?`)) return;
    try {
        const res = await fetch(`${API_URL}/admin/tables/${id}`, { method: "DELETE" });
        if (!res.ok) {
            mostrarAlerta("No se pudo eliminar: " + await parsearError(res), "danger");
            return;
        }
        if (document.getElementById("mesa-id").value === String(id)) cancelarEdicionMesa();
        await cargarMesas();
        mostrarAlerta("Mesa eliminada con éxito", "info");
    } catch (err) {
        mostrarAlerta("Error de conexión al eliminar la mesa.", "danger");
    }
}

// ========================================================
// 2. PRODUCTOS (CRUD COMPLETO)
// ========================================================
let productosCache = [];

async function cargarProductos() {
    const tbody = document.getElementById("tabla-productos");
    try {
        const res = await fetch(`${API_URL}/admin/products`);
        if (!res.ok) throw new Error(await parsearError(res));
        productosCache = await res.json();

        if (productosCache.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-muted text-center py-3">No hay productos en el menú.</td></tr>`;
            return;
        }

        tbody.innerHTML = productosCache.map(p => {
            const cat = categoriasCache.find(c => c.id === p.categoria_id);
            const catNombre = cat ? cat.nombre : `Cat #${p.categoria_id}`;
            const badgeDisp = p.disponibilidad
                ? '<span class="badge bg-success">Disponible</span>'
                : '<span class="badge bg-secondary">Agotado</span>';

            return `
                <tr>
                    <td><strong>#${p.id}</strong></td>
                    <td>
                        <strong>${esc(p.nombre)}</strong>
                        ${p.descripcion ? `<br><small class="text-muted">${esc(p.descripcion)}</small>` : ""}
                    </td>
                    <td><strong>$${Number(p.precio).toLocaleString()}</strong></td>
                    <td><span class="badge bg-info text-dark">${esc(catNombre)}</span></td>
                    <td>${badgeDisp}</td>
                    <td class="text-end text-nowrap">
                        <button class="btn btn-outline-primary btn-sm me-1" onclick="editarProducto(${p.id})">Editar</button>
                        <button class="btn btn-outline-danger btn-sm" onclick="eliminarProducto(${p.id})">Eliminar</button>
                    </td>
                </tr>
            `;
        }).join("");
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center py-3">Error al cargar productos: ${esc(err.message)}</td></tr>`;
    }
}

async function guardarProducto(e) {
    e.preventDefault();
    const id = document.getElementById("prod-id").value;
    const nombre = document.getElementById("prod-nombre").value.trim();
    const precio = parseFloat(document.getElementById("prod-precio").value);
    const categoria_id = parseInt(document.getElementById("prod-categoria-select").value);
    const descripcion = document.getElementById("prod-descripcion").value.trim();
    const disponibilidad = document.getElementById("prod-disponibilidad").checked;

    const payload = {
        nombre,
        precio,
        categoria_id,
        descripcion: descripcion || "Sin descripción",
        disponibilidad
    };

    try {
        const res = await fetch(`${API_URL}/admin/products${id ? "/" + id : ""}`, {
            method: id ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            mostrarAlerta(await parsearError(res), "danger");
            return;
        }

        cancelarEdicionProducto();
        await cargarProductos();
        mostrarAlerta(id ? "¡Producto actualizado con éxito!" : "¡Producto creado con éxito!", "success");
    } catch (err) {
        mostrarAlerta("Error de conexión al guardar el producto.", "danger");
    }
}

function editarProducto(id) {
    const p = productosCache.find(x => x.id === id);
    if (!p) return;
    document.getElementById("prod-id").value = p.id;
    document.getElementById("prod-nombre").value = p.nombre;
    document.getElementById("prod-precio").value = p.precio;
    document.getElementById("prod-categoria-select").value = p.categoria_id;
    document.getElementById("prod-descripcion").value = p.descripcion || "";
    document.getElementById("prod-disponibilidad").checked = !!p.disponibilidad;

    document.getElementById("producto-titulo").textContent = `Editar Producto #${p.id}`;
    document.getElementById("prod-btn-guardar").textContent = "Actualizar Producto";
    document.getElementById("prod-btn-cancelar").classList.remove("d-none");
    document.getElementById("form-producto").scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelarEdicionProducto() {
    document.getElementById("form-producto").reset();
    document.getElementById("prod-id").value = "";
    document.getElementById("prod-disponibilidad").checked = true;
    document.getElementById("producto-titulo").textContent = "Agregar Producto al Menú";
    document.getElementById("prod-btn-guardar").textContent = "Guardar Producto";
    document.getElementById("prod-btn-cancelar").classList.add("d-none");
}

async function eliminarProducto(id) {
    const p = productosCache.find(x => x.id === id);
    if (!confirm(`¿Eliminar el producto "${p ? p.nombre : id}"?`)) return;
    try {
        const res = await fetch(`${API_URL}/admin/products/${id}`, { method: "DELETE" });
        if (!res.ok) {
            mostrarAlerta("No se pudo eliminar: " + await parsearError(res), "danger");
            return;
        }
        if (document.getElementById("prod-id").value === String(id)) cancelarEdicionProducto();
        await cargarProductos();
        mostrarAlerta("Producto eliminado del menú.", "info");
    } catch (err) {
        mostrarAlerta("Error de conexión al eliminar el producto.", "danger");
    }
}

// ========================================================
// 3. CATEGORÍAS (CRUD COMPLETO)
// ========================================================
let categoriasCache = [];

async function cargarCategorias() {
    const tbody = document.getElementById("tabla-categorias");
    const selectProdCat = document.getElementById("prod-categoria-select");
    try {
        const res = await fetch(`${API_URL}/admin/categories`);
        if (!res.ok) throw new Error(await parsearError(res));
        categoriasCache = await res.json();

        // Actualizar select en productos
        if (selectProdCat) {
            if (categoriasCache.length === 0) {
                selectProdCat.innerHTML = `<option value="1">General (por defecto)</option>`;
            } else {
                selectProdCat.innerHTML = categoriasCache.map(c => `
                    <option value="${c.id}">${esc(c.nombre)}</option>
                `).join("");
            }
        }

        if (categoriasCache.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="text-muted text-center py-3">No hay categorías registradas.</td></tr>`;
            return;
        }

        tbody.innerHTML = categoriasCache.map(c => `
            <tr>
                <td><strong>#${c.id}</strong></td>
                <td>${esc(c.nombre)}</td>
                <td class="text-end text-nowrap">
                    <button class="btn btn-outline-primary btn-sm me-1" onclick="editarCategoria(${c.id})">Editar</button>
                    <button class="btn btn-outline-danger btn-sm" onclick="eliminarCategoria(${c.id})">Eliminar</button>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-danger text-center py-3">Error al cargar categorías: ${esc(err.message)}</td></tr>`;
    }
}

async function guardarCategoria(e) {
    e.preventDefault();
    const id = document.getElementById("cat-id").value;
    const nombre = document.getElementById("cat-nombre").value.trim();

    try {
        const res = await fetch(`${API_URL}/admin/categories${id ? "/" + id : ""}`, {
            method: id ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre })
        });

        if (!res.ok) {
            mostrarAlerta(await parsearError(res), "danger");
            return;
        }

        cancelarEdicionCategoria();
        await cargarCategorias();
        mostrarAlerta(id ? "¡Categoría actualizada con éxito!" : "¡Categoría creada con éxito!", "success");
    } catch (err) {
        mostrarAlerta("Error de conexión al guardar la categoría.", "danger");
    }
}

function editarCategoria(id) {
    const c = categoriasCache.find(x => x.id === id);
    if (!c) return;
    document.getElementById("cat-id").value = c.id;
    document.getElementById("cat-nombre").value = c.nombre;
    document.getElementById("categoria-titulo").textContent = `Editar Categoría #${c.id}`;
    document.getElementById("cat-btn-guardar").textContent = "Actualizar Categoría";
    document.getElementById("cat-btn-cancelar").classList.remove("d-none");
}

function cancelarEdicionCategoria() {
    document.getElementById("form-categoria").reset();
    document.getElementById("cat-id").value = "";
    document.getElementById("categoria-titulo").textContent = "Agregar Categoría";
    document.getElementById("cat-btn-guardar").textContent = "Guardar Categoría";
    document.getElementById("cat-btn-cancelar").classList.add("d-none");
}

async function eliminarCategoria(id) {
    const c = categoriasCache.find(x => x.id === id);
    if (!confirm(`¿Eliminar la categoría "${c ? c.nombre : id}"?`)) return;
    try {
        const res = await fetch(`${API_URL}/admin/categories/${id}`, { method: "DELETE" });
        if (!res.ok) {
            mostrarAlerta("No se pudo eliminar: " + await parsearError(res), "danger");
            return;
        }
        if (document.getElementById("cat-id").value === String(id)) cancelarEdicionCategoria();
        await cargarCategorias();
        mostrarAlerta("Categoría eliminada con éxito.", "info");
    } catch (err) {
        mostrarAlerta("Error de conexión al eliminar la categoría.", "danger");
    }
}

// ========================================================
// 4. USUARIOS (CRUD COMPLETO HU-01)
// ========================================================
let usuariosCache = [];
const ROL_BADGE = { admin: "bg-danger", cocina: "bg-warning text-dark", mesero: "bg-success" };

async function cargarUsuarios() {
    const tbody = document.getElementById("tabla-usuarios");
    const selectMeseroPedido = document.getElementById("pedido-mesero-select");
    try {
        const res = await fetch(`${API_URL}/admin/users`);
        if (!res.ok) throw new Error(await parsearError(res));
        usuariosCache = await res.json();

        // Actualizar select de meseros en pedidos
        if (selectMeseroPedido) {
            const meseros = usuariosCache.filter(u => u.rol.toLowerCase() === "mesero" || u.rol.toLowerCase() === "admin");
            selectMeseroPedido.innerHTML = `<option value="">Seleccione mesero...</option>` +
                meseros.map(u => `<option value="${u.id}">${esc(u.nombre)} (${u.rol})</option>`).join("");
        }

        if (usuariosCache.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-3">No hay usuarios registrados.</td></tr>`;
            return;
        }

        tbody.innerHTML = usuariosCache.map(u => `
            <tr>
                <td><strong>#${u.id}</strong></td>
                <td>${esc(u.nombre)}</td>
                <td>${esc(u.correo)}</td>
                <td><span class="badge ${ROL_BADGE[u.rol] || "bg-secondary"}">${esc(u.rol.toUpperCase())}</span></td>
                <td class="text-end text-nowrap">
                    <button class="btn btn-outline-primary btn-sm me-1" onclick="editarUsuario(${u.id})">Editar</button>
                    <button class="btn btn-outline-danger btn-sm" onclick="eliminarUsuario(${u.id})">Eliminar</button>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center py-3">No se pudieron cargar usuarios.</td></tr>`;
    }
}

async function guardarUsuario(e) {
    e.preventDefault();
    const id = document.getElementById("usuario-id").value;
    const contrasena = document.getElementById("usuario-contrasena").value;
    const payload = {
        nombre: document.getElementById("usuario-nombre").value.trim(),
        correo: document.getElementById("usuario-correo").value.trim(),
        rol: document.getElementById("usuario-rol").value
    };
    if (contrasena) payload.contrasena = contrasena;

    try {
        const res = await fetch(`${API_URL}/admin/users${id ? "/" + id : ""}`, {
            method: id ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            mostrarAlerta(await parsearError(res), "danger");
            return;
        }
        cancelarEdicionUsuario();
        await cargarUsuarios();
        mostrarAlerta(id ? "¡Usuario actualizado con éxito!" : "¡Usuario creado con éxito!", "success");
    } catch (err) {
        mostrarAlerta("Error de conexión al guardar el usuario.", "danger");
    }
}

function editarUsuario(id) {
    const u = usuariosCache.find(x => x.id === id);
    if (!u) return;
    document.getElementById("usuario-id").value = u.id;
    document.getElementById("usuario-nombre").value = u.nombre;
    document.getElementById("usuario-correo").value = u.correo;
    document.getElementById("usuario-rol").value = u.rol;
    const pass = document.getElementById("usuario-contrasena");
    pass.value = "";
    pass.required = false;
    pass.placeholder = "Dejar vacío para no cambiarla";
    document.getElementById("usuario-titulo").textContent = `✏️ Editar Usuario #${u.id}`;
    document.getElementById("usuario-guardar").textContent = "Actualizar Usuario";
    document.getElementById("usuario-cancelar").classList.remove("d-none");
    document.getElementById("form-usuario").scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelarEdicionUsuario() {
    document.getElementById("form-usuario").reset();
    document.getElementById("usuario-id").value = "";
    const pass = document.getElementById("usuario-contrasena");
    pass.required = true;
    pass.placeholder = "Contraseña";
    document.getElementById("usuario-titulo").textContent = "👥 Agregar Usuario";
    document.getElementById("usuario-guardar").textContent = "Guardar Usuario";
    document.getElementById("usuario-cancelar").classList.add("d-none");
}

async function eliminarUsuario(id) {
    const u = usuariosCache.find(x => x.id === id);
    if (!confirm(`¿Eliminar al usuario "${u ? u.nombre : id}"?`)) return;
    try {
        const res = await fetch(`${API_URL}/admin/users/${id}`, { method: "DELETE" });
        if (!res.ok) {
            mostrarAlerta("No se pudo eliminar: " + await parsearError(res), "danger");
            return;
        }
        if (document.getElementById("usuario-id").value === String(id)) cancelarEdicionUsuario();
        await cargarUsuarios();
        mostrarAlerta("Usuario eliminado con éxito.", "info");
    } catch (err) {
        mostrarAlerta("Error de conexión al eliminar el usuario.", "danger");
    }
}

// ========================================================
// 5. PEDIDOS Y COCINA (INTERACCIÓN TABLE <-> ORDER)
// ========================================================
let pedidosCache = [];

function toggleMesaRequerida() {
    const tipo = document.getElementById("pedido-tipo").value;
    const grupoMesa = document.getElementById("grupo-pedido-mesa");
    if (tipo === "para_llevar") {
        grupoMesa.style.display = "none";
        document.getElementById("pedido-mesa-select").required = false;
    } else {
        grupoMesa.style.display = "block";
        document.getElementById("pedido-mesa-select").required = true;
    }
}

async function cargarPedidos() {
    const tbody = document.getElementById("tabla-pedidos");
    const filtroEstado = document.getElementById("filtro-pedidos-estado").value;
    try {
        const url = filtroEstado
            ? `${API_URL}/cocina/orders?estado=${encodeURIComponent(filtroEstado)}`
            : `${API_URL}/cocina/orders`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(await parsearError(res));
        pedidosCache = await res.json();

        if (pedidosCache.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-3">No hay pedidos registrados con este criterio.</td></tr>`;
            return;
        }

        const ESTADO_BADGES = {
            "PENDIENTE": "bg-secondary",
            "EN PREPARACIÓN": "bg-warning text-dark",
            "LISTO": "bg-info text-dark",
            "ENTREGADO": "bg-success",
            "CANCELADO": "bg-danger"
        };

        tbody.innerHTML = pedidosCache.map(p => {
            const mesaTexto = p.mesa_id ? `Mesa #${p.mesa_id}` : "Para Llevar";
            const badgeClass = ESTADO_BADGES[p.estado] || "bg-secondary";

            return `
                <tr>
                    <td><strong>#${p.id}</strong></td>
                    <td><span class="fw-semibold">${mesaTexto}</span></td>
                    <td><span class="badge bg-light text-dark border">${p.tipo_pedido}</span></td>
                    <td><span class="badge ${badgeClass}">${p.estado}</span></td>
                    <td class="text-end">
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-warning" title="En preparación" onclick="cambiarEstadoPedido(${p.id}, 'EN PREPARACIÓN')">Cocinar</button>
                            <button class="btn btn-outline-info" title="Listo" onclick="cambiarEstadoPedido(${p.id}, 'LISTO')">Listo</button>
                            <button class="btn btn-outline-success" title="Entregado (Libera mesa)" onclick="cambiarEstadoPedido(${p.id}, 'ENTREGADO')">Entregar</button>
                            <button class="btn btn-outline-danger" title="Cancelar (Libera mesa)" onclick="cambiarEstadoPedido(${p.id}, 'CANCELADO')">X</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join("");
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center py-3">Error al cargar pedidos: ${esc(err.message)}</td></tr>`;
    }
}

async function crearPedido(e) {
    e.preventDefault();
    const tipo = document.getElementById("pedido-tipo").value;
    const mesaSelect = document.getElementById("pedido-mesa-select");
    const meseroSelect = document.getElementById("pedido-mesero-select");

    const mesa_id = (tipo === "salon" && mesaSelect.value) ? parseInt(mesaSelect.value) : null;
    const mesero_id = parseInt(meseroSelect.value);

    if (tipo === "salon" && !mesa_id) {
        mostrarAlerta("Debes seleccionar una mesa para pedidos en salón.", "warning");
        return;
    }
    if (!mesero_id) {
        mostrarAlerta("Debes seleccionar el mesero que atiende.", "warning");
        return;
    }

    const payload = {
        tipo_pedido: tipo,
        mesa_id: mesa_id,
        mesero_id: mesero_id
    };

    try {
        const res = await fetch(`${API_URL}/mesero/orders`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            mostrarAlerta(await parsearError(res), "danger");
            return;
        }

        document.getElementById("form-pedido").reset();
        await cargarPedidos();
        await cargarMesas(); // Actualiza el estado visual de la mesa (¡ocupada!)
        mostrarAlerta("¡Pedido creado exitosamente! La mesa fue marcada como Ocupada.", "success");
    } catch (err) {
        mostrarAlerta("Error de conexión al crear el pedido.", "danger");
    }
}

async function cambiarEstadoPedido(orderId, nuevoEstado) {
    try {
        const res = await fetch(`${API_URL}/cocina/orders/${orderId}/status?estado=${encodeURIComponent(nuevoEstado)}`, {
            method: "PUT"
        });

        if (!res.ok) {
            mostrarAlerta("Error: " + await parsearError(res), "danger");
            return;
        }

        await cargarPedidos();
        await cargarMesas(); // Si se entregó o canceló, la mesa vuelve a estar disponible
        mostrarAlerta(`Pedido #${orderId} actualizado a ${nuevoEstado}.`, "success");
    } catch (err) {
        mostrarAlerta("Error de conexión al actualizar estado del pedido.", "danger");
    }
}

// ========================================================
// 6. INVENTARIO (CRUD COMPLETO)
// ========================================================
let inventarioCache = [];

async function cargarInventario() {
    const tbody = document.getElementById("tabla-inventario");
    try {
        const res = await fetch(`${API_URL}/admin/inventory`);
        if (!res.ok) throw new Error(await parsearError(res));
        inventarioCache = await res.json();

        if (inventarioCache.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-3">No hay insumos en inventario.</td></tr>`;
            return;
        }

        tbody.innerHTML = inventarioCache.map(i => `
            <tr>
                <td><strong>#${i.id}</strong></td>
                <td><strong>${esc(i.nombre_insumo)}</strong></td>
                <td><span class="badge bg-secondary fs-6">${i.cantidad}</span></td>
                <td>${esc(i.unidad_medida)}</td>
                <td class="text-end text-nowrap">
                    <button class="btn btn-outline-primary btn-sm me-1" onclick="editarInventario(${i.id})">Editar</button>
                    <button class="btn btn-outline-danger btn-sm" onclick="eliminarInventario(${i.id})">Eliminar</button>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center py-3">Error al cargar inventario: ${esc(err.message)}</td></tr>`;
    }
}

async function guardarInventario(e) {
    e.preventDefault();
    const id = document.getElementById("inv-id").value;
    const nombre_insumo = document.getElementById("inv-nombre").value.trim();
    const cantidad = parseFloat(document.getElementById("inv-cantidad").value);
    const unidad_medida = document.getElementById("inv-unidad").value.trim();

    const payload = { nombre_insumo, cantidad, unidad_medida };

    try {
        const res = await fetch(`${API_URL}/admin/inventory${id ? "/" + id : ""}`, {
            method: id ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            mostrarAlerta(await parsearError(res), "danger");
            return;
        }

        cancelarEdicionInventario();
        await cargarInventario();
        mostrarAlerta(id ? "¡Insumo actualizado con éxito!" : "¡Insumo registrado con éxito!", "success");
    } catch (err) {
        mostrarAlerta("Error de conexión al guardar el insumo.", "danger");
    }
}

function editarInventario(id) {
    const i = inventarioCache.find(x => x.id === id);
    if (!i) return;
    document.getElementById("inv-id").value = i.id;
    document.getElementById("inv-nombre").value = i.nombre_insumo;
    document.getElementById("inv-cantidad").value = i.cantidad;
    document.getElementById("inv-unidad").value = i.unidad_medida;

    document.getElementById("inv-titulo").textContent = `Editar Insumo #${i.id}`;
    document.getElementById("inv-btn-guardar").textContent = "Actualizar Insumo";
    document.getElementById("inv-btn-cancelar").classList.remove("d-none");
    document.getElementById("form-inventario").scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelarEdicionInventario() {
    document.getElementById("form-inventario").reset();
    document.getElementById("inv-id").value = "";
    document.getElementById("inv-titulo").textContent = "Agregar Insumo";
    document.getElementById("inv-btn-guardar").textContent = "Guardar Insumo";
    document.getElementById("inv-btn-cancelar").classList.add("d-none");
}

async function eliminarInventario(id) {
    const i = inventarioCache.find(x => x.id === id);
    if (!confirm(`¿Eliminar el insumo "${i ? i.nombre_insumo : id}"?`)) return;
    try {
        const res = await fetch(`${API_URL}/admin/inventory/${id}`, { method: "DELETE" });
        if (!res.ok) {
            mostrarAlerta("No se pudo eliminar: " + await parsearError(res), "danger");
            return;
        }
        if (document.getElementById("inv-id").value === String(id)) cancelarEdicionInventario();
        await cargarInventario();
        mostrarAlerta("Insumo eliminado del inventario.", "info");
    } catch (err) {
        mostrarAlerta("Error de conexión al eliminar el insumo.", "danger");
    }
}

// ========================================================
// INICIALIZACIÓN AL ABRIR LA PÁGINA
// ========================================================
window.onload = async () => {
    // Cargar todas las listas al inicio
    await cargarCategorias();
    await cargarProductos();
    await cargarMesas();
    await cargarUsuarios();
    await cargarPedidos();
    await cargarInventario();
};

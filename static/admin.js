// static/admin.js - Lógica del módulo de Administración: Usuarios, Productos, Categorías, Mesas e Inventario
let usuariosCache = [];
let productosCache = [];
let mesasCache = [];
let categoriasCache = [];
let inventarioCache = [];

const ROL_BADGES = {
    admin: "bg-danger",
    cocina: "bg-warning text-dark",
    mesero: "bg-success"
};

// ===================== USUARIOS =====================
async function cargarUsuarios() {
    const tbody = document.getElementById("tabla-usuarios");
    if (!tbody) return;
    try {
        usuariosCache = await apiFetch("/admin/users");
        if (usuariosCache.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-3">No hay usuarios registrados.</td></tr>`;
            return;
        }
        tbody.innerHTML = usuariosCache.map(u => `
            <tr>
                <td>${u.id}</td>
                <td><strong>${esc(u.nombre)}</strong></td>
                <td>${esc(u.correo)}</td>
                <td><span class="badge ${ROL_BADGES[u.rol] || "bg-secondary"}">${esc(u.rol)}</span></td>
                <td class="text-end text-nowrap">
                    <button class="btn btn-outline-info btn-sm me-1" onclick="consultarUsuario(${u.id})" title="Ver detalle">🔍 Ver</button>
                    <button class="btn btn-outline-primary btn-sm me-1" onclick="editarUsuario(${u.id})">Editar</button>
                    <button class="btn btn-outline-danger btn-sm" onclick="eliminarUsuario(${u.id})">Eliminar</button>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center py-3">No se pudieron cargar los usuarios: ${esc(err.message)}</td></tr>`;
    }
}

async function consultarUsuario(id) {
    try {
        const u = await apiFetch(`/admin/users/${id}`);
        mostrarModalDetalle(`Ficha de Usuario #${u.id}`, [
            ["ID del Usuario", `<code>#${u.id}</code>`],
            ["Nombre Completo", `<strong>${esc(u.nombre)}</strong>`],
            ["Correo Electrónico", `<a href="mailto:${esc(u.correo)}">${esc(u.correo)}</a>`],
            ["Rol en el Sistema", `<span class="badge ${ROL_BADGES[u.rol] || "bg-secondary"}">${esc(u.rol)}</span>`]
        ]);
    } catch (err) {
        notifyError("Error al consultar usuario: " + err.message);
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
        if (id) {
            await apiFetch(`/admin/users/${id}`, { method: "PUT", body: payload });
            notifySuccess("¡Usuario actualizado con éxito!");
        } else {
            await apiFetch("/admin/users", { method: "POST", body: payload });
            notifySuccess("¡Usuario creado con éxito!");
        }
        cancelarEdicionUsuario();
        cargarUsuarios();
        if (typeof cargarMeserosSelect === "function") cargarMeserosSelect();
    } catch (err) {
        notifyError("Error al guardar usuario: " + err.message);
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
    pass.placeholder = "Dejar vacío para conservar actual";
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
        await apiFetch(`/admin/users/${id}`, { method: "DELETE" });
        if (document.getElementById("usuario-id").value === String(id)) cancelarEdicionUsuario();
        notifySuccess("Usuario eliminado.");
        cargarUsuarios();
        if (typeof cargarMeserosSelect === "function") cargarMeserosSelect();
    } catch (err) {
        notifyError("No se pudo eliminar el usuario: " + err.message);
    }
}

// ===================== CATEGORÍAS =====================
async function cargarCategorias() {
    const tbody = document.getElementById("tabla-categorias");
    const selectProd = document.getElementById("prod-categoria");
    try {
        categoriasCache = await apiFetch("/admin/categories");

        // Actualizar select de productos
        if (selectProd) {
            if (categoriasCache.length === 0) {
                selectProd.innerHTML = `<option value="1">1 - General (Por defecto)</option>`;
            } else {
                selectProd.innerHTML = categoriasCache.map(c => `
                    <option value="${c.id}">${c.id} - ${esc(c.nombre)}</option>
                `).join("");
            }
        }

        // Actualizar tabla de categorías
        if (tbody) {
            if (categoriasCache.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" class="text-muted text-center py-3">No hay categorías registradas.</td></tr>`;
                return;
            }
            tbody.innerHTML = categoriasCache.map(c => `
                <tr>
                    <td><strong>#${c.id}</strong></td>
                    <td>${esc(c.nombre)}</td>
                    <td class="text-end text-nowrap">
                        <button class="btn btn-outline-info btn-sm me-1" onclick="consultarCategoria(${c.id})" title="Ver detalle">🔍 Ver</button>
                        <button class="btn btn-outline-primary btn-sm me-1" onclick="editarCategoria(${c.id})">Editar</button>
                        <button class="btn btn-outline-danger btn-sm" onclick="eliminarCategoria(${c.id})">Eliminar</button>
                    </td>
                </tr>
            `).join("");
        }
    } catch (err) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="3" class="text-danger text-center py-3">Error al cargar categorías: ${esc(err.message)}</td></tr>`;
    }
}

async function consultarCategoria(id) {
    try {
        const c = await apiFetch(`/admin/categories/${id}`);
        mostrarModalDetalle(`Ficha de Categoría #${c.id}`, [
            ["ID de Categoría", `<code>#${c.id}</code>`],
            ["Nombre de Categoría", `<strong>${esc(c.nombre)}</strong>`]
        ]);
    } catch (err) {
        notifyError("Error al consultar categoría: " + err.message);
    }
}

async function guardarCategoria(e) {
    e.preventDefault();
    const id = document.getElementById("cat-id").value;
    const payload = {
        nombre: document.getElementById("cat-nombre").value.trim()
    };

    try {
        if (id) {
            await apiFetch(`/admin/categories/${id}`, { method: "PUT", body: payload });
            notifySuccess("¡Categoría actualizada!");
        } else {
            await apiFetch("/admin/categories", { method: "POST", body: payload });
            notifySuccess("¡Categoría creada con éxito!");
        }
        cancelarEdicionCategoria();
        cargarCategorias();
    } catch (err) {
        notifyError("Error al guardar categoría: " + err.message);
    }
}

function editarCategoria(id) {
    const c = categoriasCache.find(x => x.id === id);
    if (!c) return;
    document.getElementById("cat-id").value = c.id;
    document.getElementById("cat-nombre").value = c.nombre;
    document.getElementById("cat-titulo").textContent = `✏️ Editar Categoría #${c.id}`;
    document.getElementById("cat-guardar").textContent = "Actualizar Categoría";
    document.getElementById("cat-cancelar").classList.remove("d-none");
    document.getElementById("form-categoria").scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelarEdicionCategoria() {
    document.getElementById("form-categoria").reset();
    document.getElementById("cat-id").value = "";
    document.getElementById("cat-titulo").textContent = "🏷️ Agregar Categoría";
    document.getElementById("cat-guardar").textContent = "Guardar Categoría";
    document.getElementById("cat-cancelar").classList.add("d-none");
}

async function eliminarCategoria(id) {
    const c = categoriasCache.find(x => x.id === id);
    if (!confirm(`¿Eliminar la categoría "${c ? c.nombre : id}"?`)) return;
    try {
        await apiFetch(`/admin/categories/${id}`, { method: "DELETE" });
        if (document.getElementById("cat-id").value === String(id)) cancelarEdicionCategoria();
        notifySuccess("Categoría eliminada.");
        cargarCategorias();
        cargarProductos();
    } catch (err) {
        notifyError("No se pudo eliminar la categoría: " + err.message);
    }
}

// ===================== PRODUCTOS =====================
async function cargarProductos() {
    const tbody = document.getElementById("tabla-productos");
    if (!tbody) return;
    try {
        productosCache = await apiFetch("/admin/products");
        if (productosCache.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-muted text-center py-3">No hay productos en el menú.</td></tr>`;
            return;
        }
        tbody.innerHTML = productosCache.map(p => {
            const cat = categoriasCache.find(c => c.id === p.categoria_id);
            const catNombre = cat ? cat.nombre : `Cat #${p.categoria_id}`;
            return `
                <tr>
                    <td>${p.id}</td>
                    <td><strong>${esc(p.nombre)}</strong></td>
                    <td>$${Number(p.precio).toFixed(2)}</td>
                    <td><span class="badge bg-light text-dark border">${esc(catNombre)}</span></td>
                    <td><small class="text-muted">${esc(p.descripcion || "Sin descripción")}</small></td>
                    <td><span class="badge ${p.disponibilidad ? "bg-success" : "bg-secondary"}">${p.disponibilidad ? "Disponible" : "Agotado"}</span></td>
                    <td class="text-end text-nowrap">
                        <button class="btn btn-outline-info btn-sm me-1" onclick="consultarProducto(${p.id})" title="Ver detalle">🔍 Ver</button>
                        <button class="btn btn-outline-primary btn-sm me-1" onclick="editarProducto(${p.id})">Editar</button>
                        <button class="btn btn-outline-danger btn-sm" onclick="eliminarProducto(${p.id})">Eliminar</button>
                    </td>
                </tr>
            `;
        }).join("");
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-danger text-center py-3">Error al cargar productos: ${esc(err.message)}</td></tr>`;
    }
}

async function consultarProducto(id) {
    try {
        const p = await apiFetch(`/admin/products/${id}`);
        const cat = categoriasCache.find(c => c.id === p.categoria_id);
        const catNombre = cat ? cat.nombre : `Categoría #${p.categoria_id}`;
        mostrarModalDetalle(`Ficha de Producto #${p.id}`, [
            ["ID de Producto", `<code>#${p.id}</code>`],
            ["Nombre", `<strong>${esc(p.nombre)}</strong>`],
            ["Precio Unitario", `<strong>$${Number(p.precio).toFixed(2)}</strong>`],
            ["Categoría", `<span class="badge bg-light text-dark border">${esc(catNombre)}</span>`],
            ["Descripción", esc(p.descripcion || "Sin descripción")],
            ["Estado / Disponibilidad", `<span class="badge ${p.disponibilidad ? "bg-success" : "bg-secondary"}">${p.disponibilidad ? "Disponible para pedir" : "Agotado"}</span>`]
        ]);
    } catch (err) {
        notifyError("Error al consultar producto: " + err.message);
    }
}

async function guardarProducto(e) {
    e.preventDefault();
    const id = document.getElementById("prod-id").value;
    const catInput = document.getElementById("prod-categoria").value;
    const payload = {
        nombre: document.getElementById("prod-nombre").value.trim(),
        precio: parseFloat(document.getElementById("prod-precio").value),
        descripcion: document.getElementById("prod-descripcion").value.trim() || "Sin descripción",
        disponibilidad: document.getElementById("prod-disponible").value === "true",
        categoria_id: catInput ? parseInt(catInput) : 1
    };

    try {
        if (id) {
            await apiFetch(`/admin/products/${id}`, { method: "PUT", body: payload });
            notifySuccess("¡Producto actualizado!");
        } else {
            await apiFetch("/admin/products", { method: "POST", body: payload });
            notifySuccess("¡Producto agregado con éxito!");
        }
        cancelarEdicionProducto();
        cargarProductos();
        if (typeof cargarMenuMesero === "function") cargarMenuMesero();
    } catch (err) {
        notifyError("Error al guardar producto: " + err.message);
    }
}

function editarProducto(id) {
    const p = productosCache.find(x => x.id === id);
    if (!p) return;
    document.getElementById("prod-id").value = p.id;
    document.getElementById("prod-nombre").value = p.nombre;
    document.getElementById("prod-precio").value = p.precio;
    document.getElementById("prod-descripcion").value = p.descripcion || "";
    document.getElementById("prod-disponible").value = p.disponibilidad ? "true" : "false";
    document.getElementById("prod-categoria").value = p.categoria_id;
    document.getElementById("prod-titulo").textContent = `✏️ Editar Producto #${p.id}`;
    document.getElementById("prod-guardar").textContent = "Actualizar Producto";
    document.getElementById("prod-cancelar").classList.remove("d-none");
    document.getElementById("form-producto").scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelarEdicionProducto() {
    document.getElementById("form-producto").reset();
    document.getElementById("prod-id").value = "";
    document.getElementById("prod-titulo").textContent = "🍔 Agregar Producto";
    document.getElementById("prod-guardar").textContent = "Guardar Producto";
    document.getElementById("prod-cancelar").classList.add("d-none");
}

async function eliminarProducto(id) {
    const p = productosCache.find(x => x.id === id);
    if (!confirm(`¿Eliminar el producto "${p ? p.nombre : id}"?`)) return;
    try {
        await apiFetch(`/admin/products/${id}`, { method: "DELETE" });
        if (document.getElementById("prod-id").value === String(id)) cancelarEdicionProducto();
        notifySuccess("Producto eliminado.");
        cargarProductos();
        if (typeof cargarMenuMesero === "function") cargarMenuMesero();
    } catch (err) {
        notifyError("No se pudo eliminar el producto: " + err.message);
    }
}

// ===================== MESAS =====================
async function cargarMesasAdmin() {
    const tbody = document.getElementById("tabla-mesas");
    const countBadge = document.getElementById("mesas-contador");
    if (!tbody) return;
    try {
        mesasCache = await apiFetch("/admin/tables");
        if (countBadge) {
            countBadge.textContent = `${mesasCache.length}/20`;
            if (mesasCache.length >= 20) {
                countBadge.className = "badge bg-danger ms-2";
            } else {
                countBadge.className = "badge bg-info text-dark ms-2";
            }
        }
        if (mesasCache.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-3">No hay mesas configuradas.</td></tr>`;
            return;
        }
        tbody.innerHTML = mesasCache.map(m => `
            <tr>
                <td>${m.id}</td>
                <td><strong>Mesa ${m.numero}</strong></td>
                <td>${m.capacidad} personas</td>
                <td><span class="badge ${m.estado === "disponible" ? "bg-success" : "bg-warning text-dark"}">${esc(m.estado || "disponible")}</span></td>
                <td class="text-end text-nowrap">
                    <button class="btn btn-outline-info btn-sm me-1" onclick="consultarMesa(${m.id})" title="Ver detalle">🔍 Ver</button>
                    <button class="btn btn-outline-primary btn-sm me-1" onclick="editarMesa(${m.id})">Editar</button>
                    <button class="btn btn-outline-danger btn-sm" onclick="eliminarMesa(${m.id})">Eliminar</button>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center py-3">Error al cargar mesas: ${esc(err.message)}</td></tr>`;
    }
}

async function consultarMesa(id) {
    try {
        const m = await apiFetch(`/admin/tables/${id}`);
        mostrarModalDetalle(`Ficha de Mesa #${m.numero}`, [
            ["ID interno", `<code>#${m.id}</code>`],
            ["Número de Mesa", `<strong>Mesa ${m.numero}</strong>`],
            ["Capacidad", `${m.capacidad} comensales`],
            ["Estado actual", `<span class="badge ${m.estado === "disponible" ? "bg-success" : "bg-warning text-dark"}">${esc(m.estado || "disponible")}</span>`]
        ]);
    } catch (err) {
        notifyError("Error al consultar mesa: " + err.message);
    }
}

async function guardarMesa(e) {
    e.preventDefault();
    const id = document.getElementById("mesa-id").value;
    const payload = {
        numero: parseInt(document.getElementById("mesa-numero").value),
        capacidad: parseInt(document.getElementById("mesa-capacidad").value),
        estado: document.getElementById("mesa-estado").value
    };

    // Comprobación en cliente antes de empezar para crear mesa
    if (!id && mesasCache.length >= 20) {
        notifyError("Comprobación previa: Límite máximo de 20 mesas alcanzado en el restaurante. No es posible crear más mesas.");
        return;
    }

    try {
        if (id) {
            await apiFetch(`/admin/tables/${id}`, { method: "PUT", body: payload });
            notifySuccess("¡Mesa actualizada!");
        } else {
            await apiFetch("/admin/tables", { method: "POST", body: payload });
            notifySuccess("¡Mesa creada con éxito!");
        }
        cancelarEdicionMesa();
        cargarMesasAdmin();
        if (typeof cargarMesasMesero === "function") cargarMesasMesero();
    } catch (err) {
        notifyError("Error al guardar mesa: " + err.message);
    }
}

function editarMesa(id) {
    const m = mesasCache.find(x => x.id === id);
    if (!m) return;
    document.getElementById("mesa-id").value = m.id;
    document.getElementById("mesa-numero").value = m.numero;
    document.getElementById("mesa-capacidad").value = m.capacidad;
    document.getElementById("mesa-estado").value = m.estado || "disponible";
    document.getElementById("mesa-titulo").textContent = `✏️ Editar Mesa #${m.numero}`;
    document.getElementById("mesa-guardar").textContent = "Actualizar Mesa";
    document.getElementById("mesa-cancelar").classList.remove("d-none");
    document.getElementById("form-mesa").scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelarEdicionMesa() {
    document.getElementById("form-mesa").reset();
    document.getElementById("mesa-id").value = "";
    document.getElementById("mesa-titulo").textContent = "🪑 Agregar Mesa";
    document.getElementById("mesa-guardar").textContent = "Guardar Mesa";
    document.getElementById("mesa-cancelar").classList.add("d-none");
}

async function eliminarMesa(id) {
    const m = mesasCache.find(x => x.id === id);
    if (!confirm(`¿Eliminar la mesa #${m ? m.numero : id}?`)) return;
    try {
        await apiFetch(`/admin/tables/${id}`, { method: "DELETE" });
        if (document.getElementById("mesa-id").value === String(id)) cancelarEdicionMesa();
        notifySuccess("Mesa eliminada.");
        cargarMesasAdmin();
        if (typeof cargarMesasMesero === "function") cargarMesasMesero();
    } catch (err) {
        notifyError("No se pudo eliminar la mesa: " + err.message);
    }
}

// ===================== INVENTARIO =====================
async function cargarInventario() {
    const tbody = document.getElementById("tabla-inventario");
    if (!tbody) return;
    try {
        inventarioCache = await apiFetch("/admin/inventory");
        if (inventarioCache.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-3">No hay insumos en el inventario.</td></tr>`;
            return;
        }
        tbody.innerHTML = inventarioCache.map(i => `
            <tr>
                <td><strong>#${i.id}</strong></td>
                <td><strong>${esc(i.nombre_insumo)}</strong></td>
                <td>${Number(i.cantidad).toFixed(2)}</td>
                <td><span class="badge bg-secondary">${esc(i.unidad_medida)}</span></td>
                <td class="text-end text-nowrap">
                    <button class="btn btn-outline-info btn-sm me-1" onclick="consultarInventario(${i.id})" title="Ver detalle">🔍 Ver</button>
                    <button class="btn btn-outline-primary btn-sm me-1" onclick="editarInsumo(${i.id})">Editar</button>
                    <button class="btn btn-outline-danger btn-sm" onclick="eliminarInsumo(${i.id})">Eliminar</button>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center py-3">Error al cargar inventario: ${esc(err.message)}</td></tr>`;
    }
}

async function consultarInventario(id) {
    try {
        const i = await apiFetch(`/admin/inventory/${id}`);
        mostrarModalDetalle(`Ficha de Insumo #${i.id}`, [
            ["ID de Insumo", `<code>#${i.id}</code>`],
            ["Nombre del Insumo", `<strong>${esc(i.nombre_insumo)}</strong>`],
            ["Cantidad en Stock", `<strong>${Number(i.cantidad).toFixed(2)}</strong>`],
            ["Unidad de Medida", `<span class="badge bg-secondary">${esc(i.unidad_medida)}</span>`]
        ]);
    } catch (err) {
        notifyError("Error al consultar insumo: " + err.message);
    }
}

async function guardarInsumo(e) {
    e.preventDefault();
    const id = document.getElementById("inv-id").value;
    const payload = {
        nombre_insumo: document.getElementById("inv-nombre").value.trim(),
        cantidad: parseFloat(document.getElementById("inv-cantidad").value),
        unidad_medida: document.getElementById("inv-unidad").value.trim()
    };

    try {
        if (id) {
            await apiFetch(`/admin/inventory/${id}`, { method: "PUT", body: payload });
            notifySuccess("¡Insumo actualizado!");
        } else {
            await apiFetch("/admin/inventory", { method: "POST", body: payload });
            notifySuccess("¡Insumo agregado al inventario!");
        }
        cancelarEdicionInsumo();
        cargarInventario();
    } catch (err) {
        notifyError("Error al guardar insumo: " + err.message);
    }
}

function editarInsumo(id) {
    const i = inventarioCache.find(x => x.id === id);
    if (!i) return;
    document.getElementById("inv-id").value = i.id;
    document.getElementById("inv-nombre").value = i.nombre_insumo;
    document.getElementById("inv-cantidad").value = i.cantidad;
    document.getElementById("inv-unidad").value = i.unidad_medida;
    document.getElementById("inv-titulo").textContent = `✏️ Editar Insumo #${i.id}`;
    document.getElementById("inv-guardar").textContent = "Actualizar Insumo";
    document.getElementById("inv-cancelar").classList.remove("d-none");
    document.getElementById("form-inventario").scrollIntoView({ behavior: "smooth", block: "center" });
}

function cancelarEdicionInsumo() {
    document.getElementById("form-inventario").reset();
    document.getElementById("inv-id").value = "";
    document.getElementById("inv-titulo").textContent = "📦 Agregar Insumo";
    document.getElementById("inv-guardar").textContent = "Guardar Insumo";
    document.getElementById("inv-cancelar").classList.add("d-none");
}

async function eliminarInsumo(id) {
    const i = inventarioCache.find(x => x.id === id);
    if (!confirm(`¿Eliminar el insumo "${i ? i.nombre_insumo : id}"?`)) return;
    try {
        await apiFetch(`/admin/inventory/${id}`, { method: "DELETE" });
        if (document.getElementById("inv-id").value === String(id)) cancelarEdicionInsumo();
        notifySuccess("Insumo eliminado.");
        cargarInventario();
    } catch (err) {
        notifyError("No se pudo eliminar el insumo: " + err.message);
    }
}

function initAdminModule() {
    cargarCategorias();
    cargarUsuarios();
    cargarProductos();
    cargarMesasAdmin();
    cargarInventario();
}

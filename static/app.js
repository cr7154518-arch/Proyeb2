const API_URL = window.location.origin;

// Cargar Lista de Productos en el Menú
async function cargarMenu() {
    try {
        const res = await fetch(`${API_URL}/mesero/menu`);
        const productos = await res.json();
        const lista = document.getElementById("lista-menu");
        lista.innerHTML = "";

        if (!productos || productos.length === 0) {
            lista.innerHTML = `<li class="list-group-item text-muted text-center">No hay productos registrados.</li>`;
            return;
        }

        productos.forEach(p => {
            lista.innerHTML += `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${p.nombre}</strong>
                        ${p.descripcion ? `<br><small class="text-muted">${p.descripcion}</small>` : ''}
                    </div>
                    <span class="badge bg-primary rounded-pill">$${p.precio}</span>
                </li>`;
        });
    } catch (err) {
        console.error("Error al obtener el menú:", err);
    }
}

// Cargar Lista de Mesas
async function cargarMesas() {
    try {
        const res = await fetch(`${API_URL}/mesero/tables`);
        const mesas = await res.json();
        const grid = document.getElementById("grid-mesas");
        grid.innerHTML = "";

        if (!mesas || mesas.length === 0) {
            grid.innerHTML = `<div class="col-12 text-muted text-center">No hay mesas configuradas.</div>`;
            return;
        }

        mesas.forEach(m => {
            grid.innerHTML += `
                <div class="col-6">
                    <div class="card text-center p-2 border-success bg-white">
                        <h6 class="fw-bold mb-1">Mesa ${m.numero}</h6>
                        <small class="text-muted">Capacidad: ${m.capacidad} pers.</small>
                    </div>
                </div>`;
        });
    } catch (err) {
        console.error("Error al obtener las mesas:", err);
    }
}

// Registrar Producto nuevo en la BD
async function crearProducto(e) {
    e.preventDefault();
    const nombre = document.getElementById("prod-nombre").value;
    const precio = parseFloat(document.getElementById("prod-precio").value);
    const descripcion = document.getElementById("prod-descripcion").value;
    const catInput = document.getElementById("prod-categoria").value;

    const categoria_id = catInput ? parseInt(catInput) : 1;

    const payload = {
        nombre: nombre,
        precio: precio,
        descripcion: descripcion || "Sin descripción",
        disponibilidad: true,
        categoria_id: categoria_id
    };

    try {
        const res = await fetch(`${API_URL}/admin/products`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            document.getElementById("form-producto").reset();
            cargarMenu();
            alert("¡Producto creado con éxito!");
        } else {
            const errorData = await res.json();
            alert("Error " + res.status + ": " + JSON.stringify(errorData.detail || errorData));
        }
    } catch (err) {
        alert("Error de conexión al guardar el producto.");
    }
}

// Registrar Mesa nueva en la BD
async function crearMesa(e) {
    e.preventDefault();
    const numero = parseInt(document.getElementById("mesa-numero").value);
    const capacidad = parseInt(document.getElementById("mesa-capacidad").value);

    try {
        const res = await fetch(`${API_URL}/admin/tables`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ numero, capacidad })
        });

        if (res.ok) {
            document.getElementById("form-mesa").reset();
            cargarMesas();
            alert("¡Mesa creada con éxito!");
        } else {
            const errorData = await res.json();
            alert("Error al crear la mesa: " + JSON.stringify(errorData.detail || errorData));
        }
    } catch (err) {
        alert("Error de conexión al guardar la mesa.");
    }
}

// ===================== GESTIÓN DE USUARIOS (HU-01) =====================
let usuariosCache = [];

// Escapa texto antes de insertarlo en el HTML (evita inyección de código)
function esc(texto) {
    return String(texto ?? "").replace(/[&<>"']/g, c => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
}

const ROL_BADGE = { admin: "bg-danger", cocina: "bg-warning text-dark", mesero: "bg-success" };

// Convierte el error de la API en un texto legible
async function mensajeError(res) {
    try {
        const data = await res.json();
        const d = data.detail ?? data;
        if (Array.isArray(d)) return d.map(e => (e.loc ? e.loc.slice(1).join(".") + ": " : "") + e.msg).join("\n");
        return typeof d === "string" ? d : JSON.stringify(d);
    } catch {
        return "Error " + res.status;
    }
}

async function cargarUsuarios() {
    const tbody = document.getElementById("tabla-usuarios");
    try {
        const res = await fetch(`${API_URL}/admin/users`);
        if (!res.ok) throw new Error(await mensajeError(res));
        usuariosCache = await res.json();

        if (usuariosCache.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-3">No hay usuarios registrados.</td></tr>`;
            return;
        }
        tbody.innerHTML = usuariosCache.map(u => `
            <tr>
                <td>${u.id}</td>
                <td>${esc(u.nombre)}</td>
                <td>${esc(u.correo)}</td>
                <td><span class="badge ${ROL_BADGE[u.rol] || "bg-secondary"}">${esc(u.rol)}</span></td>
                <td class="text-end text-nowrap">
                    <button class="btn btn-outline-primary btn-sm" onclick="editarUsuario(${u.id})">Editar</button>
                    <button class="btn btn-outline-danger btn-sm" onclick="eliminarUsuario(${u.id})">Eliminar</button>
                </td>
            </tr>`).join("");
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center py-3">No se pudieron cargar los usuarios.</td></tr>`;
        console.error("Error al obtener los usuarios:", err);
    }
}

// Crea un usuario nuevo o actualiza el que se está editando
async function guardarUsuario(e) {
    e.preventDefault();
    const id = document.getElementById("usuario-id").value;
    const contrasena = document.getElementById("usuario-contrasena").value;
    const payload = {
        nombre: document.getElementById("usuario-nombre").value.trim(),
        correo: document.getElementById("usuario-correo").value.trim(),
        rol: document.getElementById("usuario-rol").value
    };
    if (contrasena) payload.contrasena = contrasena;   // al editar, vacío = no cambiar

    try {
        const res = await fetch(`${API_URL}/admin/users${id ? "/" + id : ""}`, {
            method: id ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            alert("Error al guardar el usuario: " + await mensajeError(res));
            return;
        }
        cancelarEdicionUsuario();
        cargarUsuarios();
        alert(id ? "¡Usuario actualizado con éxito!" : "¡Usuario creado con éxito!");
    } catch (err) {
        alert("Error de conexión al guardar el usuario.");
    }
}

// Pasa el formulario a modo edición con los datos del usuario
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
    document.getElementById("usuario-titulo").textContent = "✏️ Editar Usuario #" + u.id;
    document.getElementById("usuario-guardar").textContent = "Actualizar Usuario";
    document.getElementById("usuario-cancelar").classList.remove("d-none");
    document.getElementById("form-usuario").scrollIntoView({ behavior: "smooth", block: "center" });
}

// Vuelve el formulario a modo "crear"
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
    if (!confirm(`¿Eliminar al usuario "${u ? u.nombre : id}"? Esta acción no se puede deshacer.`)) return;
    try {
        const res = await fetch(`${API_URL}/admin/users/${id}`, { method: "DELETE" });
        if (!res.ok) {
            alert("No se pudo eliminar: " + await mensajeError(res));
        } else if (document.getElementById("usuario-id").value === String(id)) {
            cancelarEdicionUsuario();
        }
        cargarUsuarios();
    } catch (err) {
        alert("Error de conexión al eliminar el usuario.");
    }
}

// Cargar datos al abrir la página
window.onload = () => {
    cargarMenu();
    cargarMesas();
    cargarUsuarios();
};
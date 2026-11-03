// static/api.js - Helper centralizado de peticiones, manejo de errores y utilidades
const API_URL = window.location.origin;

/**
 * Escapa texto antes de insertarlo en el HTML para prevenir XSS.
 */
function esc(texto) {
    return String(texto ?? "").replace(/[&<>"']/g, c => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
}

/**
 * Convierte el objeto de error de FastAPI en un mensaje de texto legible.
 */
async function parseError(res) {
    try {
        const data = await res.json();
        const d = data.detail ?? data;
        if (Array.isArray(d)) {
            return d.map(e => (e.loc ? e.loc.slice(1).join(".") + ": " : "") + e.msg).join("\n");
        }
        return typeof d === "string" ? d : JSON.stringify(d);
    } catch {
        return `Error del servidor (código ${res.status})`;
    }
}

/**
 * Helper centralizado para fetch con manejo de JSON y excepciones.
 */
async function apiFetch(endpoint, options = {}) {
    const config = {
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        ...options
    };

    if (config.body && typeof config.body === "object" && !(config.body instanceof FormData)) {
        config.body = JSON.stringify(config.body);
    }

    try {
        const res = await fetch(`${API_URL}${endpoint}`, config);
        if (!res.ok) {
            const msg = await parseError(res);
            throw new Error(msg);
        }
        if (res.status === 204) {
            return null;
        }
        return await res.json();
    } catch (err) {
        console.error(`Error en API [${options.method || "GET"} ${endpoint}]:`, err);
        throw err;
    }
}

/**
 * Muestra notificación flotante o modal usando alert simple.
 */
function notifySuccess(mensaje) {
    alert("✅ " + mensaje);
}

function notifyError(mensaje) {
    alert("❌ " + mensaje);
}


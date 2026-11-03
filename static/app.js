// static/app.js - Inicializador principal y control de navegación por pestañas

document.addEventListener("DOMContentLoaded", () => {
    // Inicializar cada módulo al cargar la página
    if (typeof initAdminModule === "function") initAdminModule();
    if (typeof initMeseroModule === "function") initMeseroModule();
    if (typeof initCocinaModule === "function") initCocinaModule();

    // Eventos de cambio de pestaña para recargar datos frescos
    const tabAdmin = document.getElementById("tab-admin-btn");
    const tabMesero = document.getElementById("tab-mesero-btn");
    const tabCocina = document.getElementById("tab-cocina-btn");

    if (tabAdmin) {
        tabAdmin.addEventListener("shown.bs.tab", () => {
            cargarCategorias();
            cargarUsuarios();
            cargarProductos();
            cargarMesasAdmin();
            cargarInventario();
        });
    }

    if (tabMesero) {
        tabMesero.addEventListener("shown.bs.tab", () => {
            cargarMeserosSelect();
            cargarMesasMesero();
            cargarMenuMesero();
            cargarPedidos();
        });
    }

    if (tabCocina) {
        tabCocina.addEventListener("shown.bs.tab", () => {
            cargarCocina();
        });
    }
});

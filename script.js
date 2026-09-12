// ==========================================================================
// GamerStock // CONTROL DE INVENTARIO
// Imágenes: IndexedDB local — NUNCA viajan en el JSON
// ==========================================================================

// ==========================================================================
// CONEXIÓN A SUPABASE (base de datos en la nube)
// ==========================================================================
const SUPABASE_URL = 'https://oaoijxrbdoxhjyauzoer.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hb2lqeHJiZG94aGp5YXV6b2VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNzk4NTQsImV4cCI6MjEwNDc1NTg1NH0.wgpfjp9Gs5l_9p-mGf7VmdHTNc8EK8xLHw6to_vWgX8';
let supabaseClient = null;
try {
    if (window.supabase) supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (err) { console.warn('No se pudo iniciar Supabase, se seguirá trabajando localmente:', err); }

// --- Funciones de sincronización (todas "best effort": si falla, la app sigue funcionando con localStorage) ---
async function supabaseReemplazarInventario() {
    if (!supabaseClient) return;
    try {
        await supabaseClient.from('inventario').delete().neq('id', '__ninguno__');
        if (inventario.length) {
            const filas = inventario.map(p => ({ id: String(p.id), nombre: p.nombre, categoria: p.categoria || p.category || '', precio: parseFloat(p.precio) || 0, stock: parseInt(p.stock) || 0 }));
            await supabaseClient.from('inventario').insert(filas);
        }
    } catch (err) { console.warn('Supabase (inventario):', err); }
}

async function supabaseReemplazarCategorias() {
    if (!supabaseClient) return;
    try {
        await supabaseClient.from('categorias').delete().gte('id', 0);
        if (categorias.length) await supabaseClient.from('categorias').insert(categorias.map(c => ({ nombre: c })));
    } catch (err) { console.warn('Supabase (categorias):', err); }
}

async function supabaseReemplazarMetodosPago() {
    if (!supabaseClient) return;
    try {
        await supabaseClient.from('metodos_pago').delete().gte('id', 0);
        if (metodosPagoPersonalizados.length) await supabaseClient.from('metodos_pago').insert(metodosPagoPersonalizados.map(m => ({ nombre: m })));
    } catch (err) { console.warn('Supabase (metodos_pago):', err); }
}

async function supabaseInsertarHistorial(filasNuevas) {
    if (!supabaseClient || !filasNuevas.length) return;
    try {
        await supabaseClient.from('historial_salidas').insert(filasNuevas.map(t => ({
            fecha_hora: t.fechaHora, factura: t.factura, nombre: t.nombre, categoria: t.categoria,
            precio_original: t.precioOriginal, descuento_aplicado: t.descuentoAplicado,
            precio_venta_final: t.precioVentaFinal, forma_pago: t.formaPago, cliente: t.cliente,
            descripcion: t.descripcion, vendido: t.vendido
        })));
    } catch (err) { console.warn('Supabase (historial):', err); }
}

async function supabaseLimpiarHistorial() {
    if (!supabaseClient) return;
    try { await supabaseClient.from('historial_salidas').delete().gte('id', 0); } catch (err) { console.warn('Supabase (limpiar historial):', err); }
}

async function supabaseGuardarCliente(cliente) {
    if (!supabaseClient) return;
    try {
        await supabaseClient.from('clientes').upsert({
            id: cliente.id, clave: cliente.clave, nombre: cliente.nombre, cedula: cliente.cedula, celular: cliente.celular,
            primera_compra: cliente.primeraCompra, ultima_compra: cliente.ultimaCompra,
            total_compras: cliente.totalCompras, total_gastado: cliente.totalGastado
        }, { onConflict: 'id' });
    } catch (err) { console.warn('Supabase (clientes):', err); }
}

async function supabaseGuardarConfiguracion(clave, valor) {
    if (!supabaseClient) return;
    try { await supabaseClient.from('configuracion_app').upsert({ clave, valor }, { onConflict: 'clave' }); } catch (err) { console.warn('Supabase (config):', err); }
}

// --- Carga inicial desde Supabase: si hay datos en la nube, reemplazan lo que haya local ---
async function cargarDatosDesdeSupabase() {
    if (!supabaseClient) return false;
    try {
        const [invRes, catRes, metRes, histRes, cliRes, cfgRes] = await Promise.all([
            supabaseClient.from('inventario').select('*'),
            supabaseClient.from('categorias').select('*').order('id'),
            supabaseClient.from('metodos_pago').select('*').order('id'),
            supabaseClient.from('historial_salidas').select('*').order('id', { ascending: false }),
            supabaseClient.from('clientes').select('*'),
            supabaseClient.from('configuracion_app').select('*')
        ]);

        // Si la base ya tiene datos (proyecto no vacío), los usamos como fuente de verdad
        if (invRes.data && invRes.data.length) {
            inventario = invRes.data.map(p => ({ id: p.id, nombre: p.nombre, categoria: p.categoria, category: p.categoria, precio: p.precio, stock: p.stock }));
        }
        if (catRes.data && catRes.data.length) categorias = catRes.data.map(c => c.nombre);
        if (metRes.data && metRes.data.length) metodosPagoPersonalizados = metRes.data.map(m => m.nombre);
        if (histRes.data && histRes.data.length) {
            historialSalidas = histRes.data.map(t => ({
                fechaHora: t.fecha_hora, factura: t.factura, nombre: t.nombre, categoria: t.categoria,
                precioOriginal: t.precio_original, descuentoAplicado: t.descuento_aplicado, precioVentaFinal: t.precio_venta_final,
                formaPago: t.forma_pago, cliente: t.cliente, descripcion: t.descripcion, vendido: t.vendido
            }));
        }
        if (cliRes.data && cliRes.data.length) {
            clientesGamer = cliRes.data.map(c => ({
                id: c.id, clave: c.clave, nombre: c.nombre, cedula: c.cedula, celular: c.celular,
                primeraCompra: c.primera_compra, ultimaCompra: c.ultima_compra, totalCompras: c.total_compras, totalGastado: c.total_gastado
            }));
        }
        if (cfgRes.data && cfgRes.data.length) {
            cfgRes.data.forEach(row => {
                if (row.clave === 'admin_password_gamer') localStorage.setItem('admin_password_gamer', row.valor);
                if (row.clave === 'acceso_password_gamer') localStorage.setItem('acceso_password_gamer', row.valor);
            });
        }

        // Guardamos también en localStorage para que sirva de respaldo sin internet
        localStorage.setItem('inventario_gamer', JSON.stringify(inventario));
        localStorage.setItem('categorias_gamer', JSON.stringify(categorias));
        localStorage.setItem('metodos_pago_gamer', JSON.stringify(metodosPagoPersonalizados));
        localStorage.setItem('historial_salidas_gamer', JSON.stringify(historialSalidas));
        localStorage.setItem('clientes_gamer', JSON.stringify(clientesGamer));

        // Si la nube está vacía pero hay datos locales (primera vez que se conecta), subimos lo local
        if (!(invRes.data && invRes.data.length) && inventario.length) supabaseReemplazarInventario();
        if (!(catRes.data && catRes.data.length) && categorias.length) supabaseReemplazarCategorias();
        if (!(metRes.data && metRes.data.length) && metodosPagoPersonalizados.length) supabaseReemplazarMetodosPago();
        if (!(histRes.data && histRes.data.length) && historialSalidas.length) supabaseInsertarHistorial(historialSalidas);
        if (!(cliRes.data && cliRes.data.length) && clientesGamer.length) clientesGamer.forEach(c => supabaseGuardarCliente(c));

        return true;
    } catch (err) {
        console.warn('No se pudo cargar desde Supabase, se sigue trabajando localmente:', err);
        return false;
    }
}

let inventario = JSON.parse(localStorage.getItem('inventario_gamer')) || [];
let categorias = JSON.parse(localStorage.getItem('categorias_gamer')) || ["Procesadores", "Tarjetas de Video", "Placas Madre", "Periféricos"];
let historialSalidas = JSON.parse(localStorage.getItem('historial_salidas_gamer')) || [];
let carritoVentaActual = [];
let metodosPagoPersonalizados = JSON.parse(localStorage.getItem('metodos_pago_gamer')) || [];
let clientesGamer = JSON.parse(localStorage.getItem('clientes_gamer')) || [];

// ==========================================================================
// PAGINACIÓN DEL CATÁLOGO
// ==========================================================================
const PRODUCTOS_POR_PAGINA = 8;
let paginaActualCatalogo = 1;
let ultimaClaveFiltroCatalogo = null;

// ==========================================================================
// MENÚ LATERAL TIPO ACCORDION (sub-categorías con ">" en el nombre)
// Ej: "Periféricos > Teclados > Gamer" arma un árbol de 3 niveles.
// ==========================================================================
let gruposCategoriaExpandidos = new Set();

// ==========================================================================
// INDEXEDDB — IMÁGENES LOCALES
// ==========================================================================
let dbImagenes = null;

function abrirDBImagenes() {
    return new Promise((resolve) => {
        const req = indexedDB.open('ExpoTecImagenes', 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore('imagenes', { keyPath: 'id' });
        req.onsuccess = e => { dbImagenes = e.target.result; resolve(); };
        req.onerror = () => resolve();
    });
}

function guardarImagenDB(id, base64) {
    return new Promise((resolve) => {
        if (!dbImagenes) { resolve(); return; }
        const tx = dbImagenes.transaction('imagenes', 'readwrite');
        tx.objectStore('imagenes').put({ id, src: base64 });
        tx.oncomplete = resolve;
        tx.onerror = resolve;
    });
}

function obtenerImagenDB(id) {
    return new Promise((resolve) => {
        if (!dbImagenes) { resolve(null); return; }
        const req = dbImagenes.transaction('imagenes', 'readonly').objectStore('imagenes').get(id);
        req.onsuccess = () => resolve(req.result ? req.result.src : null);
        req.onerror = () => resolve(null);
    });
}

function eliminarImagenDB(id) {
    if (!dbImagenes) return;
    dbImagenes.transaction('imagenes', 'readwrite').objectStore('imagenes').delete(id);
}

function comprimirImagen(archivo) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                const MAX = 520;
                let w = img.width, h = img.height;
                if (w > h && w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
                else if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.72));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(archivo);
    });
}

// ==========================================================================
// DOM
// ==========================================================================
const formProducto       = document.getElementById('form-producto');
const formCategoria      = document.getElementById('form-categoria');
const selectCategoria    = document.getElementById('categoria');
const contenedorCards    = document.getElementById('contenedor-cards');
const contenedorPaginacion = document.getElementById('paginacion-productos');
const contenedorFiltros  = document.getElementById('filtros-secciones');
const buscadorInput      = document.getElementById('buscador-productos');
const btnExportar        = document.getElementById('btn-exportar');
const inputImportar      = document.getElementById('importar-archivo');
const btnRepararDatos    = document.getElementById('btn-reparar-datos');
const tablaCuerpoHistorial = document.getElementById('tabla-cuerpo-historial');
const btnDescargarExcel  = document.getElementById('btn-descargar-excel');
const btnExportarInventarioExcel = document.getElementById('btn-exportar-inventario-excel');
const btnLimpiarHistorial = document.getElementById('btn-limpiar-historial');
const editIdInput        = document.getElementById('edit-id');
const tituloFormulario   = document.getElementById('titulo-formulario');
const btnSubmitForm      = document.getElementById('btn-submit-form');
const btnCancelarEdicion = document.getElementById('btn-cancelar-edicion');
const totalProductosEl   = document.getElementById('total-productos');
const valorTotalEl       = document.getElementById('valor-total');
const alertasStockEl     = document.getElementById('alertas-stock');
const inputImagenForm    = document.getElementById('imagen-producto');
const previewImagenForm  = document.getElementById('preview-imagen-form');

const modalEditar        = document.getElementById('modal-editar');
const formEditarModal    = document.getElementById('form-editar-modal');
const modalEditId        = document.getElementById('modal-edit-id');
const modalEditNombre    = document.getElementById('modal-edit-nombre');
const modalEditCategoria = document.getElementById('modal-edit-categoria');
const modalEditPrecio    = document.getElementById('modal-edit-precio');
const modalEditStock     = document.getElementById('modal-edit-stock');
const modalEditImagen    = document.getElementById('modal-edit-imagen');
const previewImagenModal = document.getElementById('preview-imagen-modal');
const btnCerrarModalEditar = document.getElementById('btn-cerrar-modal-editar');
const btnCerrarEditarX   = document.getElementById('btn-cerrar-editar-x');

const btnToggleCarrito   = document.getElementById('btn-toggle-carrito');
const panelCarrito       = document.getElementById('panel-carrito');
const carritoBadge       = document.getElementById('carrito-badge');
const carritoItemsEl     = document.getElementById('carrito-items');
const carritoSubtotalEl  = document.getElementById('carrito-subtotal');
const carritoDescEl      = document.getElementById('carrito-descuentos');
const carritoTotalEl     = document.getElementById('carrito-total');
const carritoMetodoPago  = document.getElementById('carrito-metodo-pago');
const contenedorNuevoMetodo = document.getElementById('contenedor-nuevo-metodo');
const inputNuevoMetodo   = document.getElementById('input-nuevo-metodo');
const btnGuardarMetodo   = document.getElementById('btn-guardar-metodo');
const btnProcesarFactura = document.getElementById('btn-procesar-factura');
const btnCancelarCarrito = document.getElementById('btn-cancelar-venta-carrito');

// ==========================================================================
// SISTEMA DE ROLES (EMPLEADO / ADMINISTRADOR)
// ==========================================================================
// Contraseña de Administrador: guardada en localStorage (tú la cambias desde la página)
// Si nunca la has cambiado, la contraseña por defecto es: admin123
function obtenerPasswordAdmin() {
    return localStorage.getItem('admin_password_gamer') || 'admin123';
}
function guardarPasswordAdmin(nueva) {
    localStorage.setItem('admin_password_gamer', nueva);
    supabaseGuardarConfiguracion('admin_password_gamer', nueva);
}

// Contraseña de ACCESO al sistema (se pide al abrir la página).
// Si nunca la has cambiado, la contraseña por defecto es: gamercore123
function obtenerPasswordAcceso() {
    return localStorage.getItem('acceso_password_gamer') || 'gamercore123';
}
function guardarPasswordAcceso(nueva) {
    localStorage.setItem('acceso_password_gamer', nueva);
    supabaseGuardarConfiguracion('acceso_password_gamer', nueva);
}

// ==========================================================================
// PANTALLA DE ACCESO (pide contraseña antes de mostrar el sistema)
// ==========================================================================
(function comprobarAccesoApp() {
    const pantallaLogin = document.getElementById('pantalla-login-acceso');
    if (!pantallaLogin) return;

    if (sessionStorage.getItem('acceso_concedido_gamer') === 'si') {
        pantallaLogin.style.display = 'none';
        return;
    }
    pantallaLogin.style.display = 'flex';

    const formLoginAcceso = document.getElementById('form-login-acceso');
    const inputLoginAcceso = document.getElementById('input-login-acceso');
    const msgErrorLoginAcceso = document.getElementById('msg-error-login-acceso');

    setTimeout(() => inputLoginAcceso && inputLoginAcceso.focus(), 150);

    if (formLoginAcceso) {
        formLoginAcceso.addEventListener('submit', function(e) {
            e.preventDefault();
            if (inputLoginAcceso.value === obtenerPasswordAcceso()) {
                sessionStorage.setItem('acceso_concedido_gamer', 'si');
                pantallaLogin.style.display = 'none';
            } else {
                if (msgErrorLoginAcceso) msgErrorLoginAcceso.style.display = 'block';
                inputLoginAcceso.value = '';
                inputLoginAcceso.focus();
            }
        });
    }
})();

let rolActual = sessionStorage.getItem('rol_gamer') || 'empleado';

const badgeRol           = document.getElementById('badge-rol');
const btnCambiarRol      = document.getElementById('btn-cambiar-rol');
const btnAbrirCambiarClave = document.getElementById('btn-abrir-cambiar-clave');
const btnAbrirCambiarClaveAcceso = document.getElementById('btn-abrir-cambiar-clave-acceso');
const modalPassword      = document.getElementById('modal-password');
const formPassword       = document.getElementById('form-password');
const inputPasswordAdmin = document.getElementById('input-password-admin');
const msgErrorPassword   = document.getElementById('msg-error-password');
const btnCancelarPassword = document.getElementById('btn-cancelar-password');
const btnCerrarPasswordX  = document.getElementById('btn-cerrar-password-x');

const modalCambiarClave  = document.getElementById('modal-cambiar-clave');
const formCambiarClave   = document.getElementById('form-cambiar-clave');
const inputClaveActual   = document.getElementById('input-clave-actual');
const inputClaveNueva    = document.getElementById('input-clave-nueva');
const inputClaveNuevaConfirmar = document.getElementById('input-clave-nueva-confirmar');
const msgErrorCambiarClave = document.getElementById('msg-error-cambiar-clave');
const msgExitoCambiarClave = document.getElementById('msg-exito-cambiar-clave');
const btnCancelarCambiarClave = document.getElementById('btn-cancelar-cambiar-clave');
const btnCerrarCambiarClaveX  = document.getElementById('btn-cerrar-cambiar-clave-x');

function esAdmin() {
    return rolActual === 'administrador';
}

function actualizarBadgeRol() {
    if (!badgeRol || !btnCambiarRol) return;
    if (esAdmin()) {
        badgeRol.textContent = '👑 Administrador';
        badgeRol.className = 'badge-rol rol-admin';
        btnCambiarRol.textContent = '🔒 Cerrar sesión Admin';
        if (btnAbrirCambiarClave) btnAbrirCambiarClave.style.display = 'inline-block';
        if (btnAbrirCambiarClaveAcceso) btnAbrirCambiarClaveAcceso.style.display = 'inline-block';
    } else {
        badgeRol.textContent = '🙋 Empleado';
        badgeRol.className = 'badge-rol rol-empleado';
        btnCambiarRol.textContent = '🔑 Iniciar como Admin';
        if (btnAbrirCambiarClave) btnAbrirCambiarClave.style.display = 'none';
        if (btnAbrirCambiarClaveAcceso) btnAbrirCambiarClaveAcceso.style.display = 'none';
    }
}

// Callback pendiente: la acción que se ejecutará si la contraseña es correcta
let accionPendientePassword = null;

function abrirModalPassword(accion) {
    accionPendientePassword = accion;
    if (msgErrorPassword) msgErrorPassword.style.display = 'none';
    if (inputPasswordAdmin) inputPasswordAdmin.value = '';
    if (modalPassword) modalPassword.classList.add('active');
    setTimeout(() => inputPasswordAdmin && inputPasswordAdmin.focus(), 150);
}

function cerrarModalPassword() {
    if (modalPassword) modalPassword.classList.remove('active');
    accionPendientePassword = null;
}

// Ejecuta una acción solo si es Admin; si no, pide contraseña primero
function ejecutarConPermiso(accion) {
    if (esAdmin()) { accion(); return; }
    abrirModalPassword(accion);
}

if (formPassword) {
    formPassword.addEventListener('submit', function(e) {
        e.preventDefault();
        if (inputPasswordAdmin.value === obtenerPasswordAdmin()) {
            const accion = accionPendientePassword;
            cerrarModalPassword();
            if (accion) accion();
        } else {
            msgErrorPassword.style.display = 'block';
            inputPasswordAdmin.value = '';
            inputPasswordAdmin.focus();
        }
    });
}
if (btnCancelarPassword) btnCancelarPassword.addEventListener('click', cerrarModalPassword);
if (btnCerrarPasswordX) btnCerrarPasswordX.addEventListener('click', cerrarModalPassword);
if (modalPassword) {
    modalPassword.addEventListener('click', (e) => { if (e.target === modalPassword) cerrarModalPassword(); });
}

if (btnCambiarRol) {
    btnCambiarRol.addEventListener('click', function() {
        if (esAdmin()) {
            rolActual = 'empleado';
            sessionStorage.setItem('rol_gamer', rolActual);
            actualizarBadgeRol();
            actualizarInterfaz(obtenerFiltroActivo()); actualizarStats();
            return;
        }
        abrirModalPassword(() => {
            rolActual = 'administrador';
            sessionStorage.setItem('rol_gamer', rolActual);
            actualizarBadgeRol();
            actualizarInterfaz(obtenerFiltroActivo()); actualizarStats();
        });
    });
}

actualizarBadgeRol();

// ==========================================================================
// SALIR / CIERRE AUTOMÁTICO POR INACTIVIDAD (seguridad)
// ==========================================================================
function bloquearAccesoApp() {
    const pantallaLogin = document.getElementById('pantalla-login-acceso');
    if (!pantallaLogin || pantallaLogin.style.display === 'flex') return; // ya está bloqueada

    sessionStorage.removeItem('acceso_concedido_gamer');
    sessionStorage.removeItem('rol_gamer');
    rolActual = 'empleado';
    actualizarBadgeRol();

    const inputLoginAcceso = document.getElementById('input-login-acceso');
    const msgErrorLoginAcceso = document.getElementById('msg-error-login-acceso');
    if (inputLoginAcceso) inputLoginAcceso.value = '';
    if (msgErrorLoginAcceso) msgErrorLoginAcceso.style.display = 'none';

    pantallaLogin.style.display = 'flex';
    setTimeout(() => inputLoginAcceso && inputLoginAcceso.focus(), 150);
}

const btnSalirApp = document.getElementById('btn-salir-app');
if (btnSalirApp) {
    btnSalirApp.addEventListener('click', () => {
        if (confirm('¿Salir del sistema? Vas a necesitar la contraseña de acceso para volver a entrar.')) {
            bloquearAccesoApp();
        }
    });
}

// Bloqueo automático tras 10 minutos sin ninguna actividad (mouse, teclado, clics, etc.)
const TIEMPO_INACTIVIDAD_MS = 10 * 60 * 1000;
let temporizadorInactividad;
function reiniciarTemporizadorInactividad() {
    clearTimeout(temporizadorInactividad);
    temporizadorInactividad = setTimeout(bloquearAccesoApp, TIEMPO_INACTIVIDAD_MS);
}
['mousemove', 'keydown', 'click', 'touchstart', 'scroll', 'wheel'].forEach(evento => {
    document.addEventListener(evento, reiniciarTemporizadorInactividad, { passive: true });
});
reiniciarTemporizadorInactividad();

// ==========================================================================
// CAMBIAR CONTRASEÑA DE ADMINISTRADOR
// ==========================================================================
function abrirModalCambiarClave() {
    if (!modalCambiarClave) return;
    formCambiarClave.reset();
    msgErrorCambiarClave.style.display = 'none';
    msgExitoCambiarClave.style.display = 'none';
    modalCambiarClave.classList.add('active');
}

function cerrarModalCambiarClave() {
    if (modalCambiarClave) modalCambiarClave.classList.remove('active');
}

if (btnAbrirCambiarClave) btnAbrirCambiarClave.addEventListener('click', abrirModalCambiarClave);
if (btnCancelarCambiarClave) btnCancelarCambiarClave.addEventListener('click', cerrarModalCambiarClave);
if (btnCerrarCambiarClaveX) btnCerrarCambiarClaveX.addEventListener('click', cerrarModalCambiarClave);
if (modalCambiarClave) {
    modalCambiarClave.addEventListener('click', (e) => { if (e.target === modalCambiarClave) cerrarModalCambiarClave(); });
}

if (formCambiarClave) {
    formCambiarClave.addEventListener('submit', function(e) {
        e.preventDefault();
        msgErrorCambiarClave.style.display = 'none';
        msgExitoCambiarClave.style.display = 'none';

        const actual = inputClaveActual.value;
        const nueva = inputClaveNueva.value;
        const confirmar = inputClaveNuevaConfirmar.value;

        if (actual !== obtenerPasswordAdmin()) {
            msgErrorCambiarClave.textContent = '❌ La contraseña actual no es correcta.';
            msgErrorCambiarClave.style.display = 'block';
            return;
        }
        if (nueva.length < 4) {
            msgErrorCambiarClave.textContent = '❌ La nueva contraseña debe tener al menos 4 caracteres.';
            msgErrorCambiarClave.style.display = 'block';
            return;
        }
        if (nueva !== confirmar) {
            msgErrorCambiarClave.textContent = '❌ Las contraseñas nuevas no coinciden.';
            msgErrorCambiarClave.style.display = 'block';
            return;
        }

        guardarPasswordAdmin(nueva);
        msgExitoCambiarClave.style.display = 'block';
        formCambiarClave.reset();
        setTimeout(cerrarModalCambiarClave, 1400);
    });
}

// ==========================================================================
// CAMBIAR CONTRASEÑA DE ACCESO AL SISTEMA
// ==========================================================================
const modalCambiarClaveAcceso  = document.getElementById('modal-cambiar-clave-acceso');
const formCambiarClaveAcceso   = document.getElementById('form-cambiar-clave-acceso');
const inputClaveAccesoActual   = document.getElementById('input-clave-acceso-actual');
const inputClaveAccesoNueva    = document.getElementById('input-clave-acceso-nueva');
const inputClaveAccesoNuevaConfirmar = document.getElementById('input-clave-acceso-nueva-confirmar');
const msgErrorCambiarClaveAcceso = document.getElementById('msg-error-cambiar-clave-acceso');
const msgExitoCambiarClaveAcceso = document.getElementById('msg-exito-cambiar-clave-acceso');
const btnCancelarCambiarClaveAcceso = document.getElementById('btn-cancelar-cambiar-clave-acceso');
const btnCerrarCambiarClaveAccesoX  = document.getElementById('btn-cerrar-cambiar-clave-acceso-x');

function abrirModalCambiarClaveAcceso() {
    if (!modalCambiarClaveAcceso) return;
    formCambiarClaveAcceso.reset();
    msgErrorCambiarClaveAcceso.style.display = 'none';
    msgExitoCambiarClaveAcceso.style.display = 'none';
    modalCambiarClaveAcceso.classList.add('active');
}

function cerrarModalCambiarClaveAcceso() {
    if (modalCambiarClaveAcceso) modalCambiarClaveAcceso.classList.remove('active');
}

if (btnAbrirCambiarClaveAcceso) btnAbrirCambiarClaveAcceso.addEventListener('click', abrirModalCambiarClaveAcceso);
if (btnCancelarCambiarClaveAcceso) btnCancelarCambiarClaveAcceso.addEventListener('click', cerrarModalCambiarClaveAcceso);
if (btnCerrarCambiarClaveAccesoX) btnCerrarCambiarClaveAccesoX.addEventListener('click', cerrarModalCambiarClaveAcceso);
if (modalCambiarClaveAcceso) {
    modalCambiarClaveAcceso.addEventListener('click', (e) => { if (e.target === modalCambiarClaveAcceso) cerrarModalCambiarClaveAcceso(); });
}

if (formCambiarClaveAcceso) {
    formCambiarClaveAcceso.addEventListener('submit', function(e) {
        e.preventDefault();
        msgErrorCambiarClaveAcceso.style.display = 'none';
        msgExitoCambiarClaveAcceso.style.display = 'none';

        const actual = inputClaveAccesoActual.value;
        const nueva = inputClaveAccesoNueva.value;
        const confirmar = inputClaveAccesoNuevaConfirmar.value;

        if (actual !== obtenerPasswordAcceso()) {
            msgErrorCambiarClaveAcceso.textContent = '❌ La contraseña actual no es correcta.';
            msgErrorCambiarClaveAcceso.style.display = 'block';
            return;
        }
        if (nueva.length < 4) {
            msgErrorCambiarClaveAcceso.textContent = '❌ La nueva contraseña debe tener al menos 4 caracteres.';
            msgErrorCambiarClaveAcceso.style.display = 'block';
            return;
        }
        if (nueva !== confirmar) {
            msgErrorCambiarClaveAcceso.textContent = '❌ Las contraseñas nuevas no coinciden.';
            msgErrorCambiarClaveAcceso.style.display = 'block';
            return;
        }

        guardarPasswordAcceso(nueva);
        msgExitoCambiarClaveAcceso.style.display = 'block';
        formCambiarClaveAcceso.reset();
        setTimeout(cerrarModalCambiarClaveAcceso, 1400);
    });
}

// ==========================================================================
// RESTABLECER CONTRASEÑA (sin pedir la actual — para cuando se te olvida)
// ==========================================================================
const btnRestablecerClave = document.getElementById('btn-restablecer-clave');
const modalRestablecerClave = document.getElementById('modal-restablecer-clave');
const formRestablecerClave = document.getElementById('form-restablecer-clave');
const inputRestablecerNueva = document.getElementById('input-restablecer-nueva');
const inputRestablecerConfirmar = document.getElementById('input-restablecer-confirmar');
const msgErrorRestablecerClave = document.getElementById('msg-error-restablecer-clave');
const msgExitoRestablecerClave = document.getElementById('msg-exito-restablecer-clave');
const btnCancelarRestablecerClave = document.getElementById('btn-cancelar-restablecer-clave');
const btnCerrarRestablecerClaveX = document.getElementById('btn-cerrar-restablecer-clave-x');

function abrirModalRestablecerClave() {
    if (!modalRestablecerClave) return;
    formRestablecerClave.reset();
    msgErrorRestablecerClave.style.display = 'none';
    msgExitoRestablecerClave.style.display = 'none';
    modalRestablecerClave.classList.add('active');
}

function cerrarModalRestablecerClave() {
    if (modalRestablecerClave) modalRestablecerClave.classList.remove('active');
}

if (btnRestablecerClave) btnRestablecerClave.addEventListener('click', abrirModalRestablecerClave);
if (btnCancelarRestablecerClave) btnCancelarRestablecerClave.addEventListener('click', cerrarModalRestablecerClave);
if (btnCerrarRestablecerClaveX) btnCerrarRestablecerClaveX.addEventListener('click', cerrarModalRestablecerClave);
if (modalRestablecerClave) {
    modalRestablecerClave.addEventListener('click', (e) => { if (e.target === modalRestablecerClave) cerrarModalRestablecerClave(); });
}

if (formRestablecerClave) {
    formRestablecerClave.addEventListener('submit', function(e) {
        e.preventDefault();
        msgErrorRestablecerClave.style.display = 'none';
        msgExitoRestablecerClave.style.display = 'none';

        const nueva = inputRestablecerNueva.value;
        const confirmar = inputRestablecerConfirmar.value;

        if (nueva.length < 4) {
            msgErrorRestablecerClave.textContent = '❌ La nueva contraseña debe tener al menos 4 caracteres.';
            msgErrorRestablecerClave.style.display = 'block';
            return;
        }
        if (nueva !== confirmar) {
            msgErrorRestablecerClave.textContent = '❌ Las contraseñas no coinciden.';
            msgErrorRestablecerClave.style.display = 'block';
            return;
        }

        guardarPasswordAdmin(nueva);
        msgExitoRestablecerClave.style.display = 'block';
        formRestablecerClave.reset();
        setTimeout(cerrarModalRestablecerClave, 1400);
    });
}

// ==========================================================================
// PREVIEW DE IMAGEN
// ==========================================================================
function mostrarPreviewArchivo(archivo, contenedor) {
    const r = new FileReader();
    r.onload = e => { contenedor.style.display = 'block'; contenedor.innerHTML = `<img src="${e.target.result}">`; };
    r.readAsDataURL(archivo);
}
function mostrarPreviewSrc(src, contenedor) {
    if (!src) { contenedor.style.display = 'none'; return; }
    contenedor.style.display = 'block';
    contenedor.innerHTML = `<img src="${src}" alt="Imagen actual">`;
}

inputImagenForm.addEventListener('change', function() {
    if (this.files[0]) mostrarPreviewArchivo(this.files[0], previewImagenForm);
});
modalEditImagen.addEventListener('change', function() {
    if (this.files[0]) mostrarPreviewArchivo(this.files[0], previewImagenModal);
});

// ==========================================================================
// MÉTODOS DE PAGO PERSONALIZADOS
// ==========================================================================
function pintarMetodosPagoPersonalizados() {
    // Quitar opciones personalizadas previas (dejar solo las fijas + "Otro")
    Array.from(carritoMetodoPago.options).forEach(opt => {
        if (opt.dataset.personalizado === '1') opt.remove();
    });
    const optOtro = carritoMetodoPago.querySelector('option[value="__otro__"]');
    metodosPagoPersonalizados.forEach(metodo => {
        const opt = document.createElement('option');
        opt.value = metodo;
        opt.textContent = `🔧 ${metodo}`;
        opt.dataset.personalizado = '1';
        carritoMetodoPago.insertBefore(opt, optOtro);
    });
}

carritoMetodoPago.addEventListener('change', function() {
    if (this.value === '__otro__') {
        contenedorNuevoMetodo.style.display = 'block';
        inputNuevoMetodo.focus();
    } else {
        contenedorNuevoMetodo.style.display = 'none';
    }
});

btnGuardarMetodo.addEventListener('click', () => {
    const nombreMetodo = inputNuevoMetodo.value.trim();
    if (!nombreMetodo) { alert('Escribe el nombre del método de pago, parce.'); return; }

    if (!metodosPagoPersonalizados.some(m => m.toLowerCase() === nombreMetodo.toLowerCase())) {
        metodosPagoPersonalizados.push(nombreMetodo);
        localStorage.setItem('metodos_pago_gamer', JSON.stringify(metodosPagoPersonalizados));
        supabaseReemplazarMetodosPago();
        pintarMetodosPagoPersonalizados();
    }

    carritoMetodoPago.value = nombreMetodo;
    inputNuevoMetodo.value = '';
    contenedorNuevoMetodo.style.display = 'none';
});

// ==========================================================================
// CARRITO FLOTANTE
// ==========================================================================
btnToggleCarrito.addEventListener('click', () => {
    panelCarrito.style.display = panelCarrito.style.display === 'flex' ? 'none' : 'flex';
});

btnCancelarCarrito.addEventListener('click', () => {
    if (carritoVentaActual.length === 0 || confirm("¿Cancelar la venta? El inventario no se modificará.")) {
        carritoVentaActual = []; renderizarCarrito(); panelCarrito.style.display = 'none';
        document.getElementById('carrito-descripcion-venta').value = "";
        actualizarBotonDescripcionVenta();
    }
});

const btnSeguirComprando = document.getElementById('btn-seguir-comprando');
if (btnSeguirComprando) btnSeguirComprando.addEventListener('click', () => {
    panelCarrito.style.display = 'none';
});

// --- Descripción de la venta (modal) ---
const campoDescripcionVenta = document.getElementById('carrito-descripcion-venta');
const btnAbrirDescripcionVenta = document.getElementById('btn-abrir-descripcion-venta');
const modalDescripcionVenta = document.getElementById('modal-descripcion-venta');
const inputDescripcionModal = document.getElementById('input-descripcion-venta-modal');

function actualizarBotonDescripcionVenta() {
    const texto = campoDescripcionVenta.value.trim();
    if (texto) {
        btnAbrirDescripcionVenta.textContent = '✏️ Editar Descripción de Venta';
        btnAbrirDescripcionVenta.classList.add('con-texto');
    } else {
        btnAbrirDescripcionVenta.textContent = '➕ Agregar Descripción de Venta';
        btnAbrirDescripcionVenta.classList.remove('con-texto');
    }
}

if (btnAbrirDescripcionVenta) btnAbrirDescripcionVenta.addEventListener('click', () => {
    inputDescripcionModal.value = campoDescripcionVenta.value;
    modalDescripcionVenta.classList.add('active');
    inputDescripcionModal.focus();
});

function cerrarModalDescripcionVenta() {
    modalDescripcionVenta.classList.remove('active');
}

const btnCerrarDescripcionX = document.getElementById('btn-cerrar-descripcion-x');
const btnCancelarDescripcionVenta = document.getElementById('btn-cancelar-descripcion-venta');
const btnGuardarDescripcionVenta = document.getElementById('btn-guardar-descripcion-venta');

if (btnCerrarDescripcionX) btnCerrarDescripcionX.addEventListener('click', cerrarModalDescripcionVenta);
if (btnCancelarDescripcionVenta) btnCancelarDescripcionVenta.addEventListener('click', cerrarModalDescripcionVenta);
if (btnGuardarDescripcionVenta) btnGuardarDescripcionVenta.addEventListener('click', () => {
    campoDescripcionVenta.value = inputDescripcionModal.value.trim();
    actualizarBotonDescripcionVenta();
    cerrarModalDescripcionVenta();
});

window.agregarAlCarritoVenta = function(id) {
    const prod = inventario.find(p => p.id === id);
    if (!prod) return;
    const pStock = parseInt(prod.stock) || 0;
    if (pStock <= 0) { alert(`"${prod.nombre}" está agotado.`); return; }
    const carritoEstabaVacio = carritoVentaActual.length === 0;
    const existente = carritoVentaActual.find(i => i.id === id);
    if (existente) {
        if (existente.cantidad + 1 > pStock) { alert(`Stock máximo: ${pStock} unidades.`); return; }
        existente.cantidad++;
    } else {
        carritoVentaActual.push({ id: prod.id, nombre: prod.nombre, categoria: prod.categoria || prod.category, precioOriginal: parseFloat(prod.precio) || 0, cantidad: 1, descuento: 0, descripcionProducto: '' });
    }
    renderizarCarrito();
    if (carritoEstabaVacio) panelCarrito.style.display = 'flex';
};

function renderizarCarrito() {
    carritoItemsEl.innerHTML = '';
    const total_items = carritoVentaActual.reduce((a, i) => a + i.cantidad, 0);
    carritoBadge.textContent = total_items;
    carritoBadge.style.display = total_items > 0 ? 'flex' : 'none';
    if (carritoVentaActual.length === 0) {
        carritoItemsEl.innerHTML = '<p class="carrito-vacio">Agrega productos con "Vender".</p>';
        carritoSubtotalEl.textContent = formatearMoneda(0); carritoDescEl.textContent = `-${formatearMoneda(0)}`; carritoTotalEl.textContent = formatearMoneda(0);
        return;
    }
    let subtotal = 0, totalDesc = 0;
    carritoVentaActual.forEach((item, idx) => {
        const invProd = inventario.find(p => p.id === item.id);
        const maxStock = invProd ? (parseInt(invProd.stock) || 1) : 1;
        const subItem = item.precioOriginal * item.cantidad;
        const totalItem = subItem - item.descuento;
        subtotal += subItem; totalDesc += item.descuento;
        const div = document.createElement('div');
        div.className = 'carrito-item';
        div.innerHTML = `
            <div class="ci-top"><span class="ci-nombre">${item.nombre}</span><button class="ci-quitar" onclick="removerDelCarrito(${idx})">✕</button></div>
            <div class="ci-controles ${esAdmin() ? '' : 'ci-controles-empleado'}">
                ${esAdmin() ? `<div class="ci-campo"><label>Precio $</label><input type="number" value="${item.precioOriginal}" min="0" step="any" onchange="cambiarPrecioCarrito(${idx},this.value)"></div>` : ''}
                <div class="ci-campo"><label>Cant.</label><input type="number" value="${item.cantidad}" min="1" max="${maxStock}" onchange="cambiarCantidadCarrito(${idx},this.value)"></div>
                ${esAdmin() ? `<div class="ci-campo"><label>Desc. $</label><input type="number" value="${item.descuento}" min="0" step="any" onchange="cambiarDescuentoCarrito(${idx},this.value)"></div>
                <div class="ci-campo ci-total-item"><label>Total</label><span>${formatearMoneda(totalItem)}</span></div>` : ''}
            </div>
            <div class="ci-nota">
                <input type="text" placeholder="📝 Nota de este producto (ej. color, serial, garantía)..." value="${(item.descripcionProducto || '').replace(/"/g, '&quot;')}" onchange="cambiarDescripcionProductoCarrito(${idx},this.value)">
            </div>`;
        carritoItemsEl.appendChild(div);
    });
    carritoSubtotalEl.textContent = formatearMoneda(subtotal);
    carritoDescEl.textContent = `-${formatearMoneda(totalDesc)}`;
    carritoTotalEl.textContent = formatearMoneda(subtotal - totalDesc);
    const filaSubtotal = document.getElementById('fila-subtotal-carrito');
    const filaDescuentos = document.getElementById('fila-descuentos-carrito');
    if (filaSubtotal) filaSubtotal.style.display = esAdmin() ? '' : 'none';
    if (filaDescuentos) filaDescuentos.style.display = esAdmin() ? '' : 'none';
}

window.cambiarPrecioCarrito = function(idx, val) {
    let v = parseFloat(val) || 0;
    carritoVentaActual[idx].precioOriginal = v;
    if (carritoVentaActual[idx].descuento > v * carritoVentaActual[idx].cantidad) carritoVentaActual[idx].descuento = v * carritoVentaActual[idx].cantidad;
    renderizarCarrito();
};
window.cambiarCantidadCarrito = function(idx, val) {
    let cant = parseInt(val) || 1;
    const invProd = inventario.find(p => p.id === carritoVentaActual[idx].id);
    const max = invProd ? (parseInt(invProd.stock) || 0) : 0;
    if (cant > max) { alert(`Stock disponible: ${max}`); cant = max; }
    carritoVentaActual[idx].cantidad = cant; renderizarCarrito();
};
window.cambiarDescuentoCarrito = function(idx, val) {
    let desc = parseFloat(val) || 0;
    const sub = carritoVentaActual[idx].precioOriginal * carritoVentaActual[idx].cantidad;
    if (desc > sub) { alert("El descuento no puede superar el subtotal."); desc = sub; }
    carritoVentaActual[idx].descuento = desc; renderizarCarrito();
};
window.removerDelCarrito = function(idx) {
    carritoVentaActual.splice(idx, 1); renderizarCarrito();
};
window.cambiarDescripcionProductoCarrito = function(idx, val) {
    carritoVentaActual[idx].descripcionProducto = val.trim();
};

btnProcesarFactura.addEventListener('click', function() {
    if (carritoVentaActual.length === 0) { alert("El carrito está vacío."); return; }
    if (carritoMetodoPago.value === '__otro__') { alert("Escribe y guarda el nuevo método de pago antes de procesar la factura."); inputNuevoMetodo.focus(); return; }
    document.getElementById('modal-confirmar-venta').classList.add('active');
});

function completarProcesoFactura(seVendio) {
    document.getElementById('modal-confirmar-venta').classList.remove('active');
    const numeroFactura = "FAC-" + Math.floor(1000 + Math.random() * 9000);
    const metodoPago = carritoMetodoPago.value;
    const fechaHora = new Date().toLocaleString();
    const nombreCliente = document.getElementById('carrito-nombre-cliente').value.trim() || "Cliente General";
    const cedulaCliente = document.getElementById('carrito-cedula-cliente').value.trim() || "";
    const celularCliente = document.getElementById('carrito-celular-cliente').value.trim() || "";
    const descripcionVenta = document.getElementById('carrito-descripcion-venta').value.trim() || "";
    const productosParaRecibo = [...carritoVentaActual];
    const subtotalRecibo = carritoVentaActual.reduce((a, i) => a + (i.precioOriginal * i.cantidad), 0);
    const totalRecibo = carritoVentaActual.reduce((a, i) => a + (i.precioOriginal * i.cantidad - i.descuento), 0);
    carritoVentaActual.forEach(item => {
        if (seVendio) {
            inventario = inventario.map(prod => prod.id === item.id ? { ...prod, stock: Math.max(0, (parseInt(prod.stock)||0) - item.cantidad) } : prod);
        }
        historialSalidas.unshift({ fechaHora, factura: numeroFactura, nombre: `${item.nombre} (x${item.cantidad})${!seVendio ? ' — No vendido' : ''}`, categoria: item.categoria, precioOriginal: item.precioOriginal * item.cantidad, descuentoAplicado: item.descuento, precioVentaFinal: (item.precioOriginal * item.cantidad) - item.descuento, formaPago: metodoPago, cliente: nombreCliente, descripcion: descripcionVenta, vendido: seVendio });
    });
    localStorage.setItem('inventario_gamer', JSON.stringify(inventario));
    localStorage.setItem('historial_salidas_gamer', JSON.stringify(historialSalidas));
    supabaseReemplazarInventario();
    supabaseInsertarHistorial(historialSalidas.slice(0, carritoVentaActual.length));
    guardarOActualizarCliente(nombreCliente, cedulaCliente, celularCliente, fechaHora, totalRecibo, seVendio);
    imprimirReciboTicket(numeroFactura, fechaHora, metodoPago, nombreCliente, cedulaCliente, celularCliente, productosParaRecibo, subtotalRecibo, totalRecibo, descripcionVenta, seVendio);
    document.getElementById('carrito-nombre-cliente').value = "";
    document.getElementById('carrito-cedula-cliente').value = "";
    document.getElementById('carrito-celular-cliente').value = "";
    document.getElementById('carrito-descripcion-venta').value = "";
    actualizarBotonDescripcionVenta();
    carritoVentaActual = []; renderizarCarrito(); panelCarrito.style.display = 'none';
    actualizarInterfaz(obtenerFiltroActivo()); renderizarTablaHistorial();
    alert(seVendio ? `✅ Factura ${numeroFactura} procesada con éxito.` : `⚠️ Factura ${numeroFactura} registrada sin descontar stock.`);
}

document.getElementById('btn-confirmar-si-vendido').addEventListener('click', () => completarProcesoFactura(true));
document.getElementById('btn-confirmar-no-vendido').addEventListener('click', () => completarProcesoFactura(false));

// ==========================================================================
// CATEGORÍAS Y FILTROS
// ==========================================================================
function actualizarSelectCategorias() {
    selectCategoria.innerHTML = '<option value="">Selecciona...</option>';
    categorias.forEach(cat => { const o = document.createElement('option'); o.value = cat; o.textContent = cat; selectCategoria.appendChild(o); });
}

function construirArbolCategorias(cats) {
    const raiz = { children: new Map(), full: null };
    cats.forEach(cat => {
        const partes = cat.split('>').map(s => s.trim()).filter(Boolean);
        if (!partes.length) return;
        let nodo = raiz;
        partes.forEach((parte, i) => {
            if (!nodo.children.has(parte)) nodo.children.set(parte, { children: new Map(), full: null, nombre: parte });
            nodo = nodo.children.get(parte);
            if (i === partes.length - 1) nodo.full = cat;
        });
    });
    return raiz;
}

function ramaContieneActivo(nodo, categoriaActiva) {
    for (const hijo of nodo.children.values()) {
        if (hijo.full === categoriaActiva) return true;
        if (hijo.children.size && ramaContieneActivo(hijo, categoriaActiva)) return true;
    }
    return false;
}

function crearBotonFiltroHoja(hijo, profundidad, categoriaActiva) {
    const wrap = document.createElement('div');
    wrap.className = 'wrap-filtro-hoja';
    wrap.style.paddingLeft = (profundidad * 16) + 'px';
    const btn = document.createElement('button');
    btn.className = 'btn-filtro nivel-hoja' + (hijo.full === categoriaActiva ? ' active' : '');
    btn.setAttribute('data-categoria', hijo.full);
    btn.textContent = hijo.nombre;
    btn.addEventListener('click', function(e) {
        if (e.target.classList.contains('btn-eliminar-categoria-x')) return;
        buscadorInput.value = '';
        document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('active'));
        this.classList.add('active'); paginaActualCatalogo = 1; actualizarInterfaz(hijo.full);
    });
    const x = document.createElement('span');
    x.className = 'btn-eliminar-categoria-x'; x.innerHTML = '&times;';
    x.addEventListener('click', e => { e.stopPropagation(); eliminarCategoria(hijo.full); });
    btn.appendChild(x);
    wrap.appendChild(btn);
    return wrap;
}

function renderizarNodoArbol(nodo, contenedor, profundidad, categoriaActiva, rutaPadre) {
    nodo.children.forEach((hijo, nombre) => {
        const ruta = rutaPadre ? rutaPadre + '>' + nombre : nombre;
        const tieneHijos = hijo.children.size > 0;

        if (!tieneHijos) {
            contenedor.appendChild(crearBotonFiltroHoja(hijo, profundidad, categoriaActiva));
            return;
        }

        const abierto = gruposCategoriaExpandidos.has(ruta) || hijo.full === categoriaActiva || ramaContieneActivo(hijo, categoriaActiva);
        if (abierto) gruposCategoriaExpandidos.add(ruta);

        const grupoWrap = document.createElement('div');
        grupoWrap.className = 'grupo-categoria';

        const header = document.createElement('div');
        header.className = 'filtro-grupo-header' + (abierto ? ' abierto' : '') + (hijo.full === categoriaActiva ? ' active' : '');
        header.style.paddingLeft = (14 + profundidad * 16) + 'px';

        const flecha = document.createElement('span');
        flecha.className = 'flecha-grupo';
        flecha.textContent = '›';

        const label = document.createElement('span');
        label.className = 'texto-grupo';
        label.textContent = nombre;

        header.appendChild(flecha);
        header.appendChild(label);

        header.addEventListener('click', () => {
            if (gruposCategoriaExpandidos.has(ruta)) gruposCategoriaExpandidos.delete(ruta);
            else gruposCategoriaExpandidos.add(ruta);

            let nuevoActivo = obtenerFiltroActivo();
            if (hijo.full) {
                buscadorInput.value = '';
                paginaActualCatalogo = 1;
                nuevoActivo = hijo.full;
                actualizarInterfaz(hijo.full);
            }
            actualizarFiltros(nuevoActivo);
        });

        grupoWrap.appendChild(header);

        const sub = document.createElement('div');
        sub.className = 'filtro-subnivel' + (abierto ? ' abierto' : '');
        grupoWrap.appendChild(sub);

        contenedor.appendChild(grupoWrap);
        renderizarNodoArbol(hijo, sub, profundidad + 1, categoriaActiva, ruta);
    });
}

function actualizarFiltros(categoriaActiva = 'todos') {
    contenedorFiltros.innerHTML = '';

    const btnTodos = document.createElement('button');
    btnTodos.className = 'btn-filtro nivel-hoja' + (categoriaActiva === 'todos' ? ' active' : '');
    btnTodos.setAttribute('data-categoria', 'todos');
    btnTodos.textContent = '📁 Todos';
    btnTodos.addEventListener('click', function() {
        buscadorInput.value = '';
        document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('active'));
        this.classList.add('active'); paginaActualCatalogo = 1; actualizarInterfaz('todos');
    });
    contenedorFiltros.appendChild(btnTodos);

    const arbol = construirArbolCategorias(categorias);
    renderizarNodoArbol(arbol, contenedorFiltros, 0, categoriaActiva, '');
}

formCategoria.addEventListener('submit', function(e) {
    e.preventDefault();
    const nuevaCat = document.getElementById('nueva-categoria-nombre').value.trim();
    if (nuevaCat && !categorias.includes(nuevaCat)) {
        categorias.push(nuevaCat);
        localStorage.setItem('categorias_gamer', JSON.stringify(categorias));
        supabaseReemplazarCategorias();
        actualizarSelectCategorias(); actualizarFiltros(obtenerFiltroActivo()); formCategoria.reset();
        alert(`Sección "${nuevaCat}" agregada. 🎮`);
    }
});

window.eliminarCategoria = function(catAEliminar) {
    ejecutarConPermiso(() => eliminarCategoriaReal(catAEliminar));
};

function eliminarCategoriaReal(catAEliminar) {
    if (!confirm(`🚨 ¿Eliminar la categoría "${catAEliminar}"?`)) return;
    const borrar = confirm(`¿Eliminar también los productos de "${catAEliminar}"?\n[Aceptar] borrarlos. [Cancelar] conservarlos como "Sin Categoría".`);
    const filtroPrevio = obtenerFiltroActivo();
    if (borrar) inventario = inventario.filter(p => (p.categoria||p.category) !== catAEliminar);
    else inventario = inventario.map(p => (p.categoria||p.category) === catAEliminar ? { ...p, categoria: "Sin Categoría", category: "Sin Categoría" } : p);
    categorias = categorias.filter(c => c !== catAEliminar);
    localStorage.setItem('categorias_gamer', JSON.stringify(categorias));
    localStorage.setItem('inventario_gamer', JSON.stringify(inventario));
    supabaseReemplazarCategorias();
    supabaseReemplazarInventario();
    const nuevoFiltro = (filtroPrevio === catAEliminar) ? 'todos' : filtroPrevio;
    actualizarSelectCategorias(); actualizarFiltros(nuevoFiltro); actualizarInterfaz(nuevoFiltro);
    alert(`Categoría "${catAEliminar}" removida.`);
};

// ==========================================================================
// FORMULARIO PRINCIPAL (con imagen IndexedDB)
// ==========================================================================
formProducto.addEventListener('submit', async function(e) {
    e.preventDefault();
    const idEdicion = editIdInput.value;
    const nombre = document.getElementById('nombre').value.trim();
    const categoria = document.getElementById('categoria').value;
    const precio = parseFloat(document.getElementById('precio').value) || 0;
    const stock = parseInt(document.getElementById('stock').value) || 0;
    const archivo = inputImagenForm.files[0];

    if (idEdicion) {
        const idNum = parseInt(idEdicion);
        inventario = inventario.map(p => p.id === idNum ? { ...p, nombre, categoria, category: categoria, precio, stock } : p);
        if (archivo) { const b64 = await comprimirImagen(archivo); await guardarImagenDB(idNum, b64); }
        localStorage.setItem('inventario_gamer', JSON.stringify(inventario));
        supabaseReemplazarInventario();
        resetearModoFormulario();
        // Solo actualizamos la tarjeta editada, sin repintar todo el catálogo
        refrescarProductoEnPantalla(idNum, !!archivo);
        return;
    } else {
        const nuevoId = Date.now();
        inventario.push({ id: nuevoId, nombre, categoria, category: categoria, precio, stock });
        if (archivo) { const b64 = await comprimirImagen(archivo); await guardarImagenDB(nuevoId, b64); }
    }
    localStorage.setItem('inventario_gamer', JSON.stringify(inventario));
    supabaseReemplazarInventario();
    formProducto.reset(); previewImagenForm.style.display = 'none';
    actualizarInterfaz(obtenerFiltroActivo());
});

btnCancelarEdicion.addEventListener('click', resetearModoFormulario);

function resetearModoFormulario() {
    editIdInput.value = "";
    tituloFormulario.innerHTML = '<span class="icono-panel">➕</span>Ingresar Item';
    btnSubmitForm.textContent = "Registrar Componente";
    btnSubmitForm.style.borderColor = "#ff6b00"; btnSubmitForm.style.color = "#ff6b00";
    btnCancelarEdicion.style.display = "none";
    previewImagenForm.style.display = 'none'; formProducto.reset();
}

// ==========================================================================
// MODAL EDITAR (con imagen IndexedDB)
// ==========================================================================
window.prepararEdicion = function(id) {
    ejecutarConPermiso(() => prepararEdicionReal(id));
};

async function prepararEdicionReal(id) {
    const p = inventario.find(prod => prod.id === id);
    if (!p) return;
    modalEditCategoria.innerHTML = '<option value="">Selecciona...</option>';
    categorias.forEach(cat => { const o = document.createElement('option'); o.value = cat; o.textContent = cat; modalEditCategoria.appendChild(o); });
    if ((p.categoria||p.category) === "Sin Categoría") { const o = document.createElement('option'); o.value = "Sin Categoría"; o.textContent = "Sin Categoría"; modalEditCategoria.appendChild(o); }
    modalEditId.value = p.id;
    modalEditNombre.value = p.nombre;
    modalEditCategoria.value = p.categoria || p.category;
    modalEditPrecio.value = parseFloat(p.precio) || 0;
    modalEditStock.value = parseInt(p.stock) || 0;
    // Mostrar imagen actual
    const imgSrc = await obtenerImagenDB(p.id);
    mostrarPreviewSrc(imgSrc, previewImagenModal);
    modalEditar.classList.add('active');
}

formEditarModal.addEventListener('submit', async function(e) {
    e.preventDefault();
    const idEdicion = parseInt(modalEditId.value);
    const nombre = modalEditNombre.value.trim();
    const categoria = modalEditCategoria.value;
    const precio = parseFloat(modalEditPrecio.value) || 0;
    const stock = parseInt(modalEditStock.value) || 0;
    const archivo = modalEditImagen.files[0];
    inventario = inventario.map(p => p.id === idEdicion ? { ...p, nombre, categoria, category: categoria, precio, stock } : p);
    if (archivo) { const b64 = await comprimirImagen(archivo); await guardarImagenDB(idEdicion, b64); }
    localStorage.setItem('inventario_gamer', JSON.stringify(inventario));
    supabaseReemplazarInventario();
    cerrarModalEditarFlotante();
    // Solo actualizamos la tarjeta editada, sin repintar todo el catálogo (no más "salto")
    refrescarProductoEnPantalla(idEdicion, !!archivo);
});

function cerrarModalEditarFlotante() {
    modalEditar.classList.remove('active'); formEditarModal.reset(); previewImagenModal.style.display = 'none';
}
btnCerrarModalEditar.addEventListener('click', cerrarModalEditarFlotante);
if (btnCerrarEditarX) btnCerrarEditarX.addEventListener('click', cerrarModalEditarFlotante);

// ==========================================================================
// ELIMINAR PRODUCTO
// ==========================================================================
window.eliminarProducto = function(id) {
    ejecutarConPermiso(() => eliminarProductoReal(id));
};

function eliminarProductoReal(id) {
    if (confirm("🚨 ¿Deseas borrar este componente del catálogo?")) {
        inventario = inventario.filter(p => p.id !== id);
        eliminarImagenDB(id);
        localStorage.setItem('inventario_gamer', JSON.stringify(inventario));
        supabaseReemplazarInventario();
        actualizarInterfaz(obtenerFiltroActivo());
    }
}

// ==========================================================================
// RENDER TARJETAS (imágenes desde IndexedDB)
// ==========================================================================
function actualizarInterfaz(categoriaFiltro = 'todos') {
    contenedorCards.innerHTML = '';
    let filtrados = inventario;
    const busqueda = buscadorInput.value.toLowerCase().trim();
    if (busqueda) {
        filtrados = filtrados.filter(p => p.nombre.toLowerCase().includes(busqueda));
        document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('active'));
    } else if (categoriaFiltro !== 'todos') {
        filtrados = filtrados.filter(p => (p.categoria||p.category) === categoriaFiltro);
    }

    // Si cambió el filtro o la búsqueda respecto al último render, volvemos a la página 1.
    // Si es el mismo filtro (ej. tras editar/vender un producto), conservamos la página actual.
    const claveFiltroActual = busqueda ? `busqueda:${busqueda}` : `cat:${categoriaFiltro}`;
    if (claveFiltroActual !== ultimaClaveFiltroCatalogo) {
        paginaActualCatalogo = 1;
        ultimaClaveFiltroCatalogo = claveFiltroActual;
    }

    const totalProductosFiltrados = filtrados.length;
    const totalPaginas = Math.max(1, Math.ceil(totalProductosFiltrados / PRODUCTOS_POR_PAGINA));
    if (paginaActualCatalogo > totalPaginas) paginaActualCatalogo = totalPaginas;
    if (paginaActualCatalogo < 1) paginaActualCatalogo = 1;

    const inicioPagina = (paginaActualCatalogo - 1) * PRODUCTOS_POR_PAGINA;
    const productosPagina = filtrados.slice(inicioPagina, inicioPagina + PRODUCTOS_POR_PAGINA);

    if (filtrados.length === 0) {
        contenedorCards.innerHTML = `<p class="txt-vacio">No se encontró hardware que coincida.</p>`;
    } else {
        productosPagina.forEach(async prod => {
            const catActual = prod.categoria || prod.category;
            const pStock = parseInt(prod.stock) || 0;
            const pPrecio = parseFloat(prod.precio) || 0;
            const stockClass = pStock <= 3 ? 'dot-low' : 'dot-ok';
            const stockTexto = pStock <= 0 ? 'Agotado' : (pStock <= 3 ? 'Bajo Stock' : 'Estable');
            const card = document.createElement('div');
            card.className = 'tarjeta-producto';
            card.dataset.id = prod.id;
            card.innerHTML = `
                <div class="tarjeta-imagen-wrapper">
                    <img class="tarjeta-img" src="" alt="${prod.nombre}" style="display:none;">
                    <div class="tarjeta-img-placeholder">🖥️</div>
                </div>
                <div class="tarjeta-info">
                    <h3>${prod.nombre}</h3>
                    <p class="txt-cat" title="${catActual}">${(catActual || '').split('>').pop().trim()}</p>
                    ${esAdmin() ? `<p class="txt-precio">${formatearMoneda(pPrecio)}</p>` : ''}
                    ${esAdmin() ? `<div class="info-stock"><span class="dot-stock ${stockClass}"></span><span>${pStock} un. (${stockTexto})</span></div>` : ''}
                </div>
                <div class="tarjeta-acciones">
                    <div class="fila-botones-principales">
                        <button class="btn-tarjeta btn-vender" onclick="agregarAlCarritoVenta(${prod.id})">Vender</button>
                        <button class="btn-tarjeta btn-editar" onclick="prepararEdicion(${prod.id})">Editar</button>
                    </div>
                    <button class="btn-tarjeta btn-eliminar" onclick="eliminarProducto(${prod.id})">🗑️ Eliminar</button>
                </div>`;
            contenedorCards.appendChild(card);
            // Cargar imagen desde IndexedDB sin bloquear el render
            obtenerImagenDB(prod.id).then(src => {
                if (src) {
                    const imgEl = card.querySelector('.tarjeta-img');
                    const placeholder = card.querySelector('.tarjeta-img-placeholder');
                    imgEl.src = src; imgEl.style.display = 'block';
                    if (placeholder) placeholder.style.display = 'none';
                }
            });
        });
    }
    renderizarPaginacionCatalogo(totalPaginas, categoriaFiltro);
    actualizarStats();
}

function renderizarPaginacionCatalogo(totalPaginas, categoriaFiltro) {
    if (!contenedorPaginacion) return;
    contenedorPaginacion.innerHTML = '';
    if (totalPaginas <= 1) return;

    const irAPagina = (num) => {
        paginaActualCatalogo = num;
        actualizarInterfaz(categoriaFiltro);
        contenedorCards.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const btnAnterior = document.createElement('button');
    btnAnterior.className = 'btn-pagina btn-pagina-nav';
    btnAnterior.textContent = '← Anterior';
    btnAnterior.disabled = paginaActualCatalogo === 1;
    btnAnterior.addEventListener('click', () => irAPagina(paginaActualCatalogo - 1));
    contenedorPaginacion.appendChild(btnAnterior);

    // Rango de números de página a mostrar (máx. 5 alrededor de la actual)
    let inicio = Math.max(1, paginaActualCatalogo - 2);
    let fin = Math.min(totalPaginas, inicio + 4);
    inicio = Math.max(1, fin - 4);

    if (inicio > 1) {
        const btn1 = document.createElement('button');
        btn1.className = 'btn-pagina'; btn1.textContent = '1';
        btn1.addEventListener('click', () => irAPagina(1));
        contenedorPaginacion.appendChild(btn1);
        if (inicio > 2) {
            const puntos = document.createElement('span');
            puntos.className = 'puntos-pagina'; puntos.textContent = '…';
            contenedorPaginacion.appendChild(puntos);
        }
    }

    for (let i = inicio; i <= fin; i++) {
        const btn = document.createElement('button');
        btn.className = 'btn-pagina' + (i === paginaActualCatalogo ? ' active' : '');
        btn.textContent = i;
        btn.addEventListener('click', () => irAPagina(i));
        contenedorPaginacion.appendChild(btn);
    }

    if (fin < totalPaginas) {
        if (fin < totalPaginas - 1) {
            const puntos = document.createElement('span');
            puntos.className = 'puntos-pagina'; puntos.textContent = '…';
            contenedorPaginacion.appendChild(puntos);
        }
        const btnUltima = document.createElement('button');
        btnUltima.className = 'btn-pagina'; btnUltima.textContent = totalPaginas;
        btnUltima.addEventListener('click', () => irAPagina(totalPaginas));
        contenedorPaginacion.appendChild(btnUltima);
    }

    const btnSiguiente = document.createElement('button');
    btnSiguiente.className = 'btn-pagina btn-pagina-nav';
    btnSiguiente.textContent = 'Siguiente →';
    btnSiguiente.disabled = paginaActualCatalogo === totalPaginas;
    btnSiguiente.addEventListener('click', () => irAPagina(paginaActualCatalogo + 1));
    contenedorPaginacion.appendChild(btnSiguiente);
}

function actualizarStats() {
    const totalDinero = inventario.reduce((acc, p) => acc + ((parseFloat(p.precio)||0) * (parseInt(p.stock)||0)), 0);
    const alertasStock = inventario.filter(p => (parseInt(p.stock)||0) <= 3).length;
    if (totalProductosEl) totalProductosEl.textContent = inventario.length;
    if (valorTotalEl) valorTotalEl.textContent = esAdmin() ? formatearMoneda(totalDinero) : '••••••';
    if (alertasStockEl) alertasStockEl.textContent = esAdmin() ? alertasStock : '••';
}

// ==========================================================================
// ACTUALIZAR UNA SOLA TARJETA (sin repintar todo el catálogo)
// ==========================================================================
function obtenerFiltroActivo() {
    const activo = document.querySelector('.btn-filtro.active');
    return activo ? activo.getAttribute('data-categoria') : 'todos';
}

function productoSigueVisible(prod) {
    const busqueda = buscadorInput.value.toLowerCase().trim();
    if (busqueda) return prod.nombre.toLowerCase().includes(busqueda);
    const filtro = obtenerFiltroActivo();
    if (filtro !== 'todos') return (prod.categoria || prod.category) === filtro;
    return true;
}

function refrescarProductoEnPantalla(id, imagenCambio = false) {
    const prod = inventario.find(p => p.id === id);
    if (!prod) return;
    const card = contenedorCards.querySelector(`.tarjeta-producto[data-id="${id}"]`);

    // Si la tarjeta no está en pantalla, o ya no debería mostrarse con el filtro/búsqueda
    // actual (ej. le cambiaste la categoría), hacemos un repintado completo como respaldo.
    if (!card || !productoSigueVisible(prod)) {
        actualizarInterfaz(obtenerFiltroActivo());
        return;
    }

    const catActual = prod.categoria || prod.category;
    const pStock = parseInt(prod.stock) || 0;
    const pPrecio = parseFloat(prod.precio) || 0;
    const stockClass = pStock <= 3 ? 'dot-low' : 'dot-ok';
    const stockTexto = pStock <= 0 ? 'Agotado' : (pStock <= 3 ? 'Bajo Stock' : 'Estable');

    card.querySelector('h3').textContent = prod.nombre;
    const elTxtCat = card.querySelector('.txt-cat');
    elTxtCat.textContent = (catActual || '').split('>').pop().trim();
    elTxtCat.title = catActual;
    const elTxtPrecio = card.querySelector('.txt-precio');
    if (elTxtPrecio) elTxtPrecio.textContent = formatearMoneda(pPrecio);
    const elDotStock = card.querySelector('.dot-stock');
    if (elDotStock) elDotStock.className = `dot-stock ${stockClass}`;
    const elInfoStock = card.querySelector('.info-stock span:last-child');
    if (elInfoStock) elInfoStock.textContent = `${pStock} un. (${stockTexto})`;
    const imgEl = card.querySelector('.tarjeta-img');
    if (imgEl) imgEl.alt = prod.nombre;

    if (imagenCambio) {
        obtenerImagenDB(id).then(src => {
            if (src && imgEl) {
                const placeholder = card.querySelector('.tarjeta-img-placeholder');
                imgEl.src = src; imgEl.style.display = 'block';
                if (placeholder) placeholder.style.display = 'none';
            }
        });
    }

    actualizarStats();
}

// ==========================================================================
// EXPORTAR / IMPORTAR JSON (SIN imágenes — las imágenes son locales)
// ==========================================================================
btnExportar.addEventListener('click', function() {
    if (inventario.length === 0) { alert("No hay productos para exportar."); return; }
    // SOLO datos, nunca imágenes
    const datos = inventario.map(p => ({
        id: p.id, nombre: p.nombre,
        categoria: p.categoria || p.category,
        category: p.categoria || p.category,
        precio: p.precio, stock: p.stock
    }));
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.download = `GamerStock_Inventario_${new Date().toISOString().slice(0,10)}.json`;
    link.href = url; link.click(); URL.revokeObjectURL(url);
});

inputImportar.addEventListener('change', function(e) {
    const archivo = e.target.files[0]; if (!archivo) return;
    ejecutarConPermiso(() => procesarImportacionJSON(archivo));
});

function procesarImportacionJSON(archivo) {
    const lector = new FileReader();
    lector.onload = function(evt) {
        try {
            const parseados = JSON.parse(evt.target.result);
            if (!Array.isArray(parseados)) { alert("Error: Archivo inválido."); return; }
            const modoSumar = confirm(
                "📥 IMPORTAR JSON\n\n" +
                "✅ Aceptar = SINCRONIZAR desde Bodega:\n  • Actualiza stock y precio de los existentes\n  • Agrega productos nuevos\n  • Las imágenes NO se tocan\n\n" +
                "❌ Cancelar = REEMPLAZAR todo el catálogo (las imágenes se conservan igual)."
            );
            if (modoSumar) {
                let actualizados = 0, agregados = 0;
                parseados.forEach(nuevo => {
                    const cat = nuevo.categoria || nuevo.category || "Sin Categoría";
                    const idxExistente = inventario.findIndex(p =>
                        p.nombre.trim().toLowerCase() === (nuevo.nombre || '').trim().toLowerCase() &&
                        (p.categoria || p.category) === cat
                    );
                    if (idxExistente > -1) {
                        // Actualiza stock y precio, conserva imagen y demás campos
                        inventario[idxExistente] = {
                            ...inventario[idxExistente],
                            stock: parseInt(nuevo.stock) || 0,
                            precio: parseFloat(nuevo.precio) || 0,
                            categoria: cat, category: cat
                        };
                        actualizados++;
                    } else {
                        inventario.push({ id: nuevo.id || (Date.now() + Math.random()), nombre: nuevo.nombre || "Sin nombre", categoria: cat, category: cat, precio: parseFloat(nuevo.precio)||0, stock: parseInt(nuevo.stock)||0 });
                        agregados++;
                    }
                });
                alert(`✅ Sincronización completada.\n\n📦 Actualizados (stock/precio): ${actualizados}\n🆕 Nuevos agregados: ${agregados}\n🖼️ Imágenes locales intactas.`);
            } else {
                inventario = parseados.map(p => {
                    const cat = p.categoria || p.category || "Sin Categoría";
                    return { id: p.id || (Date.now() + Math.random()), nombre: p.nombre || "Sin nombre", categoria: cat, category: cat, precio: parseFloat(p.precio)||0, stock: parseInt(p.stock)||0 };
                });
                alert(`✅ Catálogo reemplazado con ${inventario.length} productos.\n🖼️ Imágenes locales intactas.`);
            }
            inventario.forEach(p => { if (p.categoria && p.categoria !== "Sin Categoría" && !categorias.includes(p.categoria)) categorias.push(p.categoria); });
            localStorage.setItem('inventario_gamer', JSON.stringify(inventario));
            localStorage.setItem('categorias_gamer', JSON.stringify(categorias));
            supabaseReemplazarInventario();
            supabaseReemplazarCategorias();
            actualizarSelectCategorias(); actualizarFiltros(); actualizarInterfaz('todos');
        } catch { alert("Error: Archivo JSON inválido."); }
    };
    lector.readAsText(archivo); inputImportar.value = "";
}



// ==========================================================================
// REPARAR DATOS
// ==========================================================================
if (btnRepararDatos) {
    btnRepararDatos.addEventListener('click', function() {
        ejecutarConPermiso(function() {
            if (!confirm("⚠️ ¿Reparar valores corruptos? Las imágenes locales NO se afectan.")) return;
            inventario = inventario.map(p => {
                const cat = (p.categoria && p.categoria !== 'undefined') ? p.categoria : (p.category && p.category !== 'undefined') ? p.category : "Sin Categoría";
                return { ...p, precio: parseFloat(p.precio)||0, stock: parseInt(p.stock)||0, categoria: cat, category: cat, nombre: p.nombre||"Sin nombre" };
            });
            inventario.forEach(p => { if (p.categoria && p.categoria !== "Sin Categoría" && !categorias.includes(p.categoria)) categorias.push(p.categoria); });
            localStorage.setItem('inventario_gamer', JSON.stringify(inventario));
            localStorage.setItem('categorias_gamer', JSON.stringify(categorias));
            supabaseReemplazarInventario();
            supabaseReemplazarCategorias();
            actualizarSelectCategorias(); actualizarFiltros(); actualizarInterfaz('todos');
            alert("¡Datos reparados! ✅ Las imágenes locales están intactas.");
        });
    });
}

// ==========================================================================
// EXPORTAR INVENTARIO A EXCEL — ORGANIZADO POR CATEGORÍA (M.2, Teclados, etc.)
// ==========================================================================
btnExportarInventarioExcel.addEventListener('click', function() {
    if (inventario.length === 0) { alert("No hay productos en el inventario para exportar."); return; }

    // Agrupar productos por categoría
    const grupos = {};
    inventario.forEach(p => {
        const cat = p.categoria || p.category || "Sin Categoría";
        if (!grupos[cat]) grupos[cat] = [];
        grupos[cat].push(p);
    });

    const libro = XLSX.utils.book_new();

    // --- HOJA RESUMEN GENERAL (primera hoja) ---
    const filasResumen = [];
    let granTotalProductos = 0;
    let granTotalValor = 0;
    Object.keys(grupos).sort().forEach(cat => {
        const items = grupos[cat];
        const totalStock = items.reduce((acc, p) => acc + (parseInt(p.stock) || 0), 0);
        const totalValor = items.reduce((acc, p) => acc + ((parseFloat(p.precio) || 0) * (parseInt(p.stock) || 0)), 0);
        filasResumen.push({
            "CATEGORÍA / SECCIÓN": cat,
            "N° DE PRODUCTOS": items.length,
            "STOCK TOTAL": totalStock,
            "VALOR TOTAL ($)": totalValor
        });
        granTotalProductos += items.length;
        granTotalValor += totalValor;
    });
    filasResumen.push({ "CATEGORÍA / SECCIÓN": "TOTAL GENERAL", "N° DE PRODUCTOS": granTotalProductos, "STOCK TOTAL": "", "VALOR TOTAL ($)": granTotalValor });
    const hojaResumen = XLSX.utils.json_to_sheet(filasResumen);
    hojaResumen['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 14 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(libro, hojaResumen, "Resumen General");

    // --- UNA HOJA POR CADA CATEGORÍA (M.2, Teclados, etc.) ---
    const nombresUsados = new Set(["resumen general"]);
    Object.keys(grupos).sort().forEach(cat => {
        const filas = grupos[cat].map(p => ({
            "PRODUCTO": p.nombre,
            "PRECIO UNITARIO ($)": parseFloat(p.precio) || 0,
            "STOCK": parseInt(p.stock) || 0,
            "VALOR TOTAL ($)": (parseFloat(p.precio) || 0) * (parseInt(p.stock) || 0)
        }));
        const hoja = XLSX.utils.json_to_sheet(filas);
        hoja['!cols'] = [{ wch: 38 }, { wch: 20 }, { wch: 12 }, { wch: 20 }];

        // Nombre de hoja válido: máx 31 caracteres, sin : \ / ? * [ ], sin repetir
        let nombreHoja = cat.replace(/[:\\\/\?\*\[\]]/g, "").substring(0, 31).trim() || "Sin Categoria";
        let base = nombreHoja, contador = 2;
        while (nombresUsados.has(nombreHoja.toLowerCase())) {
            nombreHoja = `${base.substring(0, 28)}_${contador}`;
            contador++;
        }
        nombresUsados.add(nombreHoja.toLowerCase());

        XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);
    });

    XLSX.writeFile(libro, `GamerStock_Inventario_${new Date().toISOString().slice(0,10)}.xlsx`);
});

// ==========================================================================
// HISTORIAL Y EXCEL
// ==========================================================================
function renderizarTablaHistorial() {
    tablaCuerpoHistorial.innerHTML = '';
    if (historialSalidas.length === 0) {
        tablaCuerpoHistorial.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#64748b;">No se registran egresos contables.</td></tr>`;
        return;
    }
    historialSalidas.forEach(t => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${t.fechaHora}</td>
            <td style="color:#ff6b00;font-weight:bold;">${t.factura||'N/A'}</td>
            <td style="font-weight:bold;color:#fff;">${t.nombre}</td>
            <td><span class="txt-cat" style="font-size:0.85rem;">${t.categoria}</span></td>
            <td>${formatearMoneda(parseFloat(t.precioOriginal)||0)}</td>
            <td style="color:#ef4444;">-${formatearMoneda(parseFloat(t.descuentoAplicado)||0)}</td>
            <td style="font-weight:bold;color:#10b981;">${formatearMoneda(parseFloat(t.precioVentaFinal)||0)}</td>
            <td style="color:#ffa500;">${t.formaPago}</td>`;
        tablaCuerpoHistorial.appendChild(fila);
    });
}

btnLimpiarHistorial.addEventListener('click', function() {
    ejecutarConPermiso(function() {
        if (confirm("🚨 ¿Purgar el historial de ventas?")) {
            historialSalidas = []; localStorage.setItem('historial_salidas_gamer', JSON.stringify(historialSalidas)); supabaseLimpiarHistorial(); renderizarTablaHistorial();
        }
    });
});

btnDescargarExcel.addEventListener('click', function() {
    if (historialSalidas.length === 0) { alert("No hay movimientos para el Excel."); return; }
    const datosExcel = historialSalidas.map(item => ({
        "FECHA Y HORA": item.fechaHora, "N° FACTURA": item.factura||'N/A',
        "HARDWARE / COMPONENTE": item.nombre, "CATEGORÍA": item.categoria,
        "PRECIO ORIGINAL ($)": item.precioOriginal, "DESCUENTO ($)": item.descuentoAplicado,
        "PRECIO FINAL ($)": item.precioVentaFinal, "MÉTODO DE PAGO": item.formaPago
    }));
    const hoja = XLSX.utils.json_to_sheet(datosExcel);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Auditoria_Ventas");
    hoja['!cols'] = [{ wch: 22 }, { wch: 15 }, { wch: 38 }, { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 28 }];
    XLSX.writeFile(libro, `GamerStock_Cuadre_Caja_${new Date().toISOString().slice(0,10)}.xlsx`);
});

// ==========================================================================
// CLIENTES
// ==========================================================================
function claveCliente(nombre, cedula) {
    if (cedula && cedula.trim()) return 'ced:' + cedula.trim().toLowerCase();
    if (nombre && nombre.trim() && nombre.trim().toLowerCase() !== 'cliente general') return 'nom:' + nombre.trim().toLowerCase();
    return null;
}

function guardarOActualizarCliente(nombre, cedula, celular, fechaHora, totalVenta, seVendio) {
    const clave = claveCliente(nombre, cedula);
    if (!clave) return; // No se guarda "Cliente General" sin datos identificables

    let cliente = clientesGamer.find(c => c.clave === clave);
    if (!cliente) {
        cliente = {
            id: 'cli_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            clave,
            nombre: nombre || 'Cliente General',
            cedula: cedula || '',
            celular: celular || '',
            primeraCompra: fechaHora,
            ultimaCompra: fechaHora,
            totalCompras: 0,
            totalGastado: 0
        };
        clientesGamer.unshift(cliente);
    }
    // Actualiza datos si llegaron más completos
    if (nombre && nombre.trim().toLowerCase() !== 'cliente general') cliente.nombre = nombre;
    if (cedula) cliente.cedula = cedula;
    if (celular) cliente.celular = celular;
    cliente.ultimaCompra = fechaHora;
    if (seVendio) {
        cliente.totalCompras += 1;
        cliente.totalGastado += (totalVenta || 0);
    }
    localStorage.setItem('clientes_gamer', JSON.stringify(clientesGamer));
    supabaseGuardarCliente(cliente);
    actualizarSugerenciasClientes();
}

function actualizarSugerenciasClientes() {
    const dlNombres = document.getElementById('lista-sugerencias-clientes');
    const dlCedulas = document.getElementById('lista-sugerencias-cedulas');
    if (dlNombres) {
        dlNombres.innerHTML = clientesGamer.map(c => `<option value="${c.nombre.replace(/"/g,'&quot;')}"></option>`).join('');
    }
    if (dlCedulas) {
        dlCedulas.innerHTML = clientesGamer.filter(c => c.cedula).map(c => `<option value="${c.cedula.replace(/"/g,'&quot;')}"></option>`).join('');
    }
}

function renderizarListaClientes(filtro = '') {
    const contenedor = document.getElementById('lista-clientes-contenedor');
    const vacio = document.getElementById('lista-clientes-vacio');
    if (!contenedor) return;

    const term = filtro.trim().toLowerCase();
    const lista = clientesGamer.filter(c => {
        if (!term) return true;
        return c.nombre.toLowerCase().includes(term) || (c.cedula || '').toLowerCase().includes(term) || (c.celular || '').toLowerCase().includes(term);
    }).sort((a, b) => new Date(b.ultimaCompra) - new Date(a.ultimaCompra));

    contenedor.innerHTML = '';
    if (lista.length === 0) {
        vacio.style.display = 'block';
        vacio.textContent = clientesGamer.length === 0
            ? 'Aún no hay clientes registrados. Se guardan automáticamente al procesar una venta con nombre o cédula.'
            : 'No se encontraron clientes con ese criterio de búsqueda.';
        return;
    }
    vacio.style.display = 'none';

    lista.forEach(c => {
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjeta-cliente';
        tarjeta.innerHTML = `
            <h4>👤 ${c.nombre}</h4>
            ${c.cedula ? `<p>C.C.: ${c.cedula}</p>` : ''}
            ${c.celular ? `<p>📱 ${c.celular}</p>` : ''}
            <p style="color:#64748b;font-size:0.78rem;">Última compra: ${c.ultimaCompra}</p>
            <span class="badge-compras">${c.totalCompras} compra${c.totalCompras === 1 ? '' : 's'}</span>
        `;
        tarjeta.addEventListener('click', () => abrirDetalleCliente(c.id));
        contenedor.appendChild(tarjeta);
    });
}

function abrirModalClientes() {
    const modal = document.getElementById('modal-clientes');
    if (!modal) return;
    const buscador = document.getElementById('buscador-clientes');
    if (buscador) buscador.value = '';
    renderizarListaClientes();
    modal.classList.add('active');
}

function cerrarModalClientes() {
    const modal = document.getElementById('modal-clientes');
    if (modal) modal.classList.remove('active');
}

function abrirDetalleCliente(idCliente) {
    const cliente = clientesGamer.find(c => c.id === idCliente);
    if (!cliente) return;

    document.getElementById('titulo-detalle-cliente').innerHTML = `<span class="icono-panel">👤</span>${cliente.nombre}`;
    document.getElementById('info-detalle-cliente').innerHTML = `
        ${cliente.cedula ? `<span><strong>C.C.:</strong> ${cliente.cedula}</span>` : ''}
        ${cliente.celular ? `<span><strong>Celular:</strong> ${cliente.celular}</span>` : ''}
        <span><strong>Compras:</strong> ${cliente.totalCompras}</span>
        <span><strong>Total gastado:</strong> ${formatearMoneda(cliente.totalGastado)}</span>
        <span><strong>Primera compra:</strong> ${cliente.primeraCompra}</span>
        <span><strong>Última compra:</strong> ${cliente.ultimaCompra}</span>
    `;

    const cuerpo = document.getElementById('tabla-cuerpo-detalle-cliente');
    cuerpo.innerHTML = '';
    const compras = historialSalidas.filter(h => {
        const claveH = claveCliente(h.cliente, '');
        // Compara por nombre exacto o, si el cliente tiene cédula, por coincidencia de nombre (la cédula no queda en historialSalidas por ítem)
        return (h.cliente || '').trim().toLowerCase() === (cliente.nombre || '').trim().toLowerCase();
    });

    if (compras.length === 0) {
        cuerpo.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#64748b;">No hay compras registradas para este cliente.</td></tr>`;
    } else {
        compras.forEach(t => {
            const fila = document.createElement('tr');
            fila.innerHTML = `
                <td>${t.fechaHora}</td>
                <td style="color:#ff6b00;font-weight:bold;">${t.factura || 'N/A'}</td>
                <td style="font-weight:bold;color:#fff;">${t.nombre}</td>
                <td style="font-weight:bold;color:#10b981;">${formatearMoneda(parseFloat(t.precioVentaFinal) || 0)}</td>
                <td style="color:#ffa500;">${t.formaPago}</td>`;
            cuerpo.appendChild(fila);
        });
    }

    document.getElementById('modal-detalle-cliente').classList.add('active');
}

function cerrarModalDetalleCliente() {
    const modal = document.getElementById('modal-detalle-cliente');
    if (modal) modal.classList.remove('active');
}

const btnCerrarClientesX = document.getElementById('btn-cerrar-clientes-x');
const modalClientes = document.getElementById('modal-clientes');
const buscadorClientes = document.getElementById('buscador-clientes');
if (btnCerrarClientesX) btnCerrarClientesX.addEventListener('click', cerrarModalClientes);
if (modalClientes) modalClientes.addEventListener('click', (e) => { if (e.target === modalClientes) cerrarModalClientes(); });
if (buscadorClientes) buscadorClientes.addEventListener('input', function () { renderizarListaClientes(this.value); });

const btnCerrarDetalleClienteX = document.getElementById('btn-cerrar-detalle-cliente-x');
const modalDetalleCliente = document.getElementById('modal-detalle-cliente');
if (btnCerrarDetalleClienteX) btnCerrarDetalleClienteX.addEventListener('click', cerrarModalDetalleCliente);
if (modalDetalleCliente) modalDetalleCliente.addEventListener('click', (e) => { if (e.target === modalDetalleCliente) cerrarModalDetalleCliente(); });

actualizarSugerenciasClientes();

// ==========================================================================
// ==========================================================================
// RECIBO / TICKET — Estilos 100% inline para garantizar impresión correcta
// ==========================================================================

// *** EDITA ESTOS DATOS CON LOS DE TU NEGOCIO ***
const NEGOCIO = {
    nombre:    "GAMERCORE",
    slogan:    "Hardware & Tecnología de Alto Rendimiento",
    nit:       "NIT: 900.123.456-7",
    telefono:  "300 226 9524",
    direccion: "CRA 48 # 10-45, C.C. Monterrey, Local 271",
    mensaje:   "¡Gracias por tu compra! Vuelve pronto."
};

function formatearMoneda(valor) {
    return (Number(valor) || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function imprimirReciboTicket(nroFactura, fecha, pago, nombreCliente, cedulaCliente, celularCliente, items, subtotal, total, descripcionVenta = "", seVendio = true) {
    const tc = document.getElementById('contenedor-recibo-venta');

    // Filas de productos
    let filasItems = '';
    items.forEach((item, i) => {
        const bg = i % 2 === 0 ? '#f9f9f9' : '#ffffff';
        filasItems += `
            <tr style="background:${bg};">
                <td style="padding:9px 10px;border-bottom:1px solid #e0e0e0;font-size:13.5px;color:#000;">
                    <strong style="color:#000;">${item.nombre}.</strong>
                    ${item.descripcionProducto ? `<br><span style="font-size:11px;color:#333;font-style:italic;">📝 ${item.descripcionProducto}</span>` : ''}
                </td>
                <td style="padding:9px 10px;border-bottom:1px solid #e0e0e0;text-align:right;font-size:13.5px;color:#000;vertical-align:middle;white-space:nowrap;">
                    x${item.cantidad}
                </td>
            </tr>`;
    });

    // Datos del cliente (solo mostrar los que tienen valor)
    let datosCliente = `<strong style="color:#000;">${nombreCliente}.</strong>`;
    if (cedulaCliente) datosCliente += `<br><span style="font-size:15px;color:#000;">C.C.: ${cedulaCliente}</span>`;
    if (celularCliente) datosCliente += `<br><span style="font-size:15px;color:#000;">Cel.: ${celularCliente}</span>`;

    tc.innerHTML = `
    <div id="ticket-impresion-remoto" style="
        width: 100%;
        box-sizing: border-box;
        margin: 0 auto;
        font-family: Arial, sans-serif;
        color: #000;
        background: #fff;
        padding: 0;
    ">

        <!-- ENCABEZADO NEGOCIO -->
        <div style="border: 2px solid #000; padding: 14px 18px; margin-bottom: 10px;">
            <div class="recibo-fila-header" style="align-items:center;">
                <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                    <img src="logo-gamercore.jpg" alt="GamerCore" style="width:52px;height:52px;object-fit:contain;background:#04070d;border-radius:8px;padding:4px;flex-shrink:0;">
                    <div style="min-width:0;">
                        <div style="font-size:10px;font-weight:bold;color:#666;text-transform:uppercase;letter-spacing:1px;">Recibo de Venta</div>
                        <div style="font-size:20px;font-weight:900;color:#000;letter-spacing:1.5px;line-height:1.2;">${NEGOCIO.nombre}</div>
                        <div style="font-size:11.5px;color:#333;font-style:italic;">${NEGOCIO.slogan}</div>
                    </div>
                </div>
                <div class="recibo-header-derecha">
                    <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:1px;">N.° Factura</div>
                    <div style="font-size:17px;font-weight:900;color:#000;">${nroFactura}</div>
                </div>
            </div>
            <div class="recibo-fila-header" style="border-top:1px dashed #ccc; margin-top:10px; padding-top:8px;">
                <div style="font-size:11px;color:#333;line-height:1.5;">
                    📞 ${NEGOCIO.telefono}<br>📍 ${NEGOCIO.direccion}
                </div>
                <div class="recibo-header-derecha">
                    <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:1px;">Fecha</div>
                    <div style="font-size:12px;color:#000;">${fecha}</div>
                </div>
            </div>
        </div>

        <!-- DATOS DEL CLIENTE -->
        <div class="recibo-fila-header" style="border: 2px solid #000; padding: 12px 18px; margin-bottom: 10px;">
            <div>
                <div style="font-size:10px;font-weight:bold;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Cliente</div>
                <div style="font-size:14px;color:#000;line-height:1.6;">${datosCliente}</div>
            </div>
            <div class="recibo-header-derecha">
                <div style="font-size:10px;font-weight:bold;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Forma de Pago</div>
                <div style="font-size:14px;color:#000;">${pago}.</div>
            </div>
        </div>

        ${!seVendio ? `
        <!-- AVISO: VENTA NO CONCRETADA -->
        <div style="border: 2px solid #c00; padding: 10px 18px; margin-bottom: 10px; text-align:center;">
            <span style="font-size:13px;font-weight:900;color:#c00;text-transform:uppercase;letter-spacing:0.5px;">⚠️ Venta no concretada — No se descontó del inventario.</span>
        </div>` : ''}

        <!-- TABLA DE PRODUCTOS -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:10px;border:2px solid #000;">
            <thead>
                <tr style="background:#000;">
                    <th style="padding:9px 10px;text-align:left;font-size:13px;color:#fff;font-weight:bold;">Descripción</th>
                    <th style="padding:9px 10px;text-align:right;font-size:13px;color:#fff;font-weight:bold;">Cant.</th>
                </tr>
            </thead>
            <tbody>${filasItems}</tbody>
        </table>

        ${descripcionVenta ? `
        <!-- DESCRIPCIÓN DE LA VENTA -->
        <div style="border: 2px solid #000; padding: 10px 18px; margin-bottom: 10px;">
            <div style="font-size:10px;font-weight:bold;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Descripción / Observaciones</div>
            <div style="font-size:13px;color:#000;line-height:1.5;white-space:pre-wrap;">${descripcionVenta}</div>
        </div>` : ''}

        <!-- TOTALES -->
        <div style="border-top:2px solid #000;padding-top:8px;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;font-size:19px;font-weight:900;color:#000;padding-top:4px;">
                <span>Total Cobrado:</span><span>${formatearMoneda(total)}</span>
            </div>
        </div>

        <!-- FIRMA -->
        <div style="display:flex;justify-content:space-between;margin-bottom:14px;">
            <div style="text-align:center;width:45%;">
                <div style="border-top:1px solid #000;padding-top:6px;font-size:12px;color:#000;">Firma del Vendedor.</div>
            </div>
            <div style="text-align:center;width:45%;">
                <div style="border-top:1px solid #000;padding-top:6px;font-size:12px;color:#000;">Firma del Cliente.</div>
            </div>
        </div>

        <!-- AVISO IMPORTANTE Y GARANTÍA -->
        <div style="border-top:1px dashed #000;padding-top:10px;text-align:center;">
            <p style="font-size:9.5px;color:#444;line-height:1.4;margin-bottom:6px;">
                <strong>Aviso importante:</strong> Todos nuestros productos están sujetos a cambio de precio y disponibilidad sin previo aviso, validar al momento de realizar la compra.
            </p>
            <p style="font-size:10.5px;font-weight:900;color:#000;letter-spacing:0.4px;">
                Garantía por defecto de fábrica.
            </p>
        </div>

        <!-- FOOTER -->
        <div style="text-align:center;border-top:1px dashed #000;padding-top:10px;margin-top:8px;font-size:12px;color:#000;">
            ${NEGOCIO.mensaje}<br>
            <span style="font-size:10.5px;color:#777;">${NEGOCIO.nombre} — Sistema de Inventario GamerCore</span>
        </div>

    </div>`;

    document.getElementById('modal-recibo-venta').classList.add('active');
}

const btnCerrarReciboX = document.getElementById('btn-cerrar-recibo-x');
const btnCerrarReciboVenta = document.getElementById('btn-cerrar-recibo-venta');
const btnImprimirReciboVenta = document.getElementById('btn-imprimir-recibo-venta');

function cerrarModalRecibo() {
    document.getElementById('modal-recibo-venta').classList.remove('active');
}
if (btnCerrarReciboX) btnCerrarReciboX.addEventListener('click', cerrarModalRecibo);
if (btnCerrarReciboVenta) btnCerrarReciboVenta.addEventListener('click', cerrarModalRecibo);
if (btnImprimirReciboVenta) btnImprimirReciboVenta.addEventListener('click', () => {
    const ticket = document.getElementById('ticket-impresion-remoto');
    const marcadorOriginal = document.createComment('lugar-original-ticket');
    if (ticket) {
        ticket.parentNode.insertBefore(marcadorOriginal, ticket);
        document.body.appendChild(ticket);
    }
    window.print();
    if (ticket && marcadorOriginal.parentNode) {
        marcadorOriginal.parentNode.insertBefore(ticket, marcadorOriginal);
        marcadorOriginal.remove();
    }
});

// ==========================================================================
// MODAL — HISTORIAL COMPLETO DE VENTAS Y FINANZAS
// ==========================================================================
const modalHistorial       = document.getElementById('modal-historial');
const btnAbrirHistorial    = document.getElementById('btn-abrir-historial');
const btnCerrarHistorialX  = document.getElementById('btn-cerrar-historial-x');

function abrirModalHistorial() {
    if (!modalHistorial) return;
    renderizarTablaHistorial();
    modalHistorial.classList.add('active');
}

function cerrarModalHistorial() {
    if (!modalHistorial) return;
    modalHistorial.classList.remove('active');
}

if (btnAbrirHistorial) btnAbrirHistorial.addEventListener('click', abrirModalHistorial);
if (btnCerrarHistorialX) btnCerrarHistorialX.addEventListener('click', cerrarModalHistorial);
if (modalHistorial) {
    modalHistorial.addEventListener('click', (e) => {
        if (e.target === modalHistorial) cerrarModalHistorial();
    });
}

// --- Modal de Copia de Seguridad ---
const modalBackup = document.getElementById('modal-backup');
const btnCerrarBackupX = document.getElementById('btn-cerrar-backup-x');

function cerrarModalBackup() {
    if (modalBackup) modalBackup.classList.remove('active');
}

if (btnCerrarBackupX) btnCerrarBackupX.addEventListener('click', cerrarModalBackup);
if (modalBackup) {
    modalBackup.addEventListener('click', (e) => {
        if (e.target === modalBackup) cerrarModalBackup();
    });
}

// ==========================================================================
// BÚSQUEDA Y ARRANQUE
// ==========================================================================
let temporizadorBusqueda;
buscadorInput.addEventListener('input', function() {
    clearTimeout(temporizadorBusqueda);
    temporizadorBusqueda = setTimeout(() => actualizarInterfaz('todos'), 300);
});

abrirDBImagenes().then(async () => {
    await cargarDatosDesdeSupabase();
    actualizarSelectCategorias(); actualizarFiltros(); actualizarInterfaz(); renderizarTablaHistorial();
    pintarMetodosPagoPersonalizados();
    actualizarSugerenciasClientes();
});

const pieAnio = document.getElementById('pie-pagina-anio');
if (pieAnio) pieAnio.textContent = new Date().getFullYear();

// ==========================================================================
// MENÚ LATERAL — navegación, estado activo y comportamiento móvil
// ==========================================================================
(function () {
    const menuLateral = document.getElementById('menu-lateral');
    const btnMenuMobile = document.getElementById('btn-menu-mobile');
    const menuOverlay = document.getElementById('menu-overlay');
    const itemsMenu = document.querySelectorAll('.menu-item');

    if (!menuLateral) return;

    const destinoPorSeccion = {
        inicio: 'seccion-inicio',
        inventario: 'seccion-inventario',
        ventas: 'seccion-inventario'
    };

    const destinoPorAccion = {
        admin: 'panel-rol'
    };

    function cerrarMenuMobile() {
        menuLateral.classList.remove('abierto');
        if (menuOverlay) menuOverlay.classList.remove('visible');
    }

    function irASeccion(idDestino) {
        const el = document.getElementById(idDestino);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    itemsMenu.forEach(item => {
        item.addEventListener('click', function () {
            const seccion = this.dataset.seccion;
            const accion = this.dataset.accion;

            if (seccion) {
                itemsMenu.forEach(i => i.classList.remove('activo'));
                this.classList.add('activo');

                if (seccion === 'historial') {
                    if (typeof abrirModalHistorial === 'function') abrirModalHistorial();
                } else if (seccion === 'clientes') {
                    if (typeof abrirModalClientes === 'function') abrirModalClientes();
                } else {
                    irASeccion(destinoPorSeccion[seccion]);

                    if (seccion === 'ventas') {
                        const btnCarrito = document.getElementById('btn-toggle-carrito');
                        const panelCarrito = document.getElementById('panel-carrito');
                        if (btnCarrito && panelCarrito && panelCarrito.style.display === 'none') {
                            btnCarrito.click();
                        }
                    }
                }
            } else if (accion === 'backup') {
                const modalBackup = document.getElementById('modal-backup');
                if (modalBackup) modalBackup.classList.add('active');
            } else if (accion && destinoPorAccion[accion]) {
                irASeccion(destinoPorAccion[accion]);
            }

            cerrarMenuMobile();
        });
    });

    if (btnMenuMobile) {
        btnMenuMobile.addEventListener('click', function () {
            menuLateral.classList.add('abierto');
            if (menuOverlay) menuOverlay.classList.add('visible');
        });
    }

    if (menuOverlay) {
        menuOverlay.addEventListener('click', cerrarMenuMobile);
    }

    const btnColapsarMenu = document.getElementById('btn-colapsar-menu');
    if (btnColapsarMenu) {
        btnColapsarMenu.addEventListener('click', function () {
            const colapsado = document.body.classList.toggle('menu-colapsado');
            btnColapsarMenu.textContent = colapsado ? '›' : '‹';
            btnColapsarMenu.title = colapsado ? 'Mostrar menú' : 'Ocultar menú';
            btnColapsarMenu.setAttribute('aria-label', colapsado ? 'Mostrar menú' : 'Ocultar menú');
        });
    }
})();

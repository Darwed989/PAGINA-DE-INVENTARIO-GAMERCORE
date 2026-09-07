// ==========================================================================
// GamerStock // CONTROL DE INVENTARIO
// Imágenes: IndexedDB local — NUNCA viajan en el JSON
// ==========================================================================

let inventario = JSON.parse(localStorage.getItem('inventario_gamer')) || [];
let categorias = JSON.parse(localStorage.getItem('categorias_gamer')) || ["Procesadores", "Tarjetas de Video", "Placas Madre", "Periféricos"];
let historialSalidas = JSON.parse(localStorage.getItem('historial_salidas_gamer')) || [];
let carritoVentaActual = [];
let metodosPagoPersonalizados = JSON.parse(localStorage.getItem('metodos_pago_gamer')) || [];

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
}

let rolActual = sessionStorage.getItem('rol_gamer') || 'empleado';

const badgeRol           = document.getElementById('badge-rol');
const btnCambiarRol      = document.getElementById('btn-cambiar-rol');
const btnAbrirCambiarClave = document.getElementById('btn-abrir-cambiar-clave');
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
    } else {
        badgeRol.textContent = '🙋 Empleado';
        badgeRol.className = 'badge-rol rol-empleado';
        btnCambiarRol.textContent = '🔑 Iniciar como Admin';
        if (btnAbrirCambiarClave) btnAbrirCambiarClave.style.display = 'none';
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
            return;
        }
        abrirModalPassword(() => {
            rolActual = 'administrador';
            sessionStorage.setItem('rol_gamer', rolActual);
            actualizarBadgeRol();
        });
    });
}

actualizarBadgeRol();

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
    }
});

window.agregarAlCarritoVenta = function(id) {
    const prod = inventario.find(p => p.id === id);
    if (!prod) return;
    const pStock = parseInt(prod.stock) || 0;
    if (pStock <= 0) { alert(`"${prod.nombre}" está agotado.`); return; }
    const existente = carritoVentaActual.find(i => i.id === id);
    if (existente) {
        if (existente.cantidad + 1 > pStock) { alert(`Stock máximo: ${pStock} unidades.`); return; }
        existente.cantidad++;
    } else {
        carritoVentaActual.push({ id: prod.id, nombre: prod.nombre, categoria: prod.categoria || prod.category, precioOriginal: parseFloat(prod.precio) || 0, cantidad: 1, descuento: 0 });
    }
    renderizarCarrito(); panelCarrito.style.display = 'flex';
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
            <div class="ci-controles">
                <div class="ci-campo"><label>Precio $</label><input type="number" value="${item.precioOriginal}" min="0" step="any" onchange="cambiarPrecioCarrito(${idx},this.value)"></div>
                <div class="ci-campo"><label>Cant.</label><input type="number" value="${item.cantidad}" min="1" max="${maxStock}" onchange="cambiarCantidadCarrito(${idx},this.value)"></div>
                <div class="ci-campo"><label>Desc. $</label><input type="number" value="${item.descuento}" min="0" step="any" onchange="cambiarDescuentoCarrito(${idx},this.value)"></div>
                <div class="ci-campo ci-total-item"><label>Total</label><span>${formatearMoneda(totalItem)}</span></div>
            </div>`;
        carritoItemsEl.appendChild(div);
    });
    carritoSubtotalEl.textContent = formatearMoneda(subtotal);
    carritoDescEl.textContent = `-${formatearMoneda(totalDesc)}`;
    carritoTotalEl.textContent = formatearMoneda(subtotal - totalDesc);
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
    imprimirReciboTicket(numeroFactura, fechaHora, metodoPago, nombreCliente, cedulaCliente, celularCliente, productosParaRecibo, subtotalRecibo, totalRecibo, descripcionVenta, seVendio);
    document.getElementById('carrito-nombre-cliente').value = "";
    document.getElementById('carrito-cedula-cliente').value = "";
    document.getElementById('carrito-celular-cliente').value = "";
    document.getElementById('carrito-descripcion-venta').value = "";
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
                    <p class="txt-precio">${formatearMoneda(pPrecio)}</p>
                    <div class="info-stock"><span class="dot-stock ${stockClass}"></span><span>${pStock} un. (${stockTexto})</span></div>
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
    if (valorTotalEl) valorTotalEl.textContent = formatearMoneda(totalDinero);
    if (alertasStockEl) alertasStockEl.textContent = alertasStock;
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
    card.querySelector('.txt-precio').textContent = formatearMoneda(pPrecio);
    card.querySelector('.dot-stock').className = `dot-stock ${stockClass}`;
    card.querySelector('.info-stock span:last-child').textContent = `${pStock} un. (${stockTexto})`;
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
            historialSalidas = []; localStorage.setItem('historial_salidas_gamer', JSON.stringify(historialSalidas)); renderizarTablaHistorial();
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
// ==========================================================================
// RECIBO / TICKET — Estilos 100% inline para garantizar impresión correcta
// ==========================================================================

// *** EDITA ESTOS DATOS CON LOS DE TU NEGOCIO ***
const NEGOCIO = {
    nombre:    "GAMERCORE",
    slogan:    "Hardware & Tecnología de Alto Rendimiento",
    nit:       "NIT: 900.123.456-7",
    telefono:  "+57 300 000 0000",
    direccion: "Medellín, Antioquia, Colombia",
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
        const tot = (item.precioOriginal * item.cantidad) - item.descuento;
        const bg = i % 2 === 0 ? '#f9f9f9' : '#ffffff';
        filasItems += `
            <tr style="background:${bg};">
                <td style="padding:12px 8px;border-bottom:1px solid #e0e0e0;font-size:16px;color:#000;">
                    <strong style="color:#000;">${item.nombre}.</strong><br>
                    <span style="font-size:14px;color:#555;">Cant.: ${item.cantidad} × ${formatearMoneda(item.precioOriginal)}</span>
                </td>
                <td style="padding:12px 8px;border-bottom:1px solid #e0e0e0;text-align:right;font-size:16px;font-weight:bold;color:#000;vertical-align:middle;">
                    ${formatearMoneda(tot)}
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
        <div class="recibo-fila-header" style="border: 3px solid #000; padding: 20px 22px; margin-bottom: 16px;">
            <div style="display:flex; align-items:flex-start; gap:16px;">
                <img src="logo-gamercore.jpg" alt="GamerCore" style="width:76px;height:76px;object-fit:contain;background:#04070d;border-radius:10px;padding:5px;flex-shrink:0;">
                <div>
                    <div style="font-size:13px;font-weight:bold;color:#000;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">RECIBO DE VENTA</div>
                    <div style="font-size:26px;font-weight:900;color:#000;letter-spacing:2px;margin-bottom:6px;">${NEGOCIO.nombre}</div>
                    <div style="font-size:15px;color:#000;font-style:italic;margin-bottom:10px;">${NEGOCIO.slogan}</div>
                    <div style="font-size:15px;color:#000;line-height:1.8;">
                        <div>${NEGOCIO.nit}</div>
                        <div>📞 ${NEGOCIO.telefono}</div>
                        <div>📍 ${NEGOCIO.direccion}</div>
                    </div>
                </div>
            </div>
            <div class="recibo-header-derecha">
                <div style="font-size:13px;color:#000;text-transform:uppercase;letter-spacing:1px;">Fecha:</div>
                <div style="font-size:15px;color:#000;margin-bottom:14px;">${fecha}</div>
                <div style="font-size:13px;color:#000;text-transform:uppercase;letter-spacing:1px;">N.° de Factura:</div>
                <div style="font-size:22px;font-weight:900;color:#000;">${nroFactura}</div>
            </div>
        </div>

        <!-- DATOS DEL CLIENTE -->
        <div class="recibo-fila-header" style="border: 3px solid #000; padding: 16px 22px; margin-bottom: 16px;">
            <div>
                <div style="font-size:13px;font-weight:bold;color:#000;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Cliente:</div>
                <div style="font-size:16px;color:#000;line-height:1.8;">${datosCliente}</div>
            </div>
            <div class="recibo-header-derecha">
                <div style="font-size:13px;font-weight:bold;color:#000;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Forma de Pago:</div>
                <div style="font-size:16px;color:#000;">${pago}.</div>
            </div>
        </div>

        ${!seVendio ? `
        <!-- AVISO: VENTA NO CONCRETADA -->
        <div style="border: 3px solid #c00; padding: 12px 22px; margin-bottom: 16px; text-align:center;">
            <span style="font-size:15px;font-weight:900;color:#c00;text-transform:uppercase;letter-spacing:1px;">⚠️ Venta no concretada — No se descontó del inventario.</span>
        </div>` : ''}

        <!-- TABLA DE PRODUCTOS -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
            <thead>
                <tr style="background:#000;">
                    <th style="padding:12px 8px;text-align:left;font-size:15px;color:#fff;font-weight:bold;">DESCRIPCIÓN</th>
                    <th style="padding:12px 8px;text-align:right;font-size:15px;color:#fff;font-weight:bold;">TOTAL</th>
                </tr>
            </thead>
            <tbody>${filasItems}</tbody>
        </table>

        ${descripcionVenta ? `
        <!-- DESCRIPCIÓN DE LA VENTA -->
        <div style="border: 3px solid #000; padding: 14px 22px; margin-bottom: 16px;">
            <div style="font-size:13px;font-weight:bold;color:#000;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Descripción / Observaciones:</div>
            <div style="font-size:15px;color:#000;line-height:1.6;white-space:pre-wrap;">${descripcionVenta}</div>
        </div>` : ''}

        <!-- TOTALES -->
        <div style="border-top:3px solid #000;padding-top:14px;margin-bottom:22px;">
            <div style="display:flex;justify-content:space-between;font-size:16px;color:#000;margin-bottom:6px;">
                <span>Subtotal:</span><span>${formatearMoneda(subtotal)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:22px;font-weight:900;color:#000;border-top:1px dashed #000;padding-top:10px;">
                <span>Total Cobrado:</span><span>${formatearMoneda(total)}</span>
            </div>
        </div>

        <!-- FIRMA -->
        <div style="display:flex;justify-content:space-between;margin-top:40px;margin-bottom:20px;">
            <div style="text-align:center;width:45%;">
                <div style="border-top:1px solid #000;padding-top:8px;font-size:14px;color:#000;">Firma del Vendedor.</div>
            </div>
            <div style="text-align:center;width:45%;">
                <div style="border-top:1px solid #000;padding-top:8px;font-size:14px;color:#000;">Firma del Cliente.</div>
            </div>
        </div>

        <!-- FOOTER -->
        <div style="text-align:center;border-top:1px dashed #000;padding-top:14px;font-size:14px;color:#000;">
            ${NEGOCIO.mensaje}<br>
            <span style="font-size:12px;color:#555;">${NEGOCIO.nombre} — Sistema de Inventario GamerCore</span>
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

// ==========================================================================
// BÚSQUEDA Y ARRANQUE
// ==========================================================================
let temporizadorBusqueda;
buscadorInput.addEventListener('input', function() {
    clearTimeout(temporizadorBusqueda);
    temporizadorBusqueda = setTimeout(() => actualizarInterfaz('todos'), 300);
});

abrirDBImagenes().then(() => {
    actualizarSelectCategorias(); actualizarFiltros(); actualizarInterfaz(); renderizarTablaHistorial();
    pintarMetodosPagoPersonalizados();
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
        ventas: 'seccion-inventario',
        historial: 'seccion-historial'
    };

    const destinoPorAccion = {
        backup: 'seccion-backup',
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
                irASeccion(destinoPorSeccion[seccion]);

                if (seccion === 'ventas') {
                    const btnCarrito = document.getElementById('btn-toggle-carrito');
                    const panelCarrito = document.getElementById('panel-carrito');
                    if (btnCarrito && panelCarrito && panelCarrito.style.display === 'none') {
                        btnCarrito.click();
                    }
                }
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
})();
// Configuración de Firebase
// IMPORTANTE: Completar estos valores después de crear el proyecto en Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyDGvgNj-7Lw9U-jGnr7p9VDDrs9N_DnHSA",
    authDomain: "appturnos-a085a.firebaseapp.com",
    projectId: "appturnos-a085a",
    storageBucket: "appturnos-a085a.firebasestorage.app",
    messagingSenderId: "676399399275",
    appId: "1:676399399275:web:0c9123cd1584143e818c2e"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Referencias globales
const auth = firebase.auth();
const db = firebase.firestore();

// Configuración de la peluquería
const CONFIG = {
    horaApertura: 9,
    horaCierre: 18,
    intervaloMinutos: 30,
    diasLaborales: [2, 3, 4, 5, 6], // Martes (2) a Sábado (6) - 0=Domingo, 1=Lunes
    maxTurnosPorUsuario: 3,
    diasAnticipacion: 120, // 4 meses de anticipación (V2: cambiado de 90 a 120 días)
    servicios: [
        { id: 'corte', nombre: 'Corte de Cabello', duracion: 30, precio: 2000 },
        { id: 'corte-barba', nombre: 'Corte + Barba', duracion: 45, precio: 2800 },
        { id: 'color', nombre: 'Coloración', duracion: 90, precio: 5000 },
        { id: 'alisado', nombre: 'Alisado', duracion: 120, precio: 8000 },
        { id: 'tratamiento', nombre: 'Tratamiento Capilar', duracion: 60, precio: 3500 }
    ],
    adminEmail: 'admin@peluqueria.com'
};

// Configurar persistencia de autenticación
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch((error) => {
        console.error('Error al configurar persistencia:', error);
    });

// Utilidades
const Utils = {
    // Formatear fecha a texto
    formatearFecha(fecha) {
        const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return fecha.toLocaleDateString('es-AR', opciones);
    },

    // Formatear fecha corta
    formatearFechaCorta(fecha) {
        const dia = fecha.getDate().toString().padStart(2, '0');
        const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
        const año = fecha.getFullYear();
        return `${dia}/${mes}/${año}`;
    },

    // Capitalizar primera letra
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    // Verificar si es día laboral
    esDiaLaboral(fecha) {
        const dia = fecha.getDay();
        return CONFIG.diasLaborales.includes(dia);
    },

    // Verificar si una fecha está bloqueada
    async esFechaBloqueada(fecha) {
        const fechaStr = Utils.formatearFechaCorta(fecha);
        const snapshot = await db.collection('fechasBloqueadas')
            .where('fecha', '==', fechaStr)
            .get();
        return !snapshot.empty;
    },

    // Obtener servicio por ID
    getServicio(servicioId) {
        return CONFIG.servicios.find(s => s.id === servicioId);
    },

    // Mostrar loading
    showLoading(mensaje = 'Cargando...') {
        Swal.fire({
            title: mensaje,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
    },

    // Cerrar loading
    closeLoading() {
        Swal.close();
    },

    // Mostrar mensaje de éxito
    showSuccess(titulo, mensaje) {
        return Swal.fire({
            icon: 'success',
            title: titulo,
            text: mensaje,
            confirmButtonColor: '#2196f3'
        });
    },

    // Mostrar mensaje de error
    showError(titulo, mensaje) {
        return Swal.fire({
            icon: 'error',
            title: titulo,
            text: mensaje,
            confirmButtonColor: '#2196f3'
        });
    },

    // Confirmar acción
    confirmar(titulo, mensaje) {
        return Swal.fire({
            title: titulo,
            text: mensaje,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f44336',
            cancelButtonColor: '#757575',
            confirmButtonText: 'Sí, confirmar',
            cancelButtonText: 'Cancelar'
        });
    },

    // Descargar como CSV
    descargarCSV(data, filename) {
        const csv = this.arrayToCSV(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    // Convertir array a CSV
    arrayToCSV(data) {
        if (data.length === 0) return '';

        const headers = Object.keys(data[0]);
        const csvRows = [];

        // Agregar headers
        csvRows.push(headers.join(','));

        // Agregar datos
        for (const row of data) {
            const values = headers.map(header => {
                const escaped = ('' + row[header]).replace(/"/g, '\\"');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        }

        return csvRows.join('\n');
    },

    // ========================================
    // TOAST NOTIFICATIONS (V2)
    // ========================================

    /**
     * Mostrar toast notification
     * @param {string} message - Mensaje a mostrar
     * @param {string} type - Tipo: 'success', 'error', 'info', 'warning'
     * @param {number} duration - Duración en ms (default: 3000)
     */
    showToast(message, type = 'info', duration = 3000) {
        // Configuración de colores según tipo
        const colors = {
            success: 'linear-gradient(to right, #4caf50, #45a049)',
            error: 'linear-gradient(to right, #f44336, #d32f2f)',
            info: 'linear-gradient(to right, #2196f3, #1976d2)',
            warning: 'linear-gradient(to right, #ff9800, #f57c00)'
        };

        Toastify({
            text: message,
            duration: duration,
            close: true,
            gravity: 'top',
            position: 'right',
            stopOnFocus: true,
            style: {
                background: colors[type] || colors.info,
                borderRadius: '8px',
                padding: '12px 20px',
                fontSize: '0.95rem',
                fontWeight: '500',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            },
            onClick: function() {}
        }).showToast();
    },

    // Atajos para tipos específicos de toast
    toastSuccess(message, duration = 3000) {
        this.showToast(message, 'success', duration);
    },

    toastError(message, duration = 3000) {
        this.showToast(message, 'error', duration);
    },

    toastInfo(message, duration = 3000) {
        this.showToast(message, 'info', duration);
    },

    toastWarning(message, duration = 3000) {
        this.showToast(message, 'warning', duration);
    }
};

// Exportar para uso global
window.CONFIG = CONFIG;
window.Utils = Utils;

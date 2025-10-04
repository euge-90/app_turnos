// Panel de Administración

let currentAgendaDate = new Date();
let currentWeekStart = new Date();

// Gestor Admin
const AdminManager = {
    // Obtener estadísticas
    async obtenerEstadisticas() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());

        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        // Turnos hoy
        const turnosHoySnapshot = await db.collection('turnos')
            .where('fecha', '>=', firebase.firestore.Timestamp.fromDate(today))
            .where('fecha', '<', firebase.firestore.Timestamp.fromDate(new Date(today.getTime() + 24 * 60 * 60 * 1000)))
            .get();

        const turnosHoy = turnosHoySnapshot.docs.filter(doc => doc.data().estado === 'confirmado').length;

        // Turnos semana
        const turnosSemanaSnapshot = await db.collection('turnos')
            .where('fecha', '>=', firebase.firestore.Timestamp.fromDate(startOfWeek))
            .get();

        const turnosSemana = turnosSemanaSnapshot.docs.filter(doc => doc.data().estado === 'confirmado').length;

        // Turnos mes
        const turnosMesSnapshot = await db.collection('turnos')
            .where('fecha', '>=', firebase.firestore.Timestamp.fromDate(startOfMonth))
            .get();

        const turnosMes = turnosMesSnapshot.docs.filter(doc => doc.data().estado === 'confirmado').length;

        // Total clientes
        const clientes = await db.collection('usuarios').get();

        return {
            turnosHoy,
            turnosSemana,
            turnosMes,
            totalClientes: clientes.size
        };
    },

    // Obtener turnos de un día
    async obtenerTurnosDia(fecha) {
        const inicio = new Date(fecha);
        inicio.setHours(0, 0, 0, 0);
        const fin = new Date(fecha);
        fin.setHours(23, 59, 59, 999);

        const snapshot = await db.collection('turnos')
            .where('fecha', '>=', firebase.firestore.Timestamp.fromDate(inicio))
            .where('fecha', '<=', firebase.firestore.Timestamp.fromDate(fin))
            .get();

        return snapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data(),
                fecha: doc.data().fecha.toDate()
            }))
            .filter(turno => turno.estado === 'confirmado')
            .sort((a, b) => {
                const fechaDiff = a.fecha - b.fecha;
                if (fechaDiff !== 0) return fechaDiff;
                return a.hora.localeCompare(b.hora);
            });
    },

    // Obtener turnos de la semana
    async obtenerTurnosSemana(startDate) {
        const inicio = new Date(startDate);
        inicio.setHours(0, 0, 0, 0);
        const fin = new Date(startDate);
        fin.setDate(fin.getDate() + 7);
        fin.setHours(23, 59, 59, 999);

        const snapshot = await db.collection('turnos')
            .where('fecha', '>=', firebase.firestore.Timestamp.fromDate(inicio))
            .where('fecha', '<=', firebase.firestore.Timestamp.fromDate(fin))
            .get();

        return snapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data(),
                fecha: doc.data().fecha.toDate()
            }))
            .filter(turno => turno.estado === 'confirmado')
            .sort((a, b) => {
                const fechaDiff = a.fecha - b.fecha;
                if (fechaDiff !== 0) return fechaDiff;
                return a.hora.localeCompare(b.hora);
            });
    },

    // Cancelar turno (admin)
    async cancelarTurno(turnoId) {
        await db.collection('turnos').doc(turnoId).update({
            estado: 'cancelado',
            canceladoAt: firebase.firestore.FieldValue.serverTimestamp(),
            canceladoPor: 'admin'
        });
    },

    // Bloquear fecha
    async bloquearFecha(fecha, motivo) {
        const fechaStr = Utils.formatearFechaCorta(fecha);

        await db.collection('fechasBloqueadas').add({
            fecha: fechaStr,
            motivo: motivo || 'No disponible',
            bloqueadoAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    },

    // Desbloquear fecha
    async desbloquearFecha(bloqueadoId) {
        await db.collection('fechasBloqueadas').doc(bloqueadoId).delete();
    },

    // Obtener fechas bloqueadas
    async obtenerFechasBloqueadas() {
        const snapshot = await db.collection('fechasBloqueadas')
            .orderBy('fecha', 'desc')
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    },

    // Buscar turnos por cliente
    async buscarTurnos(query) {
        const snapshot = await db.collection('turnos')
            .where('estado', '==', 'confirmado')
            .orderBy('fecha', 'desc')
            .limit(50)
            .get();

        const turnos = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            fecha: doc.data().fecha.toDate()
        }));

        // Filtrar por nombre o email
        const queryLower = query.toLowerCase();
        return turnos.filter(t =>
            t.usuarioNombre.toLowerCase().includes(queryLower) ||
            t.usuarioEmail.toLowerCase().includes(queryLower)
        );
    },

    // Obtener turnos del mes para exportar
    async obtenerTurnosMes(mes, año) {
        const inicio = new Date(año, mes, 1);
        const fin = new Date(año, mes + 1, 0);
        fin.setHours(23, 59, 59, 999);

        const snapshot = await db.collection('turnos')
            .where('fecha', '>=', firebase.firestore.Timestamp.fromDate(inicio))
            .where('fecha', '<=', firebase.firestore.Timestamp.fromDate(fin))
            .get();

        return snapshot.docs
            .map(doc => {
                const data = doc.data();
                const servicio = Utils.getServicio(data.servicio.id);
                return {
                    fecha: data.fecha.toDate(),
                    hora: data.hora,
                    Fecha: Utils.formatearFechaCorta(data.fecha.toDate()),
                    Hora: data.hora,
                    Cliente: data.usuarioNombre,
                    Email: data.usuarioEmail,
                    Servicio: servicio.nombre,
                    Precio: servicio.precio,
                    Estado: data.estado
                };
            })
            .sort((a, b) => {
                const fechaDiff = a.fecha - b.fecha;
                if (fechaDiff !== 0) return fechaDiff;
                return a.hora.localeCompare(b.hora);
            });
    },

    // Obtener estadísticas de servicios
    async obtenerEstadisticasServicios() {
        const snapshot = await db.collection('turnos')
            .where('estado', '==', 'confirmado')
            .get();

        const servicios = {};

        snapshot.docs.forEach(doc => {
            const servicioId = doc.data().servicio.id;
            if (!servicios[servicioId]) {
                servicios[servicioId] = 0;
            }
            servicios[servicioId]++;
        });

        return Object.entries(servicios).map(([id, count]) => ({
            servicio: Utils.getServicio(id),
            cantidad: count
        })).sort((a, b) => b.cantidad - a.cantidad);
    },

    // Crear nuevo servicio
    async crearServicio(nombre, duracion, precio) {
        const servicioId = nombre.toLowerCase().replace(/\s+/g, '-');

        await db.collection('servicios').doc(servicioId).set({
            id: servicioId,
            nombre: nombre,
            duracion: parseInt(duracion),
            precio: parseInt(precio),
            activo: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Recargar servicios en CONFIG
        await this.cargarServicios();
    },

    // Actualizar servicio existente
    async actualizarServicio(servicioId, nombre, duracion, precio) {
        await db.collection('servicios').doc(servicioId).update({
            nombre: nombre,
            duracion: parseInt(duracion),
            precio: parseInt(precio),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Recargar servicios en CONFIG
        await this.cargarServicios();
    },

    // Eliminar servicio
    async eliminarServicio(servicioId) {
        // Verificar si hay turnos activos con este servicio
        const turnosActivos = await db.collection('turnos')
            .where('servicio.id', '==', servicioId)
            .where('estado', '==', 'confirmado')
            .where('fecha', '>=', firebase.firestore.Timestamp.fromDate(new Date()))
            .get();

        if (!turnosActivos.empty) {
            throw new Error('No se puede eliminar un servicio con turnos activos');
        }

        await db.collection('servicios').doc(servicioId).delete();

        // Recargar servicios en CONFIG
        await this.cargarServicios();
    },

    // Cargar servicios desde Firestore
    async cargarServicios() {
        const snapshot = await db.collection('servicios')
            .where('activo', '==', true)
            .get();

        const servicios = [];

        snapshot.docs.forEach(doc => {
            servicios.push(doc.data());
        });

        // Si no hay servicios en Firestore, usar los servicios por defecto
        if (servicios.length === 0) {
            CONFIG.servicios.forEach(async (servicio) => {
                await db.collection('servicios').doc(servicio.id).set({
                    ...servicio,
                    activo: true,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
            return CONFIG.servicios;
        }

        // Actualizar CONFIG con los servicios de Firestore
        CONFIG.servicios = servicios.sort((a, b) => a.precio - b.precio);
        window.CONFIG = CONFIG;

        return servicios;
    },

    // Obtener todos los servicios
    async obtenerServicios() {
        const snapshot = await db.collection('servicios')
            .where('activo', '==', true)
            .get();

        return snapshot.docs.map(doc => doc.data());
    }
};

// UI Admin
const AdminUI = {
    // Renderizar estadísticas
    async renderEstadisticas() {
        try {
            const stats = await AdminManager.obtenerEstadisticas();

            document.getElementById('turnosHoy').textContent = stats.turnosHoy;
            document.getElementById('turnosSemana').textContent = stats.turnosSemana;
            document.getElementById('turnosMes').textContent = stats.turnosMes;
            document.getElementById('totalClientes').textContent = stats.totalClientes;
        } catch (error) {
            console.error('Error al cargar estadísticas:', error);
        }
    },

    // Renderizar agenda del día
    async renderAgenda() {
        const container = document.getElementById('agendaContainer');
        const fechaEl = document.getElementById('fechaAgenda');

        fechaEl.textContent = Utils.formatearFecha(currentAgendaDate);
        container.innerHTML = '<div class="loading">Cargando agenda...</div>';

        try {
            const turnos = await AdminManager.obtenerTurnosDia(currentAgendaDate);

            if (turnos.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #757575; padding: 2rem;">No hay turnos para este día</p>';
                return;
            }

            container.innerHTML = '';

            turnos.forEach(turno => {
                const servicio = Utils.getServicio(turno.servicio.id);
                const item = document.createElement('div');
                item.className = 'agenda-item';

                item.innerHTML = `
                    <div class="agenda-item-info">
                        <h4>${turno.hora} - ${servicio.nombre}</h4>
                        <p>${turno.usuarioNombre} (${turno.usuarioEmail})</p>
                        <p>Duración: ${servicio.duracion} min | Precio: $${servicio.precio.toLocaleString('es-AR')}</p>
                    </div>
                    <div class="turno-actions">
                        <button class="btn-danger btn-small" onclick="eliminarTurnoAdmin('${turno.id}')">Eliminar</button>
                    </div>
                `;

                container.appendChild(item);
            });
        } catch (error) {
            container.innerHTML = '<p style="text-align: center; color: #f44336;">Error al cargar agenda</p>';
            console.error('Error:', error);
        }
    },

    // Renderizar vista semanal
    async renderSemana() {
        const container = document.getElementById('semanaContainer');
        const fechaEl = document.getElementById('fechaSemana');

        const endDate = new Date(currentWeekStart);
        endDate.setDate(endDate.getDate() + 6);

        fechaEl.textContent = `${Utils.formatearFechaCorta(currentWeekStart)} - ${Utils.formatearFechaCorta(endDate)}`;
        container.innerHTML = '<div class="loading">Cargando semana...</div>';

        try {
            const turnos = await AdminManager.obtenerTurnosSemana(currentWeekStart);

            // Agrupar por día
            const turnosPorDia = {};
            for (let i = 0; i < 7; i++) {
                const fecha = new Date(currentWeekStart);
                fecha.setDate(fecha.getDate() + i);
                const key = Utils.formatearFechaCorta(fecha);
                turnosPorDia[key] = [];
            }

            turnos.forEach(turno => {
                const key = Utils.formatearFechaCorta(turno.fecha);
                if (turnosPorDia[key]) {
                    turnosPorDia[key].push(turno);
                }
            });

            container.innerHTML = '';

            Object.entries(turnosPorDia).forEach(([fecha, turnosDia]) => {
                const diaDiv = document.createElement('div');
                diaDiv.style.marginBottom = '2rem';

                diaDiv.innerHTML = `
                    <h3 style="color: #2196f3; margin-bottom: 1rem;">${fecha} (${turnosDia.length} turnos)</h3>
                `;

                if (turnosDia.length === 0) {
                    diaDiv.innerHTML += '<p style="color: #757575; margin-left: 1rem;">Sin turnos</p>';
                } else {
                    turnosDia.forEach(turno => {
                        const servicio = Utils.getServicio(turno.servicio.id);
                        const item = document.createElement('div');
                        item.className = 'agenda-item';
                        item.style.marginBottom = '0.5rem';

                        item.innerHTML = `
                            <div class="agenda-item-info">
                                <h4>${turno.hora} - ${servicio.nombre}</h4>
                                <p>${turno.usuarioNombre}</p>
                            </div>
                        `;

                        diaDiv.appendChild(item);
                    });
                }

                container.appendChild(diaDiv);
            });
        } catch (error) {
            container.innerHTML = '<p style="text-align: center; color: #f44336;">Error al cargar semana</p>';
            console.error('Error:', error);
        }
    },

    // Renderizar fechas bloqueadas
    async renderFechasBloqueadas() {
        const container = document.getElementById('blockedDatesContainer');

        try {
            const fechas = await AdminManager.obtenerFechasBloqueadas();

            if (fechas.length === 0) {
                container.innerHTML = '<p style="color: #757575;">No hay fechas bloqueadas</p>';
                return;
            }

            container.innerHTML = '';

            fechas.forEach(fecha => {
                const item = document.createElement('div');
                item.className = 'blocked-date-item';

                item.innerHTML = `
                    <div>
                        <strong>${fecha.fecha}</strong>
                        <p style="color: #757575; font-size: 0.9rem;">${fecha.motivo}</p>
                    </div>
                    <button class="btn-danger btn-small" onclick="desbloquearFechaUI('${fecha.id}')">Desbloquear</button>
                `;

                container.appendChild(item);
            });
        } catch (error) {
            console.error('Error al cargar fechas bloqueadas:', error);
        }
    },

    // Renderizar estadísticas de servicios
    async renderEstadisticasServicios() {
        const container = document.getElementById('serviciosStats');

        try {
            const stats = await AdminManager.obtenerEstadisticasServicios();

            if (stats.length === 0) {
                container.innerHTML = '<p style="color: #757575;">No hay datos disponibles</p>';
                return;
            }

            container.innerHTML = '';

            stats.forEach(stat => {
                const item = document.createElement('div');
                item.style.display = 'flex';
                item.style.justifyContent = 'space-between';
                item.style.padding = '0.75rem';
                item.style.background = '#f5f5f5';
                item.style.borderRadius = '8px';
                item.style.marginBottom = '0.5rem';

                item.innerHTML = `
                    <span>${stat.servicio.nombre}</span>
                    <strong style="color: #2196f3;">${stat.cantidad} turnos</strong>
                `;

                container.appendChild(item);
            });
        } catch (error) {
            console.error('Error al cargar estadísticas de servicios:', error);
        }
    },

    // Renderizar lista de servicios
    async renderServicios() {
        const container = document.getElementById('serviciosListContainer');

        try {
            const servicios = await AdminManager.obtenerServicios();

            if (servicios.length === 0) {
                container.innerHTML = '<p style="color: #757575;">No hay servicios disponibles</p>';
                return;
            }

            container.innerHTML = '';

            servicios.forEach(servicio => {
                const item = document.createElement('div');
                item.className = 'service-item';
                item.style.display = 'flex';
                item.style.justifyContent = 'space-between';
                item.style.alignItems = 'center';
                item.style.padding = '1rem';
                item.style.background = '#f5f5f5';
                item.style.borderRadius = '8px';
                item.style.marginBottom = '0.75rem';

                item.innerHTML = `
                    <div>
                        <h4 style="margin: 0 0 0.5rem 0;">${servicio.nombre}</h4>
                        <p style="margin: 0; color: #757575; font-size: 0.9rem;">
                            Duración: ${servicio.duracion} min | Precio: $${servicio.precio.toLocaleString('es-AR')}
                        </p>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-primary btn-small" onclick="editarServicioUI('${servicio.id}')">Editar</button>
                        <button class="btn-danger btn-small" onclick="eliminarServicioUI('${servicio.id}')">Eliminar</button>
                    </div>
                `;

                container.appendChild(item);
            });
        } catch (error) {
            console.error('Error al cargar servicios:', error);
            container.innerHTML = '<p style="color: #f44336;">Error al cargar servicios</p>';
        }
    }
};

// Eliminar turno (admin)
async function eliminarTurnoAdmin(turnoId) {
    const result = await Utils.confirmar(
        '¿Eliminar Turno?',
        'Esta acción eliminará permanentemente el turno del cliente. El cliente no recibirá notificación.'
    );

    if (result.isConfirmed) {
        try {
            Utils.showLoading('Eliminando turno...');
            await AdminManager.cancelarTurno(turnoId);
            Utils.closeLoading();
            await Utils.showSuccess('Turno Eliminado', 'El turno ha sido eliminado correctamente');
            AdminUI.renderAgenda();
            AdminUI.renderEstadisticas();
        } catch (error) {
            Utils.closeLoading();
            Utils.showError('Error', error.message);
        }
    }
}

// Desbloquear fecha
async function desbloquearFechaUI(bloqueadoId) {
    const result = await Utils.confirmar(
        '¿Desbloquear Fecha?',
        'Esta fecha volverá a estar disponible para reservas.'
    );

    if (result.isConfirmed) {
        try {
            await AdminManager.desbloquearFecha(bloqueadoId);
            await Utils.showSuccess('Fecha Desbloqueada', 'La fecha está ahora disponible');
            AdminUI.renderFechasBloqueadas();
        } catch (error) {
            Utils.showError('Error', error.message);
        }
    }
}

// Editar servicio
async function editarServicioUI(servicioId) {
    const servicio = CONFIG.servicios.find(s => s.id === servicioId);

    const { value: formValues } = await Swal.fire({
        title: 'Editar Servicio',
        html: `
            <input id="swal-nombre" class="swal2-input" placeholder="Nombre" value="${servicio.nombre}">
            <input id="swal-duracion" type="number" class="swal2-input" placeholder="Duración (min)" value="${servicio.duracion}">
            <input id="swal-precio" type="number" class="swal2-input" placeholder="Precio" value="${servicio.precio}">
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            return {
                nombre: document.getElementById('swal-nombre').value,
                duracion: document.getElementById('swal-duracion').value,
                precio: document.getElementById('swal-precio').value
            };
        }
    });

    if (formValues) {
        if (!formValues.nombre || !formValues.duracion || !formValues.precio) {
            Utils.showError('Error', 'Todos los campos son obligatorios');
            return;
        }

        try {
            Utils.showLoading('Actualizando servicio...');
            await AdminManager.actualizarServicio(servicioId, formValues.nombre, formValues.duracion, formValues.precio);
            Utils.closeLoading();
            await Utils.showSuccess('Servicio Actualizado', 'El servicio ha sido actualizado correctamente');
            AdminUI.renderServicios();
        } catch (error) {
            Utils.closeLoading();
            Utils.showError('Error', error.message);
        }
    }
}

// Eliminar servicio
async function eliminarServicioUI(servicioId) {
    const result = await Utils.confirmar(
        '¿Eliminar Servicio?',
        'Esta acción eliminará el servicio. No se puede eliminar si hay turnos activos.'
    );

    if (result.isConfirmed) {
        try {
            Utils.showLoading('Eliminando servicio...');
            await AdminManager.eliminarServicio(servicioId);
            Utils.closeLoading();
            await Utils.showSuccess('Servicio Eliminado', 'El servicio ha sido eliminado correctamente');
            AdminUI.renderServicios();
        } catch (error) {
            Utils.closeLoading();
            Utils.showError('Error', error.message);
        }
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Verificar que estamos en admin.html
    if (!document.getElementById('turnosHoy')) return;

    // Mostrar nombre del admin
    auth.onAuthStateChanged((user) => {
        if (user && user.email === CONFIG.adminEmail) {
            const adminName = document.getElementById('adminNameNav');
            if (adminName) {
                adminName.textContent = 'Administrador';
            }

            // Inicializar UI
            AdminUI.renderEstadisticas();
            AdminUI.renderAgenda();
            AdminUI.renderFechasBloqueadas();
            AdminUI.renderEstadisticasServicios();

            // Poblar selector de años
            const yearSelect = document.getElementById('exportYear');
            const currentYear = new Date().getFullYear();
            for (let year = currentYear; year >= currentYear - 2; year--) {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                yearSelect.appendChild(option);
            }

            // Seleccionar mes actual
            document.getElementById('exportMonth').value = new Date().getMonth();
        }
    });

    // Tabs de administración
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;

            document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(tab + 'Tab').classList.add('active');

            // Cargar datos si es necesario
            if (tab === 'semana') {
                currentWeekStart = new Date();
                currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
                AdminUI.renderSemana();
            } else if (tab === 'servicios') {
                AdminUI.renderServicios();
            }
        });
    });

    // Navegación de agenda
    document.getElementById('prevDayBtn').addEventListener('click', () => {
        currentAgendaDate.setDate(currentAgendaDate.getDate() - 1);
        AdminUI.renderAgenda();
    });

    document.getElementById('todayBtn').addEventListener('click', () => {
        currentAgendaDate = new Date();
        AdminUI.renderAgenda();
    });

    document.getElementById('nextDayBtn').addEventListener('click', () => {
        currentAgendaDate.setDate(currentAgendaDate.getDate() + 1);
        AdminUI.renderAgenda();
    });

    // Navegación semanal
    document.getElementById('prevWeekBtn').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() - 7);
        AdminUI.renderSemana();
    });

    document.getElementById('thisWeekBtn').addEventListener('click', () => {
        currentWeekStart = new Date();
        currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
        AdminUI.renderSemana();
    });

    document.getElementById('nextWeekBtn').addEventListener('click', () => {
        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
        AdminUI.renderSemana();
    });

    // Búsqueda
    document.getElementById('searchBtn').addEventListener('click', async () => {
        const query = document.getElementById('searchInput').value.trim();
        const container = document.getElementById('searchResults');

        if (!query) {
            Utils.showError('Error', 'Ingresa un término de búsqueda');
            return;
        }

        container.innerHTML = '<div class="loading">Buscando...</div>';

        try {
            const turnos = await AdminManager.buscarTurnos(query);

            if (turnos.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #757575; padding: 2rem;">No se encontraron resultados</p>';
                return;
            }

            container.innerHTML = '';

            turnos.forEach(turno => {
                const servicio = Utils.getServicio(turno.servicio.id);
                const item = document.createElement('div');
                item.className = 'agenda-item';

                item.innerHTML = `
                    <div class="agenda-item-info">
                        <h4>${Utils.formatearFechaCorta(turno.fecha)} - ${turno.hora}</h4>
                        <p>${turno.usuarioNombre} (${turno.usuarioEmail})</p>
                        <p>${servicio.nombre} | $${servicio.precio.toLocaleString('es-AR')}</p>
                    </div>
                    <div class="turno-actions">
                        <button class="btn-danger btn-small" onclick="eliminarTurnoAdmin('${turno.id}')">Eliminar</button>
                    </div>
                `;

                container.appendChild(item);
            });
        } catch (error) {
            container.innerHTML = '<p style="text-align: center; color: #f44336;">Error en la búsqueda</p>';
            console.error('Error:', error);
        }
    });

    // Bloquear fecha
    document.getElementById('blockDateBtn').addEventListener('click', async () => {
        const dateInput = document.getElementById('blockDate').value;
        const reason = document.getElementById('blockReason').value;

        if (!dateInput) {
            Utils.showError('Error', 'Selecciona una fecha');
            return;
        }

        const fecha = new Date(dateInput + 'T00:00:00');

        try {
            await AdminManager.bloquearFecha(fecha, reason);
            await Utils.showSuccess('Fecha Bloqueada', 'La fecha ha sido bloqueada correctamente');
            document.getElementById('blockDate').value = '';
            document.getElementById('blockReason').value = '';
            AdminUI.renderFechasBloqueadas();
        } catch (error) {
            Utils.showError('Error', error.message);
        }
    });

    // Exportar CSV
    document.getElementById('exportBtn').addEventListener('click', async () => {
        const mes = parseInt(document.getElementById('exportMonth').value);
        const año = parseInt(document.getElementById('exportYear').value);

        try {
            Utils.showLoading('Generando archivo...');

            const turnos = await AdminManager.obtenerTurnosMes(mes, año);

            if (turnos.length === 0) {
                Utils.closeLoading();
                Utils.showError('Sin Datos', 'No hay turnos para el mes seleccionado');
                return;
            }

            const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const filename = `turnos_${meses[mes]}_${año}.csv`;

            Utils.descargarCSV(turnos, filename);
            Utils.closeLoading();
            Utils.showSuccess('Exportado', 'El archivo ha sido descargado');
        } catch (error) {
            Utils.closeLoading();
            Utils.showError('Error', error.message);
        }
    });

    // Crear servicio
    document.getElementById('createServiceBtn').addEventListener('click', async () => {
        const nombre = document.getElementById('serviceNombre').value.trim();
        const duracion = document.getElementById('serviceDuracion').value;
        const precio = document.getElementById('servicePrecio').value;

        if (!nombre || !duracion || !precio) {
            Utils.showError('Error', 'Todos los campos son obligatorios');
            return;
        }

        if (duracion < 15) {
            Utils.showError('Error', 'La duración mínima es 15 minutos');
            return;
        }

        if (precio < 0) {
            Utils.showError('Error', 'El precio debe ser mayor o igual a 0');
            return;
        }

        try {
            Utils.showLoading('Creando servicio...');
            await AdminManager.crearServicio(nombre, duracion, precio);
            Utils.closeLoading();
            await Utils.showSuccess('Servicio Creado', 'El servicio ha sido creado correctamente');

            // Limpiar formulario
            document.getElementById('serviceNombre').value = '';
            document.getElementById('serviceDuracion').value = '';
            document.getElementById('servicePrecio').value = '';

            AdminUI.renderServicios();
        } catch (error) {
            Utils.closeLoading();
            Utils.showError('Error', error.message);
        }
    });
});

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
        const turnosHoy = await db.collection('turnos')
            .where('fecha', '>=', firebase.firestore.Timestamp.fromDate(today))
            .where('fecha', '<', firebase.firestore.Timestamp.fromDate(new Date(today.getTime() + 24 * 60 * 60 * 1000)))
            .where('estado', '==', 'confirmado')
            .get();

        // Turnos semana
        const turnosSemana = await db.collection('turnos')
            .where('fecha', '>=', firebase.firestore.Timestamp.fromDate(startOfWeek))
            .where('estado', '==', 'confirmado')
            .get();

        // Turnos mes
        const turnosMes = await db.collection('turnos')
            .where('fecha', '>=', firebase.firestore.Timestamp.fromDate(startOfMonth))
            .where('estado', '==', 'confirmado')
            .get();

        // Total clientes
        const clientes = await db.collection('usuarios').get();

        return {
            turnosHoy: turnosHoy.size,
            turnosSemana: turnosSemana.size,
            turnosMes: turnosMes.size,
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
            .where('estado', '==', 'confirmado')
            .orderBy('fecha')
            .orderBy('hora')
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            fecha: doc.data().fecha.toDate()
        }));
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
            .where('estado', '==', 'confirmado')
            .orderBy('fecha')
            .orderBy('hora')
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            fecha: doc.data().fecha.toDate()
        }));
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
            .orderBy('fecha')
            .orderBy('hora')
            .get();

        return snapshot.docs.map(doc => {
            const data = doc.data();
            const servicio = Utils.getServicio(data.servicio.id);
            return {
                Fecha: Utils.formatearFechaCorta(data.fecha.toDate()),
                Hora: data.hora,
                Cliente: data.usuarioNombre,
                Email: data.usuarioEmail,
                Servicio: servicio.nombre,
                Precio: servicio.precio,
                Estado: data.estado
            };
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
                        <button class="btn-danger btn-small" onclick="cancelarTurnoAdmin('${turno.id}')">Cancelar</button>
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
    }
};

// Cancelar turno (admin)
async function cancelarTurnoAdmin(turnoId) {
    const result = await Utils.confirmar(
        '¿Cancelar Turno?',
        'Esta acción cancelará el turno del cliente.'
    );

    if (result.isConfirmed) {
        try {
            Utils.showLoading('Cancelando turno...');
            await AdminManager.cancelarTurno(turnoId);
            Utils.closeLoading();
            await Utils.showSuccess('Turno Cancelado', 'El turno ha sido cancelado');
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
                        <button class="btn-danger btn-small" onclick="cancelarTurnoAdmin('${turno.id}')">Cancelar</button>
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
});

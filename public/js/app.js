// Gestor de Turnos
class GestorTurnos {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
        this.servicioSeleccionado = null;
        this.fechaSeleccionada = null;
        this.horaSeleccionada = null;
        this.currentMonth = new Date();
    }

    // Obtener horarios disponibles para una fecha
    async obtenerHorariosDisponibles(fecha) {
        const cacheKey = fecha.toDateString();

        // Verificar cache
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.horarios;
            }
        }

        try {
            // Obtener turnos ocupados de Firebase
            const inicio = new Date(fecha);
            inicio.setHours(0, 0, 0, 0);
            const fin = new Date(fecha);
            fin.setHours(23, 59, 59, 999);

            const snapshot = await db.collection('turnos')
                .where('fecha', '>=', firebase.firestore.Timestamp.fromDate(inicio))
                .where('fecha', '<=', firebase.firestore.Timestamp.fromDate(fin))
                .get();

            // Filtrar solo los confirmados y obtener horas ocupadas
            const ocupados = new Set(
                snapshot.docs
                    .filter(doc => doc.data().estado === 'confirmado')
                    .map(doc => doc.data().hora)
            );

            // Generar horarios disponibles
            const horarios = [];
            for (let hora = CONFIG.horaApertura; hora < CONFIG.horaCierre; hora++) {
                for (let minuto = 0; minuto < 60; minuto += CONFIG.intervaloMinutos) {
                    const horaStr = `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`;
                    if (!ocupados.has(horaStr)) {
                        horarios.push(horaStr);
                    }
                }
            }

            // Guardar en cache
            this.cache.set(cacheKey, {
                horarios,
                timestamp: Date.now()
            });

            return horarios;
        } catch (error) {
            console.error('Error al obtener horarios:', error);
            // Si hay error, devolver horarios vacíos o todos los disponibles
            const horarios = [];
            for (let hora = CONFIG.horaApertura; hora < CONFIG.horaCierre; hora++) {
                for (let minuto = 0; minuto < 60; minuto += CONFIG.intervaloMinutos) {
                    const horaStr = `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`;
                    horarios.push(horaStr);
                }
            }
            return horarios;
        }
    }

    // Reservar turno
    async reservarTurno(fecha, hora, servicio) {
        const user = auth.currentUser;
        if (!user) throw new Error('Debes iniciar sesión');

        // Verificar límite de turnos
        const turnosActivosSnapshot = await db.collection('turnos')
            .where('usuarioId', '==', user.uid)
            .where('estado', '==', 'confirmado')
            .get();

        const ahora = firebase.firestore.Timestamp.fromDate(new Date());
        const turnosActivos = turnosActivosSnapshot.docs.filter(doc =>
            doc.data().fecha >= ahora
        );

        if (turnosActivos.length >= CONFIG.maxTurnosPorUsuario) {
            throw new Error(`Máximo ${CONFIG.maxTurnosPorUsuario} turnos activos permitidos`);
        }

        // Crear turno con verificación de disponibilidad
        const turnoRef = db.collection('turnos').doc();

        const fechaTimestamp = firebase.firestore.Timestamp.fromDate(fecha);

        // Verificar que no exista otro turno en ese horario
        const existentesSnapshot = await db.collection('turnos')
            .where('fecha', '==', fechaTimestamp)
            .where('hora', '==', hora)
            .get();

        const existentes = existentesSnapshot.docs.filter(doc =>
            doc.data().estado === 'confirmado'
        );

        if (existentes.length > 0) {
            throw new Error('Este horario ya fue reservado por otro usuario');
        }

        // Crear el turno
        await turnoRef.set({
            id: turnoRef.id,
            usuarioId: user.uid,
            usuarioNombre: user.displayName || 'Usuario',
            usuarioEmail: user.email,
            fecha: fechaTimestamp,
            hora: hora,
            servicio: servicio,
            estado: 'confirmado',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Actualizar contador de turnos del usuario
        await db.collection('usuarios').doc(user.uid).update({
            turnosReservados: firebase.firestore.FieldValue.increment(1)
        });

        // Limpiar cache
        this.cache.clear();

        return turnoRef.id;
    }

    // Cancelar turno
    async cancelarTurno(turnoId) {
        const user = auth.currentUser;
        if (!user) throw new Error('Debes iniciar sesión');

        const turnoRef = db.collection('turnos').doc(turnoId);
        const turno = await turnoRef.get();

        if (!turno.exists) {
            throw new Error('Turno no encontrado');
        }

        if (turno.data().usuarioId !== user.uid) {
            throw new Error('No puedes cancelar este turno');
        }

        // Verificar que sea con 2 horas de anticipación
        const fechaTurno = turno.data().fecha.toDate();
        const [hora, minuto] = turno.data().hora.split(':');
        fechaTurno.setHours(parseInt(hora), parseInt(minuto), 0, 0);

        const ahora = new Date();
        const horasAnticipacion = (fechaTurno - ahora) / (1000 * 60 * 60);

        if (horasAnticipacion < 2) {
            throw new Error('Debes cancelar con al menos 2 horas de anticipación');
        }

        await turnoRef.update({
            estado: 'cancelado',
            canceladoAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Limpiar cache
        this.cache.clear();
    }

    // Obtener turnos del usuario actual
    async obtenerMisTurnos() {
        const user = auth.currentUser;
        if (!user) return [];

        try {
            const snapshot = await db.collection('turnos')
                .where('usuarioId', '==', user.uid)
                .where('estado', '==', 'confirmado')
                .get();

            const ahora = firebase.firestore.Timestamp.fromDate(new Date());

            // Filtrar, ordenar y limitar en JavaScript
            return snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    fecha: doc.data().fecha.toDate()
                }))
                .filter(turno => turno.fecha >= ahora.toDate())
                .sort((a, b) => {
                    // Ordenar por fecha
                    const fechaDiff = a.fecha - b.fecha;
                    if (fechaDiff !== 0) return fechaDiff;
                    // Si la fecha es igual, ordenar por hora
                    return a.hora.localeCompare(b.hora);
                })
                .slice(0, 10);
        } catch (error) {
            console.error('Error al obtener turnos:', error);
            return [];
        }
    }
}

// Inicializar gestor
const gestorTurnos = new GestorTurnos();

// UI Manager
const UI = {
    // Renderizar servicios
    renderServicios() {
        const container = document.getElementById('serviciosContainer');
        container.innerHTML = '';

        CONFIG.servicios.forEach(servicio => {
            const card = document.createElement('div');
            card.className = 'servicio-card';
            card.innerHTML = `
                <h4>${servicio.nombre}</h4>
                <p class="duracion">${servicio.duracion} minutos</p>
                <p class="precio">$${servicio.precio.toLocaleString('es-AR')}</p>
            `;

            card.addEventListener('click', () => {
                document.querySelectorAll('.servicio-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                gestorTurnos.servicioSeleccionado = servicio;
            });

            container.appendChild(card);
        });
    },

    // Renderizar calendario
    renderCalendario() {
        const container = document.getElementById('calendarContainer');
        const currentMonthEl = document.getElementById('currentMonth');

        const year = gestorTurnos.currentMonth.getFullYear();
        const month = gestorTurnos.currentMonth.getMonth();

        currentMonthEl.textContent = gestorTurnos.currentMonth.toLocaleDateString('es-AR', {
            month: 'long',
            year: 'numeric'
        });

        container.innerHTML = '';

        // Headers de días
        const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        dias.forEach(dia => {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day header';
            dayEl.textContent = dia;
            container.appendChild(dayEl);
        });

        // Primer día del mes
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startingDayOfWeek = firstDay.getDay();

        // Días del mes anterior
        for (let i = 0; i < startingDayOfWeek; i++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day other-month';
            container.appendChild(dayEl);
        }

        // Días del mes actual
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() + CONFIG.diasAnticipacion);

        for (let day = 1; day <= lastDay.getDate(); day++) {
            const fecha = new Date(year, month, day);
            fecha.setHours(0, 0, 0, 0); // Normalizar la hora para comparación exacta

            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            dayEl.textContent = day;

            // Verificar si es día laboral
            const esLaboral = Utils.esDiaLaboral(fecha);

            // Verificar si está en el rango permitido (desde hoy hasta maxDate)
            const enRango = fecha >= today && fecha <= maxDate;

            // Marcar días pasados
            if (fecha < today) {
                dayEl.classList.add('no-laboral');
            } else if (!esLaboral) {
                dayEl.classList.add('no-laboral');
            } else if (!enRango) {
                dayEl.classList.add('no-laboral');
            } else {
                dayEl.classList.add('disponible');
                dayEl.addEventListener('click', async () => {
                    if (!gestorTurnos.servicioSeleccionado) {
                        Utils.showError('Error', 'Primero selecciona un servicio');
                        return;
                    }

                    document.querySelectorAll('.calendar-day.disponible').forEach(d => d.classList.remove('selected'));
                    dayEl.classList.add('selected');
                    gestorTurnos.fechaSeleccionada = fecha;
                    await UI.mostrarHorarios(fecha);
                });
            }

            container.appendChild(dayEl);
        }
    },

    // Mostrar horarios disponibles
    async mostrarHorarios(fecha) {
        const section = document.getElementById('horariosSection');
        const container = document.getElementById('horariosContainer');
        const fechaEl = document.getElementById('fechaSeleccionada');

        fechaEl.textContent = Utils.formatearFecha(fecha);
        container.innerHTML = '<div class="loading">Cargando horarios...</div>';
        section.style.display = 'block';

        try {
            const horarios = await gestorTurnos.obtenerHorariosDisponibles(fecha);

            container.innerHTML = '';

            if (horarios.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #757575;">No hay horarios disponibles para esta fecha</p>';
                return;
            }

            horarios.forEach(hora => {
                const btn = document.createElement('button');
                btn.className = 'horario-btn';
                btn.textContent = hora;

                btn.addEventListener('click', () => {
                    document.querySelectorAll('.horario-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    gestorTurnos.horaSeleccionada = hora;
                    UI.mostrarConfirmacion();
                });

                container.appendChild(btn);
            });
        } catch (error) {
            container.innerHTML = '<p style="text-align: center; color: #f44336;">Error al cargar horarios</p>';
            console.error('Error:', error);
        }
    },

    // Mostrar confirmación
    mostrarConfirmacion() {
        const section = document.getElementById('confirmacionSection');
        const servicio = gestorTurnos.servicioSeleccionado;
        const fecha = gestorTurnos.fechaSeleccionada;
        const hora = gestorTurnos.horaSeleccionada;

        document.getElementById('confirmServicio').textContent = servicio.nombre;
        document.getElementById('confirmFecha').textContent = Utils.formatearFecha(fecha);
        document.getElementById('confirmHora').textContent = hora;
        document.getElementById('confirmDuracion').textContent = servicio.duracion;
        document.getElementById('confirmPrecio').textContent = servicio.precio.toLocaleString('es-AR');

        section.style.display = 'block';
        section.scrollIntoView({ behavior: 'smooth' });
    },

    // Renderizar mis turnos
    async renderMisTurnos() {
        const container = document.getElementById('misTurnosContainer');
        container.innerHTML = '<div class="loading">Cargando tus turnos...</div>';

        try {
            const turnos = await gestorTurnos.obtenerMisTurnos();

            if (turnos.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #757575;">No tienes turnos activos</p>';
                return;
            }

            container.innerHTML = '';

            turnos.forEach(turno => {
                const servicio = Utils.getServicio(turno.servicio.id);
                const card = document.createElement('div');
                card.className = 'turno-card';

                const fechaHora = new Date(turno.fecha);
                const [hora, minuto] = turno.hora.split(':');
                fechaHora.setHours(parseInt(hora), parseInt(minuto));

                card.innerHTML = `
                    <div class="turno-info">
                        <h4>${servicio.nombre}</h4>
                        <p>📅 ${Utils.formatearFecha(turno.fecha)}</p>
                        <p>🕐 ${turno.hora} hs</p>
                        <p>💰 $${servicio.precio.toLocaleString('es-AR')}</p>
                    </div>
                    <div class="turno-actions">
                        <button class="btn-danger btn-small" onclick="cancelarTurnoUI('${turno.id}')">Cancelar</button>
                    </div>
                `;

                container.appendChild(card);
            });
        } catch (error) {
            container.innerHTML = '<p style="text-align: center; color: #f44336;">Error al cargar turnos</p>';
            console.error('Error:', error);
        }
    }
};

// Cancelar turno desde UI
async function cancelarTurnoUI(turnoId) {
    const result = await Utils.confirmar(
        '¿Cancelar Turno?',
        'Esta acción no se puede deshacer. Recuerda que debes cancelar con al menos 2 horas de anticipación.'
    );

    if (result.isConfirmed) {
        try {
            Utils.showLoading('Cancelando turno...');
            await gestorTurnos.cancelarTurno(turnoId);
            Utils.closeLoading();
            await Utils.showSuccess('¡Turno Cancelado!', 'Tu turno ha sido cancelado correctamente');
            UI.renderMisTurnos();
            UI.renderCalendario();
        } catch (error) {
            Utils.closeLoading();
            Utils.showError('Error', error.message);
        }
    }
}

// Cargar servicios desde Firestore
async function cargarServiciosDesdeFirestore() {
    try {
        const snapshot = await db.collection('servicios')
            .where('activo', '==', true)
            .get();

        if (!snapshot.empty) {
            const servicios = snapshot.docs.map(doc => doc.data());
            CONFIG.servicios = servicios.sort((a, b) => a.precio - b.precio);
            window.CONFIG = CONFIG;
        }
    } catch (error) {
        console.error('Error al cargar servicios:', error);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Verificar que estamos en index.html
    if (!document.getElementById('serviciosContainer')) return;

    // Mostrar nombre del usuario
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            const userName = document.getElementById('userNameNav');
            if (userName) {
                userName.textContent = user.displayName || user.email;
            }

            // Cargar servicios desde Firestore
            await cargarServiciosDesdeFirestore();

            // Inicializar UI
            UI.renderServicios();
            UI.renderCalendario();
            UI.renderMisTurnos();
        }
    });

    // Navegación del calendario
    document.getElementById('prevMonthBtn').addEventListener('click', () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const prevMonth = new Date(gestorTurnos.currentMonth);
        prevMonth.setMonth(prevMonth.getMonth() - 1);

        // Obtener el primer día del mes anterior
        const firstDayOfPrevMonth = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);

        // Permitir retroceder solo si el mes anterior no es completamente pasado
        const firstDayOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        if (firstDayOfPrevMonth >= firstDayOfCurrentMonth) {
            gestorTurnos.currentMonth = prevMonth;
            UI.renderCalendario();
        }
    });

    document.getElementById('nextMonthBtn').addEventListener('click', () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() + CONFIG.diasAnticipacion);

        const nextMonth = new Date(gestorTurnos.currentMonth);
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        // Obtener el primer día del mes siguiente
        const firstDayOfNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);

        // Permitir navegación si el primer día del mes está dentro del rango
        if (firstDayOfNextMonth <= maxDate) {
            gestorTurnos.currentMonth = nextMonth;
            UI.renderCalendario();
        }
    });

    // Confirmar reserva
    document.getElementById('confirmarReservaBtn').addEventListener('click', async () => {
        if (!gestorTurnos.servicioSeleccionado || !gestorTurnos.fechaSeleccionada || !gestorTurnos.horaSeleccionada) {
            Utils.showError('Error', 'Por favor completa todos los pasos');
            return;
        }

        try {
            Utils.showLoading('Reservando turno...');

            await gestorTurnos.reservarTurno(
                gestorTurnos.fechaSeleccionada,
                gestorTurnos.horaSeleccionada,
                gestorTurnos.servicioSeleccionado
            );

            Utils.closeLoading();
            await Utils.showSuccess('¡Turno Reservado!', 'Tu turno ha sido confirmado. Te esperamos!');

            // Limpiar selección
            gestorTurnos.servicioSeleccionado = null;
            gestorTurnos.fechaSeleccionada = null;
            gestorTurnos.horaSeleccionada = null;

            document.getElementById('confirmacionSection').style.display = 'none';
            document.getElementById('horariosSection').style.display = 'none';

            // Actualizar UI
            UI.renderMisTurnos();
            UI.renderCalendario();
            document.querySelectorAll('.servicio-card').forEach(c => c.classList.remove('selected'));
            document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));

            // Scroll al inicio
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            Utils.closeLoading();
            Utils.showError('Error', error.message);
        }
    });

    // Cancelar reserva
    document.getElementById('cancelarReservaBtn').addEventListener('click', () => {
        gestorTurnos.horaSeleccionada = null;
        document.getElementById('confirmacionSection').style.display = 'none';
        document.querySelectorAll('.horario-btn').forEach(b => b.classList.remove('selected'));
    });
});

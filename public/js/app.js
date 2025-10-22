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

    // V2: Obtener cantidad de turnos por día del mes para badges
    async obtenerTurnosPorDiaDelMes(year, month) {
        const cacheKey = `turnos_mes_${year}_${month}`;

        // Verificar cache
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const inicio = new Date(year, month, 1);
            inicio.setHours(0, 0, 0, 0);
            const fin = new Date(year, month + 1, 0);
            fin.setHours(23, 59, 59, 999);

            const snapshot = await db.collection('turnos')
                .where('fecha', '>=', firebase.firestore.Timestamp.fromDate(inicio))
                .where('fecha', '<=', firebase.firestore.Timestamp.fromDate(fin))
                .where('estado', '==', 'confirmado')
                .get();

            // Contar turnos por día
            const turnosPorDia = {};
            snapshot.docs.forEach(doc => {
                const turno = doc.data();
                const fecha = turno.fecha.toDate();
                const dia = fecha.getDate();
                turnosPorDia[dia] = (turnosPorDia[dia] || 0) + 1;
            });

            // Guardar en cache
            this.cache.set(cacheKey, {
                data: turnosPorDia,
                timestamp: Date.now()
            });

            return turnosPorDia;
        } catch (error) {
            console.error('Error al obtener turnos del mes:', error);
            return {};
        }
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

    // Reservar turno con transacción atómica (FIX BUG-001)
    async reservarTurno(fecha, hora, servicio) {
        const user = auth.currentUser;
        if (!user) throw new Error('Debes iniciar sesión');

        const fechaTimestamp = firebase.firestore.Timestamp.fromDate(fecha);

        // Verificar límite de turnos ANTES de la transacción (optimización)
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

        // TRANSACCIÓN ATÓMICA para prevenir doble reserva
        let turnoId;
        try {
            turnoId = await db.runTransaction(async (transaction) => {
                // 1. Verificar disponibilidad DENTRO de la transacción
                const querySnapshot = await transaction.get(
                    db.collection('turnos')
                        .where('fecha', '==', fechaTimestamp)
                        .where('hora', '==', hora)
                        .where('estado', '==', 'confirmado')
                );

                // 2. Si ya existe un turno confirmado en ese horario, abortar
                if (!querySnapshot.empty) {
                    throw new Error('HORARIO_NO_DISPONIBLE');
                }

                // 3. Crear el turno de forma atómica
                const turnoRef = db.collection('turnos').doc();
                transaction.set(turnoRef, {
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

                // 4. Actualizar contador de turnos del usuario
                const userRef = db.collection('usuarios').doc(user.uid);
                transaction.update(userRef, {
                    turnosReservados: firebase.firestore.FieldValue.increment(1)
                });

                return turnoRef.id;
            });

            // Limpiar cache tras éxito
            this.cache.clear();
            return turnoId;

        } catch (error) {
            // Manejo específico del error de horario no disponible
            if (error.message === 'HORARIO_NO_DISPONIBLE') {
                throw new Error('Este horario acaba de ser reservado por otro usuario. Por favor selecciona otro horario.');
            }
            // Re-lanzar otros errores
            throw error;
        }
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

        // Verificar que sea con 1 hora de anticipación (V2: cambiado de 2 a 1 hora)
        const fechaTurno = turno.data().fecha.toDate();
        const [hora, minuto] = turno.data().hora.split(':');
        fechaTurno.setHours(parseInt(hora), parseInt(minuto), 0, 0);

        const ahora = new Date();
        const horasAnticipacion = (fechaTurno - ahora) / (1000 * 60 * 60);

        if (horasAnticipacion < 1) {
            throw new Error('No puedes cancelar este turno. Los turnos solo pueden cancelarse con al menos 1 hora de anticipación. Para cancelaciones de último momento, contacta a la peluquería.');
        }

        await turnoRef.update({
            estado: 'cancelado',
            canceladoAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // V2: Notificar lista de espera para este horario
        await notificarListaEsperaCuandoCancelan(fechaTurno, turno.data().hora);

        // Limpiar cache
        this.cache.clear();
    }

    // Modificar turno (V2 - Nueva funcionalidad)
    async modificarTurno(turnoId, nuevaFecha, nuevaHora) {
        const user = auth.currentUser;
        if (!user) throw new Error('Debes iniciar sesión');

        const turnoRef = db.collection('turnos').doc(turnoId);
        const turno = await turnoRef.get();

        if (!turno.exists) {
            throw new Error('Turno no encontrado');
        }

        const turnoData = turno.data();

        if (turnoData.usuarioId !== user.uid) {
            throw new Error('No puedes modificar este turno');
        }

        if (turnoData.estado !== 'confirmado') {
            throw new Error('Solo puedes modificar turnos confirmados');
        }

        // Verificar límite de modificaciones (máximo 2)
        const modificacionesCount = turnoData.modificationsCount || 0;
        if (modificacionesCount >= 2) {
            throw new Error('Has alcanzado el límite de modificaciones para este turno (máximo 2)');
        }

        // Verificar que sea con al menos 2 horas de anticipación
        const fechaTurno = turnoData.fecha.toDate();
        const [hora, minuto] = turnoData.hora.split(':');
        fechaTurno.setHours(parseInt(hora), parseInt(minuto), 0, 0);

        const ahora = new Date();
        const horasAnticipacion = (fechaTurno - ahora) / (1000 * 60 * 60);

        if (horasAnticipacion < 2) {
            throw new Error('Solo puedes modificar turnos con al menos 2 horas de anticipación');
        }

        // Verificar que la nueva fecha sea futura
        const nuevaFechaTimestamp = firebase.firestore.Timestamp.fromDate(nuevaFecha);
        if (nuevaFecha < new Date()) {
            throw new Error('La nueva fecha debe ser futura');
        }

        // Usar transacción para verificar disponibilidad del nuevo horario
        try {
            await db.runTransaction(async (transaction) => {
                // Verificar que el nuevo horario esté disponible
                const querySnapshot = await transaction.get(
                    db.collection('turnos')
                        .where('fecha', '==', nuevaFechaTimestamp)
                        .where('hora', '==', nuevaHora)
                        .where('estado', '==', 'confirmado')
                );

                // Filtrar para excluir el turno actual (permite modificar sin conflicto consigo mismo)
                const conflictos = querySnapshot.docs.filter(doc => doc.id !== turnoId);

                if (conflictos.length > 0) {
                    throw new Error('HORARIO_NO_DISPONIBLE');
                }

                // Guardar datos anteriores para el historial
                const datosAnteriores = {
                    previousDate: turnoData.fecha,
                    previousTime: turnoData.hora,
                    modifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    modificationsCount: modificacionesCount + 1
                };

                // Actualizar el turno
                transaction.update(turnoRef, {
                    fecha: nuevaFechaTimestamp,
                    hora: nuevaHora,
                    ...datosAnteriores
                });
            });

            // Limpiar cache tras éxito
            this.cache.clear();

        } catch (error) {
            if (error.message === 'HORARIO_NO_DISPONIBLE') {
                throw new Error('El nuevo horario no está disponible. Por favor selecciona otro.');
            }
            throw error;
        }
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
                Utils.toastSuccess(`✂️ ${servicio.nombre} seleccionado`, 2000);
            });

            container.appendChild(card);
        });
    },

    // Renderizar calendario (V2 - Mejorado con badges)
    async renderCalendario() {
        const container = document.getElementById('calendarContainer');
        const currentMonthEl = document.getElementById('currentMonth');

        const year = gestorTurnos.currentMonth.getFullYear();
        const month = gestorTurnos.currentMonth.getMonth();

        currentMonthEl.textContent = gestorTurnos.currentMonth.toLocaleDateString('es-AR', {
            month: 'long',
            year: 'numeric'
        });

        container.innerHTML = '';

        // V2: Obtener cantidad de turnos por día del mes para badges
        const turnosPorDia = await gestorTurnos.obtenerTurnosPorDiaDelMes(year, month);

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

            // V2: Agregar badge con cantidad de turnos
            const cantidadTurnos = turnosPorDia[day] || 0;
            if (cantidadTurnos > 0) {
                const badgeClass = cantidadTurnos <= 2 ? 'turnos-bajo' : cantidadTurnos <= 4 ? 'turnos-medio' : 'turnos-alto';
                dayEl.innerHTML = `
                    <span class="day-number">${day}</span>
                    <span class="turnos-badge ${badgeClass}">${cantidadTurnos}</span>
                `;
            } else {
                dayEl.textContent = day;
            }

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
                    Utils.toastInfo(`📅 ${Utils.formatearFechaCorta(fecha)} - Cargando horarios...`, 2000);
                    await UI.mostrarHorarios(fecha);
                });
            }

            container.appendChild(dayEl);
        }

        // BUG-005 FIX: Deshabilitar botones de navegación cuando se alcanza el límite
        const prevBtn = document.getElementById('prevMonthBtn');
        const nextBtn = document.getElementById('nextMonthBtn');

        if (prevBtn && nextBtn) {
            // Verificar si podemos ir al mes anterior
            const prevMonth = new Date(gestorTurnos.currentMonth);
            prevMonth.setMonth(prevMonth.getMonth() - 1);
            const firstDayOfPrevMonth = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
            const firstDayOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

            if (firstDayOfPrevMonth < firstDayOfCurrentMonth) {
                prevBtn.disabled = true;
                prevBtn.style.opacity = '0.5';
                prevBtn.style.cursor = 'not-allowed';
            } else {
                prevBtn.disabled = false;
                prevBtn.style.opacity = '1';
                prevBtn.style.cursor = 'pointer';
            }

            // Verificar si podemos ir al mes siguiente
            const nextMonth = new Date(gestorTurnos.currentMonth);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            const firstDayOfNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);

            if (firstDayOfNextMonth > maxDate) {
                nextBtn.disabled = true;
                nextBtn.style.opacity = '0.5';
                nextBtn.style.cursor = 'not-allowed';
            } else {
                nextBtn.disabled = false;
                nextBtn.style.opacity = '1';
                nextBtn.style.cursor = 'pointer';
            }
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

            // V2: Horarios sugeridos inteligentes
            const sugeridos = [];

            // Primer horario disponible
            if (horarios.length > 0) {
                sugeridos.push({ hora: horarios[0], tipo: 'Primer horario' });
            }

            // Horario cerca del mediodía (12:00-14:00)
            const medioDia = horarios.find(h => {
                const [hora] = h.split(':').map(Number);
                return hora >= 12 && hora <= 14;
            });
            if (medioDia && !sugeridos.find(s => s.hora === medioDia)) {
                sugeridos.push({ hora: medioDia, tipo: 'Mediodía' });
            }

            // Último horario disponible
            if (horarios.length > 1 && !sugeridos.find(s => s.hora === horarios[horarios.length - 1])) {
                sugeridos.push({ hora: horarios[horarios.length - 1], tipo: 'Último horario' });
            }

            // Mostrar horarios sugeridos
            if (sugeridos.length > 0) {
                const sugeridosSection = document.createElement('div');
                sugeridosSection.className = 'horarios-sugeridos';
                sugeridosSection.innerHTML = '<h4 style="margin: 0 0 1rem 0; color: var(--primary-color);">⭐ Horarios Sugeridos</h4>';

                sugeridos.forEach(({ hora, tipo }) => {
                    const btn = document.createElement('button');
                    btn.className = 'horario-btn horario-sugerido';
                    btn.innerHTML = `
                        <span class="hora-principal">${hora}</span>
                        <span class="hora-tipo">${tipo}</span>
                    `;

                    btn.addEventListener('click', () => {
                        document.querySelectorAll('.horario-btn').forEach(b => b.classList.remove('selected'));
                        btn.classList.add('selected');
                        gestorTurnos.horaSeleccionada = hora;
                        Utils.toastSuccess(`🕐 Horario ${hora} seleccionado`, 2000);
                        UI.mostrarConfirmacion();
                    });

                    sugeridosSection.appendChild(btn);
                });

                container.appendChild(sugeridosSection);
            }

            // Sección "Ver todos los horarios"
            const todosSection = document.createElement('div');
            todosSection.className = 'todos-horarios';
            todosSection.style.marginTop = '1.5rem';

            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'btn-secondary';
            toggleBtn.textContent = `Ver todos los horarios (${horarios.length})`;
            toggleBtn.style.width = '100%';

            const horariosGrid = document.createElement('div');
            horariosGrid.className = 'horarios-grid';
            horariosGrid.style.display = 'none';
            horariosGrid.style.marginTop = '1rem';

            toggleBtn.addEventListener('click', () => {
                const isVisible = horariosGrid.style.display !== 'none';
                horariosGrid.style.display = isVisible ? 'none' : 'grid';
                toggleBtn.textContent = isVisible ? `Ver todos los horarios (${horarios.length})` : 'Ocultar horarios';
            });

            horarios.forEach(hora => {
                const btn = document.createElement('button');
                btn.className = 'horario-btn';
                btn.textContent = hora;

                btn.addEventListener('click', () => {
                    document.querySelectorAll('.horario-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    gestorTurnos.horaSeleccionada = hora;
                    Utils.toastSuccess(`🕐 Horario ${hora} seleccionado`, 2000);
                    UI.mostrarConfirmacion();
                });

                horariosGrid.appendChild(btn);
            });

            todosSection.appendChild(toggleBtn);
            todosSection.appendChild(horariosGrid);
            container.appendChild(todosSection);
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

                // Información de modificaciones
                const modificaciones = turno.modificationsCount || 0;
                const modificacionesInfo = modificaciones > 0
                    ? `<p style="font-size: 0.85rem; color: #757575;">Modificado ${modificaciones} ${modificaciones === 1 ? 'vez' : 'veces'}</p>`
                    : '';

                card.innerHTML = `
                    <div class="turno-info">
                        <h4>${servicio.nombre}</h4>
                        <p>📅 ${Utils.formatearFecha(turno.fecha)}</p>
                        <p>🕐 ${turno.hora} hs</p>
                        <p>💰 $${servicio.precio.toLocaleString('es-AR')}</p>
                        ${modificacionesInfo}
                    </div>
                    <div class="turno-actions">
                        <button class="btn-primary btn-small" onclick="abrirModalModificar('${turno.id}', '${servicio.id}')">📝 Modificar</button>
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
        'Esta acción no se puede deshacer. Recuerda que debes cancelar con al menos 1 hora de anticipación.'
    );

    if (result.isConfirmed) {
        try {
            Utils.showLoading('Cancelando turno...');
            await gestorTurnos.cancelarTurno(turnoId);
            Utils.closeLoading();
            await Utils.showSuccess('¡Turno Cancelado!', 'Tu turno ha sido cancelado correctamente');
            UI.renderMisTurnos();
            await UI.renderCalendario();
        } catch (error) {
            Utils.closeLoading();
            Utils.showError('Error', error.message);
        }
    }
}

// Modificar turno desde UI (V2 - Nueva funcionalidad)
async function abrirModalModificar(turnoId, servicioId) {
    try {
        // Obtener datos del turno actual
        const turnoRef = db.collection('turnos').doc(turnoId);
        const turnoDoc = await turnoRef.get();

        if (!turnoDoc.exists) {
            Utils.showError('Error', 'Turno no encontrado');
            return;
        }

        const turnoData = turnoDoc.data();
        const servicio = Utils.getServicio(servicioId);
        const fechaActual = turnoData.fecha.toDate();
        const horaActual = turnoData.hora;

        // Verificar límite de modificaciones
        const modificaciones = turnoData.modificationsCount || 0;
        if (modificaciones >= 2) {
            Utils.showError('Límite alcanzado', 'Has alcanzado el límite de modificaciones para este turno (máximo 2)');
            return;
        }

        // Paso 1: Seleccionar nueva fecha
        const minDate = new Date();
        minDate.setDate(minDate.getDate() + 1); // Mínimo mañana
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + CONFIG.diasAnticipacion);

        const { value: nuevaFechaStr } = await Swal.fire({
            title: 'Modificar Turno - Paso 1/2',
            html: `
                <div style="text-align: left; margin-bottom: 1rem;">
                    <p><strong>Turno actual:</strong></p>
                    <p>📅 ${Utils.formatearFecha(fechaActual)}</p>
                    <p>🕐 ${horaActual} hs</p>
                    <p style="color: #757575; font-size: 0.9rem;">Modificaciones realizadas: ${modificaciones}/2</p>
                </div>
                <label for="nueva-fecha" style="display: block; text-align: left; margin-bottom: 0.5rem;">
                    <strong>Selecciona la nueva fecha:</strong>
                </label>
                <input
                    type="date"
                    id="nueva-fecha"
                    class="swal2-input"
                    min="${minDate.toISOString().split('T')[0]}"
                    max="${maxDate.toISOString().split('T')[0]}"
                    style="width: 80%; font-size: 1rem;"
                >
            `,
            showCancelButton: true,
            confirmButtonText: 'Siguiente →',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#2196f3',
            preConfirm: () => {
                const fechaInput = document.getElementById('nueva-fecha').value;
                if (!fechaInput) {
                    Swal.showValidationMessage('Debes seleccionar una fecha');
                    return false;
                }
                return fechaInput;
            }
        });

        if (!nuevaFechaStr) return; // Usuario canceló

        // Parsear fecha seleccionada
        const [año, mes, dia] = nuevaFechaStr.split('-').map(Number);
        const nuevaFecha = new Date(año, mes - 1, dia);

        // Verificar que sea día laboral
        if (!Utils.esDiaLaboral(nuevaFecha)) {
            Utils.showError('Día no disponible', 'La peluquería no abre ese día');
            return;
        }

        // Paso 2: Obtener horarios disponibles y seleccionar hora
        Utils.showLoading('Cargando horarios disponibles...');
        const horariosDisponibles = await gestorTurnos.obtenerHorariosDisponibles(nuevaFecha);
        Utils.closeLoading();

        if (horariosDisponibles.length === 0) {
            Utils.showError('Sin horarios', 'No hay horarios disponibles para esa fecha');
            return;
        }

        // Crear opciones de horarios
        const horariosOptions = horariosDisponibles.map(hora =>
            `<option value="${hora}">${hora} hs</option>`
        ).join('');

        const { value: nuevaHora } = await Swal.fire({
            title: 'Modificar Turno - Paso 2/2',
            html: `
                <div style="text-align: left; margin-bottom: 1rem;">
                    <p><strong>Nueva fecha seleccionada:</strong></p>
                    <p>📅 ${Utils.formatearFecha(nuevaFecha)}</p>
                </div>
                <label for="nueva-hora" style="display: block; text-align: left; margin-bottom: 0.5rem;">
                    <strong>Selecciona el nuevo horario:</strong>
                </label>
                <select id="nueva-hora" class="swal2-input" style="width: 80%; font-size: 1rem;">
                    <option value="">-- Selecciona un horario --</option>
                    ${horariosOptions}
                </select>
                <div style="margin-top: 1rem; padding: 0.75rem; background-color: #fff3cd; border-radius: 6px; text-align: left;">
                    <p style="margin: 0; color: #856404; font-size: 0.9rem;">
                        ⚠️ Recuerda que solo puedes modificar con al menos 2 horas de anticipación.
                    </p>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Confirmar Cambio',
            cancelButtonText: 'Volver',
            confirmButtonColor: '#2196f3',
            preConfirm: () => {
                const horaInput = document.getElementById('nueva-hora').value;
                if (!horaInput) {
                    Swal.showValidationMessage('Debes seleccionar un horario');
                    return false;
                }
                return horaInput;
            }
        });

        if (!nuevaHora) return; // Usuario canceló

        // Confirmar modificación
        try {
            Utils.showLoading('Modificando turno...');
            await gestorTurnos.modificarTurno(turnoId, nuevaFecha, nuevaHora);
            Utils.closeLoading();

            await Utils.showSuccess(
                '¡Turno Modificado!',
                `Tu turno ha sido modificado exitosamente.<br><br>
                <strong>Nueva fecha:</strong> ${Utils.formatearFecha(nuevaFecha)}<br>
                <strong>Nueva hora:</strong> ${nuevaHora} hs`
            );

            // Actualizar UI
            await UI.renderMisTurnos();
            await UI.renderCalendario();

        } catch (error) {
            Utils.closeLoading();
            Utils.showError('Error al modificar', error.message);
        }

    } catch (error) {
        console.error('Error al abrir modal de modificación:', error);
        Utils.showError('Error', 'Ocurrió un error al cargar el formulario de modificación');
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

// ========================================
// HISTORIAL DE TURNOS (V2)
// ========================================

// Obtener historial de turnos con filtros
async function obtenerHistorialTurnos(filters = { status: 'all', period: 'all' }) {
    const user = auth.currentUser;
    if (!user) return [];

    try {
        const ahora = firebase.firestore.Timestamp.fromDate(new Date());

        // Construir query base
        let query = db.collection('turnos')
            .where('usuarioId', '==', user.uid);

        // Aplicar filtro de período
        if (filters.period !== 'all') {
            const fechaInicio = new Date();
            if (filters.period === 'month') {
                fechaInicio.setMonth(fechaInicio.getMonth() - 1);
            } else if (filters.period === '3months') {
                fechaInicio.setMonth(fechaInicio.getMonth() - 3);
            }
            const timestampInicio = firebase.firestore.Timestamp.fromDate(fechaInicio);
            query = query.where('fecha', '>=', timestampInicio);
        }

        const snapshot = await query.get();

        // Filtrar en JavaScript para excluir turnos activos y aplicar filtro de estado
        return snapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data(),
                fecha: doc.data().fecha.toDate()
            }))
            .filter(turno => {
                // Excluir turnos confirmados en el futuro (esos son "activos")
                if (turno.estado === 'confirmado' && turno.fecha >= ahora.toDate()) {
                    return false;
                }

                // Aplicar filtro de estado
                if (filters.status !== 'all' && turno.estado !== filters.status) {
                    return false;
                }

                return true;
            })
            .sort((a, b) => b.fecha - a.fecha); // Ordenar por fecha descendente

    } catch (error) {
        console.error('Error al obtener historial:', error);
        return [];
    }
}

// Cargar y renderizar historial
async function cargarHistorial() {
    const historialList = document.getElementById('historialList');
    const historialStats = document.getElementById('historialStats');

    // Obtener filtros actuales
    const statusFilter = document.getElementById('statusFilter').value;
    const periodFilter = document.getElementById('periodFilter').value;

    // Mostrar loading
    historialList.innerHTML = '<div class="loading">Cargando historial...</div>';
    historialStats.innerHTML = '';

    try {
        // Obtener turnos
        const turnos = await obtenerHistorialTurnos({
            status: statusFilter,
            period: periodFilter
        });

        // Calcular estadísticas
        const stats = {
            total: turnos.length,
            completed: turnos.filter(t => t.estado === 'completed').length,
            cancelled: turnos.filter(t => t.estado === 'cancelled').length
        };

        // Renderizar estadísticas
        historialStats.innerHTML = `
            <h3>Estadísticas</h3>
            <div class="stats-row">
                <div class="stat-item">
                    <span class="number">${stats.total}</span>
                    <span class="label">Total de turnos</span>
                </div>
                <div class="stat-item">
                    <span class="number">${stats.completed}</span>
                    <span class="label">Completados</span>
                </div>
                <div class="stat-item">
                    <span class="number">${stats.cancelled}</span>
                    <span class="label">Cancelados</span>
                </div>
            </div>
        `;

        // Renderizar lista
        if (turnos.length === 0) {
            historialList.innerHTML = '<p style="text-align: center; color: #757575; padding: 2rem;">No hay turnos en el historial con los filtros seleccionados</p>';
            return;
        }

        historialList.innerHTML = '';

        turnos.forEach(turno => {
            const servicio = Utils.getServicio(turno.servicio.id);
            const card = document.createElement('div');
            card.className = `historial-card ${turno.estado}`;

            // Determinar icono y texto según estado
            let estadoIcon = '';
            let estadoTexto = '';
            let estadoClass = '';

            if (turno.estado === 'completed') {
                estadoIcon = '✅';
                estadoTexto = 'Completado';
                estadoClass = 'completed';
            } else if (turno.estado === 'cancelled') {
                estadoIcon = '❌';
                estadoTexto = 'Cancelado';
                estadoClass = 'cancelled';

                // Agregar fecha de cancelación si existe
                if (turno.canceladoAt) {
                    const fechaCancelacion = turno.canceladoAt.toDate();
                    estadoTexto += ` (${Utils.formatearFechaCorta(fechaCancelacion)})`;
                }
            } else {
                // Estado confirmado pero fecha pasada (no asistió)
                estadoIcon = '⚠️';
                estadoTexto = 'No asistió';
                estadoClass = 'cancelled';
            }

            card.innerHTML = `
                <div class="historial-info">
                    <h4>${servicio.nombre}</h4>
                    <p>📅 ${Utils.formatearFecha(turno.fecha)}</p>
                    <p>🕐 ${turno.hora} hs</p>
                    <p>💰 $${servicio.precio.toLocaleString('es-AR')}</p>
                </div>
                <div class="historial-badge ${estadoClass}">
                    ${estadoIcon} ${estadoTexto}
                </div>
            `;

            historialList.appendChild(card);
        });

    } catch (error) {
        console.error('Error al cargar historial:', error);
        historialList.innerHTML = '<p style="text-align: center; color: #f44336;">Error al cargar el historial</p>';
    }
}

// REQ-V2-05: Cargar perfil de usuario
async function cargarPerfil() {
    const perfilContainer = document.querySelector('.perfil-container');
    perfilContainer.innerHTML = '<div class="loading">Cargando perfil...</div>';

    try {
        const user = auth.currentUser;
        if (!user) {
            perfilContainer.innerHTML = '<p style="text-align: center; color: #f44336;">Error: Usuario no autenticado</p>';
            return;
        }

        // Obtener datos del usuario desde Firestore
        const userDoc = await db.collection('usuarios').doc(user.uid).get();
        const userData = userDoc.data();

        // Obtener estadísticas de turnos
        const turnosSnapshot = await db.collection('turnos')
            .where('usuarioId', '==', user.uid)
            .get();

        const turnos = turnosSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            fecha: doc.data().fecha.toDate()
        }));

        const ahora = new Date();
        const completados = turnos.filter(t => t.estado === 'confirmado' && t.fecha < ahora).length;
        const cancelados = turnos.filter(t => t.estado === 'cancelado').length;
        const totalTurnos = turnos.length;

        // Obtener iniciales para el avatar
        const nombre = userData?.nombre || user.displayName || 'Usuario';
        const iniciales = nombre.split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);

        // Formatear fecha de registro
        const fechaRegistro = userData?.fechaRegistro?.toDate() || new Date();
        const miembroDesde = fechaRegistro.toLocaleDateString('es-AR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Renderizar perfil
        perfilContainer.innerHTML = `
            <div class="perfil-header">
                <div class="perfil-avatar">${iniciales}</div>
                <div class="perfil-info-header">
                    <h3>${nombre}</h3>
                    <p class="perfil-email">${user.email}</p>
                    <p class="perfil-miembro">Miembro desde ${miembroDesde}</p>
                </div>
            </div>

            <div class="perfil-stats">
                <div class="perfil-stat-card">
                    <div class="stat-icon">📊</div>
                    <div class="stat-info">
                        <span class="stat-value">${totalTurnos}</span>
                        <span class="stat-label">Total de Turnos</span>
                    </div>
                </div>
                <div class="perfil-stat-card">
                    <div class="stat-icon">✅</div>
                    <div class="stat-info">
                        <span class="stat-value">${completados}</span>
                        <span class="stat-label">Completados</span>
                    </div>
                </div>
                <div class="perfil-stat-card">
                    <div class="stat-icon">❌</div>
                    <div class="stat-info">
                        <span class="stat-value">${cancelados}</span>
                        <span class="stat-label">Cancelados</span>
                    </div>
                </div>
            </div>

            <div class="perfil-datos">
                <h4>Información Personal</h4>
                <div class="perfil-dato">
                    <span class="dato-label">👤 Nombre:</span>
                    <span class="dato-valor" id="perfil-nombre-display">${nombre}</span>
                </div>
                <div class="perfil-dato">
                    <span class="dato-label">📧 Email:</span>
                    <span class="dato-valor">${user.email}</span>
                </div>
                <div class="perfil-dato">
                    <span class="dato-label">📱 Teléfono:</span>
                    <span class="dato-valor" id="perfil-telefono-display">${userData?.telefono || 'No especificado'}</span>
                </div>
            </div>

            <div class="perfil-acciones">
                <button id="btnEditarPerfil" class="btn-primary">✏️ Editar Perfil</button>
                <button id="btnCambiarPassword" class="btn-secondary">🔒 Cambiar Contraseña</button>
                <button id="btnEliminarCuenta" class="btn-danger">🗑️ Eliminar Cuenta</button>
            </div>

            <!-- V2: Lista de espera activa -->
            <div class="perfil-lista-espera">
                <h4>⏰ Mis Listas de Espera</h4>
                <div id="listasEsperaContainer"></div>
            </div>
        `;

        // Event listeners para las acciones
        document.getElementById('btnEditarPerfil').addEventListener('click', abrirModalEditarPerfil);
        document.getElementById('btnCambiarPassword').addEventListener('click', abrirModalCambiarPassword);
        document.getElementById('btnEliminarCuenta').addEventListener('click', eliminarCuenta);

        // V2: Cargar listas de espera
        await cargarListasEsperaPerfil();

    } catch (error) {
        console.error('Error al cargar perfil:', error);
        perfilContainer.innerHTML = '<p style="text-align: center; color: #f44336;">Error al cargar el perfil</p>';
    }
}

// REQ-V2-05: Editar perfil (nombre y teléfono)
async function abrirModalEditarPerfil() {
    const user = auth.currentUser;
    const userDoc = await db.collection('usuarios').doc(user.uid).get();
    const userData = userDoc.data();

    const { value: formValues } = await Swal.fire({
        title: '✏️ Editar Perfil',
        html: `
            <div style="text-align: left;">
                <label for="edit-nombre" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Nombre:</label>
                <input
                    type="text"
                    id="edit-nombre"
                    class="swal2-input"
                    value="${userData?.nombre || user.displayName || ''}"
                    placeholder="Tu nombre completo"
                    style="width: 90%; margin: 0 0 1rem 0;"
                >

                <label for="edit-telefono" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Teléfono:</label>
                <input
                    type="tel"
                    id="edit-telefono"
                    class="swal2-input"
                    value="${userData?.telefono || ''}"
                    placeholder="Ej: (011) 1234-5678"
                    style="width: 90%; margin: 0;"
                >

                <p style="color: #757575; font-size: 0.85rem; margin-top: 1rem;">
                    ℹ️ El email no se puede modificar
                </p>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar Cambios',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#2196f3',
        preConfirm: () => {
            const nombre = document.getElementById('edit-nombre').value.trim();
            const telefono = document.getElementById('edit-telefono').value.trim();

            if (!nombre || nombre.length < 3) {
                Swal.showValidationMessage('El nombre debe tener al menos 3 caracteres');
                return false;
            }

            // Validar teléfono si se proporcionó
            if (telefono) {
                const phoneDigits = telefono.replace(/\D/g, '');
                if (phoneDigits.length < 10) {
                    Swal.showValidationMessage('Teléfono inválido (mínimo 10 dígitos)');
                    return false;
                }
            }

            return { nombre, telefono };
        }
    });

    if (formValues) {
        try {
            Utils.showLoading('Actualizando perfil...');

            // Actualizar en Firestore
            await db.collection('usuarios').doc(user.uid).update({
                nombre: formValues.nombre,
                telefono: formValues.telefono
            });

            // Actualizar displayName en Auth
            await user.updateProfile({
                displayName: formValues.nombre
            });

            Utils.closeLoading();
            Utils.showSuccess('¡Perfil Actualizado!', 'Tus datos han sido actualizados correctamente');

            // Recargar perfil
            cargarPerfil();

            // Actualizar nombre en navbar
            const userName = document.getElementById('userNameNav');
            if (userName) {
                userName.textContent = formValues.nombre;
            }

        } catch (error) {
            Utils.closeLoading();
            Utils.showError('Error', 'No se pudo actualizar el perfil: ' + error.message);
        }
    }
}

// REQ-V2-05: Cambiar contraseña con re-autenticación
async function abrirModalCambiarPassword() {
    const user = auth.currentUser;

    // Verificar si el usuario usa autenticación con contraseña
    const hasPasswordProvider = user.providerData.some(p => p.providerId === 'password');

    if (!hasPasswordProvider) {
        Utils.showError('No disponible', 'Esta cuenta usa autenticación con Google. No puedes cambiar la contraseña desde aquí.');
        return;
    }

    const { value: formValues } = await Swal.fire({
        title: '🔒 Cambiar Contraseña',
        html: `
            <div style="text-align: left;">
                <label for="password-actual" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Contraseña Actual:</label>
                <input
                    type="password"
                    id="password-actual"
                    class="swal2-input"
                    placeholder="Tu contraseña actual"
                    style="width: 90%; margin: 0 0 1rem 0;"
                >

                <label for="password-nueva" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Nueva Contraseña:</label>
                <input
                    type="password"
                    id="password-nueva"
                    class="swal2-input"
                    placeholder="Mínimo 6 caracteres"
                    style="width: 90%; margin: 0 0 1rem 0;"
                >

                <label for="password-confirmar" style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Confirmar Nueva Contraseña:</label>
                <input
                    type="password"
                    id="password-confirmar"
                    class="swal2-input"
                    placeholder="Repite la nueva contraseña"
                    style="width: 90%; margin: 0;"
                >
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Cambiar Contraseña',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#2196f3',
        preConfirm: () => {
            const actual = document.getElementById('password-actual').value;
            const nueva = document.getElementById('password-nueva').value;
            const confirmar = document.getElementById('password-confirmar').value;

            if (!actual) {
                Swal.showValidationMessage('Debes ingresar tu contraseña actual');
                return false;
            }

            if (!nueva || nueva.length < 6) {
                Swal.showValidationMessage('La nueva contraseña debe tener al menos 6 caracteres');
                return false;
            }

            if (nueva !== confirmar) {
                Swal.showValidationMessage('Las contraseñas no coinciden');
                return false;
            }

            return { actual, nueva };
        }
    });

    if (formValues) {
        try {
            Utils.showLoading('Cambiando contraseña...');

            // Re-autenticar al usuario
            const credential = firebase.auth.EmailAuthProvider.credential(
                user.email,
                formValues.actual
            );

            await user.reauthenticateWithCredential(credential);

            // Cambiar contraseña
            await user.updatePassword(formValues.nueva);

            Utils.closeLoading();
            Utils.showSuccess('¡Contraseña Actualizada!', 'Tu contraseña ha sido cambiada exitosamente');

        } catch (error) {
            Utils.closeLoading();

            let mensajeError = 'No se pudo cambiar la contraseña';
            if (error.code === 'auth/wrong-password') {
                mensajeError = 'La contraseña actual es incorrecta';
            } else if (error.code === 'auth/requires-recent-login') {
                mensajeError = 'Por seguridad, debes cerrar sesión y volver a iniciarla antes de cambiar tu contraseña';
            }

            Utils.showError('Error', mensajeError);
        }
    }
}

// REQ-V2-05: Eliminar cuenta
async function eliminarCuenta() {
    const user = auth.currentUser;

    // Primera confirmación
    const resultado1 = await Utils.confirmar(
        '⚠️ ¿Eliminar Cuenta?',
        'Esta acción es IRREVERSIBLE. Se eliminarán todos tus datos y turnos. ¿Estás seguro?'
    );

    if (!resultado1.isConfirmed) return;

    // Segunda confirmación con contraseña
    const { value: password } = await Swal.fire({
        title: '🔒 Confirmar Identidad',
        html: `
            <p style="margin-bottom: 1rem;">Por seguridad, ingresa tu contraseña para confirmar:</p>
            <input
                type="password"
                id="delete-password"
                class="swal2-input"
                placeholder="Tu contraseña"
                style="width: 90%;"
            >
            <p style="color: #f44336; font-size: 0.9rem; margin-top: 1rem;">
                ⚠️ Esta acción NO se puede deshacer
            </p>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Eliminar Mi Cuenta',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#f44336',
        preConfirm: () => {
            const pass = document.getElementById('delete-password').value;
            if (!pass) {
                Swal.showValidationMessage('Debes ingresar tu contraseña');
                return false;
            }
            return pass;
        }
    });

    if (!password) return;

    try {
        Utils.showLoading('Eliminando cuenta...');

        // Re-autenticar
        const credential = firebase.auth.EmailAuthProvider.credential(
            user.email,
            password
        );

        await user.reauthenticateWithCredential(credential);

        // Eliminar turnos del usuario
        const turnosSnapshot = await db.collection('turnos')
            .where('usuarioId', '==', user.uid)
            .get();

        const batch = db.batch();
        turnosSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Eliminar documento de usuario
        batch.delete(db.collection('usuarios').doc(user.uid));

        await batch.commit();

        // Eliminar usuario de Auth
        await user.delete();

        Utils.closeLoading();

        await Swal.fire({
            icon: 'success',
            title: 'Cuenta Eliminada',
            text: 'Tu cuenta y todos tus datos han sido eliminados. Serás redirigido al login.',
            confirmButtonColor: '#2196f3',
            allowOutsideClick: false
        });

        // Redirigir a login
        window.location.href = 'login.html';

    } catch (error) {
        Utils.closeLoading();

        let mensajeError = 'No se pudo eliminar la cuenta';
        if (error.code === 'auth/wrong-password') {
            mensajeError = 'Contraseña incorrecta';
        } else if (error.code === 'auth/requires-recent-login') {
            mensajeError = 'Por seguridad, debes cerrar sesión y volver a iniciarla antes de eliminar tu cuenta';
        }

        Utils.showError('Error', mensajeError);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // ========================================
    // MODO OSCURO (V2) - Inicializar primero
    // ========================================
    const darkMode = localStorage.getItem("darkMode") === "true";
    if (darkMode) {
        document.body.classList.add("dark-mode");
        updateDarkModeIcon();
    }

    // Toggle de modo oscuro
    const darkModeToggle = document.getElementById("darkModeToggle");
    if (darkModeToggle) {
        darkModeToggle.addEventListener("click", () => {
            document.body.classList.toggle("dark-mode");
            const isDark = document.body.classList.contains("dark-mode");
            localStorage.setItem("darkMode", isDark);
            updateDarkModeIcon();
            if (typeof Utils !== "undefined" && Utils.toastInfo) {
                Utils.toastInfo(isDark ? "🌙 Modo oscuro activado" : "☀️ Modo claro activado", 2000);
            }
        });
    }

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
            await UI.renderCalendario();
            await UI.renderMisTurnos();
        }
    });

    // Sistema de tabs (V2)
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;

            // Remover active de todos los botones y contenidos
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Agregar active al botón clickeado y su contenido
            button.classList.add('active');
            document.getElementById(targetTab + 'Tab').classList.add('active');

            // Cargar contenido según el tab
            if (targetTab === 'historial') {
                cargarHistorial();
            } else if (targetTab === 'perfil') {
                cargarPerfil();
            } else if (targetTab === 'turnos') {
                Utils.toastInfo('📅 Mis Turnos Activos', 2000);
            }
        });
    });

    // Filtros de historial (V2)
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            Utils.toastInfo('🔍 Aplicando filtros...', 2000);
            cargarHistorial();
        });
    }

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
            await UI.renderCalendario();
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
            await UI.renderCalendario();
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
            await UI.renderMisTurnos();
            await UI.renderCalendario();
            document.querySelectorAll('.servicio-card').forEach(c => c.classList.remove('selected'));
            document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));

            // Scroll al inicio
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            Utils.closeLoading();

            // Si el horario ya no está disponible, ofrecer lista de espera (V2)
            if (error.message.includes('acaba de ser reservado')) {
                // Mostrar modal de lista de espera
                await mostrarModalListaEspera(
                    gestorTurnos.fechaSeleccionada,
                    gestorTurnos.horaSeleccionada,
                    gestorTurnos.servicioSeleccionado
                );

                // Recargar horarios disponibles para la fecha seleccionada
                gestorTurnos.horaSeleccionada = null;
                document.getElementById('confirmacionSection').style.display = 'none';
                document.querySelectorAll('.horario-btn').forEach(b => b.classList.remove('selected'));

                // Actualizar horarios disponibles
                if (gestorTurnos.fechaSeleccionada) {
                    await UI.mostrarHorarios(gestorTurnos.fechaSeleccionada);
                }
            } else {
                // Otros errores
                Utils.showError('Error', error.message);
            }
        }
    });

    // Cancelar reserva
    document.getElementById('cancelarReservaBtn').addEventListener('click', () => {
        gestorTurnos.horaSeleccionada = null;
        document.getElementById('confirmacionSection').style.display = 'none';
        document.querySelectorAll('.horario-btn').forEach(b => b.classList.remove('selected'));
    });
});

// ========================================
// SISTEMA DE LISTA DE ESPERA (V2)
// ========================================

/**
 * Agregar a lista de espera cuando un horario está ocupado
 */
async function agregarAListaEspera(fecha, hora, servicio) {
    const user = auth.currentUser;
    if (!user) throw new Error('Debes iniciar sesión');

    const fechaStr = Utils.formatearFechaCorta(fecha);

    try {
        // Verificar que no esté ya en lista de espera para ese horario
        const snapshot = await db.collection('listaEspera')
            .where('userId', '==', user.uid)
            .where('fecha', '==', fechaStr)
            .where('hora', '==', hora)
            .where('notificado', '==', false)
            .get();

        if (!snapshot.empty) {
            throw new Error('Ya estás en la lista de espera para este horario');
        }

        // Agregar a lista de espera
        await db.collection('listaEspera').add({
            userId: user.uid,
            userEmail: user.email,
            userName: user.displayName || user.email,
            fecha: fechaStr,
            hora: hora,
            servicio: servicio.nombre,
            servicioId: servicio.id,
            notificado: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        return true;
    } catch (error) {
        console.error('Error al agregar a lista de espera:', error);
        throw error;
    }
}

/**
 * Obtener listas de espera activas del usuario
 */
async function obtenerListasEspera() {
    const user = auth.currentUser;
    if (!user) return [];

    try {
        const snapshot = await db.collection('listaEspera')
            .where('userId', '==', user.uid)
            .where('notificado', '==', false)
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error al obtener listas de espera:', error);
        return [];
    }
}

/**
 * Cancelar lista de espera
 */
async function cancelarListaEspera(listaId) {
    try {
        await db.collection('listaEspera').doc(listaId).delete();
    } catch (error) {
        console.error('Error al cancelar lista de espera:', error);
        throw error;
    }
}

/**
 * Notificar lista de espera cuando se cancela un turno
 * Esta función se llama automáticamente cuando se cancela un turno
 */
async function notificarListaEsperaCuandoCancelan(fecha, hora) {
    try {
        const fechaStr = Utils.formatearFechaCorta(fecha);

        // Buscar personas en lista de espera para ese horario
        const snapshot = await db.collection('listaEspera')
            .where('fecha', '==', fechaStr)
            .where('hora', '==', hora)
            .where('notificado', '==', false)
            .orderBy('createdAt', 'asc')
            .limit(1)
            .get();

        // Notificar al primero en la lista
        if (!snapshot.empty) {
            const lista = snapshot.docs[0];
            await db.collection('listaEspera').doc(lista.id).update({
                notificado: true,
                notificadoAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    } catch (error) {
        console.error('Error al notificar lista de espera:', error);
    }
}

/**
 * Cargar y renderizar listas de espera en el perfil
 */
async function cargarListasEsperaPerfil() {
    const container = document.getElementById('listasEsperaContainer');

    if (!container) return;

    container.innerHTML = '<div class="loading">Cargando...</div>';

    try {
        const listas = await obtenerListasEspera();

        if (listas.length === 0) {
            container.innerHTML = '<p style="color: #757575;">No tenés listas de espera activas</p>';
            return;
        }

        container.innerHTML = '';

        listas.forEach(lista => {
            const card = document.createElement('div');
            card.className = 'lista-espera-card';
            card.style.cssText = `
                background: #fff3cd;
                padding: 1rem;
                border-radius: 8px;
                border-left: 4px solid #ff9800;
                margin-bottom: 0.75rem;
            `;

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <p style="margin: 0; font-weight: 600; color: #212121;">${lista.servicio}</p>
                        <p style="margin: 0.25rem 0; color: #757575; font-size: 0.9rem;">📅 ${lista.fecha} - 🕐 ${lista.hora} hs</p>
                        <p style="margin: 0.25rem 0; color: #ff9800; font-size: 0.85rem;">⏰ En espera de disponibilidad</p>
                    </div>
                    <button
                        class="btn-danger btn-small"
                        onclick="cancelarListaEsperaUI('${lista.id}')"
                        style="padding: 0.5rem 1rem; border: none; background: #f44336; color: white; border-radius: 6px; cursor: pointer; font-weight: 500;">
                        Cancelar
                    </button>
                </div>
            `;

            container.appendChild(card);
        });

    } catch (error) {
        console.error('Error al cargar listas de espera:', error);
        container.innerHTML = '<p style="color: #f44336;">Error al cargar listas de espera</p>';
    }
}

/**
 * UI para cancelar lista de espera
 */
async function cancelarListaEsperaUI(listaId) {
    const result = await Utils.confirmar(
        '¿Cancelar Lista de Espera?',
        'Dejarás de recibir notificaciones para este horario.'
    );

    if (result.isConfirmed) {
        try {
            await cancelarListaEspera(listaId);
            await Utils.showSuccess('Lista de Espera Cancelada', 'Ya no recibirás notificaciones para este horario');
            cargarListasEsperaPerfil();
        } catch (error) {
            Utils.showError('Error', 'No se pudo cancelar la lista de espera');
        }
    }
}

/**
 * Mostrar modal de lista de espera cuando un horario está ocupado
 */
async function mostrarModalListaEspera(fecha, hora, servicio) {
    const result = await Swal.fire({
        title: 'Horario Ocupado',
        html: `
            <p style="margin-bottom: 1rem;">Este horario ya está ocupado.</p>
            <p style="font-weight: 600; margin-bottom: 1rem;">¿Querés anotarte en la lista de espera?</p>
            <p style="font-size: 0.9rem; color: #757575;">
                Si se cancela este turno, te notificaremos automáticamente por email.
            </p>
        `,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Sí, anotarme',
        cancelButtonText: 'No, buscar otro horario',
        confirmButtonColor: '#2196f3',
        cancelButtonColor: '#757575'
    });

    if (result.isConfirmed) {
        try {
            Utils.showLoading('Agregando a lista de espera...');
            await agregarAListaEspera(fecha, hora, servicio);
            Utils.closeLoading();
            await Utils.showSuccess(
                '¡Listo!',
                'Te agregamos a la lista de espera. Te notificaremos por email si se libera este horario.'
            );
        } catch (error) {
            Utils.closeLoading();
            Utils.showError('Error', error.message);
        }
    }
}

// ========================================
// MODO OSCURO (V2) - Función auxiliar
// ========================================
function updateDarkModeIcon() {
    const darkModeToggle = document.getElementById("darkModeToggle");
    if (darkModeToggle) {
        const isDark = document.body.classList.contains("dark-mode");
        darkModeToggle.textContent = isDark ? "☀️" : "🌙";
        darkModeToggle.title = isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
    }
}

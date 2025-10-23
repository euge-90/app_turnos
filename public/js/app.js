// ✅ HELPER: Parsear fecha desde Firestore (puede ser string o Timestamp)
function parseFechaFirestore(fecha) {
    if (!fecha) return null;

    // Si es string "2025-10-31", convertir a Date
    if (typeof fecha === 'string') {
        return new Date(fecha + 'T00:00:00');
    }

    // Si es Timestamp de Firestore
    if (fecha && typeof fecha === 'object' && fecha.toDate) {
        return fecha.toDate();
    }

    // Si ya es Date
    if (fecha instanceof Date) {
        return fecha;
    }

    // Fallback
    return new Date(fecha);
}

// ========================================
// AUTO-MIGRACIÓN DE TURNOS (Ejecutar una vez por usuario)
// ========================================
/**
 * Migra automáticamente los turnos del usuario de String a Timestamp
 * Se ejecuta solo una vez por usuario (usa localStorage)
 */
async function migrarMisTurnosAutomatico() {
    const user = auth.currentUser;
    if (!user) return;

    // Verificar si ya migró
    const migracionKey = `migracion_timestamp_completada_${user.uid}`;
    if (localStorage.getItem(migracionKey)) {
        console.log('✅ Auto-migración: Ya completada anteriormente para este usuario');
        return;
    }

    console.log('🔧 Iniciando auto-migración de turnos del usuario (String → Timestamp)...');

    try {
        const snapshot = await db.collection('turnos')
            .where('usuarioId', '==', user.uid)
            .get();

        if (snapshot.empty) {
            console.log('ℹ️  No hay turnos para migrar');
            localStorage.setItem(migracionKey, 'true');
            return;
        }

        let migrados = 0;
        let yaCorrectos = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();

            // Verificar si fecha ES un string (formato YYYY-MM-DD)
            if (typeof data.fecha === 'string') {
                if (!/^\d{4}-\d{2}-\d{2}$/.test(data.fecha)) {
                    console.warn(`  ⚠️  Turno ${doc.id}: formato de fecha inválido (${data.fecha}), se omite`);
                    continue;
                }

                const fechaDate = new Date(data.fecha + 'T00:00:00');
                if (isNaN(fechaDate.getTime())) {
                    console.warn(`  ⚠️  Turno ${doc.id}: no se pudo convertir la fecha (${data.fecha})`);
                    continue;
                }

                const fechaTimestamp = firebase.firestore.Timestamp.fromDate(fechaDate);

                await doc.ref.update({
                    fecha: fechaTimestamp
                });

                migrados++;
                console.log(`  ✅ Turno ${doc.id}: ${data.fecha} → Timestamp`);

            } else if (data.fecha && data.fecha.toDate && typeof data.fecha.toDate === 'function') {
                // Ya es Timestamp
                yaCorrectos++;
            }
        }

        console.log('');
        console.log('========================================');
        console.log('✅ AUTO-MIGRACIÓN COMPLETADA (String → Timestamp)');
        console.log('========================================');
        console.log(`   Total revisados: ${snapshot.size}`);
        console.log(`   Turnos migrados: ${migrados}`);
        console.log(`   Ya correctos: ${yaCorrectos}`);
        console.log('========================================');

        if (migrados > 0) {
            Utils.toastSuccess(`✅ Datos actualizados: ${migrados} turno${migrados > 1 ? 's' : ''} migrado${migrados > 1 ? 's' : ''}`, 3000);
        }

        // Marcar como completado
        localStorage.setItem(migracionKey, 'true');

    } catch (error) {
        console.error('❌ Error en auto-migración:', error);
        // No marcar como completado si hubo error, para que intente de nuevo
    }
}

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
            // ✅ Calcular fechas como strings "2025-10-01" y "2025-10-31"
            const inicio = new Date(year, month, 1);
            const fin = new Date(year, month + 1, 0);
            const fechaInicioStr = inicio.toISOString().split('T')[0];
            const fechaFinStr = fin.toISOString().split('T')[0];

            const snapshot = await db.collection('turnos')
                .where('fecha', '>=', fechaInicioStr)
                .where('fecha', '<=', fechaFinStr)
                .where('estado', '==', 'confirmado')
                .get();

            // Contar turnos por día
            const turnosPorDia = {};
            snapshot.docs.forEach(doc => {
                const turno = doc.data();
                // ✅ Parsear fecha (compatible con strings y Timestamps)
                const fecha = parseFechaFirestore(turno.fecha);
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
        // ✅ Convertir fecha a string
        const fechaString = fecha instanceof Date
            ? fecha.toISOString().split('T')[0]
            : String(fecha).split('T')[0];

        const cacheKey = fechaString;

        // Verificar cache
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.horarios;
            }
        }

        try {
            // Obtener turnos ocupados de Firebase usando string
            const snapshot = await db.collection('turnos')
                .where('fecha', '==', fechaString)
                .where('estado', '==', 'confirmado')
                .get();

            // Obtener horas ocupadas (ya filtradas por estado en query)
            const ocupados = new Set(
                snapshot.docs.map(doc => doc.data().hora)
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

        // Normalizar parámetros entrantes
        const fechaNormalizada = parseFechaFirestore(fecha);
        if (!fechaNormalizada || Number.isNaN(fechaNormalizada.getTime())) {
            throw new Error('Fecha inválida');
        }
        fechaNormalizada.setHours(0, 0, 0, 0);
        const fechaTimestamp = firebase.firestore.Timestamp.fromDate(fechaNormalizada);

        const horaNormalizada = String(hora);

        const servicioLimpio = {
            id: String(servicio?.id || ''),
            nombre: String(servicio?.nombre || ''),
            duracion: Number(servicio?.duracion || 0),
            precio: Number(servicio?.precio || 0)
        };

        console.log('🔍 Reservando turno - parámetros normalizados', {
            fechaOriginal: fecha,
            fechaTimestamp,
            horaOriginal: hora,
            horaNormalizada,
            servicioLimpio
        });

        // Validar fecha futura
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        if (fechaNormalizada < hoy) {
            throw new Error('No puedes reservar turnos en fechas pasadas');
        }

        // Verificar límite de turnos activos (filtrando en memoria por fecha futura)
        const turnosActivosSnapshot = await db.collection('turnos')
            .where('usuarioId', '==', user.uid)
            .where('estado', '==', 'confirmado')
            .get();

        const ahoraTimestamp = firebase.firestore.Timestamp.fromDate(new Date());
        const turnosActivos = turnosActivosSnapshot.docs.filter(doc => {
            const fechaDoc = parseFechaFirestore(doc.data().fecha);
            if (!fechaDoc) return false;
            return fechaDoc.getTime() >= ahoraTimestamp.toDate().getTime();
        });

        if (turnosActivos.length >= CONFIG.maxTurnosPorUsuario) {
            throw new Error(`Máximo ${CONFIG.maxTurnosPorUsuario} turnos activos permitidos`);
        }

        // Verificar disponibilidad FUERA de la transacción (fix: serialización de Timestamp)
        console.log('🔎 Consultando disponibilidad con:', {
            tipoFecha: fechaTimestamp?.constructor?.name,
            fechaTimestamp,
            horaNormalizada
        });

        const disponibilidadSnapshot = await db.collection('turnos')
            .where('fecha', '==', fechaTimestamp)
            .where('hora', '==', horaNormalizada)
            .where('estado', '==', 'confirmado')
            .get();

        if (!disponibilidadSnapshot.empty) {
            throw new Error('Este horario acaba de ser reservado por otro usuario. Por favor selecciona otro horario.');
        }

        // Crear el turno
        const datosTurno = {
            usuarioId: user.uid,
            usuarioNombre: user.displayName || 'Usuario',
            usuarioEmail: user.email,
            fecha: fechaTimestamp,
            hora: horaNormalizada,
            servicio: servicioLimpio,
            estado: 'confirmado',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            modificacionesCount: 0
        };

        const datosParaFirestore = (typeof Utils !== 'undefined' && Utils.sanitizeForFirestore)
            ? Utils.sanitizeForFirestore(datosTurno)
            : datosTurno;

        console.log('📋 Datos del turno a guardar (sanitizados):', datosParaFirestore);

        try {
            const turnoRef = await db.collection('turnos').add(datosParaFirestore);
            console.log('✅ Turno creado exitosamente con ID:', turnoRef.id);

            this.cache.clear();
            return turnoRef.id;

        } catch (error) {
            console.error('🔥 Error al guardar turno:', error);
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
        // ✅ Parsear fecha (compatible con strings y Timestamps)
        const fechaTurno = parseFechaFirestore(turno.data().fecha);
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
        // ✅ Parsear fecha (compatible con strings y Timestamps)
        const fechaTurno = parseFechaFirestore(turnoData.fecha);
        const [hora, minuto] = turnoData.hora.split(':');
        fechaTurno.setHours(parseInt(hora), parseInt(minuto), 0, 0);

        const ahora = new Date();
        const horasAnticipacion = (fechaTurno - ahora) / (1000 * 60 * 60);

        if (horasAnticipacion < 2) {
            throw new Error('Solo puedes modificar turnos con al menos 2 horas de anticipación');
        }

        // ✅ Convertir nueva fecha a string
        const nuevaFechaString = nuevaFecha instanceof Date
            ? nuevaFecha.toISOString().split('T')[0]
            : String(nuevaFecha).split('T')[0];

        // Verificar que la nueva fecha sea futura
        if (nuevaFecha < new Date()) {
            throw new Error('La nueva fecha debe ser futura');
        }

        // Usar transacción para verificar disponibilidad del nuevo horario
        try {
            await db.runTransaction(async (transaction) => {
                // Verificar que el nuevo horario esté disponible (usando STRING)
                const querySnapshot = await transaction.get(
                    db.collection('turnos')
                        .where('fecha', '==', nuevaFechaString)
                        .where('hora', '==', nuevaHora)
                        .where('estado', '==', 'confirmado')
                );

                // Filtrar para excluir el turno actual (permite modificar sin conflicto consigo mismo)
                const conflictos = querySnapshot.docs.filter(doc => doc.id !== turnoId);

                if (conflictos.length > 0) {
                    throw new Error('HORARIO_NO_DISPONIBLE');
                }

                // Guardar datos anteriores para el historial (SOLO PRIMITIVOS)
                const datosAnteriores = {
                    previousDate: turnoData.fecha,
                    previousTime: turnoData.hora,
                    modificationsCount: modificacionesCount + 1,
                    modifiedAt: firebase.firestore.Timestamp.now()  // ✅ Timestamp de modificación
                };

                // Actualizar el turno (usando STRING para fecha)
                transaction.update(turnoRef, {
                    fecha: nuevaFechaString,  // ✅ String: "2025-10-31"
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
            // Crear Timestamp para hoy a las 00:00
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const hoyTimestamp = firebase.firestore.Timestamp.fromDate(hoy);

            const snapshot = await db.collection('turnos')
                .where('usuarioId', '==', user.uid)
                .where('estado', '==', 'confirmado')
                .where('fecha', '>=', hoyTimestamp)
                .get();

            // Ordenar y limitar en JavaScript
            return snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .sort((a, b) => {
                    // Ordenar por fecha (Timestamp)
                    const fechaA = a.fecha.toMillis ? a.fecha.toMillis() : new Date(a.fecha).getTime();
                    const fechaB = b.fecha.toMillis ? b.fecha.toMillis() : new Date(b.fecha).getTime();
                    const fechaDiff = fechaA - fechaB;
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
        section.classList.remove('hidden');

        try {
            const horarios = await gestorTurnos.obtenerHorariosDisponibles(fecha);

            container.innerHTML = '';

            if (horarios.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #757575;">No hay horarios disponibles para esta fecha</p>';
                return;
            }

            // Crear contenedor principal
            const horariosContainer = document.createElement('div');
            horariosContainer.className = 'horarios-container';

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

            // Crear header con título y botón toggle
            const header = document.createElement('div');
            header.className = 'horarios-header';

            const titulo = document.createElement('h5');
            titulo.innerHTML = '⭐ Horarios Sugeridos';

            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'btn-toggle-horarios';
            toggleBtn.textContent = `Ver todos los horarios (${horarios.length})`;

            header.appendChild(titulo);
            header.appendChild(toggleBtn);
            horariosContainer.appendChild(header);

            // Mostrar horarios sugeridos
            if (sugeridos.length > 0) {
                const sugeridosSection = document.createElement('div');
                sugeridosSection.className = 'horarios-sugeridos';

                const sugeridosGrid = document.createElement('div');
                sugeridosGrid.className = 'horarios-sugeridos-grid';

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

                    sugeridosGrid.appendChild(btn);
                });

                sugeridosSection.appendChild(sugeridosGrid);
                horariosContainer.appendChild(sugeridosSection);
            }

            // Sección "Todos los horarios"
            const todosSection = document.createElement('div');
            todosSection.className = 'todos-horarios';

            const horariosGrid = document.createElement('div');
            horariosGrid.className = 'horarios-grid';
            horariosGrid.style.display = 'none';

            toggleBtn.addEventListener('click', () => {
                const isVisible = horariosGrid.style.display !== 'none';
                horariosGrid.style.display = isVisible ? 'none' : 'grid';
                toggleBtn.textContent = isVisible ? `Ver todos los horarios (${horarios.length})` : 'Ocultar horarios';
                titulo.innerHTML = isVisible ? '⭐ Horarios Sugeridos' : '📋 Todos los Horarios';
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

            todosSection.appendChild(horariosGrid);
            horariosContainer.appendChild(todosSection);
            container.appendChild(horariosContainer);
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

        section.classList.remove('hidden');
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

                const fechaHora = parseFechaFirestore(turno.fecha);
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
        // ✅ Parsear fecha (compatible con strings y Timestamps)
        const fechaActual = parseFechaFirestore(turnoData.fecha);
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
        const ahora = new Date();

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
            // ✅ Usar string en lugar de Timestamp
            const fechaInicioStr = fechaInicio.toISOString().split('T')[0];
            query = query.where('fecha', '>=', fechaInicioStr);
        }

        const snapshot = await query.get();

        // Filtrar en JavaScript para excluir turnos activos y aplicar filtro de estado
        return snapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data(),
                // ✅ Parsear fecha (compatible con strings y Timestamps)
                fecha: parseFechaFirestore(doc.data().fecha)
            }))
            .filter(turno => {
                // Excluir turnos confirmados en el futuro (esos son "activos")
                if (turno.estado === 'confirmado' && turno.fecha >= ahora) {
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

        // Renderizar lista - Verificar si hay turnos PRIMERO
        if (turnos.length === 0) {
            // Ocultar estadísticas si no hay turnos
            historialStats.innerHTML = '';

            // Mostrar mensaje amigable con estado vacío
            historialList.innerHTML = `
                <div style="text-align: center; padding: 3rem 1rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.3;">📋</div>
                    <h3 style="color: var(--text-dark); margin-bottom: 0.5rem;">No hay turnos en tu historial</h3>
                    <p style="color: var(--text-light); margin-bottom: 1.5rem;">
                        ${statusFilter !== 'all' || periodFilter !== 'all'
                            ? 'Intenta ajustar los filtros para ver más resultados'
                            : 'Tus turnos completados y cancelados aparecerán aquí'}
                    </p>
                    ${statusFilter !== 'all' || periodFilter !== 'all'
                        ? '<button class="btn-secondary" onclick="document.getElementById(\'statusFilter\').value=\'all\'; document.getElementById(\'periodFilter\').value=\'all\'; cargarHistorial();">Limpiar Filtros</button>'
                        : '<button class="btn-primary" onclick="document.querySelectorAll(\'.tab-btn\')[0].click();">Reservar un Turno</button>'}
                </div>
            `;
            return;
        }

        // Calcular estadísticas (solo si hay turnos)
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
                    // ✅ Parsear fecha (compatible con strings y Timestamps)
                    const fechaCancelacion = parseFechaFirestore(turno.canceladoAt);
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

    if (!perfilContainer) {
        console.error('Error: No se encontró el contenedor del perfil');
        return;
    }

    perfilContainer.innerHTML = '<div class="loading">Cargando perfil...</div>';

    try {
        const user = auth.currentUser;
        if (!user) {
            perfilContainer.innerHTML = `
                <div style="text-align: center; padding: 3rem 1rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.3;">👤</div>
                    <h3 style="color: var(--text-dark); margin-bottom: 0.5rem;">Error: Usuario no autenticado</h3>
                    <p style="color: var(--text-light); margin-bottom: 1.5rem;">Debes iniciar sesión para ver tu perfil</p>
                    <button class="btn-primary" onclick="window.location.href='login.html'">Iniciar Sesión</button>
                </div>
            `;
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
            // ✅ Parsear fecha (compatible con strings y Timestamps)
            fecha: parseFechaFirestore(doc.data().fecha)
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
        // ✅ Parsear fecha (compatible con strings y Timestamps)
        const fechaRegistro = userData?.fechaRegistro
            ? parseFechaFirestore(userData.fechaRegistro)
            : new Date();
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
        perfilContainer.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem;">
                <div style="font-size: 4rem; margin-bottom: 1rem; opacity: 0.3;">⚠️</div>
                <h3 style="color: var(--text-dark); margin-bottom: 0.5rem;">Error al cargar tu perfil</h3>
                <p style="color: var(--text-light); margin-bottom: 1.5rem;">
                    Ocurrió un problema al cargar tu información. Por favor, intenta nuevamente.
                </p>
                <button class="btn-primary" onclick="cargarPerfil()">Reintentar</button>
            </div>
        `;
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

// ========================================
// INICIALIZAR MODO OSCURO (ejecutar inmediatamente, antes de DOMContentLoaded)
// ========================================
// Aplicar modo oscuro antes de que la página se renderice para evitar flash
const darkMode = localStorage.getItem("darkMode") === "true";
if (darkMode) {
    document.documentElement.classList.add("dark-mode");
    document.body.classList.add("dark-mode");
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // ========================================
    // MODO OSCURO (V2) - Registrar event listener
    // ========================================
    updateDarkModeIcon(); // Actualizar ícono al cargar

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

    // Verificar que estamos en index.html (página principal con turnos)
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

            // ✅ AUTO-MIGRACIÓN: Ejecutar antes de cargar los turnos
            // Convierte fechas de Timestamp a String si es necesario
            await migrarMisTurnosAutomatico();

            // Inicializar UI
            UI.renderServicios();
            await UI.renderCalendario();
            await UI.renderMisTurnos();
        }
    });

    // Sistema de tabs (V2)
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    if (tabButtons.length > 0) {
        console.log('Inicializando tabs:', tabButtons.length, 'botones encontrados');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.tab;
                console.log('Tab clickeado:', targetTab);

                // Remover active de todos los botones y contenidos
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                // Agregar active al botón clickeado y su contenido
                button.classList.add('active');
                const targetContent = document.getElementById(targetTab + 'Tab');
                if (targetContent) {
                    targetContent.classList.add('active');
                } else {
                    console.error('No se encontró el contenido para la tab:', targetTab);
                }

                // Cargar contenido según el tab
                if (targetTab === 'historial') {
                    cargarHistorial();
                } else if (targetTab === 'perfil') {
                    cargarPerfil();
                } else if (targetTab === 'turnos') {
                    if (typeof Utils !== "undefined" && Utils.toastInfo) {
                        Utils.toastInfo('📅 Mis Turnos Activos', 2000);
                    }
                }
            });
        });
    } else {
        console.warn('No se encontraron botones de tabs');
    }

    // Filtros de historial (V2)
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            Utils.toastInfo('🔍 Aplicando filtros...', 2000);
            cargarHistorial();
        });
    }

    // Navegación del calendario
    document.getElementById('prevMonthBtn').addEventListener('click', async () => {
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

    document.getElementById('nextMonthBtn').addEventListener('click', async () => {
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

            // DEBUG: Ver todos los datos antes de limpiar
            console.log('🔍 DEBUG - Datos originales:', {
                servicio: gestorTurnos.servicioSeleccionado,
                fecha: gestorTurnos.fechaSeleccionada,
                hora: gestorTurnos.horaSeleccionada,
                tipoFecha: typeof gestorTurnos.fechaSeleccionada,
                tipoHora: typeof gestorTurnos.horaSeleccionada
            });

            // Crear objeto limpio del servicio usando JSON para eliminar TODAS las referencias
            const servicioLimpio = JSON.parse(JSON.stringify({
                id: gestorTurnos.servicioSeleccionado.id,
                nombre: gestorTurnos.servicioSeleccionado.nombre,
                duracion: gestorTurnos.servicioSeleccionado.duracion,
                precio: gestorTurnos.servicioSeleccionado.precio
            }));

            console.log('✅ Servicio limpio creado:', servicioLimpio);
            console.log('✅ Tipo de servicio limpio:', typeof servicioLimpio);
            console.log('✅ Keys del servicio:', Object.keys(servicioLimpio));

            // ✅ LOG CRÍTICO - Ver qué se pasa a reservarTurno
            console.log('📤 ANTES DE CONVERTIR - Datos originales:', {
                fecha: gestorTurnos.fechaSeleccionada,
                tipoFecha: typeof gestorTurnos.fechaSeleccionada,
                esFechaDate: gestorTurnos.fechaSeleccionada instanceof Date,
                hora: gestorTurnos.horaSeleccionada,
                tipoHora: typeof gestorTurnos.horaSeleccionada
            });

            // 🔥 FIX CRÍTICO - Convertir fecha a string ANTES de pasar a reservarTurno
            const fechaString = gestorTurnos.fechaSeleccionada instanceof Date
                ? gestorTurnos.fechaSeleccionada.toISOString().split('T')[0]
                : String(gestorTurnos.fechaSeleccionada).split('T')[0];

            const horaString = String(gestorTurnos.horaSeleccionada);

            console.log('✅ DESPUÉS DE CONVERTIR - Datos convertidos:', {
                fechaString: fechaString,
                tipoFecha: typeof fechaString,
                esFechaDate: fechaString instanceof Date,
                horaString: horaString,
                tipoHora: typeof horaString
            });

            await gestorTurnos.reservarTurno(
                fechaString,    // ✅ String: "2025-10-24"
                horaString,     // ✅ String: "12:00"
                servicioLimpio
            );

            Utils.closeLoading();
            await Utils.showSuccess('¡Turno Reservado!', 'Tu turno ha sido confirmado. Te esperamos!');

            // Limpiar selección
            gestorTurnos.servicioSeleccionado = null;
            gestorTurnos.fechaSeleccionada = null;
            gestorTurnos.horaSeleccionada = null;

            document.getElementById('confirmacionSection').classList.add('hidden');
            document.getElementById('horariosSection').classList.add('hidden');

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
                document.getElementById('confirmacionSection').classList.add('hidden');
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
        document.getElementById('confirmacionSection').classList.add('hidden');
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

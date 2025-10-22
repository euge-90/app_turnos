# Changelog - Turnify

Todos los cambios notables del proyecto Turnify serán documentados en este archivo.

---

## [2.0.0] - Octubre 2025 🚀

### Equipo de Desarrollo V2

**Desarrolladora Principal:**
- Eugenia Ojeda

**Documentación y Testing:**
- Teo Gandolfo
- Mateo Santucci
- Pedro Hauchar
- Bruno Carlomagno

---

### ✨ Agregado

#### 🎯 Panel de Administración Completo
- Dashboard avanzado con métricas en tiempo real
- Ingresos del mes (suma de turnos completados)
- Turnos completados, cancelados y tasa de cancelación
- Próximo turno con detalles completos del cliente
- Gráfico de barras mostrando turnos por día de la semana (últimos 7 días)
- Top 3 servicios más solicitados del mes con medallas 🥇🥈🥉
- Horarios más populares del mes
- Clientes frecuentes (más de 3 turnos)
- Agenda del día con vista detallada de todos los turnos
- Vista semanal completa con navegación
- Búsqueda de turnos por nombre o email de cliente
- **Botón "Marcar como Completado"** para cambiar estado de turnos
- **Botón "Cancelar"** para cancelar turnos desde el panel admin
- Gestión completa de servicios (crear, editar, eliminar)
- Bloqueo/desbloqueo de fechas (vacaciones, feriados)
- Exportación de turnos a CSV por mes
- Estadísticas de servicios más solicitados
- Tabs de navegación intuitivos: Dashboard, Agenda, Semana, Buscar, Servicios, Configuración

#### 💌 Sistema de Notificaciones por Email
- Email de confirmación automático al reservar turno
- Recordatorio 24 horas antes del turno (ejecutado diariamente a las 9:00 AM)
- Email de cancelación (tanto si cancela el cliente como el admin)
- Notificación cuando se libera un horario en lista de espera
- Templates HTML profesionales con diseño responsivo
- Implementado con SendGrid API
- Firebase Functions configuradas y listas para deploy

#### ⏰ Sistema de Lista de Espera
- Modal automático cuando un horario está ocupado
- Opción de anotarse en lista de espera
- Notificación automática por email cuando se libera el horario
- Vista de listas de espera activas en el perfil del usuario
- Cancelación de lista de espera desde el perfil
- Sistema FIFO (First In, First Out) - el primero en la lista es notificado
- Integración completa con el sistema de cancelación de turnos

#### 📊 Mejoras en el Sistema de Turnos
- Aumento de anticipación de reserva de 90 a **120 días** (4 meses)
- Reducción de tiempo de cancelación de 2 horas a **1 hora** de anticipación
- Sistema de modificación de turnos con límite de 2 modificaciones por turno
- Contador de modificaciones visible en cada turno
- Transacciones atómicas para prevenir doble reserva (Fix BUG-001)
- Bloqueo de navegación del calendario fuera del rango permitido (Fix BUG-005)

#### 👤 Perfil de Usuario Mejorado
- Estadísticas personalizadas (total de turnos, completados, cancelados)
- Vista de listas de espera activas
- Edición de nombre y teléfono
- Cambio de contraseña con re-autenticación
- Eliminación de cuenta con doble confirmación
- Avatar con iniciales del usuario
- Fecha de miembro desde el registro

#### 📜 Historial de Turnos
- Filtros por estado (Todos, Completados, Cancelados)
- Filtros por período (Último mes, Últimos 3 meses, Todo el historial)
- Estadísticas del historial
- Vista detallada de cada turno con estado visual
- Indicador de fecha de cancelación

#### 🎨 Interfaz y Diseño
- Estilos CSS profesionales para el panel admin (admin.css)
- Sistema de tabs mejorado con iconos
- Cards con animaciones y hover effects
- Gráficos visuales para estadísticas
- Toast notifications con Toastify.js
- Diseño totalmente responsivo (móvil y desktop)
- Colores corporativos consistentes (#2196f3, #4caf50, #f44336)

#### 🔒 Seguridad Mejorada
- Firestore Rules actualizadas para todas las nuevas collections
- Validación de permisos para lista de espera
- Validación de permisos para auditoría
- Reglas de seguridad para servicios y fechas bloqueadas
- Prevención de modificaciones no autorizadas

#### 🗄️ Base de Datos
- Nueva collection: `listaEspera` para sistema de lista de espera
- Nueva collection: `auditoria` para logs (opcional)
- Nueva collection: `servicios` migrada desde configuración estática
- Collection mejorada: `turnos` con nuevos estados (completed, cancelled)
- Collection mejorada: `fechasBloqueadas` para gestión de días no laborales

---

### 🔧 Mejorado

#### Performance
- Sistema de caché mejorado para turnos (5 minutos TTL)
- Optimización de consultas a Firestore
- Reducción de lecturas duplicadas con caché inteligente
- Invalidación automática de caché al crear/modificar/cancelar turnos

#### Experiencia de Usuario
- Mensajes de error más descriptivos y amigables
- Loading states en todas las operaciones asíncronas
- Confirmaciones antes de acciones destructivas
- Feedback visual inmediato con toast notifications
- Scroll automático a secciones relevantes

#### Código
- Refactorización de funciones largas en módulos más pequeños
- Mejor manejo de errores con try-catch
- Comentarios descriptivos en español
- Separación de concerns (UI, lógica de negocio, Firebase)
- Código más mantenible y escalable

---

### 🐛 Corregido

#### BUG-001: Doble Reserva
- **Problema:** Dos usuarios podían reservar el mismo horario simultáneamente
- **Solución:** Implementación de transacciones atómicas en Firestore
- **Estado:** ✅ Resuelto

#### BUG-002: Validación de Anticipación
- **Problema:** Se podía cancelar turnos con menos de 1 hora de anticipación desde la UI
- **Solución:** Validación estricta en frontend y backend
- **Estado:** ✅ Resuelto

#### BUG-003: Reservas en Fechas Pasadas
- **Problema:** Firestore Rules permitían crear turnos en fechas pasadas
- **Solución:** Validación `isFutureDate()` en Firestore Rules
- **Estado:** ✅ Resuelto

#### BUG-004: Sincronización de Servicios
- **Problema:** Servicios no se sincronizaban entre admin y usuarios
- **Solución:** Migración de servicios a Firestore con actualización automática
- **Estado:** ✅ Resuelto

#### BUG-005: Navegación de Calendario Ilimitada
- **Problema:** Se podía navegar a meses fuera del rango permitido
- **Solución:** Deshabilitar botones de navegación cuando se alcanza el límite
- **Estado:** ✅ Resuelto

---

### 📦 Dependencias Actualizadas

#### Frontend
- Firebase JS SDK 9.22.0 (mantenido)
- SweetAlert2 11.x (para modales)
- Toastify.js (nuevo - para notificaciones toast)
- Bootstrap 5.3 (mantenido)

#### Backend (Firebase Functions)
- firebase-admin ^11.11.0
- firebase-functions ^4.5.0
- @sendgrid/mail ^7.7.0

---

### 🚀 Deploy

#### Instrucciones de Deploy

**Frontend (Firebase Hosting):**
```bash
firebase deploy --only hosting
```

**Firestore Rules:**
```bash
firebase deploy --only firestore:rules
```

**Firestore Indexes:**
```bash
firebase deploy --only firestore:indexes
```

**Firebase Functions:**
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

**Configurar SendGrid:**
```bash
firebase functions:config:set sendgrid.key="TU_API_KEY_DE_SENDGRID"
```

**Deploy Completo:**
```bash
firebase deploy
```

---

### 📝 Notas de Migración

#### Para usuarios existentes:
- Todos los turnos existentes se mantienen sin cambios
- Los servicios se migrarán automáticamente a Firestore en el primer acceso
- No se requiere acción del usuario

#### Para administradores:
- El email del admin debe configurarse en `firebase-config.js` (CONFIG.adminEmail)
- Por defecto: `admin@peluqueria.com`
- Acceso al panel admin: `https://tu-dominio.web.app/admin.html`

---

### 🔮 Futuras Mejoras (Backlog)

- [ ] Modo oscuro global
- [ ] PWA instalable con service worker
- [ ] Sistema de reseñas y calificaciones
- [ ] Logs de auditoría completos en el panel admin
- [ ] Integración con Google Calendar
- [ ] Recordatorio 2 horas antes del turno
- [ ] Dashboard de analytics avanzado
- [ ] Exportación de estadísticas a Excel
- [ ] Vista de calendario mensual para usuarios
- [ ] Horarios sugeridos inteligentes basados en popularidad
- [ ] Badges con cantidad de turnos en calendario

---

### 👥 Créditos

**Desarrollo V2:**
- Eugenia Ojeda - Desarrollo Full Stack

**Documentación y Testing V2:**
- Teo Gandolfo
- Mateo Santucci
- Pedro Hauchar
- Bruno Carlomagno

**Tecnologías:**
- Vanilla JavaScript
- Firebase (Auth, Firestore, Functions, Hosting)
- Bootstrap 5.3
- SweetAlert2
- Toastify.js
- SendGrid API

---

### 📄 Licencia

Este proyecto es de uso académico/educativo.

---

### 📧 Contacto

Para consultas o sugerencias sobre el proyecto, contactar al equipo de desarrollo.

---

**Fecha de Release:** Octubre 2025
**Versión:** 2.0.0
**Repositorio:** https://github.com/euge-90/app_turnos

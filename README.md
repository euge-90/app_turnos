# ✂️ Turnify - Sistema de Gestión de Turnos para Peluquería

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Firebase](https://img.shields.io/badge/Firebase-9.22.0-orange)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow)
![License](https://img.shields.io/badge/license-Academic-green)

Sistema web completo para gestión de turnos de peluquería, desarrollado con Vanilla JavaScript y Firebase. Incluye panel de administración avanzado, notificaciones por email, sistema de lista de espera, modo oscuro y métricas en tiempo real.

---

## 📋 Tabla de Contenidos

- [Acerca del Proyecto](#-acerca-del-proyecto)
- [Versiones del Proyecto](#-versiones-del-proyecto)
- [Funcionalidades](#-funcionalidades)
- [Tecnologías](#-tecnologías)
- [Equipo de Desarrollo](#-equipo-de-desarrollo)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Deploy](#-deploy)
- [Licencia](#-licencia)

---

## 🎯 Acerca del Proyecto

Turnify es una aplicación web de gestión de turnos desarrollada como proyecto académico. El sistema permite a los clientes reservar turnos en línea y al administrador gestionar la agenda, servicios y clientes de manera eficiente.

**URL de Producción:** https://appturnos-a085a.web.app

---

## 📌 Versiones del Proyecto

### **Versión 1.0** (Septiembre 2025)

Sistema base con funcionalidades esenciales de reserva y gestión de turnos.

#### Funcionalidades V1:

**Para Clientes:**
- Sistema de registro e inicio de sesión con Firebase Authentication
- Reserva de turnos con selección de servicio, fecha y hora
- Visualización de turnos activos
- Cancelación de turnos
- Perfil de usuario básico

**Para Administradores:**
- Panel de administración básico
- Agenda del día
- Vista semanal de turnos
- Búsqueda de turnos por cliente
- Gestión de servicios (crear, editar, eliminar)
- Cancelación de turnos con notificación al cliente
- Bloqueo de fechas (vacaciones, feriados)
- Exportación de turnos a CSV

**Sistema Base:**
- Calendario interactivo con disponibilidad
- Validación de horarios laborales
- Límite de turnos activos por usuario
- Reglas de seguridad de Firestore
- Hosting en Firebase

---

### **Versión 2.0** (Octubre 2025)

Mejoras significativas en UX/UI, métricas avanzadas y nuevas funcionalidades.

#### Nuevas Funcionalidades V2:

**Para Clientes:**
- ✨ **Historial completo de turnos** con filtros avanzados (por estado, período, servicio)
- ✨ **Modificación de turnos** (hasta 2 veces por turno)
- ✨ **Sistema de lista de espera** para horarios ocupados
- ✨ **Modo oscuro/claro** con cambio dinámico
- ✨ **Perfil mejorado** con estadísticas personales y gestión de listas de espera
- ✨ **Validación de fechas bloqueadas** en tiempo real

**Para Administradores:**
- ✨ **Dashboard completo** con métricas en tiempo real:
  - Ingresos del mes calculados automáticamente
  - Gráfico de turnos por día (últimos 7 días)
  - Top 3 servicios más solicitados del mes
  - Horarios más populares
  - Clientes frecuentes (más de 3 turnos)
  - Próximo turno con detalles del cliente
- ✨ **Marcar turnos como completados**
- ✨ **Modo oscuro** en panel de administración
- ✨ **Estadísticas de servicios** más solicitados
- ✨ **Badges visuales** de cantidad de turnos por día en el calendario

**Sistema de Notificaciones:**
- ✨ Email de confirmación al reservar turno
- ✨ Recordatorio 24 horas antes del turno
- ✨ Notificación al cancelar turno
- ✨ Notificación de lista de espera cuando se libera un horario
- ✨ Templates HTML profesionales con SendGrid

**Mejoras de UX/UI:**
- ✨ Modo oscuro con contraste optimizado (WCAG AA)
- ✨ SweetAlert2 modales personalizados para ambos modos
- ✨ Horarios sugeridos destacados visualmente
- ✨ Mejoras de contraste en calendario y selección de servicios
- ✨ Estados de carga y mensajes informativos
- ✨ Diseño responsive mejorado

**Mejoras Técnicas:**
- ✨ Sistema de cache busting para actualizaciones
- ✨ Validación robusta de fechas bloqueadas
- ✨ Filtros de historial con 24 combinaciones posibles
- ✨ Filtrado por fecha de cancelación para turnos cancelados
- ✨ Headers de seguridad en Firebase Hosting
- ✨ PWA improvements (manifest, service worker)
- ✨ Logs detallados para debugging

---

## 🎨 Funcionalidades Principales

### Para Clientes 👥

✅ Autenticación segura con Firebase Auth
✅ Reserva de turnos con calendario interactivo
✅ Modificación de turnos (hasta 2 veces)
✅ Cancelación con 1 hora de anticipación
✅ Sistema de lista de espera automático
✅ Historial completo con filtros avanzados
✅ Perfil editable con estadísticas
✅ Notificaciones por email automáticas
✅ Modo oscuro/claro

### Para Administradores 👨‍💼

✅ Dashboard con métricas en tiempo real
✅ Ingresos y estadísticas del mes
✅ Top 3 servicios más solicitados
✅ Agenda del día con detalles completos
✅ Vista semanal completa
✅ Búsqueda de turnos
✅ Gestión completa de servicios (CRUD)
✅ Marcar turnos como completados
✅ Bloqueo de fechas
✅ Exportación a CSV
✅ Modo oscuro

---

## 🛠 Tecnologías

### Frontend
- **Vanilla JavaScript** (ES6+) - Sin frameworks
- **HTML5** & **CSS3** con CSS Custom Properties
- **SweetAlert2** - Modales elegantes
- **Toastify.js** - Notificaciones toast

### Backend & Servicios
- **Firebase Authentication** - Autenticación de usuarios
- **Firebase Firestore** - Base de datos NoSQL en tiempo real
- **Firebase Functions** - Funciones serverless para emails
- **Firebase Hosting** - Hosting estático con CDN
- **SendGrid API** - Envío de emails transaccionales

### Herramientas de Desarrollo
- **Git** & **GitHub** - Control de versiones
- **Firebase CLI** - Deployment y gestión
- **VS Code** - Editor de código

---

## 👥 Equipo de Desarrollo

### Versión 1.0 (Septiembre 2025)

**Desarrollo Full Stack y Documentación:**
- Mateo Santucci
- Teo Gandolfo

**Testing:**
- Pedro Hauchar
- Bruno Carlomagno
- Eugenia Ojeda

---

### Versión 2.0 (Octubre 2025)

**Desarrollo Full Stack:**
- Eugenia Ojeda

**Documentación y Testing:**
- Teo Gandolfo
- Mateo Santucci
- Pedro Hauchar
- Bruno Carlomagno

---

## 🚀 Instalación

### Prerrequisitos

- Node.js 18+ instalado
- Firebase CLI (`npm install -g firebase-tools`)
- Cuenta de Firebase (plan Blaze para Functions)
- Cuenta de SendGrid para emails

### Pasos de Instalación

1. **Clonar el repositorio:**
```bash
git clone https://github.com/euge-90/app_turnos.git
cd app_turnos
```

2. **Configurar Firebase:**
```bash
firebase login
firebase init
```

3. **Instalar dependencias de Functions:**
```bash
cd functions
npm install
cd ..
```

4. **Configurar SendGrid API Key:**
```bash
firebase functions:config:set sendgrid.key="TU_API_KEY_AQUI"
```

5. **Configurar Firestore:**
- Ir a Firebase Console
- Crear base de datos Firestore
- Aplicar las reglas de seguridad desde `firestore.rules`
- Aplicar los índices desde `firestore.indexes.json`

---

## ⚙️ Configuración

### 1. Firebase Config (`public/js/firebase-config.js`)

Actualizar con las credenciales de tu proyecto Firebase:

```javascript
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROJECT.firebaseapp.com",
    projectId: "TU_PROJECT_ID",
    storageBucket: "TU_BUCKET",
    messagingSenderId: "TU_SENDER_ID",
    appId: "TU_APP_ID"
};
```

### 2. Configuración del Sistema

En `firebase-config.js`:

```javascript
const CONFIG = {
    horaApertura: 9,              // Hora de apertura (9:00)
    horaCierre: 18,               // Hora de cierre (18:00)
    intervaloMinutos: 30,         // Intervalo entre turnos
    diasLaborales: [2, 3, 4, 5, 6], // Martes a Sábado
    maxTurnosPorUsuario: 3,       // Máximo de turnos activos
    diasAnticipacion: 120,        // Días de anticipación (4 meses)
    maxModificaciones: 2,         // Máximo de modificaciones por turno
    adminEmail: 'admin@peluqueria.com' // Email del administrador
};
```

### 3. SendGrid Email Verificado

En `functions/index.js`:

```javascript
const EMAIL_FROM = 'noreply@tudominio.com'; // Email verificado en SendGrid
const APP_URL = 'https://tu-dominio.web.app';
```

---

## 📁 Estructura del Proyecto

```
app_turnos/
├── public/
│   ├── index.html              # Página principal (cliente)
│   ├── login.html              # Login/Registro
│   ├── admin.html              # Panel de administración
│   ├── css/
│   │   ├── turnos-calendar.css # Estilos generales + modo oscuro
│   │   └── admin.css           # Estilos del panel admin
│   ├── js/
│   │   ├── firebase-config.js  # Configuración de Firebase
│   │   ├── auth.js             # Autenticación
│   │   ├── app.js              # Lógica principal cliente
│   │   ├── admin.js            # Lógica panel admin
│   │   └── validation.js       # Validaciones
│   ├── images/                 # Imágenes y logo
│   ├── manifest.webmanifest    # Manifest PWA
│   └── service-worker.js       # Service Worker PWA
├── functions/                  # Firebase Functions
│   ├── index.js                # Funciones de email y notificaciones
│   └── package.json            # Dependencias Functions
├── firestore.rules             # Reglas de seguridad Firestore
├── firestore.indexes.json      # Índices de Firestore
├── firebase.json               # Configuración Firebase
├── .firebaserc                 # Configuración de proyectos
└── README.md                   # Este archivo
```

---

## 🚀 Deploy

### Deploy Completo

```bash
# Deploy de todo el proyecto
firebase deploy

# O deploy selectivo:
firebase deploy --only hosting          # Solo frontend
firebase deploy --only firestore:rules  # Solo reglas
firebase deploy --only functions        # Solo functions
```

### Deploy Inicial

1. **Configurar proyecto:**
```bash
firebase use --add
```

2. **Deploy firestore:**
```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

3. **Deploy functions:**
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

4. **Deploy hosting:**
```bash
firebase deploy --only hosting
```

### URLs de Acceso

- **App Cliente:** https://appturnos-a085a.web.app
- **Panel Admin:** https://appturnos-a085a.web.app/admin.html
- **Firebase Console:** https://console.firebase.google.com/project/appturnos-a085a

---

## 🧪 Testing

El proyecto incluye documentación de testing:

- **CASOS_DE_PRUEBA.md** - Casos de prueba funcionales
- **REPORTE_DEFECTOS.md** - Reporte de bugs encontrados y resueltos

---

## 📚 Documentación Adicional

- **DOCUMENTACION_USO_IA.md** - Documentación de desarrollo con Claude Code
- **.claude/** - Configuración de Claude Code para desarrollo asistido por IA

---

## 🔒 Seguridad

- Autenticación con Firebase Authentication
- Reglas de seguridad de Firestore validadas
- Headers de seguridad en hosting (CSP, X-Frame-Options, etc.)
- Validación de permisos en cliente y servidor
- API Keys protegidas con Firebase Functions config

---

## 📄 Licencia

Este proyecto es de uso académico/educativo desarrollado para la materia de Ingeniería de Software.

---

## 📧 Contacto

**Equipo de Desarrollo**

**V1.0:** Mateo Santucci, Teo Gandolfo
**V2.0:** Eugenia Ojeda
**Testing:** Pedro Hauchar, Bruno Carlomagno

**Repositorio:** https://github.com/euge-90/app_turnos

---

## 🎉 Agradecimientos

Gracias a todo el equipo por el esfuerzo y dedicación en el desarrollo de Turnify en sus dos versiones.

---

**Desarrollado con ❤️ para la gestión eficiente de turnos**

**Versión Actual:** 2.0.0
**Fecha:** Octubre 2025
**Estado:** ✅ En Producción

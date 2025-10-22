# ✂️ Turnify V2 - Sistema de Gestión de Turnos para Peluquería

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Firebase](https://img.shields.io/badge/Firebase-9.22.0-orange)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-purple)
![License](https://img.shields.io/badge/license-Academic-green)

Sistema web completo para gestión de turnos de peluquería, desarrollado con Vanilla JavaScript y Firebase. Incluye panel de administración avanzado, notificaciones por email, lista de espera, y mucho más.

---

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Equipo](#-equipo)
- [Tecnologías](#-tecnologías)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Funcionalidades](#-funcionalidades)
- [Deploy](#-deploy)
- [Testing](#-testing)
- [Changelog](#-changelog)
- [Licencia](#-licencia)

---

## ✨ Características

### Para Clientes 👥

- ✅ Registro e inicio de sesión con Firebase Auth
- ✅ Reserva de turnos con selección de servicio, fecha y hora
- ✅ Modificación de turnos (hasta 2 veces por turno)
- ✅ Cancelación de turnos (con 1 hora de anticipación)
- ✅ Historial completo de turnos (completados y cancelados)
- ✅ Perfil de usuario editable (nombre, teléfono)
- ✅ Cambio de contraseña seguro con re-autenticación
- ✅ **NUEVO:** Lista de espera para horarios ocupados
- ✅ **NUEVO:** Notificaciones por email automáticas
- ✅ **NUEVO:** Estadísticas personales de turnos
- ✅ **NUEVO:** Vista de listas de espera activas en perfil

### Para Administradores 👨‍💼

- ✅ **Dashboard completo** con métricas en tiempo real
- ✅ **Ingresos del mes** calculados automáticamente
- ✅ **Gráfico de turnos** por día de la semana
- ✅ **Top 3 servicios** más solicitados con medallas
- ✅ **Horarios populares** del mes
- ✅ **Clientes frecuentes** (más de 3 turnos)
- ✅ **Próximo turno** con detalles del cliente
- ✅ Agenda del día con vista detallada
- ✅ Vista semanal completa
- ✅ Búsqueda de turnos por cliente
- ✅ **Marcar turnos como completados**
- ✅ Cancelar turnos con notificación al cliente
- ✅ Gestión completa de servicios (CRUD)
- ✅ Bloqueo de fechas (vacaciones, feriados)
- ✅ Exportación de turnos a CSV por mes
- ✅ Estadísticas de servicios más solicitados

### Sistema de Notificaciones 💌

- ✅ Email de confirmación al reservar
- ✅ Recordatorio 24 horas antes del turno
- ✅ Email al cancelar turno
- ✅ Notificación de lista de espera
- ✅ Templates HTML profesionales y responsivos
- ✅ Integración con SendGrid API

### Sistema de Lista de Espera ⏰

- ✅ Modal automático cuando un horario está ocupado
- ✅ Notificación automática cuando se libera
- ✅ Sistema FIFO (First In, First Out)
- ✅ Gestión desde el perfil del usuario
- ✅ Integración con sistema de cancelaciones

---

## 👥 Equipo

### Versión 2.0 (Octubre 2025)

**Desarrolladora Principal:**
- **Eugenia Ojeda** - Desarrollo Full Stack

**Documentación y Testing:**
- Teo Gandolfo
- Mateo Santucci
- Pedro Hauchar
- Bruno Carlomagno

---

## 🛠 Tecnologías

### Frontend
- **Vanilla JavaScript** (ES6+)
- **HTML5** & **CSS3**
- **Bootstrap 5.3** - Framework CSS
- **SweetAlert2** - Modales elegantes
- **Toastify.js** - Notificaciones toast

### Backend & Servicios
- **Firebase Authentication** - Autenticación de usuarios
- **Firebase Firestore** - Base de datos NoSQL en tiempo real
- **Firebase Functions** - Funciones serverless para emails
- **Firebase Hosting** - Hosting estático
- **SendGrid API** - Envío de emails transaccionales

### Herramientas de Desarrollo
- **Git** & **GitHub** - Control de versiones
- **Firebase CLI** - Deployment y gestión
- **VS Code** - Editor de código

---

## 🚀 Instalación

### Prerrequisitos

- Node.js 18+ instalado
- Firebase CLI instalado (`npm install -g firebase-tools`)
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

### 2. Email del Administrador

En `firebase-config.js`, configurar el email del admin:

```javascript
const CONFIG = {
    // ... otras configuraciones
    adminEmail: 'admin@tudominio.com' // Email del administrador
};
```

### 3. SendGrid Email Verificado

En `functions/index.js`, configurar el email verificado en SendGrid:

```javascript
const EMAIL_FROM = 'noreply@tudominio.com'; // Email verificado en SendGrid
const APP_URL = 'https://tu-dominio.web.app'; // URL de tu aplicación
```

### 4. Horarios y Configuración

En `firebase-config.js`, personalizar:

```javascript
const CONFIG = {
    horaApertura: 9,              // Hora de apertura (9:00)
    horaCierre: 18,               // Hora de cierre (18:00)
    intervaloMinutos: 30,         // Intervalo entre turnos
    diasLaborales: [2, 3, 4, 5, 6], // Martes a Sábado
    maxTurnosPorUsuario: 3,       // Máximo de turnos activos
    diasAnticipacion: 120,        // Días de anticipación (4 meses)
    servicios: [/* tus servicios */],
    adminEmail: 'admin@peluqueria.com'
};
```

---

## 📁 Estructura del Proyecto

```
app_turnos/
├── public/
│   ├── index.html              # Página principal (cliente)
│   ├── login.html              # Login/Registro
│   ├── admin.html              # Panel de administración ⭐ NUEVO
│   ├── css/
│   │   ├── turnos-calendar.css # Estilos generales
│   │   └── admin.css           # Estilos del panel admin ⭐ NUEVO
│   ├── js/
│   │   ├── firebase-config.js  # Configuración de Firebase
│   │   ├── auth.js             # Autenticación
│   │   ├── app.js              # Lógica principal cliente
│   │   ├── admin.js            # Lógica panel admin ⭐ NUEVO
│   │   └── validation.js       # Validaciones
│   └── icons/                  # Iconos para PWA (futuro)
├── functions/                  # Firebase Functions ⭐ NUEVO
│   ├── index.js                # Funciones de email ⭐ NUEVO
│   ├── package.json            # Dependencias Functions ⭐ NUEVO
│   └── templates/              # Templates HTML emails (futuro)
├── firestore.rules             # Reglas de seguridad Firestore ⭐ ACTUALIZADO
├── firestore.indexes.json      # Índices de Firestore
├── firebase.json               # Configuración Firebase
├── README.md                   # Este archivo ⭐ ACTUALIZADO
├── CHANGELOG.md                # Historial de cambios ⭐ NUEVO
├── DOCUMENTACION_USO_IA.md     # Documentación de desarrollo con IA
├── CASOS_DE_PRUEBA.md          # Casos de prueba
└── REPORTE_DEFECTOS.md         # Reporte de bugs
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

2. **Deploy firestore rules:**
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

- **App Cliente:** `https://TU-PROJECT.web.app`
- **Panel Admin:** `https://TU-PROJECT.web.app/admin.html`
- **Firebase Console:** `https://console.firebase.google.com/project/TU-PROJECT`

---

## 📚 Documentación Adicional

- **CHANGELOG.md:** Historial de cambios completo ⭐ NUEVO
- **DOCUMENTACION_USO_IA.md:** Documentación de desarrollo con IA
- **CASOS_DE_PRUEBA.md:** Casos de prueba detallados
- **REPORTE_DEFECTOS.md:** Bugs encontrados y resueltos

---

## 🤝 Contribuciones

Este es un proyecto académico/educativo. Para sugerencias o mejoras, contactar al equipo de desarrollo.

---

## 📄 Licencia

Este proyecto es de uso académico/educativo.

---

## 📧 Contacto

**Equipo de Desarrollo V2**
- Eugenia Ojeda - Desarrolladora Principal
- Teo Gandolfo, Mateo Santucci, Pedro Hauchar, Bruno Carlomagno - Documentación y Testing

**Repositorio:** https://github.com/euge-90/app_turnos

---

## 🎉 Agradecimientos

Gracias al equipo completo por el esfuerzo y dedicación en el desarrollo de Turnify V2.

---

**Desarrollado con ❤️ por el equipo de Turnify**

**Versión:** 2.0.0
**Fecha:** Octubre 2025
**Estado:** ✅ Producción

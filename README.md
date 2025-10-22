# 🎨 Turnify V2 - Sistema de Reserva de Turnos para Peluquería

Sistema web completo de gestión de turnos para peluquerías, desarrollado con **Vanilla JavaScript**, **Firebase** y **Bootstrap 5.3**.

**Versión**: 2.0
**Estado**: ✅ Producción

---

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Tecnologías Utilizadas](#-tecnologías-utilizadas)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación y Configuración](#-instalación-y-configuración)
- [Configuración de Firebase](#-configuración-de-firebase)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Funcionalidades Principales](#-funcionalidades-principales)
- [Despliegue](#-despliegue)
- [Seguridad](#-seguridad)
- [Solución de Problemas](#-solución-de-problemas)
- [Créditos](#-créditos)

---

## ✨ Características

### **Para Usuarios**
- ✅ Registro e inicio de sesión (email/contraseña o Google)
- 📅 Reserva de turnos con calendario interactivo
- ✏️ Modificación de turnos (hasta 2 veces por turno)
- ❌ Cancelación de turnos (con 1 hora de anticipación)
- 📊 Historial completo de turnos (completados y cancelados)
- 👤 Gestión de perfil (editar datos, cambiar contraseña, eliminar cuenta)
- 📱 Diseño 100% responsive (optimizado para iPhone SE y superiores)
- 🔔 Notificaciones toast para feedback inmediato

### **Seguridad y Validación**
- 🔒 Reglas de seguridad Firestore (backend)
- 🛡️ Validación en tiempo real con feedback visual
- 🚫 Prevención de doble reserva con transacciones atómicas
- 🔑 Re-autenticación obligatoria para acciones sensibles
- ⏰ Validación de fechas (solo futuras, dentro de 4 meses)

---

## 🛠 Tecnologías Utilizadas

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Backend**: Firebase (Authentication + Firestore)
- **UI Framework**: Bootstrap 5.3
- **Librerías**:
  - SweetAlert2 (modales y alertas)
  - Toastify.js (notificaciones no intrusivas)
- **Hosting**: Firebase Hosting
- **Versionamiento**: Git

---

## 📦 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- [Node.js](https://nodejs.org/) (v14 o superior)
- [Firebase CLI](https://firebase.google.com/docs/cli)
- Un navegador web moderno (Chrome, Firefox, Edge, Safari)
- Una cuenta de [Firebase](https://firebase.google.com/)

### Instalar Firebase CLI

```bash
npm install -g firebase-tools
```

---

## 🚀 Instalación y Configuración

### 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd app_turnos
```

### 2. Instalar dependencias (si las hubiera)

Este proyecto usa CDNs para las librerías, por lo que **no requiere** `npm install`. Sin embargo, necesitas Firebase CLI para el despliegue.

---

## 🔥 Configuración de Firebase

### Paso 1: Crear un proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Haz clic en **"Agregar proyecto"**
3. Nombra tu proyecto (ej: `turnos-peluqueria`)
4. Habilita Google Analytics (opcional)
5. Crea el proyecto

### Paso 2: Habilitar Authentication

1. En Firebase Console, ve a **Authentication** → **Sign-in method**
2. Habilita los siguientes proveedores:
   - **Email/Password**: Activar
   - **Google**: Activar (configura nombre público y correo de soporte)

### Paso 3: Crear base de datos Firestore

1. Ve a **Firestore Database**
2. Clic en **"Crear base de datos"**
3. Selecciona **"Modo de producción"** (aplicaremos reglas personalizadas)
4. Elige la ubicación más cercana (ej: `southamerica-east1`)

### Paso 4: Obtener credenciales de Firebase

1. En Firebase Console, ve a **Configuración del proyecto** (ícono ⚙️)
2. En la sección **"Tus apps"**, haz clic en el ícono web `</>`
3. Registra tu app con un nombre (ej: "Turnos Web")
4. **Copia las credenciales** que se muestran

### Paso 5: Configurar credenciales en el proyecto

Abre el archivo `public/js/firebase-config.js` y reemplaza las credenciales:

```javascript
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto-id",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};
```

### Paso 6: Configurar email del administrador

En el mismo archivo `firebase-config.js`, configura el email del administrador:

```javascript
const CONFIG = {
    // ... otras configuraciones
    adminEmail: 'admin@tudominio.com'  // ⬅️ Cambiar por tu email
};
```

### Paso 7: Desplegar reglas de seguridad de Firestore

Desde la raíz del proyecto:

```bash
firebase login
firebase use --add
# Selecciona tu proyecto de Firebase
firebase deploy --only firestore:rules
```

Esto aplicará las reglas de seguridad definidas en `firestore.rules`.

---

## 📁 Estructura del Proyecto

```
app_turnos/
├── public/
│   ├── css/
│   │   └── turnos-calendar.css      # Estilos principales
│   ├── js/
│   │   ├── firebase-config.js       # Configuración Firebase + Utils
│   │   ├── auth.js                  # Sistema de autenticación
│   │   ├── app.js                   # Lógica principal de turnos
│   │   └── validation.js            # Validaciones en tiempo real
│   ├── index.html                   # App principal (usuarios)
│   ├── login.html                   # Página de login/registro
│   └── admin.html                   # Panel admin (futuro)
├── firestore.rules                  # Reglas de seguridad Firestore
├── firebase.json                    # Configuración de Firebase Hosting
├── .firebaserc                      # Proyecto Firebase activo
└── README.md                        # Este archivo
```

---

## 🎯 Funcionalidades Principales

### 1️⃣ **Autenticación**

**Registro de usuarios**:
- Email/contraseña con validación en tiempo real
- Registro con Google (OAuth)
- Indicador de fortaleza de contraseña
- Validación de teléfono con formato argentino

**Inicio de sesión**:
- Email/contraseña
- Google Sign-In
- Persistencia de sesión (LOCAL)

### 2️⃣ **Reserva de Turnos**

**Proceso de reserva**:
1. Seleccionar servicio (Corte, Corte + Barba, Coloración, etc.)
2. Elegir fecha en calendario (días laborales: Martes a Sábado)
3. Seleccionar horario disponible (9:00 - 18:00 hs)
4. Confirmar reserva

**Validaciones**:
- Solo días laborales (martes a sábado)
- Rango de 4 meses desde hoy
- Máximo 3 turnos activos por usuario
- Prevención de doble reserva (transacciones atómicas)

### 3️⃣ **Modificación de Turnos**

- Hasta **2 modificaciones** por turno
- Anticipación mínima: **2 horas**
- Verificación de disponibilidad del nuevo horario

### 4️⃣ **Cancelación de Turnos**

- Anticipación mínima: **1 hora**
- Confirmación obligatoria
- Actualización inmediata del estado

### 5️⃣ **Historial de Turnos**

**Filtros disponibles**:
- Por estado: Todos / Completados / Cancelados
- Por período: Último mes / Últimos 3 meses / Todo el historial

**Estadísticas**:
- Total de turnos históricos
- Turnos completados
- Turnos cancelados

### 6️⃣ **Perfil de Usuario**

**Visualización**:
- Avatar con iniciales
- Nombre, email, teléfono
- Fecha de registro
- Estadísticas personales

**Edición**:
- Modificar nombre y teléfono
- Cambiar contraseña (con re-autenticación)
- Eliminar cuenta (doble confirmación + re-autenticación)

---

## 🌐 Despliegue

### Despliegue en Firebase Hosting

1. **Inicializar Firebase Hosting** (solo la primera vez):

```bash
firebase init hosting
# Selecciona:
# - Public directory: public
# - Configure as single-page app: Yes
# - Overwite index.html: No
```

2. **Desplegar**:

```bash
firebase deploy
```

3. **Acceder a tu app**:

Verás una URL como: `https://tu-proyecto.web.app`

### Despliegue solo de reglas Firestore

```bash
firebase deploy --only firestore:rules
```

### Despliegue solo del hosting

```bash
firebase deploy --only hosting
```

---

## 🔐 Seguridad

### Reglas de Firestore (firestore.rules)

Las reglas implementan validación a nivel de base de datos:

**Colección `usuarios`**:
- Solo el propietario puede leer/escribir sus datos
- El email no se puede modificar

**Colección `turnos`**:
- Solo turnos futuros
- Solo el propietario puede modificar/cancelar
- Máximo 3 turnos activos por usuario
- Modificaciones con anticipación mínima de 2 horas
- Cancelaciones con anticipación mínima de 1 hora

**Colección `fechasBloqueadas`**:
- Solo lectura para usuarios
- Solo admin puede escribir

### Validación Frontend

- **validation.js**: Módulo centralizado de validaciones
- Feedback visual en tiempo real (bordes verdes/rojos)
- Validación de email, teléfono, contraseñas
- Indicador de fortaleza de contraseña

---

## 🐛 Solución de Problemas

### Error: "Permission denied" al leer/escribir en Firestore

**Solución**: Despliega las reglas de seguridad:
```bash
firebase deploy --only firestore:rules
```

### No se muestran los turnos

**Causas posibles**:
1. Usuario no autenticado (verifica que `auth.currentUser` no sea null)
2. Reglas de Firestore bloqueando acceso
3. Datos de prueba no creados

**Solución**:
- Abre la consola del navegador (F12) y revisa errores
- Verifica en Firebase Console → Firestore que los datos existan

### Doble reserva del mismo horario

**Solución**: Este bug fue corregido en V2 usando transacciones atómicas. Asegúrate de usar la versión más reciente de `app.js`.

### Calendario no muestra 4 meses

**Solución**: Verifica en `firebase-config.js` que:
```javascript
diasAnticipacion: 120  // ✅ 4 meses (no 90)
```

### Botones demasiado pequeños en iPhone SE

**Solución**: Los estilos responsive están implementados en `turnos-calendar.css` (BUG-008 FIX). Verifica que el CSS esté actualizado.

---

## 🎨 Personalización

### Cambiar horarios de atención

Edita `firebase-config.js`:

```javascript
const CONFIG = {
    horaApertura: 9,      // Hora inicio (9:00 AM)
    horaCierre: 18,       // Hora fin (6:00 PM)
    intervaloMinutos: 30, // Duración de cada slot
    // ...
};
```

### Cambiar días laborales

```javascript
const CONFIG = {
    // 0=Domingo, 1=Lunes, 2=Martes, etc.
    diasLaborales: [2, 3, 4, 5, 6], // Martes a Sábado
    // ...
};
```

### Agregar o modificar servicios

```javascript
const CONFIG = {
    servicios: [
        { id: 'corte', nombre: 'Corte de Cabello', duracion: 30, precio: 2000 },
        { id: 'nuevo', nombre: 'Nuevo Servicio', duracion: 60, precio: 3000 },
        // ...
    ]
};
```

### Cambiar colores

Edita las variables CSS en `turnos-calendar.css`:

```css
:root {
    --primary-color: #2196f3;     /* Azul principal */
    --primary-dark: #1976d2;      /* Azul oscuro */
    --danger-color: #f44336;      /* Rojo */
    --success-color: #4caf50;     /* Verde */
    /* ... */
}
```

---

## 📊 Registro de Cambios (V2)

### 🆕 Nuevas Funcionalidades

- ✅ **REQ-V2-01**: Modificación de turnos (hasta 2 veces)
- ✅ **REQ-V2-02**: Historial de turnos con filtros
- ✅ **REQ-V2-03**: Validaciones mejoradas con feedback visual
- ✅ **REQ-V2-04**: Soporte para autenticación con Google
- ✅ **REQ-V2-05**: Gestión completa de perfil de usuario
- ✅ **REQ-V2-08**: Toast notifications para mejor UX

### 🐛 Bugs Corregidos

- ✅ **BUG-001**: Doble reserva del mismo horario (transacciones atómicas)
- ✅ **BUG-003**: Reserva de fechas pasadas (validación backend)
- ✅ **BUG-005**: Navegación de calendario más allá de 4 meses
- ✅ **BUG-006**: Cancelación sin mínimo de anticipación
- ✅ **BUG-008**: Elementos táctiles pequeños en iPhone SE

---

## 📝 Notas de Desarrollo

### Convenciones de Código

- **Nombres de variables**: camelCase
- **Nombres de funciones**: camelCase descriptivo
- **Comentarios**: En español, explicando el "por qué", no el "qué"
- **Async/Await**: Preferir sobre `.then()/.catch()`

### Testing Recomendado

Antes de producción, probar:

1. ✅ Registro de nuevo usuario
2. ✅ Login con email/password y con Google
3. ✅ Reservar un turno
4. ✅ Modificar turno (2 veces)
5. ✅ Cancelar turno
6. ✅ Ver historial con filtros
7. ✅ Editar perfil
8. ✅ Cambiar contraseña
9. ✅ Eliminar cuenta
10. ✅ Intentar doble reserva (debe fallar)
11. ✅ Responsive en móvil (iPhone SE mínimo)

---

## 📄 Licencia

Este proyecto es de código abierto. Puedes usarlo y modificarlo libremente para tu negocio.

---

## 👨‍💻 Créditos

**Versión**: 2.0
**Fecha**: Octubre 2025

### Tecnologías y Librerías

- [Firebase](https://firebase.google.com/) - Backend as a Service
- [Bootstrap](https://getbootstrap.com/) - Framework CSS
- [SweetAlert2](https://sweetalert2.github.io/) - Modales y alertas
- [Toastify.js](https://apvarun.github.io/toastify-js/) - Notificaciones toast

---

**¡Gracias por usar Turnify V2! 🎉**

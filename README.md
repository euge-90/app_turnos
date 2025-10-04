# ✂️ Sistema de Reserva de Turnos para Peluquería

Sistema web completo para gestión de turnos, desarrollado con Firebase (100% gratis para siempre).

## 🌟 Características

### Para Clientes:
- ✅ Registro e inicio de sesión seguro
- ✅ Calendario interactivo para seleccionar fechas
- ✅ Ver horarios disponibles en tiempo real
- ✅ Reservar turnos fácilmente
- ✅ Ver y cancelar turnos activos
- ✅ Múltiples servicios disponibles
- ✅ Responsive (funciona en PC, tablet y móvil)

### Para Administradores:
- ✅ Panel de administración completo
- ✅ Ver agenda del día y de la semana
- ✅ Buscar turnos por cliente
- ✅ Cancelar turnos
- ✅ Bloquear fechas (vacaciones, feriados)
- ✅ Estadísticas de turnos
- ✅ Exportar datos a CSV
- ✅ Ver servicios más solicitados

## 🛠️ Tecnologías

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Firebase (Firestore + Authentication + Hosting)
- **Librerías**: SweetAlert2 para notificaciones
- **Costo**: $0 (Gratis para siempre dentro de los límites de Firebase)

## 📁 Estructura del Proyecto

```
app_turnos/
├── public/
│   ├── index.html          # Página principal (reserva de turnos)
│   ├── login.html          # Página de login/registro
│   ├── admin.html          # Panel de administración
│   ├── css/
│   │   └── turnos-calendar.css
│   ├── js/
│   │   ├── firebase-config.js   # Configuración de Firebase
│   │   ├── auth.js              # Sistema de autenticación
│   │   ├── app.js               # Lógica de turnos (clientes)
│   │   └── admin.js             # Lógica del panel admin
│   └── img/
├── firebase.json           # Configuración de Firebase Hosting
├── firestore.rules         # Reglas de seguridad de Firestore
├── firestore.indexes.json  # Índices de Firestore
├── .gitignore
├── .firebaserc
├── DEPLOY.md              # 📘 GUÍA COMPLETA DE DEPLOYMENT
├── README.md
└── package.json
```

## 🚀 Deployment

**Lee el archivo DEPLOY.md para instrucciones paso a paso completas.**

Resumen rápido:

1. Crear proyecto en Firebase Console
2. Configurar Authentication y Firestore
3. Instalar Firebase CLI: `npm install -g firebase-tools`
4. Login: `firebase login`
5. Inicializar: `firebase init`
6. Desplegar: `firebase deploy`

## ⚙️ Configuración

Edita `public/js/firebase-config.js` para personalizar:

```javascript
const CONFIG = {
    horaApertura: 9,                    // Hora de apertura (9 AM)
    horaCierre: 18,                     // Hora de cierre (6 PM)
    intervaloMinutos: 30,               // Slots de 30 minutos
    diasLaborales: [2, 3, 4, 5, 6],    // Mar-Sáb
    maxTurnosPorUsuario: 3,            // Máximo 3 turnos activos
    diasAnticipacion: 30,              // Reservar hasta 30 días adelante
    servicios: [...],                  // Lista de servicios
    adminEmail: 'admin@peluqueria.com' // Email del administrador
};
```

## 👥 Usuarios

### Cliente Normal:
- Registrarse con cualquier email
- Acceso a: reservar turnos, ver turnos, cancelar turnos

### Administrador:
- Email: `admin@peluqueria.com` (configurable)
- Acceso a: todo lo anterior + panel de administración
- Crear este usuario al registrarse por primera vez después del deployment

## 📱 Características Técnicas

### Seguridad:
- Autenticación Firebase
- Reglas de Firestore configuradas
- Validación de datos en cliente y servidor
- Protección contra reservas duplicadas

### Performance:
- Cache de disponibilidad (5 minutos)
- Índices optimizados en Firestore
- Assets con cache HTTP
- Consultas eficientes

### UX:
- Loading states en todas las acciones
- Mensajes de error claros en español
- Confirmaciones para acciones críticas
- Diseño responsive mobile-first

## 🎨 Personalización

### Cambiar colores:
Edita las variables CSS en `public/css/turnos-calendar.css`:

```css
:root {
    --primary-color: #2196f3;  /* Azul principal */
    --primary-dark: #1976d2;   /* Azul oscuro */
    --secondary-color: #ff9800; /* Naranja */
    /* ... */
}
```

### Agregar servicios:
Modifica el array `servicios` en `CONFIG`:

```javascript
servicios: [
    {
        id: 'nuevo-servicio',
        nombre: 'Nuevo Servicio',
        duracion: 60,  // minutos
        precio: 3000   // pesos
    }
]
```

### Cambiar horarios:
```javascript
horaApertura: 10,  // 10 AM
horaCierre: 20,    // 8 PM
```

### Cambiar días laborales:
```javascript
diasLaborales: [1, 2, 3, 4, 5], // Lun-Vie
// 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb
```

## 🔧 Desarrollo Local

```bash
# Instalar dependencias (si las hay)
npm install

# Servir localmente
firebase serve

# Abrir en navegador
# http://localhost:5000
```

## 📊 Límites Gratuitos de Firebase

- **Firestore**: 50,000 lecturas/día, 20,000 escrituras/día, 1 GB almacenamiento
- **Hosting**: 10 GB almacenamiento, 360 MB/día transferencia
- **Authentication**: Usuarios ilimitados

Para una peluquería pequeña/mediana: **Nunca llegarás a estos límites**.

## 🐛 Debugging

### Ver logs en el navegador:
1. Presiona F12
2. Ve a la pestaña "Console"
3. Busca errores en rojo

### Ver datos en Firestore:
1. Firebase Console → Firestore Database
2. Ver colecciones: `turnos`, `usuarios`, `fechasBloqueadas`

### Problemas comunes:

**No puedo reservar turnos:**
- Verifica que estés autenticado
- Revisa las reglas de Firestore
- Chequea la consola del navegador

**No puedo acceder al admin:**
- Verifica que el email sea exactamente `admin@peluqueria.com`
- Revisa `CONFIG.adminEmail` en `firebase-config.js`

## 📄 Licencia

Este proyecto es de código abierto. Úsalo libremente para tu negocio.

## 🤝 Contribuciones

Si encuentras bugs o tienes mejoras, ¡son bienvenidas!

## 📞 Contacto

Para soporte técnico, consulta la documentación de Firebase:
https://firebase.google.com/docs

---

**¡Hecho con ❤️ para peluquerías que quieren modernizarse sin gastar dinero!**

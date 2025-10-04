# 🚀 Guía de Deployment - Sistema de Turnos

Esta guía te llevará paso a paso para poner tu aplicación ONLINE, GRATIS y PARA SIEMPRE usando Firebase.

---

## 📋 PASO 1: Crear Cuenta en Firebase

1. Ve a https://console.firebase.google.com
2. Haz clic en "Agregar proyecto"
3. Nombre del proyecto: `peluqueria-turnos` (o el nombre que prefieras)
4. **IMPORTANTE**: Desactiva Google Analytics (no lo necesitamos y es más rápido)
5. Haz clic en "Crear proyecto"
6. Espera unos segundos mientras se crea

---

## 📋 PASO 2: Configurar Firebase Authentication

1. En la consola de Firebase, ve a **Authentication** en el menú izquierdo
2. Haz clic en "Comenzar"
3. Habilita los siguientes métodos de inicio de sesión:
   - ✅ **Correo electrónico/Contraseña**: Actívalo
   - ✅ **Google** (opcional): Actívalo si quieres login con Google
4. Haz clic en "Guardar"

---

## 📋 PASO 3: Configurar Firestore Database

1. En el menú izquierdo, ve a **Firestore Database**
2. Haz clic en "Crear base de datos"
3. Modo: Selecciona **"Comenzar en modo de producción"**
4. Ubicación: Elige **"us-central"** (o la más cercana)
5. Haz clic en "Habilitar"
6. Espera a que se cree la base de datos

### Configurar Reglas de Seguridad:

1. Ve a la pestaña **"Reglas"**
2. COPIA Y PEGA el contenido del archivo `firestore.rules` de este proyecto
3. Haz clic en **"Publicar"**

### Configurar Índices:

1. Ve a la pestaña **"Índices"**
2. Por ahora no hace falta agregar nada, Firebase los creará automáticamente cuando sean necesarios

---

## 📋 PASO 4: Obtener Configuración de Firebase

1. Ve a **Configuración del proyecto** (ícono de engranaje arriba a la izquierda)
2. En "Tus apps", haz clic en el ícono **</>** (Web)
3. Nombre de la app: `Sistema de Turnos`
4. **NO** marques "Configurar Firebase Hosting" aún
5. Haz clic en "Registrar app"
6. COPIA toda la configuración que aparece (algo como esto):

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "peluqueria-turnos.firebaseapp.com",
  projectId: "peluqueria-turnos",
  storageBucket: "peluqueria-turnos.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

7. Abre el archivo `public/js/firebase-config.js` en tu editor
8. REEMPLAZA los valores `COMPLETAR_DESPUES_DEL_DEPLOY` con los valores que copiaste
9. GUARDA el archivo

---

## 📋 PASO 5: Instalar Firebase CLI

Abre tu terminal/CMD en la carpeta del proyecto y ejecuta:

```bash
npm install -g firebase-tools
```

Espera a que se instale completamente.

---

## 📋 PASO 6: Iniciar Sesión en Firebase

```bash
firebase login
```

Esto abrirá tu navegador. Inicia sesión con la misma cuenta de Google que usaste en Firebase Console.

---

## 📋 PASO 7: Inicializar Firebase en el Proyecto

```bash
firebase init
```

Se te harán varias preguntas. Responde así:

1. **Which Firebase features do you want to set up?**
   - ✅ Firestore
   - ✅ Hosting
   - (Usa las flechas y espacio para seleccionar, Enter para continuar)

2. **Please select an option:**
   - Selecciona: **"Use an existing project"**

3. **Select a default Firebase project:**
   - Selecciona tu proyecto (peluqueria-turnos o como lo hayas llamado)

4. **What file should be used for Firestore Rules?**
   - Presiona Enter (usa el predeterminado: `firestore.rules`)

5. **File firestore.rules already exists. Do you want to overwrite it?**
   - Escribe: **N** (NO, porque ya está configurado)

6. **What file should be used for Firestore indexes?**
   - Presiona Enter (usa el predeterminado: `firestore.indexes.json`)

7. **File firestore.indexes.json already exists. Overwrite?**
   - Escribe: **N** (NO)

8. **What do you want to use as your public directory?**
   - Escribe: **public**

9. **Configure as a single-page app (rewrite all urls to /index.html)?**
   - Escribe: **Y** (SÍ)

10. **Set up automatic builds and deploys with GitHub?**
    - Escribe: **N** (NO por ahora)

11. **File public/index.html already exists. Overwrite?**
    - Escribe: **N** (NO)

---

## 📋 PASO 8: Actualizar .firebaserc

1. Abre el archivo `.firebaserc`
2. Reemplaza `TU_PROJECT_ID_AQUI` con el ID real de tu proyecto Firebase
3. GUARDA el archivo

Debería verse así:

```json
{
  "projects": {
    "default": "peluqueria-turnos"
  }
}
```

---

## 📋 PASO 9: Desplegar Reglas de Firestore

```bash
firebase deploy --only firestore:rules
```

Espera a que confirme: ✓ Deploy complete!

---

## 📋 PASO 10: ¡DESPLEGAR LA APLICACIÓN! 🎉

```bash
firebase deploy --only hosting
```

Espera unos segundos...

### ¡LISTO! 🎊

Cuando termine verás algo como:

```
✓ Deploy complete!

Hosting URL: https://peluqueria-turnos.web.app
```

**ESA ES TU URL PÚBLICA. ¡Tu app está ONLINE!**

---

## 📋 PASO 11: Crear Usuario Administrador

1. Abre tu app en el navegador: `https://TU-PROYECTO.web.app`
2. Ve a la página de registro
3. Crea un usuario con el email: **admin@peluqueria.com**
4. Usa una contraseña segura y guárdala
5. Este usuario tendrá acceso al panel de administración en `/admin.html`

---

## 🔧 Comandos Útiles

### Ver tu app localmente antes de desplegar:
```bash
firebase serve
```
Luego abre: http://localhost:5000

### Desplegar cambios:
```bash
firebase deploy
```

### Solo desplegar Hosting:
```bash
firebase deploy --only hosting
```

### Solo desplegar Firestore:
```bash
firebase deploy --only firestore
```

### Ver logs:
```bash
firebase functions:log
```

---

## 🎨 Personalización

### Cambiar configuración de la peluquería:

Edita `public/js/firebase-config.js` y modifica el objeto `CONFIG`:

```javascript
const CONFIG = {
    horaApertura: 9,           // Hora de apertura
    horaCierre: 18,            // Hora de cierre
    intervaloMinutos: 30,       // Duración de cada slot
    diasLaborales: [2,3,4,5,6], // 0=Dom, 1=Lun, 2=Mar, etc
    maxTurnosPorUsuario: 3,     // Máximo turnos simultáneos
    diasAnticipacion: 30,       // Cuántos días adelante se puede reservar
    servicios: [                // Lista de servicios
        { id: 'corte', nombre: 'Corte de Cabello', duracion: 30, precio: 2000 },
        // Agregar más servicios aquí
    ],
    adminEmail: 'admin@peluqueria.com' // Email del admin
};
```

Después de modificar, ejecuta: `firebase deploy --only hosting`

---

## 📱 Hacer la App Instalable (PWA)

Para que los usuarios puedan "instalar" la app en su celular:

1. Crea el archivo `public/manifest.json`:

```json
{
  "name": "Sistema de Turnos - Mi Peluquería",
  "short_name": "Turnos",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#2196f3",
  "theme_color": "#2196f3",
  "icons": [
    {
      "src": "/img/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/img/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

2. Agrega en el `<head>` de index.html, login.html y admin.html:

```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#2196f3">
```

3. Despliega: `firebase deploy --only hosting`

---

## 🆘 Solución de Problemas

### Error: "Permission denied"
- Revisa las reglas de Firestore en Firebase Console
- Asegúrate de estar autenticado correctamente

### Error: "Project not found"
- Verifica que `.firebaserc` tenga el ID correcto del proyecto
- Ejecuta `firebase use --add` y selecciona tu proyecto

### Los turnos no se guardan:
- Verifica que hayas desplegado las reglas: `firebase deploy --only firestore:rules`
- Revisa la consola del navegador (F12) para ver errores

### La app no se ve bien en mobile:
- Asegúrate de tener la etiqueta viewport en el `<head>`:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ```

---

## 💰 Costos

**COMPLETAMENTE GRATIS** siempre que te mantengas dentro de los límites del plan gratuito de Firebase:

- **Firestore**: 50,000 lecturas/día, 20,000 escrituras/día
- **Hosting**: 10 GB de almacenamiento, 360 MB/día de transferencia
- **Authentication**: Usuarios ilimitados

Para una peluquería pequeña/mediana, NUNCA alcanzarás estos límites.

---

## 🔐 Seguridad

1. **NUNCA** compartas tus credenciales de admin
2. Cambia el email de admin en `CONFIG.adminEmail` si es necesario
3. Las reglas de Firestore YA están configuradas para máxima seguridad
4. Considera habilitar 2FA en tu cuenta de Google

---

## 📊 Monitoreo

Ve a Firebase Console → Analytics → Dashboard para ver:
- Usuarios activos
- Páginas más visitadas
- Errores

---

## 🎉 ¡FELICITACIONES!

Tu sistema de turnos está ONLINE, GRATIS y funcionando 24/7.

**URL de tu app**: https://TU-PROYECTO.web.app
**Panel admin**: https://TU-PROYECTO.web.app/admin.html

---

## 📞 Soporte

Si tienes problemas:
1. Revisa la consola del navegador (F12)
2. Revisa los logs de Firebase: `firebase functions:log`
3. Consulta la documentación: https://firebase.google.com/docs

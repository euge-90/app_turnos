# Documentación de Uso de Herramientas IA - Turnify

**Proyecto:** Sistema de Gestión de Turnos Turnify
**Versión:** 2.0  
**Fecha:** Octubre 2025  
**Desarrrolladora V2:** Eugenia Ojeda
**Documentacion y Testers V2:** Teo Gandolfo, Mateo Santucci, Pedro Hauchar y Bruno Carlomagno

---

## Resumen de Uso

| Herramienta | Usos | Principal Aplicación |
|-------------|------|---------------------|
| ChatGPT 4.0 | 6 | Lógica compleja, Firebase, validaciones |
| GitHub Copilot | 4 | Autocompletado, funciones auxiliares |
| Google Gemini | 2 | OAuth, casos específicos |

**Porcentaje de código generado por IA:** ~60%  
**Porcentaje modificado manualmente:** ~40%

---

## 1. Sistema de Autenticación (RF1)

**🤖 Herramienta:** ChatGPT 4.0

**Prompt:**
> "Crear sistema de autenticación con Firebase: registro con email/password, login, validación en tiempo real, persistencia de sesión, manejo de errores en español, feedback visual. Usar Vanilla JavaScript."

**Código generado por IA:**
```javascript
async function loginUsuario(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}
```

**Modificaciones realizadas:**
- ✏️ Agregué manejo de errores en español
- ✏️ Implementé validación de campos vacíos
- ✏️ Agregué feedback con SweetAlert2
- ✏️ Agregué protección de rutas

**Archivo:** `public/js/auth.js` (líneas 1-250)

---

## 2. Calendario de Turnos (RF2)

**🤖 Herramienta:** GitHub Copilot

**Prompt (comentario):**
```javascript
// Generar calendario mensual: días laborales (martes-sábado), 
// deshabilitar pasados, límite 4 meses, navegación prev/next
```

**Código sugerido por Copilot:**
```javascript
function generarCalendario(mes, anio) {
  const primerDia = new Date(anio, mes, 1);
  // ... código básico de calendario
}
```

**Modificaciones realizadas:**
- ✏️ Agregué validación de días laborales desde CONFIG
- ✏️ Implementé límite de navegación de 4 meses
- ✏️ Agregué estilos CSS para días deshabilitados
- ✏️ Implementé validación de fechas pasadas

**Archivo:** `public/js/app.js` (líneas 120-350)  
**Bug corregido:** BUG-005

---

## 3. Reservas con Transacciones (RF3-RF4)

**🤖 Herramienta:** ChatGPT 4.0

**Prompt:**
> "Sistema de reserva con Firestore usando transacciones atómicas para prevenir dobles reservas, validar máximo 3 turnos activos, guardar: fecha, hora, servicio, usuario, estado. Manejo de errores robusto."

**Código generado por IA:**
```javascript
async function reservarTurno(fecha, hora, servicio) {
  const result = await db.runTransaction(async (transaction) => {
    // Verificar disponibilidad
    const horariosRef = db.collection('turnos')
      .where('fecha', '==', fecha)
      .where('hora', '==', hora)
      .where('estado', '==', 'activo');
    
    const snapshot = await transaction.get(horariosRef);
    if (!snapshot.empty) {
      throw new Error('Horario ocupado');
    }
    // ... crear turno
  });
}
```

**Modificaciones realizadas:**
- ✏️ Agregué validación de fecha futura
- ✏️ Agregué anticipación mínima de 2 horas
- ✏️ Implementé confirmación con SweetAlert2
- ✏️ Mejoré manejo de errores de concurrencia

**Archivo:** `public/js/app.js` (líneas 380-550)  
**Bug corregido:** BUG-001 (CRÍTICO - doble reserva)

---

## 4. Modificación de Turnos (RF7 V2)

**🤖 Herramienta:** ChatGPT 4.0

**Prompt:**
> "Función para modificar turnos: máximo 2 modificaciones, anticipación 2 horas, verificar disponibilidad con transacciones, guardar historial de cambios."

**Código generado por IA:**
```javascript
async function modificarTurno(turnoId, nuevaFecha, nuevaHora) {
  await db.runTransaction(async (transaction) => {
    const turnoRef = db.collection('turnos').doc(turnoId);
    const turnoDoc = await transaction.get(turnoRef);
    
    if (turnoDoc.data().modificaciones >= 2) {
      throw new Error('Límite alcanzado');
    }
    // ... actualizar turno
  });
}
```

**Modificaciones realizadas:**
- ✏️ Validé que turno esté activo
- ✏️ Validé que fecha/hora sean diferentes
- ✏️ Agregué UI con calendario para modificación
- ✏️ Implementé visualización de historial

**Archivo:** `public/js/app.js` (líneas 800-1050)

---

## 5. Historial con Filtros (RF8 V2)

**🤖 Herramienta:** GitHub Copilot

**Prompt (comentario):**
```javascript
// Cargar historial de turnos con filtros por estado 
// (todos/activo/completado/cancelado) y período (mes/3meses/todos)
```

**Código sugerido por Copilot:**
```javascript
async function cargarHistorialTurnos() {
  const snapshot = await db.collection('turnos')
    .where('userId', '==', userId)
    .orderBy('fecha', 'desc')
    .get();
}
```

**Modificaciones realizadas:**
- ✏️ Implementé sistema de filtros completo
- ✏️ Agregué cálculo de estadísticas
- ✏️ Mejoré renderización con colores según estado
- ✏️ Agregué manejo de historial vacío

**Archivo:** `public/js/app.js` (líneas 1050-1350)

---

## 6. Validaciones en Tiempo Real (RNF2 V2)

**🤖 Herramienta:** ChatGPT 4.0

**Prompt:**
> "Módulo de validaciones en tiempo real: email (regex), teléfono argentino (+54 9 11), contraseña (mínimo 6 chars con indicador de fortaleza), confirmación, feedback visual con bordes verde/rojo."

**Código generado por IA:**
```javascript
const Validaciones = {
  email(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  },
  password(password) {
    return password.length >= 6;
  }
};
```

**Modificaciones realizadas:**
- ✏️ Mejoré regex para casos edge
- ✏️ Agregué función de fortaleza de contraseña con barra
- ✏️ Implementé feedback visual con iconos
- ✏️ Agregué validación de confirmación

**Archivo:** `public/js/validation.js` (completo)

---

## 7. Google OAuth (RF9 V2)

**🤖 Herramienta:** Google Gemini

**Prompt:**
> "Implementar Google Sign-In con Firebase: popup auth, crear documento en Firestore si es nuevo usuario, manejar popup bloqueado, estilos del botón según guías de Google."

**Código generado por Gemini:**
```javascript
async function loginConGoogle() {
  const result = await signInWithPopup(auth, provider);
  await db.collection('users').doc(result.user.uid).set({
    nombre: result.user.displayName,
    email: result.user.email
  }, { merge: true });
}
```

**Modificaciones realizadas:**
- ✏️ Agregué detección de nuevo usuario vs existente
- ✏️ Mejoré manejo de errores (popup bloqueado)
- ✏️ Agregué botón con logo SVG oficial
- ✏️ Implementé mensajes personalizados

**Archivo:** `public/js/auth.js` (líneas 250-400)

---

## 8. Gestión de Perfil (RF10 V2)

**🤖 Herramienta:** ChatGPT 4.0

**Prompt:**
> "Sistema de perfil: editar nombre/teléfono, cambiar contraseña con re-autenticación, eliminar cuenta con triple confirmación, verificar turnos activos."

**Código generado por IA:**
```javascript
async function cambiarPassword(passwordActual, passwordNueva) {
  const credential = firebase.auth.EmailAuthProvider.credential(
    user.email, passwordActual
  );
  await user.reauthenticateWithCredential(credential);
  await user.updatePassword(passwordNueva);
}
```

**Modificaciones realizadas:**
- ✏️ Agregué triple confirmación para eliminar
- ✏️ Implementé verificación de turnos activos
- ✏️ Agregué eliminación en batch
- ✏️ Agregué visualización de avatar con iniciales

**Archivo:** `public/js/app.js` (líneas 1350-1800)

---

## 9. Estilos CSS Responsive

**🤖 Herramienta:** ChatGPT 4.0

**Prompts:**
- "Estilos CSS para calendario responsive"
- "Fix iPhone SE - botones mínimo 44x44px WCAG"
- "Mejorar contraste accesibilidad WCAG AA"

**Modificaciones realizadas:**
- ✏️ Aumenté tamaño de botones a 48px (BUG-008)
- ✏️ Implementé variables CSS
- ✏️ Mejoré contraste de colores
- ✏️ Agregué animaciones suaves

**Archivo:** `public/css/turnos-calendar.css`

---

## 10. Reglas Firestore

**🤖 Herramienta:** ChatGPT 4.0

**Prompt:**
> "Reglas Firestore: usuarios solo leen/escriben sus datos, validar turnos futuros, limitar modificaciones."

**Modificaciones realizadas:**
- ✏️ Agregué validaciones de campos obligatorios
- ✏️ Implementé validación de fechas futuras
- ✏️ Agregué validación de máximo 3 turnos
- ✏️ Implementé reglas para admin

**Archivo:** `firestore.rules`

---

## Conclusión

### ✅ Lo que la IA hace bien:
- Generar código base rápidamente
- Proporcionar estructura inicial
- Sugerir patrones comunes

### ❌ Lo que requirió trabajo manual:
- Ajustar reglas de negocio específicas
- Manejar casos edge
- Optimizar rendimiento
- Corregir bugs de concurrencia
- Mejorar UX personalizado

**La IA aceleró el desarrollo en ~50%, pero el código requirió modificaciones significativas para cumplir con los requerimientos y corregir bugs críticos.**

---


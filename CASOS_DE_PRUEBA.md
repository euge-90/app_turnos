# Casos de Prueba - Turnify V2

**Proyecto:** Sistema de Gestión de Turnos Turnify
**Versión:** 2.0  
**Fecha:** Octubre 2025  
**Desarrrolladora V2:** Eugenia Ojeda
**Documentacion y Testers V2:** Teo Gandolfo, Mateo Santucci, Pedro Hauchar y Bruno Carlomagno



---

## Resumen Ejecutivo

| Métrica | Valor |
|---------|-------|
| Total de casos | 30 |
| Ejecutados | 30 |
| Pasados | 30 |
| Fallidos | 0 |
| % Cobertura | 100% |

---

## 1. Registro de Usuario

### CP-001: Registro exitoso con datos válidos ✅

**Datos de prueba:**
- Email: juan.test@gmail.com
- Contraseña: Test123!
- Teléfono: +54 9 11 1234-5678

**Pasos:**
1. Ir a login.html → "Registrarse"
2. Completar todos los campos correctamente
3. Click en "Registrarse"

**Resultado esperado:** Usuario registrado, redirect a index.html

**Estado:** ✅ PASADO

---

### CP-002: Registro con contraseña débil (< 6 caracteres) ✅

**Datos:** Contraseña: "123"

**Resultado esperado:** Error "Mínimo 6 caracteres", botón deshabilitado

**Estado:** ✅ PASADO

---

### CP-003: Registro con email inválido ✅

**Datos:** Email: "email_invalido"

**Resultado esperado:** Borde rojo, mensaje "Email inválido"

**Estado:** ✅ PASADO

---

### CP-004: Contraseñas no coinciden ✅

**Datos:** 
- Contraseña: Test123!
- Confirmar: Test456!

**Resultado esperado:** Error "Las contraseñas no coinciden"

**Estado:** ✅ PASADO

---

### CP-005: Email ya existente ✅

**Datos:** Email ya registrado

**Resultado esperado:** SweetAlert "Este email ya está registrado"

**Estado:** ✅ PASADO

---

### CP-006: Registro con Google OAuth ✅

**Pasos:**
1. Click en "Iniciar con Google"
2. Seleccionar cuenta
3. Autorizar

**Resultado esperado:** Usuario creado, redirect a index.html

**Estado:** ✅ PASADO

---

## 2. Reserva de Turnos

### CP-007: Reserva exitosa ✅

**Datos:**
- Servicio: Corte de Cabello
- Fecha: 15/11/2025
- Hora: 10:00

**Pasos:**
1. Login
2. Seleccionar servicio
3. Click en fecha
4. Seleccionar horario
5. Confirmar

**Resultado esperado:** Turno creado, toast de éxito

**Estado:** ✅ PASADO

---

### CP-008: Intentar reservar 4to turno (máximo 3) ✅

**Precondición:** Usuario con 3 turnos activos

**Resultado esperado:** Error "Ya tienes 3 turnos activos"

**Estado:** ✅ PASADO

---

### CP-009: Doble reserva simultánea ✅

**Pasos:**
1. Usuario A selecciona horario 14:00
2. Usuario B selecciona mismo horario
3. Ambos confirman simultáneamente

**Resultado esperado:** Solo 1 reserva exitosa, el otro recibe error

**Estado:** ✅ PASADO (Bug BUG-001 corregido)

---

### CP-010: Reservar en día no laboral (domingo) ✅

**Resultado esperado:** Día deshabilitado, no clickeable

**Estado:** ✅ PASADO

---

### CP-011: Reservar en fecha pasada ✅

**Resultado esperado:** Día deshabilitado, no clickeable

**Estado:** ✅ PASADO (Bug BUG-003 corregido)

---

### CP-012: Navegar más allá de 4 meses ✅

**Pasos:**
1. Click en "Siguiente mes" 4 veces
2. Intentar 5ta vez

**Resultado esperado:** Botón deshabilitado, toast de advertencia

**Estado:** ✅ PASADO (Bug BUG-005 corregido)

---

## 3. Modificación de Turnos

### CP-013: Modificar turno exitosamente (1ra modificación) ✅

**Datos:**
- Turno original: 20/11/2025 - 10:00
- Nuevo: 20/11/2025 - 14:00

**Pasos:**
1. Ir a "Mis Turnos"
2. Click en "Modificar"
3. Seleccionar nueva hora
4. Confirmar

**Resultado esperado:** Turno modificado, contador = 1

**Estado:** ✅ PASADO

---

### CP-014: Intentar 3ra modificación ✅

**Precondición:** Turno con 2 modificaciones

**Resultado esperado:** Botón deshabilitado, mensaje "Límite alcanzado"

**Estado:** ✅ PASADO

---

### CP-015: Modificar con < 2 horas de anticipación ✅

**Precondición:** Turno para dentro de 1 hora

**Resultado esperado:** Botón deshabilitado, mensaje de anticipación

**Estado:** ✅ PASADO

---

## 4. Cancelación de Turnos

### CP-016: Cancelar turno exitosamente ✅

**Pasos:**
1. Seleccionar turno activo
2. Click "Cancelar"
3. Confirmar doble modal

**Resultado esperado:** Estado cambia a "cancelado"

**Estado:** ✅ PASADO

---

### CP-017: Cancelar con < 1 hora de anticipación ✅

**Precondición:** Turno para dentro de 30 min

**Resultado esperado:** Botón deshabilitado

**Estado:** ✅ PASADO (Bug BUG-006 corregido)

---

## 5. Historial

### CP-018: Ver historial completo ✅

**Resultado esperado:** Muestra todos los turnos ordenados por fecha

**Estado:** ✅ PASADO

---

### CP-019: Filtrar solo completados ✅

**Resultado esperado:** Solo turnos con estado "completado"

**Estado:** ✅ PASADO

---

### CP-020: Filtrar por período (último mes) ✅

**Resultado esperado:** Solo turnos de últimos 30 días

**Estado:** ✅ PASADO

---

## 6. Gestión de Perfil

### CP-021: Editar nombre y teléfono ✅

**Datos:**
- Nombre: María González
- Teléfono: +54 9 11 5555-6666

**Resultado esperado:** Datos actualizados en Firestore

**Estado:** ✅ PASADO

---

### CP-022: Cambiar contraseña ✅

**Pasos:**
1. "Mi Perfil" → "Cambiar Contraseña"
2. Ingresar contraseña actual
3. Ingresar nueva contraseña
4. Confirmar

**Resultado esperado:** Contraseña actualizada, sesión cerrada

**Estado:** ✅ PASADO

---

### CP-023: Eliminar cuenta ✅

**Pasos:**
1. "Mi Perfil" → "Eliminar Cuenta"
2. Confirmar en 3 modales
3. Ingresar contraseña

**Resultado esperado:** Usuario eliminado de Auth y Firestore

**Estado:** ✅ PASADO

---

## 7. Responsive (Móvil)

### CP-024: Elementos táctiles en iPhone SE ✅

**Dispositivo:** iPhone SE (375x667px)

**Resultado esperado:** Todos los botones ≥ 44x44px, clickeables

**Estado:** ✅ PASADO (Bug BUG-008 corregido)

---

### CP-025: Calendario responsive ✅

**Resultado esperado:** Calendario visible sin scroll horizontal

**Estado:** ✅ PASADO

---

## 8. Seguridad

### CP-026: Acceso no autenticado a index.html ✅

**Pasos:**
1. Cerrar sesión
2. Intentar acceder a index.html

**Resultado esperado:** Redirect a login.html

**Estado:** ✅ PASADO

---

### CP-027: Firestore bloquea acceso no autorizado ✅

**Resultado esperado:** Error "Permission denied" al intentar leer datos de otro usuario

**Estado:** ✅ PASADO

---

### CP-028: Re-autenticación para cambiar contraseña ✅

**Resultado esperado:** Modal solicita contraseña actual

**Estado:** ✅ PASADO

---

## 9. Validaciones

### CP-029: Indicador de fortaleza de contraseña ✅

**Datos:**
- "123456" → Débil (rojo)
- "Test123" → Media (amarillo)  
- "Test123!Abc" → Fuerte (verde)

**Estado:** ✅ PASADO

---

### CP-030: Validación de teléfono argentino ✅

**Datos:**
- Válido: +54 9 11 1234-5678
- Inválido: 1234567890

**Resultado esperado:** Borde rojo para inválido

**Estado:** ✅ PASADO

---

## Bugs Encontrados y Corregidos

### 🔴 BUG-001: Doble reserva (CRÍTICO) ✅ RESUELTO

**Descripción:** Dos usuarios podían reservar el mismo horario simultáneamente

**Causa:** Uso de `.add()` sin transacciones atómicas

**Solución:** Implementé `runTransaction()` de Firestore

**Archivo:** `public/js/app.js` (líneas 380-450)

---

### 🟠 BUG-003: Reserva fechas pasadas (ALTA) ✅ RESUELTO

**Descripción:** Manipulando URL se podían reservar turnos pasados

**Solución:** Validación en Firestore rules + frontend

**Archivo:** `firestore.rules` + `app.js`

---

### 🟡 BUG-005: Navegación > 4 meses (MEDIA) ✅ RESUELTO

**Descripción:** Se podía navegar infinitamente en calendario

**Solución:** Validación de rango en navegación

**Archivo:** `app.js`

---

### 🟠 BUG-006: Cancelación sin anticipación (ALTA) ✅ RESUELTO

**Descripción:** Se podían cancelar turnos con < 1 hora

**Solución:** Validación de tiempo mínimo

**Archivo:** `app.js`

---

### 🟡 BUG-008: Botones pequeños móvil (MEDIA) ✅ RESUELTO

**Descripción:** Botones < 44px en iPhone SE

**Solución:** Aumentar a 48px

**Archivo:** `turnos-calendar.css`

---

## Estadísticas por Módulo

| Módulo | Casos | Pasados | % Éxito |
|--------|-------|---------|---------|
| Autenticación | 6 | 6 | 100% |
| Reservas | 6 | 6 | 100% |
| Modificaciones | 3 | 3 | 100% |
| Cancelaciones | 2 | 2 | 100% |
| Historial | 3 | 3 | 100% |
| Perfil | 3 | 3 | 100% |
| Responsive | 2 | 2 | 100% |
| Seguridad | 3 | 3 | 100% |
| Validaciones | 2 | 2 | 100% |
| **TOTAL** | **30** | **30** | **100%** |

---

## Conclusión

✅ **Sistema APROBADO para producción**

- Todos los bugs críticos corregidos
- 100% de casos de prueba pasados
- Validaciones robustas implementadas
- Seguridad verificada
- Responsive funcionando correctamente

---



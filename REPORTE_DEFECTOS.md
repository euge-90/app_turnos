# Reporte de Defectos - Turnify V2

**Proyecto:** Sistema de Gestión de Turnos Turnify
**Versión:** 2.0  
**Fecha:** Octubre 2025  
**Desarrrolladora V2:** Eugenia Ojeda
**Documentacion y Testers V2:** Teo Gandolfo, Mateo Santucci, Pedro Hauchar y Bruno Carlomagno

---

## Resumen Ejecutivo

| Métrica | Valor |
|---------|-------|
| Total de bugs | 5 |
| Críticos | 1 |
| Altos | 2 |
| Medios | 2 |
| Corregidos | 5 |
| Pendientes | 0 |
| % Resolución | 100% |

---

## BUG-001: Doble Reserva del Mismo Horario

**Severidad:** 🔴 CRÍTICA  
**Estado:** ✅ RESUELTO  
**Fecha detección:** 22/10/2025  
**Fecha resolución:** 24/10/2025

### Descripción
Cuando dos usuarios intentan reservar el mismo horario simultáneamente (dentro de 1-2 segundos), ambas reservas se completan exitosamente.

### Impacto
- **Negocio:** Conflictos de turnos, dos clientes a la misma hora
- **Usuario:** Mala experiencia, pérdida de confianza
- **Sistema:** Inconsistencia de datos

### Pasos para Reproducir
1. Abrir app en 2 navegadores (Chrome e Incógnito)
2. Login con 2 usuarios diferentes
3. Ambos seleccionan misma fecha y hora
4. Ambos confirman SIMULTÁNEAMENTE (< 2 seg)
5. **Resultado:** Ambos reciben confirmación de éxito

### Resultado Esperado
- Solo el primero debería poder reservar
- El segundo debería recibir error "Horario ya reservado"
- Solo 1 documento en Firestore

### Causa Raíz
Race condition: El tiempo entre la verificación (`get()`) y la inserción (`add()`) permitía doble reserva.

**Código problemático:**
```javascript
// ❌ ANTES
const existentes = await db.collection('turnos')
  .where('fecha', '==', fecha)
  .where('hora', '==', hora)
  .get();

if (!existentes.empty) {
  throw new Error('Ocupado');
}

// ⚠️ Otro usuario puede insertar aquí
await db.collection('turnos').add({ /* ... */ });
```

### Solución Implementada
Reemplazo por **transacciones atómicas**:

```javascript
// ✅ DESPUÉS
const result = await db.runTransaction(async (transaction) => {
  // Verificación dentro de la transacción
  const snapshot = await transaction.get(horariosRef);
  
  if (!snapshot.empty) {
    throw new Error('Horario ocupado');
  }
  
  // Crear turno ATÓMICAMENTE
  const nuevoTurnoRef = db.collection('turnos').doc();
  transaction.set(nuevoTurnoRef, { /* ... */ });
  
  return nuevoTurnoRef.id;
});
```

**Ventajas:**
- ✅ Operaciones de lectura/escritura atómicas
- ✅ Solo 1 usuario tiene éxito
- ✅ Retry automático en conflictos

### Archivos Modificados
- `public/js/app.js` (líneas 380-450)

### Testing Post-Fix
✅ CP-009 ejecutado: Intentar doble reserva
- Usuario A: ✅ Éxito
- Usuario B: ❌ Error
- Firestore: ✅ 1 documento

---

## BUG-003: Reserva de Fechas Pasadas

**Severidad:** 🟠 ALTA  
**Estado:** ✅ RESUELTO  
**Fecha:** 25/10/2025

### Descripción
Manipulando la consola del navegador o parámetros de URL, un usuario podía reservar turnos en fechas pasadas.

### Pasos para Reproducir
1. Abrir DevTools → Console
2. Ejecutar: `reservarTurno('2025-01-15', '10:00', 'Corte')`
3. **Resultado:** Turno reservado en fecha pasada

### Solución
Validaciones en **Firestore rules** (backend):

```javascript
// firestore.rules
match /turnos/{turnoId} {
  allow create: if request.auth != null
    && request.resource.data.fecha >= request.time.toMillis() // ✅ Backend
    && request.resource.data.userId == request.auth.uid;
}
```

Plus validación frontend:
```javascript
function validarFecha(fecha) {
  const hoy = new Date();
  if (new Date(fecha) < hoy) {
    throw new Error('No puedes reservar en fechas pasadas');
  }
}
```

### Archivos Modificados
- `firestore.rules`
- `public/js/app.js`

### Testing
✅ CP-011: Intentar reservar en fecha pasada
- Frontend: ❌ Error antes de enviar
- Backend: ❌ Firestore rechaza

---

## BUG-005: Navegación Más Allá de 4 Meses

**Severidad:** 🟡 MEDIA  
**Estado:** ✅ RESUELTO  
**Fecha:** 28/10/2025

### Descripción
Se podía navegar infinitamente en el calendario, excediendo el límite de 4 meses.

### Solución
```javascript
function navegarMes(direccion) {
  // Calcular diferencia en meses
  const diffMeses = (anioActual - anioInicial) * 12 
                    + mesActual - mesInicial;
  
  if (diffMeses > 4) {
    Toastify({
      text: "No puedes reservar más allá de 4 meses",
      backgroundColor: "#f44336"
    }).showToast();
    
    // Revertir navegación
    return;
  }
  
  generarCalendario(mesActual, anioActual);
}
```

### Archivo
- `public/js/app.js`

### Testing
✅ CP-012: Navegar 5 meses
- 4 meses: ✅ Funciona
- 5to mes: ❌ Bloqueado

---

## BUG-006: Cancelación Sin Anticipación

**Severidad:** 🟠 ALTA  
**Estado:** ✅ RESUELTO  
**Fecha:** 29/10/2025

### Descripción
Se podían cancelar turnos con menos de 1 hora de anticipación.

### Solución
```javascript
function puedeCancel(turno) {
  const fechaHoraTurno = new Date(`${turno.fecha}T${turno.hora}`);
  const horasDiferencia = (fechaHoraTurno - new Date()) / (1000 * 60 * 60);
  
  if (horasDiferencia < 1) {
    return {
      puede: false,
      mensaje: 'Debes cancelar con al menos 1 hora de anticipación'
    };
  }
  
  return { puede: true };
}
```

### Archivo
- `public/js/app.js`

### Testing
✅ CP-017: Cancelar turno para dentro de 30 min
- Botón: ❌ Deshabilitado
- Mensaje: ✅ Mostrado

---

## BUG-008: Elementos Táctiles Pequeños (Móvil)

**Severidad:** 🟡 MEDIA  
**Estado:** ✅ RESUELTO  
**Fecha:** 01/11/2025

### Descripción
Botones de horarios difíciles de presionar en iPhone SE (< 44px).

### Solución
```css
/* Tamaño mínimo WCAG */
.btn, .horario-btn {
  min-height: 48px;
  min-width: 48px;
  padding: 12px 24px;
}

@media (max-width: 480px) {
  .horario-btn {
    min-height: 48px;
    min-width: 100px;
    margin: 6px 4px; /* Más espacio */
  }
}
```

### Archivo
- `public/css/turnos-calendar.css`

### Testing
✅ CP-024: Elementos en iPhone SE
- Todos los botones: ✅ ≥ 44px
- Fácil de presionar: ✅

---

## Distribución de Bugs

### Por Severidad
| Severidad | Cantidad | % |
|-----------|----------|---|
| Crítica | 1 | 20% |
| Alta | 2 | 40% |
| Media | 2 | 40% |
| Baja | 0 | 0% |

### Por Origen
| Origen | Cantidad | % |
|--------|----------|---|
| Testing manual | 4 | 80% |
| Code review | 1 | 20% |
| Usuario | 0 | 0% |

### Tiempo de Resolución
| Bug | Severidad | Días para Fix |
|-----|-----------|---------------|
| BUG-001 | Crítica | 2 |
| BUG-003 | Alta | 0 (mismo día) |
| BUG-005 | Media | 0 (mismo día) |
| BUG-006 | Alta | 0 (mismo día) |
| BUG-008 | Media | 0 (mismo día) |

**Promedio:** 0.4 días (< 1 día)

---

## Lecciones Aprendidas

1. **Siempre usar transacciones para operaciones críticas** que involucren verificar-y-crear
2. **Validar en backend además de frontend** - el frontend puede ser bypasseado
3. **Testing de concurrencia es crucial** para apps con múltiples usuarios
4. **Elementos táctiles ≥ 44px** para móviles (WCAG)
5. **Límites de negocio deben validarse en múltiples capas** (UI, app, backend)

---

## Recomendaciones Futuras

1. ✅ Implementar testing automatizado (Cypress)
2. ✅ Agregar logging de transacciones
3. ✅ Monitoreo de errores en producción (Sentry)
4. ✅ Pruebas de carga con múltiples usuarios

---

## Estado Final

✅ **Todos los bugs críticos y altos resueltos**  
✅ **Sistema estable y testeado**  
✅ **Listo para producción**

---



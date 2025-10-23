/**
 * SCRIPT DE MIGRACIÓN DE DATOS ANTIGUOS
 * Convierte fechas de tipo Timestamp a String en la colección 'turnos'
 *
 * INSTRUCCIONES:
 * 1. Abrir la app en el navegador: https://appturnos-a085a.web.app/
 * 2. Iniciar sesión con una cuenta de administrador
 * 3. Abrir la consola del navegador (F12 → Console)
 * 4. Copiar y pegar todo este archivo en la consola
 * 5. Ejecutar: migrarDatosAntiguos()
 * 6. Esperar a que termine y revisar los logs
 *
 * IMPORTANTE: Ejecutar UNA SOLA VEZ
 */

async function migrarDatosAntiguos() {
    console.log('🔧 Iniciando migración de datos...');
    console.log('⚠️  IMPORTANTE: Este proceso puede tardar varios minutos si tienes muchos turnos');

    if (typeof firebase === 'undefined' || !firebase.firestore) {
        console.error('❌ Error: Firebase no está inicializado. Asegúrate de estar en la app.');
        return;
    }

    const db = firebase.firestore();
    const turnosRef = db.collection('turnos');

    try {
        // Obtener TODOS los turnos
        console.log('📥 Obteniendo todos los turnos de Firestore...');
        const snapshot = await turnosRef.get();

        let migratedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        console.log(`📊 Total de turnos a revisar: ${snapshot.size}`);
        console.log('');

        for (const doc of snapshot.docs) {
            try {
                const data = doc.data();
                const updates = {};
                let needsUpdate = false;

                // Verificar si 'fecha' NO es un string
                if (data.fecha && typeof data.fecha !== 'string') {
                    let fechaObj = data.fecha;

                    // Si es Timestamp de Firebase (tiene método toDate)
                    if (fechaObj.toDate && typeof fechaObj.toDate === 'function') {
                        fechaObj = fechaObj.toDate();
                    }

                    // Convertir Date a string ISO formato YYYY-MM-DD
                    if (fechaObj instanceof Date && !isNaN(fechaObj.getTime())) {
                        const fechaString = fechaObj.toISOString().split('T')[0];
                        updates.fecha = fechaString;
                        needsUpdate = true;

                        console.log(`  ✅ Turno ${doc.id}:`);
                        console.log(`     Fecha anterior: ${fechaObj}`);
                        console.log(`     Fecha nueva: ${fechaString}`);
                    } else {
                        console.warn(`  ⚠️  Turno ${doc.id}: fecha tiene formato desconocido, se omite`);
                        skippedCount++;
                    }
                } else if (typeof data.fecha === 'string') {
                    // Ya es string, verificar que tenga formato correcto
                    if (/^\d{4}-\d{2}-\d{2}$/.test(data.fecha)) {
                        console.log(`  ⏭️  Turno ${doc.id}: fecha ya es string (${data.fecha}), se omite`);
                        skippedCount++;
                    } else {
                        console.warn(`  ⚠️  Turno ${doc.id}: fecha tiene formato string incorrecto (${data.fecha})`);
                        skippedCount++;
                    }
                } else {
                    console.warn(`  ⚠️  Turno ${doc.id}: campo fecha es null o undefined`);
                    skippedCount++;
                }

                // Actualizar documento si es necesario
                if (needsUpdate) {
                    await doc.ref.update(updates);
                    migratedCount++;
                    console.log(`     💾 Actualizado en Firestore\n`);
                }

            } catch (error) {
                console.error(`  ❌ Error en turno ${doc.id}:`, error.message);
                errorCount++;
            }
        }

        console.log('');
        console.log('========================================');
        console.log('✅ MIGRACIÓN COMPLETADA');
        console.log('========================================');
        console.log(`   📊 Total de turnos revisados: ${snapshot.size}`);
        console.log(`   ✅ Turnos migrados: ${migratedCount}`);
        console.log(`   ⏭️  Turnos omitidos (ya correctos): ${skippedCount}`);
        console.log(`   ❌ Errores: ${errorCount}`);
        console.log('========================================');

        if (migratedCount > 0) {
            console.log('');
            console.log('🎉 ¡Migración exitosa!');
            console.log('💡 Ahora puedes probar crear un nuevo turno para verificar que todo funcione correctamente.');
        } else if (skippedCount === snapshot.size) {
            console.log('');
            console.log('ℹ️  Todos los turnos ya tienen el formato correcto. No fue necesario migrar nada.');
        }

    } catch (error) {
        console.error('');
        console.error('========================================');
        console.error('❌ ERROR GENERAL EN LA MIGRACIÓN');
        console.error('========================================');
        console.error(error);
        console.error('');
        console.error('💡 Posibles causas:');
        console.error('   - No tienes permisos suficientes en Firestore');
        console.error('   - Hay un problema de conexión');
        console.error('   - Las reglas de seguridad de Firestore bloquean la operación');
    }
}

// Función auxiliar para verificar un turno específico
async function verificarTurno(turnoId) {
    if (!turnoId) {
        console.error('❌ Debes proporcionar un ID de turno. Ejemplo: verificarTurno("abc123")');
        return;
    }

    const db = firebase.firestore();
    const doc = await db.collection('turnos').doc(turnoId).get();

    if (!doc.exists) {
        console.error(`❌ El turno ${turnoId} no existe`);
        return;
    }

    const data = doc.data();
    console.log('');
    console.log('========================================');
    console.log(`📋 DATOS DEL TURNO: ${turnoId}`);
    console.log('========================================');
    console.log('Campo "fecha":');
    console.log('  - Valor:', data.fecha);
    console.log('  - Tipo:', typeof data.fecha);
    console.log('  - Es Timestamp?:', data.fecha && data.fecha.toDate ? 'Sí' : 'No');
    console.log('  - Es String?:', typeof data.fecha === 'string' ? 'Sí' : 'No');
    console.log('  - Formato correcto?:', typeof data.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.fecha) ? '✅ Sí' : '❌ No');
    console.log('========================================');
    console.log('');
}

console.log('');
console.log('========================================');
console.log('📦 SCRIPT DE MIGRACIÓN CARGADO');
console.log('========================================');
console.log('');
console.log('Comandos disponibles:');
console.log('');
console.log('1️⃣  migrarDatosAntiguos()');
console.log('   Migra TODOS los turnos de Timestamp a String');
console.log('');
console.log('2️⃣  verificarTurno("ID_DEL_TURNO")');
console.log('   Verifica el formato de fecha de un turno específico');
console.log('');
console.log('========================================');
console.log('');

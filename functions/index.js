/**
 * TURNIFY V2 - FIREBASE FUNCTIONS
 * Sistema de notificaciones por email
 *
 * Funcionalidades:
 * - Email de confirmación al reservar turno
 * - Recordatorio 24 horas antes del turno
 * - Email de cancelación
 * - Notificación de lista de espera
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

// Inicializar Firebase Admin
admin.initializeApp();

// Configurar SendGrid API Key
// IMPORTANTE: Configurar con: firebase functions:config:set sendgrid.key="TU_API_KEY"
const SENDGRID_API_KEY = functions.config().sendgrid?.key;
if (SENDGRID_API_KEY) {
    sgMail.setApiKey(SENDGRID_API_KEY);
}

const EMAIL_FROM = 'noreply@turnify.com'; // Cambiar por tu email verificado en SendGrid
const APP_URL = 'https://appturnos-a085a.web.app'; // URL de tu app

/**
 * Función helper para formatear fecha
 */
function formatearFecha(fecha) {
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return fecha.toLocaleDateString('es-AR', opciones);
}

/**
 * Función helper para enviar email
 */
async function enviarEmail(to, subject, htmlContent) {
    if (!SENDGRID_API_KEY) {
        console.error('SendGrid API Key no configurada');
        return;
    }

    const msg = {
        to: to,
        from: EMAIL_FROM,
        subject: subject,
        html: htmlContent,
    };

    try {
        await sgMail.send(msg);
        console.log(`Email enviado a ${to}: ${subject}`);
    } catch (error) {
        console.error('Error al enviar email:', error);
        if (error.response) {
            console.error(error.response.body);
        }
    }
}

/**
 * 1. EMAIL DE CONFIRMACIÓN AL RESERVAR TURNO
 * Se ejecuta automáticamente cuando se crea un nuevo turno
 */
exports.enviarConfirmacionTurno = functions.firestore
    .document('turnos/{turnoId}')
    .onCreate(async (snap, context) => {
        const turno = snap.data();

        // Solo enviar si es un turno confirmado
        if (turno.estado !== 'confirmado') {
            return null;
        }

        const fecha = turno.fecha.toDate();
        const fechaFormateada = formatearFecha(fecha);

        const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }
        .content {
            padding: 30px;
        }
        .turno-info {
            background: #f5f5f5;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .turno-info p {
            margin: 10px 0;
            font-size: 16px;
            color: #212121;
        }
        .turno-info strong {
            color: #2196f3;
        }
        .button {
            display: inline-block;
            background: #2196f3;
            color: white;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
        }
        .footer {
            background: #f5f5f5;
            padding: 20px;
            text-align: center;
            color: #757575;
            font-size: 14px;
        }
        .alert-box {
            background: #fff3cd;
            border-left: 4px solid #ff9800;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✂️ Turnify</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">¡Turno Confirmado!</p>
        </div>
        <div class="content">
            <p style="font-size: 16px; color: #212121;">Hola <strong>${turno.usuarioNombre}</strong>,</p>
            <p>Tu turno ha sido confirmado exitosamente. A continuación los detalles:</p>

            <div class="turno-info">
                <p><strong>📅 Fecha:</strong> ${fechaFormateada}</p>
                <p><strong>🕐 Hora:</strong> ${turno.hora} hs</p>
                <p><strong>✂️ Servicio:</strong> ${turno.servicio.nombre}</p>
                <p><strong>⏱️ Duración:</strong> ${turno.servicio.duracion} minutos</p>
                <p><strong>💰 Precio:</strong> $${turno.servicio.precio}</p>
            </div>

            <div class="alert-box">
                <strong>⚠️ Importante:</strong> Recordá que podés cancelar o modificar tu turno con al menos 1 hora de anticipación desde la aplicación.
            </div>

            <div style="text-align: center;">
                <a href="${APP_URL}" class="button">Ver mi turno</a>
            </div>

            <p style="margin-top: 30px; color: #757575; font-size: 14px;">Te esperamos en:</p>
            <p style="color: #757575; font-size: 14px;">
                📍 Av. Principal 1234, CABA<br>
                📞 (011) 1234-5678
            </p>
        </div>
        <div class="footer">
            <p>© 2025 Turnify - Sistema de Gestión de Turnos</p>
            <p style="margin-top: 10px;">Este email fue generado automáticamente</p>
        </div>
    </div>
</body>
</html>
        `;

        await enviarEmail(
            turno.usuarioEmail,
            '✅ Turno Confirmado - Turnify',
            htmlContent
        );

        return null;
    });

/**
 * 2. RECORDATORIO 24 HORAS ANTES
 * Función programada que se ejecuta todos los días a las 9:00 AM
 */
exports.enviarRecordatorios24h = functions.pubsub
    .schedule('0 9 * * *') // Todos los días a las 9:00 AM (UTC)
    .timeZone('America/Argentina/Buenos_Aires')
    .onRun(async (context) => {
        const db = admin.firestore();

        // Calcular fecha de mañana
        const mañana = new Date();
        mañana.setDate(mañana.getDate() + 1);
        mañana.setHours(0, 0, 0, 0);

        const finMañana = new Date(mañana);
        finMañana.setHours(23, 59, 59, 999);

        // Buscar turnos confirmados para mañana
        const turnosSnapshot = await db.collection('turnos')
            .where('fecha', '>=', admin.firestore.Timestamp.fromDate(mañana))
            .where('fecha', '<=', admin.firestore.Timestamp.fromDate(finMañana))
            .where('estado', '==', 'confirmado')
            .get();

        console.log(`Enviando ${turnosSnapshot.size} recordatorios`);

        const promesas = turnosSnapshot.docs.map(async (doc) => {
            const turno = doc.data();
            const fecha = turno.fecha.toDate();
            const fechaFormateada = formatearFecha(fecha);

            const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }
        .content {
            padding: 30px;
        }
        .turno-info {
            background: #f5f5f5;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .turno-info p {
            margin: 10px 0;
            font-size: 16px;
            color: #212121;
        }
        .turno-info strong {
            color: #ff9800;
        }
        .button {
            display: inline-block;
            background: #ff9800;
            color: white;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
        }
        .footer {
            background: #f5f5f5;
            padding: 20px;
            text-align: center;
            color: #757575;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⏰ Recordatorio</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">Tu turno es mañana</p>
        </div>
        <div class="content">
            <p style="font-size: 16px; color: #212121;">Hola <strong>${turno.usuarioNombre}</strong>,</p>
            <p>Te recordamos que tenés un turno confirmado para mañana:</p>

            <div class="turno-info">
                <p><strong>📅 Fecha:</strong> ${fechaFormateada}</p>
                <p><strong>🕐 Hora:</strong> ${turno.hora} hs</p>
                <p><strong>✂️ Servicio:</strong> ${turno.servicio.nombre}</p>
                <p><strong>⏱️ Duración:</strong> ${turno.servicio.duracion} minutos</p>
            </div>

            <p style="color: #757575;">Te esperamos en:</p>
            <p style="color: #757575;">
                📍 Av. Principal 1234, CABA<br>
                📞 (011) 1234-5678
            </p>

            <div style="text-align: center;">
                <a href="${APP_URL}" class="button">Ver mi turno</a>
            </div>

            <p style="margin-top: 20px; font-size: 14px; color: #757575;">
                Si necesitás cancelar o modificar, podés hacerlo desde la aplicación.
            </p>
        </div>
        <div class="footer">
            <p>© 2025 Turnify - Sistema de Gestión de Turnos</p>
        </div>
    </div>
</body>
</html>
            `;

            return enviarEmail(
                turno.usuarioEmail,
                '⏰ Recordatorio: Tu turno es mañana - Turnify',
                htmlContent
            );
        });

        await Promise.all(promesas);
        return null;
    });

/**
 * 3. EMAIL DE CANCELACIÓN
 * Se ejecuta automáticamente cuando un turno es cancelado
 */
exports.enviarEmailCancelacion = functions.firestore
    .document('turnos/{turnoId}')
    .onUpdate(async (change, context) => {
        const turnoAntes = change.before.data();
        const turnoDespues = change.after.data();

        // Solo enviar si cambió de confirmado a cancelado
        if (turnoAntes.estado === 'confirmado' && turnoDespues.estado === 'cancelado') {
            const fecha = turnoDespues.fecha.toDate();
            const fechaFormateada = formatearFecha(fecha);

            const canceladoPor = turnoDespues.canceladoPor || 'cliente';
            const mensajeCancelacion = canceladoPor === 'admin'
                ? 'Tu turno ha sido cancelado por la peluquería.'
                : 'Tu turno ha sido cancelado exitosamente.';

            const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }
        .content {
            padding: 30px;
        }
        .turno-info {
            background: #ffebee;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #f44336;
        }
        .turno-info p {
            margin: 10px 0;
            font-size: 16px;
            color: #212121;
        }
        .button {
            display: inline-block;
            background: #2196f3;
            color: white;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
        }
        .footer {
            background: #f5f5f5;
            padding: 20px;
            text-align: center;
            color: #757575;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>❌ Turno Cancelado</h1>
        </div>
        <div class="content">
            <p style="font-size: 16px; color: #212121;">Hola <strong>${turnoDespues.usuarioNombre}</strong>,</p>
            <p>${mensajeCancelacion}</p>

            <div class="turno-info">
                <p><strong>📅 Fecha:</strong> ${fechaFormateada}</p>
                <p><strong>🕐 Hora:</strong> ${turnoDespues.hora} hs</p>
                <p><strong>✂️ Servicio:</strong> ${turnoDespues.servicio.nombre}</p>
            </div>

            ${canceladoPor === 'admin' ? '<p style="color: #f44336; font-weight: 600;">Si tenés alguna consulta, por favor contactanos.</p>' : ''}

            <p>Podés reservar un nuevo turno cuando quieras:</p>

            <div style="text-align: center;">
                <a href="${APP_URL}" class="button">Reservar nuevo turno</a>
            </div>
        </div>
        <div class="footer">
            <p>© 2025 Turnify - Sistema de Gestión de Turnos</p>
            <p style="margin-top: 10px;">📞 (011) 1234-5678</p>
        </div>
    </div>
</body>
</html>
            `;

            await enviarEmail(
                turnoDespues.usuarioEmail,
                '❌ Turno Cancelado - Turnify',
                htmlContent
            );
        }

        return null;
    });

/**
 * 4. NOTIFICACIÓN DE LISTA DE ESPERA
 * Se ejecuta cuando se actualiza el campo "notificado" en lista de espera
 */
exports.notificarListaEspera = functions.firestore
    .document('listaEspera/{listaId}')
    .onUpdate(async (change, context) => {
        const listaAntes = change.before.data();
        const listaDespues = change.after.data();

        // Solo enviar si cambió a notificado=true
        if (!listaAntes.notificado && listaDespues.notificado) {
            const fecha = new Date(listaDespues.fecha);
            const fechaFormateada = formatearFecha(fecha);

            const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }
        .content {
            padding: 30px;
        }
        .turno-info {
            background: #e8f5e9;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #4caf50;
        }
        .turno-info p {
            margin: 10px 0;
            font-size: 16px;
            color: #212121;
        }
        .button {
            display: inline-block;
            background: #4caf50;
            color: white;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
        }
        .alert {
            background: #fff3cd;
            border-left: 4px solid #ff9800;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .footer {
            background: #f5f5f5;
            padding: 20px;
            text-align: center;
            color: #757575;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 ¡Horario Disponible!</h1>
        </div>
        <div class="content">
            <p style="font-size: 16px; color: #212121;">Hola <strong>${listaDespues.userName}</strong>,</p>
            <p style="font-size: 16px;">¡Buenas noticias! El horario que esperabas se liberó:</p>

            <div class="turno-info">
                <p><strong>📅 Fecha:</strong> ${fechaFormateada}</p>
                <p><strong>🕐 Hora:</strong> ${listaDespues.hora} hs</p>
                <p><strong>✂️ Servicio:</strong> ${listaDespues.servicio}</p>
            </div>

            <div class="alert">
                <strong>⚡ ¡Apurate!</strong> Este horario puede ser reservado por otro cliente en cualquier momento.
            </div>

            <div style="text-align: center;">
                <a href="${APP_URL}" class="button">Reservar ahora</a>
            </div>

            <p style="margin-top: 20px; font-size: 14px; color: #757575;">
                Ingresá a la aplicación y reservá este horario antes que se llene.
            </p>
        </div>
        <div class="footer">
            <p>© 2025 Turnify - Sistema de Gestión de Turnos</p>
        </div>
    </div>
</body>
</html>
            `;

            await enviarEmail(
                listaDespues.userEmail,
                '🎉 ¡Horario disponible! Reservá ahora - Turnify',
                htmlContent
            );
        }

        return null;
    });

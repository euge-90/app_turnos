// Sistema de Autenticación

// Verificar estado de autenticación
auth.onAuthStateChanged((user) => {
    const currentPage = window.location.pathname;
    const isLoginPage = currentPage.includes('login.html');
    const isAdminPage = currentPage.includes('admin.html');

    if (user) {
        // Usuario autenticado
        if (isLoginPage) {
            // Redirigir desde login a la app
            if (user.email === CONFIG.adminEmail) {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'index.html';
            }
        } else if (isAdminPage) {
            // Verificar si el usuario es admin
            if (user.email !== CONFIG.adminEmail) {
                Utils.showError('Acceso Denegado', 'No tienes permisos de administrador');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
            }
        }
    } else {
        // Usuario no autenticado
        if (!isLoginPage) {
            window.location.href = 'login.html';
        }
    }
});

// Función para traducir errores de Firebase Auth
function traducirErrorAuth(error) {
    const errores = {
        'auth/email-already-in-use': 'Este email ya está registrado',
        'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
        'auth/invalid-email': 'Email inválido',
        'auth/user-not-found': 'Usuario no encontrado',
        'auth/wrong-password': 'Contraseña incorrecta',
        'auth/too-many-requests': 'Demasiados intentos fallidos. Intenta más tarde',
        'auth/network-request-failed': 'Error de conexión. Verifica tu internet',
        'auth/operation-not-allowed': 'Operación no permitida',
        'auth/user-disabled': 'Esta cuenta ha sido deshabilitada',
        'auth/requires-recent-login': 'Debes iniciar sesión nuevamente para esta operación'
    };
    return errores[error.code] || 'Error: ' + error.message;
}

// Función para registrar usuario
async function registrarUsuario(email, password, datosPersonales) {
    try {
        // Crear usuario en Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Guardar datos adicionales en Firestore
        await db.collection('usuarios').doc(user.uid).set({
            nombre: datosPersonales.nombre,
            telefono: datosPersonales.telefono,
            email: email,
            fechaRegistro: firebase.firestore.FieldValue.serverTimestamp(),
            turnosReservados: 0
        });

        // Actualizar displayName
        await user.updateProfile({
            displayName: datosPersonales.nombre
        });

        return user;
    } catch (error) {
        throw traducirErrorAuth(error);
    }
}

// Función para iniciar sesión
async function iniciarSesion(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        return userCredential.user;
    } catch (error) {
        throw traducirErrorAuth(error);
    }
}

// Función para iniciar sesión con Google
async function iniciarSesionConGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });

        const result = await auth.signInWithPopup(provider);
        const user = result.user;

        // Verificar si es nuevo usuario y crear documento en Firestore
        const userDoc = await db.collection('usuarios').doc(user.uid).get();

        if (!userDoc.exists) {
            await db.collection('usuarios').doc(user.uid).set({
                nombre: user.displayName,
                telefono: '',
                email: user.email,
                fechaRegistro: firebase.firestore.FieldValue.serverTimestamp(),
                turnosReservados: 0
            });
        }

        return user;
    } catch (error) {
        throw traducirErrorAuth(error);
    }
}

// Función para cerrar sesión
async function cerrarSesion() {
    try {
        await auth.signOut();
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
    }
}

// Event listeners para el formulario de login (solo en login.html)
if (document.getElementById('loginForm')) {
    const loginForm = document.getElementById('loginForm');
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const loginError = document.getElementById('loginError');
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');

    // Validación en tiempo real para login
    loginEmail.addEventListener('blur', () => {
        const validation = Validaciones.validateEmail(loginEmail.value);
        Validaciones.updateFieldStatus('loginEmail', validation);
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = loginEmail.value.trim();
        const password = loginPassword.value;

        // Limpiar errores
        loginError.style.display = 'none';
        loginError.textContent = '';

        // Validar con módulo Validaciones
        const validation = Validaciones.validateLoginForm({ email, password });

        if (!validation.valid) {
            const errorMessages = Object.values(validation.errors).join('. ');
            loginError.textContent = errorMessages;
            loginError.style.display = 'block';

            // Actualizar estado de campos
            if (validation.errors.email) {
                Validaciones.updateFieldStatus('loginEmail', {
                    valid: false,
                    message: validation.errors.email
                });
            }
            return;
        }

        try {
            loginSubmitBtn.disabled = true;
            loginSubmitBtn.textContent = 'Iniciando sesión...';

            await iniciarSesion(email, password);
            // La redirección se maneja en onAuthStateChanged
        } catch (error) {
            loginError.textContent = error;
            loginError.style.display = 'block';
            loginSubmitBtn.disabled = false;
            loginSubmitBtn.textContent = 'Iniciar Sesión';
        }
    });
}

// Event listeners para el formulario de registro (solo en login.html)
if (document.getElementById('registerForm')) {
    const registerForm = document.getElementById('registerForm');
    const registerName = document.getElementById('registerName');
    const registerEmail = document.getElementById('registerEmail');
    const registerPhone = document.getElementById('registerPhone');
    const registerPassword = document.getElementById('registerPassword');
    const registerPasswordConfirm = document.getElementById('registerPasswordConfirm');
    const registerError = document.getElementById('registerError');
    const registerSubmitBtn = document.getElementById('registerSubmitBtn');

    // Validación en tiempo real usando módulo Validaciones
    registerName.addEventListener('blur', () => {
        const validation = Validaciones.validateName(registerName.value);
        Validaciones.updateFieldStatus('registerName', validation);
    });

    registerEmail.addEventListener('blur', () => {
        const validation = Validaciones.validateEmail(registerEmail.value);
        Validaciones.updateFieldStatus('registerEmail', validation);
    });

    // Formatear teléfono mientras se escribe
    registerPhone.addEventListener('input', (e) => {
        const limpio = Validaciones.cleanPhone(e.target.value);
        if (limpio.length <= 10) {
            e.target.value = Validaciones.formatPhone(limpio);
        }
    });

    registerPhone.addEventListener('blur', () => {
        const validation = Validaciones.validatePhone(registerPhone.value);
        Validaciones.updateFieldStatus('registerPhone', validation);
    });

    registerPassword.addEventListener('input', () => {
        const validation = Validaciones.validatePassword(registerPassword.value);
        Validaciones.updateFieldStatus('registerPassword', validation);
    });

    registerPassword.addEventListener('blur', () => {
        const validation = Validaciones.validatePassword(registerPassword.value);
        Validaciones.updateFieldStatus('registerPassword', validation);
    });

    registerPasswordConfirm.addEventListener('blur', () => {
        const validation = Validaciones.validatePasswordConfirm(
            registerPassword.value,
            registerPasswordConfirm.value
        );
        Validaciones.updateFieldStatus('registerPasswordConfirm', validation);
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nombre = registerName.value.trim();
        const email = registerEmail.value.trim();
        const telefono = registerPhone.value;
        const password = registerPassword.value;
        const passwordConfirm = registerPasswordConfirm.value;

        // Limpiar error general
        registerError.style.display = 'none';
        registerError.textContent = '';

        // Validaciones
        if (!nombre || !email || !telefono || !password || !passwordConfirm) {
            registerError.textContent = 'Por favor completa todos los campos';
            registerError.style.display = 'block';
            return;
        }

        if (nombre.length < 3) {
            registerError.textContent = 'El nombre debe tener al menos 3 caracteres';
            registerError.style.display = 'block';
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            registerError.textContent = 'Email inválido';
            registerError.style.display = 'block';
            return;
        }

        const phoneDigits = telefono.replace(/\D/g, '');
        if (phoneDigits.length < 10) {
            registerError.textContent = 'Teléfono inválido';
            registerError.style.display = 'block';
            return;
        }

        if (password.length < 6) {
            registerError.textContent = 'La contraseña debe tener al menos 6 caracteres';
            registerError.style.display = 'block';
            return;
        }

        if (password !== passwordConfirm) {
            registerError.textContent = 'Las contraseñas no coinciden';
            registerError.style.display = 'block';
            return;
        }

        try {
            registerSubmitBtn.disabled = true;
            registerSubmitBtn.textContent = 'Creando cuenta...';

            await registrarUsuario(email, password, {
                nombre,
                telefono
            });

            // La redirección se maneja en onAuthStateChanged
        } catch (error) {
            registerError.textContent = error;
            registerError.style.display = 'block';
            registerSubmitBtn.disabled = false;
            registerSubmitBtn.textContent = 'Crear Cuenta';
        }
    });
}

// Event listener para Google Sign In (solo en login.html)
if (document.getElementById('googleLoginBtn')) {
    document.getElementById('googleLoginBtn').addEventListener('click', async () => {
        try {
            await iniciarSesionConGoogle();
            // La redirección se maneja en onAuthStateChanged
        } catch (error) {
            Utils.showError('Error', error);
        }
    });
}

// Event listener para logout (en todas las páginas excepto login)
if (document.getElementById('logoutBtn')) {
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        const result = await Utils.confirmar(
            '¿Cerrar Sesión?',
            '¿Estás seguro que deseas cerrar sesión?'
        );

        if (result.isConfirmed) {
            await cerrarSesion();
        }
    });
}

// Nota: La inicialización del modo oscuro se maneja en app.js para evitar duplicación

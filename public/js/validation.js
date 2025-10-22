// ========================================
// MÓDULO DE VALIDACIONES V2
// Sistema completo de validación de formularios
// ========================================

const Validaciones = {
    // ========================================
    // REGEX PATTERNS
    // ========================================
    patterns: {
        nombre: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{3,50}$/,
        email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
        password: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{6,}$/,
        telefono: /^[0-9]{10}$/
    },

    // ========================================
    // VALIDADORES INDIVIDUALES
    // ========================================

    /**
     * Validar nombre completo
     * @param {string} nombre - Nombre a validar
     * @returns {Object} - {valid: boolean, message: string}
     */
    validateName(nombre) {
        if (!nombre || nombre.trim().length === 0) {
            return {
                valid: false,
                message: 'El nombre es obligatorio'
            };
        }

        const nombreTrim = nombre.trim();

        if (nombreTrim.length < 3) {
            return {
                valid: false,
                message: 'El nombre debe tener al menos 3 caracteres'
            };
        }

        if (nombreTrim.length > 50) {
            return {
                valid: false,
                message: 'El nombre no puede exceder 50 caracteres'
            };
        }

        if (!this.patterns.nombre.test(nombreTrim)) {
            return {
                valid: false,
                message: 'El nombre solo puede contener letras y espacios'
            };
        }

        return {
            valid: true,
            message: ''
        };
    },

    /**
     * Validar email
     * @param {string} email - Email a validar
     * @returns {Object} - {valid: boolean, message: string}
     */
    validateEmail(email) {
        if (!email || email.trim().length === 0) {
            return {
                valid: false,
                message: 'El email es obligatorio'
            };
        }

        const emailTrim = email.trim();

        if (emailTrim.includes(' ')) {
            return {
                valid: false,
                message: 'El email no puede contener espacios'
            };
        }

        if (!this.patterns.email.test(emailTrim)) {
            return {
                valid: false,
                message: 'Ingresa un email válido (ejemplo: usuario@gmail.com)'
            };
        }

        return {
            valid: true,
            message: ''
        };
    },

    /**
     * Validar contraseña
     * @param {string} password - Contraseña a validar
     * @returns {Object} - {valid: boolean, message: string}
     */
    validatePassword(password) {
        if (!password) {
            return {
                valid: false,
                message: 'La contraseña es obligatoria'
            };
        }

        if (password.length < 6) {
            return {
                valid: false,
                message: 'La contraseña debe tener al menos 6 caracteres'
            };
        }

        // Verificar que tenga al menos una letra
        if (!/[A-Za-z]/.test(password)) {
            return {
                valid: false,
                message: 'La contraseña debe incluir al menos una letra'
            };
        }

        // Verificar que tenga al menos un número
        if (!/\d/.test(password)) {
            return {
                valid: false,
                message: 'La contraseña debe incluir al menos un número'
            };
        }

        return {
            valid: true,
            message: ''
        };
    },

    /**
     * Validar teléfono argentino (10 dígitos)
     * @param {string} telefono - Teléfono a validar
     * @returns {Object} - {valid: boolean, message: string}
     */
    validatePhone(telefono) {
        if (!telefono) {
            return {
                valid: false,
                message: 'El teléfono es obligatorio'
            };
        }

        // Limpiar espacios, guiones y paréntesis
        const telefonoLimpio = telefono.replace(/[\s\-()]/g, '');

        if (!this.patterns.telefono.test(telefonoLimpio)) {
            return {
                valid: false,
                message: 'El teléfono debe tener 10 dígitos (ejemplo: 1155667788)'
            };
        }

        return {
            valid: true,
            message: ''
        };
    },

    /**
     * Validar confirmación de contraseña
     * @param {string} password - Contraseña original
     * @param {string} passwordConfirm - Confirmación de contraseña
     * @returns {Object} - {valid: boolean, message: string}
     */
    validatePasswordConfirm(password, passwordConfirm) {
        if (!passwordConfirm) {
            return {
                valid: false,
                message: 'Debes confirmar la contraseña'
            };
        }

        if (password !== passwordConfirm) {
            return {
                valid: false,
                message: 'Las contraseñas no coinciden'
            };
        }

        return {
            valid: true,
            message: ''
        };
    },

    // ========================================
    // FORTALEZA DE CONTRASEÑA
    // ========================================

    /**
     * Calcular fortaleza de contraseña
     * @param {string} password - Contraseña a evaluar
     * @returns {Object} - {strength: number, label: string, color: string, percentage: number}
     */
    calculatePasswordStrength(password) {
        if (!password) {
            return {
                strength: 0,
                label: 'Muy débil',
                color: '#f44336',
                percentage: 0
            };
        }

        let strength = 0;

        // Longitud
        if (password.length >= 6) strength++;
        if (password.length >= 10) strength++;

        // Complejidad
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;  // Mayúsculas y minúsculas
        if (/[0-9]/.test(password)) strength++;                             // Números
        if (/[^a-zA-Z0-9]/.test(password)) strength++;                      // Símbolos especiales

        // Determinar etiqueta, color y porcentaje
        if (strength <= 1) {
            return {
                strength,
                label: 'Débil',
                color: '#f44336',
                percentage: 33
            };
        } else if (strength <= 3) {
            return {
                strength,
                label: 'Media',
                color: '#ffc107',
                percentage: 66
            };
        } else {
            return {
                strength,
                label: 'Fuerte',
                color: '#4caf50',
                percentage: 100
            };
        }
    },

    // ========================================
    // UI HELPERS
    // ========================================

    /**
     * Actualizar estado visual de un campo
     * @param {string} fieldId - ID del campo input
     * @param {Object} validation - Resultado de validación {valid, message}
     */
    updateFieldStatus(fieldId, validation) {
        const field = document.getElementById(fieldId);
        const errorEl = document.getElementById(fieldId + 'Error');

        if (!field) return;

        // Actualizar clases del campo
        field.classList.remove('is-valid', 'is-invalid');

        if (validation.valid) {
            field.classList.add('is-valid');
            if (errorEl) {
                errorEl.textContent = '';
                errorEl.classList.remove('show');
            }
        } else {
            field.classList.add('is-invalid');
            if (errorEl) {
                errorEl.textContent = validation.message;
                errorEl.classList.add('show');
            }
        }
    },

    /**
     * Actualizar indicador de fortaleza de contraseña
     * @param {string} strengthBarId - ID de la barra de fortaleza
     * @param {Object} strengthData - Datos de fortaleza
     */
    updatePasswordStrengthUI(strengthBarId, strengthData) {
        const strengthBar = document.querySelector(`#${strengthBarId} .strength-bar`);
        const strengthLabel = document.querySelector(`#${strengthBarId} .strength-label`);

        if (!strengthBar) return;

        // Actualizar barra
        strengthBar.style.width = strengthData.percentage + '%';
        strengthBar.style.backgroundColor = strengthData.color;

        // Actualizar etiqueta si existe
        if (strengthLabel) {
            strengthLabel.textContent = strengthData.label;
            strengthLabel.style.color = strengthData.color;
        }
    },

    /**
     * Limpiar formato de teléfono
     * @param {string} telefono - Teléfono con formato
     * @returns {string} - Teléfono solo dígitos
     */
    cleanPhone(telefono) {
        return telefono.replace(/[\s\-()]/g, '');
    },

    /**
     * Formatear teléfono argentino
     * @param {string} telefono - Teléfono sin formato
     * @returns {string} - Teléfono formateado
     */
    formatPhone(telefono) {
        const limpio = this.cleanPhone(telefono);
        if (limpio.length < 3) return limpio;

        if (limpio.length <= 6) {
            return `(${limpio.slice(0, 3)}) ${limpio.slice(3)}`;
        } else {
            return `(${limpio.slice(0, 3)}) ${limpio.slice(3, 7)}-${limpio.slice(7, 11)}`;
        }
    },

    // ========================================
    // VALIDACIÓN DE FORMULARIOS COMPLETOS
    // ========================================

    /**
     * Validar formulario de registro completo
     * @param {Object} formData - Datos del formulario
     * @returns {Object} - {valid: boolean, errors: Object}
     */
    validateRegistrationForm(formData) {
        const errors = {};
        let valid = true;

        // Validar nombre
        const nameValidation = this.validateName(formData.nombre);
        if (!nameValidation.valid) {
            errors.nombre = nameValidation.message;
            valid = false;
        }

        // Validar email
        const emailValidation = this.validateEmail(formData.email);
        if (!emailValidation.valid) {
            errors.email = emailValidation.message;
            valid = false;
        }

        // Validar teléfono
        const phoneValidation = this.validatePhone(formData.telefono);
        if (!phoneValidation.valid) {
            errors.telefono = phoneValidation.message;
            valid = false;
        }

        // Validar contraseña
        const passwordValidation = this.validatePassword(formData.password);
        if (!passwordValidation.valid) {
            errors.password = passwordValidation.message;
            valid = false;
        }

        // Validar confirmación de contraseña
        if (formData.passwordConfirm !== undefined) {
            const confirmValidation = this.validatePasswordConfirm(
                formData.password,
                formData.passwordConfirm
            );
            if (!confirmValidation.valid) {
                errors.passwordConfirm = confirmValidation.message;
                valid = false;
            }
        }

        return { valid, errors };
    },

    /**
     * Validar formulario de login
     * @param {Object} formData - Datos del formulario {email, password}
     * @returns {Object} - {valid: boolean, errors: Object}
     */
    validateLoginForm(formData) {
        const errors = {};
        let valid = true;

        // Validar email
        const emailValidation = this.validateEmail(formData.email);
        if (!emailValidation.valid) {
            errors.email = emailValidation.message;
            valid = false;
        }

        // Validar que la contraseña no esté vacía (sin validar formato)
        if (!formData.password || formData.password.trim().length === 0) {
            errors.password = 'La contraseña es obligatoria';
            valid = false;
        }

        return { valid, errors };
    }
};

// Exportar para uso global
window.Validaciones = Validaciones;

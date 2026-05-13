// auth.js - Lógica de la página de autenticación

// Si ya está logueado → home directamente
brAuth.onAuthStateChanged(user => {
    if (user) window.location.href = 'home.html';
});

// ── TABS ──────────────────────────────────────────────────────────────────
document.getElementById('tab-login').addEventListener('click', () => {
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-register').classList.remove('active');
    document.getElementById('form-login').classList.add('active');
    document.getElementById('form-register').classList.remove('active');
});

document.getElementById('tab-register').addEventListener('click', () => {
    document.getElementById('tab-register').classList.add('active');
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('form-register').classList.add('active');
    document.getElementById('form-login').classList.remove('active');
});

// ── LOGIN ─────────────────────────────────────────────────────────────────
document.getElementById('btn-login').addEventListener('click', async () => {
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl  = document.getElementById('login-error');
    const btn      = document.getElementById('btn-login');

    errorEl.style.display = 'none';
    if (!email || !password) {
        showError(errorEl, 'Por favor, rellena todos los campos.');
        return;
    }

    btn.disabled    = true;
    btn.textContent = 'Entrando...';
    try {
        await brAuth.signInWithEmailAndPassword(email, password);
        // onAuthStateChanged redirige automáticamente
    } catch (err) {
        btn.disabled    = false;
        btn.textContent = 'Entrar';
        showError(errorEl, getAuthErrorMsg(err.code));
    }
});

// Enter en contraseña → login
document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-login').click();
});

// ── REGISTRO ──────────────────────────────────────────────────────────────
document.getElementById('btn-register').addEventListener('click', async () => {
    const email     = document.getElementById('register-email').value.trim();
    const password  = document.getElementById('register-password').value;
    const password2 = document.getElementById('register-password2').value;
    const errorEl   = document.getElementById('register-error');
    const btn       = document.getElementById('btn-register');

    errorEl.style.display = 'none';

    if (!email || !password || !password2) {
        showError(errorEl, 'Por favor, rellena todos los campos.');
        return;
    }
    if (password !== password2) {
        showError(errorEl, 'Las contraseñas no coinciden.');
        return;
    }
    if (password.length < 6) {
        showError(errorEl, 'La contraseña debe tener al menos 6 caracteres.');
        return;
    }

    btn.disabled    = true;
    btn.textContent = 'Creando cuenta...';
    try {
        await brAuth.createUserWithEmailAndPassword(email, password);
        // onAuthStateChanged redirige automáticamente
    } catch (err) {
        btn.disabled    = false;
        btn.textContent = 'Crear cuenta';
        showError(errorEl, getAuthErrorMsg(err.code));
    }
});

document.getElementById('register-password2').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-register').click();
});

// ── HELPERS ───────────────────────────────────────────────────────────────
function showError(el, msg) {
    el.textContent    = msg;
    el.style.display  = 'block';
}

function getAuthErrorMsg(code) {
    const msgs = {
        'auth/user-not-found':        'No existe ninguna cuenta con ese correo.',
        'auth/wrong-password':        'Contraseña incorrecta.',
        'auth/invalid-email':         'El correo electrónico no es válido.',
        'auth/email-already-in-use':  'Ya existe una cuenta con ese correo.',
        'auth/weak-password':         'La contraseña es demasiado débil (mínimo 6 caracteres).',
        'auth/too-many-requests':     'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
        'auth/network-request-failed':'Error de red. Comprueba tu conexión a internet.',
        'auth/invalid-credential':    'Correo o contraseña incorrectos.',
    };
    return msgs[code] || 'Ha ocurrido un error inesperado. Inténtalo de nuevo.';
}

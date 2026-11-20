// auth-guard.js - Redirige a login si no hay sesión activa
(function () {
    brAuth.onAuthStateChanged(function (user) {
        if (!user) {
            window.location.replace('auth.html');
        }
    });
})();

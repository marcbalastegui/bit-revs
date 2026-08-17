// bitrevs-ui.js - Alertas y confirmaciones con diseño propio

// Inyectar el HTML del sistema de diálogos al cargar
(function injectDialogs() {
    if (document.getElementById('br-dialog-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'br-dialog-overlay';
    overlay.style.cssText = `
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
        z-index: 9999;
        opacity: 0; visibility: hidden;
        transition: opacity 0.2s, visibility 0.2s;
    `;

    overlay.innerHTML = `
        <div id="br-dialog-box" style="
            background: white;
            border-radius: 16px;
            padding: 32px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.2);
            transform: translateY(12px);
            transition: transform 0.2s;
            font-family: 'Inter', -apple-system, sans-serif;
        ">
            <h3 id="br-dialog-title" style="
                font-size: 1.2rem;
                font-weight: 800;
                color: #1a1a1a;
                margin: 0 0 10px;
                letter-spacing: -0.3px;
            "></h3>
            <p id="br-dialog-message" style="
                font-size: 0.92rem;
                color: #626262;
                line-height: 1.6;
                margin: 0 0 24px;
            "></p>
            <div id="br-dialog-actions" style="
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            ">
                <button id="br-dialog-cancel" style="
                    background: #f4f4f7;
                    color: #1a1a1a;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 10px;
                    font-weight: 700;
                    font-size: 0.9rem;
                    cursor: pointer;
                    font-family: inherit;
                    transition: background 0.15s;
                ">Cancelar</button>
                <button id="br-dialog-confirm" style="
                    background: #e63946;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 10px;
                    font-weight: 700;
                    font-size: 0.9rem;
                    cursor: pointer;
                    font-family: inherit;
                    transition: background 0.15s;
                ">Aceptar</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Hover en botones
    const cancelBtn  = overlay.querySelector('#br-dialog-cancel');
    const confirmBtn = overlay.querySelector('#br-dialog-confirm');
    cancelBtn.addEventListener('mouseover',  () => cancelBtn.style.background  = '#e0e0e0');
    cancelBtn.addEventListener('mouseout',   () => cancelBtn.style.background  = '#f4f4f7');
    confirmBtn.addEventListener('mouseover', () => confirmBtn.style.background = '#c12a36');
    confirmBtn.addEventListener('mouseout',  () => confirmBtn.style.background = '#e63946');
})();

// ── SHOW / HIDE ───────────────────────────────────────────────────────────
function brShowDialog(title, message, showCancel = false) {
    return new Promise((resolve) => {
        const overlay    = document.getElementById('br-dialog-overlay');
        const box        = document.getElementById('br-dialog-box');
        const titleEl    = document.getElementById('br-dialog-title');
        const messageEl  = document.getElementById('br-dialog-message');
        const cancelBtn  = document.getElementById('br-dialog-cancel');
        const confirmBtn = document.getElementById('br-dialog-confirm');

        titleEl.textContent   = title;
        messageEl.textContent = message;
        cancelBtn.style.display  = showCancel ? 'block' : 'none';
        confirmBtn.textContent   = showCancel ? 'Confirmar' : 'Aceptar';

        // Mostrar
        overlay.style.visibility = 'visible';
        overlay.style.opacity    = '1';
        box.style.transform      = 'translateY(0)';

        const close = (result) => {
            overlay.style.opacity    = '0';
            overlay.style.visibility = 'hidden';
            box.style.transform      = 'translateY(12px)';
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click',  onCancel);
            resolve(result);
        };

        const onConfirm = () => close(true);
        const onCancel  = () => close(false);

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click',  onCancel);

        // Cerrar con Escape
        const onKey = (e) => {
            if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', onKey); }
        };
        document.addEventListener('keydown', onKey);
    });
}

// ── API PÚBLICA ───────────────────────────────────────────────────────────

// Reemplaza alert() — solo botón Aceptar
window.brAlert = function(message, title = 'BitRevs') {
    return brShowDialog(title, message, false);
};

// Reemplaza confirm() — botones Cancelar + Confirmar
window.brConfirm = function(message, title = '¿Estás seguro?') {
    return brShowDialog(title, message, true);
};

// ── SPOTIFY BUTTON (todas las páginas) ───────────────────────────────────
(function injectSpotifyHeaderBtn() {
    const SPOTIFY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <path d="M7.5 10.3c3-1 6.2-1 9.2.2"/>
        <path d="M8 13.4c2.5-.8 5-.8 7.4.1"/>
        <path d="M8.6 16.3c1.8-.5 3.6-.5 5.3.1"/>
    </svg>`;

    function spotifyIsConnected() {
        return !!(localStorage.getItem('spotify_refresh_token') || localStorage.getItem('spotify_access_token'));
    }

    document.addEventListener('DOMContentLoaded', () => {
        const connected = spotifyIsConnected();
        const existing = document.getElementById('spotify-connect-btn');

        if (existing) {
            // music.html ya tiene el botón — solo actualizar estado visual
            existing.classList.toggle('connected', connected);
            existing.title = connected ? 'Spotify conectado' : 'Conectar Spotify';
            return;
        }

        // Resto de páginas — inyectar
        const headerRight = document.querySelector('.header-right');
        if (!headerRight) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'spotify-connect-btn';
        btn.className = 'spotify-connect-btn' + (connected ? ' connected' : '');
        btn.title = connected ? 'Spotify conectado' : 'Conectar Spotify';
        btn.innerHTML = SPOTIFY_SVG;
        btn.addEventListener('click', () => { window.location.href = 'music.html'; });

        const avatar = headerRight.querySelector('.header-avatar');
        if (avatar) headerRight.insertBefore(btn, avatar);
        else headerRight.appendChild(btn);
    });
})();
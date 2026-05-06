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
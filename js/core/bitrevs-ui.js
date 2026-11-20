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
            background: var(--bg-card);
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
                color: var(--text-main);
                margin: 0 0 10px;
                letter-spacing: -0.3px;
            "></h3>
            <p id="br-dialog-message" style="
                font-size: 0.92rem;
                color: var(--text-muted);
                line-height: 1.6;
                margin: 0 0 24px;
            "></p>
            <div id="br-dialog-actions" style="
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            ">
                <button id="br-dialog-cancel" style="
                    background: var(--bg-secondary);
                    color: var(--text-main);
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
    cancelBtn.addEventListener('mouseover',  () => cancelBtn.style.background  = 'var(--border-color)');
    cancelBtn.addEventListener('mouseout',   () => cancelBtn.style.background  = 'var(--bg-secondary)');
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

// ── PÁGINA NO ENCONTRADA ─────────────────────────────────────────────────
// Para páginas de detalle cuando el id de la URL no existe (enlace viejo o borrado).
window.brRenderNotFound = function(container, message, backHref, backLabel) {
    if (!container) return;
    container.innerHTML = `
        <div style="text-align:center; padding:80px 20px; color:var(--text-muted);">
            <p style="font-size:1.1rem; font-weight:700; color:var(--text-main); margin-bottom:8px;">${message}</p>
            <p style="margin-bottom:20px;">Puede que se haya borrado o que el enlace sea antiguo.</p>
            <a href="${backHref}" class="save-btn" style="text-decoration:none; display:inline-block;">${backLabel}</a>
        </div>`;
};

// ── FILAS DESLIZABLES (Inicio, Perfil...) ─────────────────────────────────
// brRenderScrollRow(contenedor, items, renderItem): pinta los primeros elementos y va
// añadiendo más al acercarse al final de la fila, hasta el máximo de Ajustes (25 o 50).
// renderItem(item) devuelve el HTML de una tarjeta.
window.brRenderScrollRow = function(container, items, renderItem, opts = {}) {
    if (!container) return;
    const rowsMax = typeof setting === 'function' ? setting('display.rowsMax', 50) : 50;
    const max  = Math.min(items.length, opts.max || rowsMax);
    const step = opts.step || 12;
    let shown  = 0;

    if (container._brRowScroll) container.removeEventListener('scroll', container._brRowScroll);
    container.innerHTML = '';

    const appendMore = () => {
        if (shown >= max) return false;
        const next = items.slice(shown, Math.min(shown + step, max));
        container.insertAdjacentHTML('beforeend', next.map(renderItem).join(''));
        shown += next.length;
        return true;
    };
    const nearEnd = () => container.scrollLeft + container.clientWidth > container.scrollWidth - 480;
    const onScroll = () => { if (nearEnd()) appendMore(); };

    appendMore();
    // Si todo lo cargado cabe en pantalla, cargar más hasta llenar la fila
    let guard = 0;
    while (shown < max && container.scrollWidth <= container.clientWidth + 480 && guard++ < 10) appendMore();

    container._brRowScroll = onScroll;
    container.addEventListener('scroll', onScroll, { passive: true });
};

// Arrastrar con el ratón cualquier fila horizontal (en móvil ya se desliza con el dedo).
// Si se ha arrastrado, el clic que llega al soltar no abre la tarjeta.
(function initDragScroll() {
    const ROWS = '.home-scroll-grid, .profile-scroll-row, .timeline-row, [data-drag-scroll]';
    let row = null, startX = 0, startLeft = 0, moved = false, swallowClick = false;

    document.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        const target = e.target.closest(ROWS);
        if (!target || target.scrollWidth <= target.clientWidth) return;
        row = target; startX = e.clientX; startLeft = target.scrollLeft; moved = false;
    });
    document.addEventListener('mousemove', e => {
        if (!row) return;
        const dx = e.clientX - startX;
        if (!moved && Math.abs(dx) > 6) { moved = true; row.classList.add('is-dragging'); }
        if (moved) { row.scrollLeft = startLeft - dx; e.preventDefault(); }
    });
    document.addEventListener('mouseup', () => {
        if (!row) return;
        row.classList.remove('is-dragging');
        if (moved) { swallowClick = true; setTimeout(() => { swallowClick = false; }, 0); }
        row = null;
    });
    document.addEventListener('click', e => {
        if (swallowClick) { e.preventDefault(); e.stopPropagation(); swallowClick = false; }
    }, true);
    // Que el navegador no intente "arrastrar" las imágenes de las tarjetas
    document.addEventListener('dragstart', e => { if (e.target.closest(ROWS)) e.preventDefault(); });
})();

// ── VISTA NORMAL / MINI-CUADRÍCULA (Música, Películas, Series) ───────────
// Markup: <div class="view-toggle" data-grid="ID-de-la-cuadrícula" data-setting="defaults.musicView">
//           <button class="view-toggle-btn" data-view="mini">…</button>
//           <button class="view-toggle-btn" data-view="normal">…</button>
//         </div>
// La mini-cuadrícula solo enseña portada + nota (.card-mini-badge). Se guarda en Ajustes.
(function initViewToggles() {
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.view-toggle[data-grid]').forEach(group => {
            const grid = document.getElementById(group.dataset.grid);
            const path = group.dataset.setting;
            if (!grid) return;

            const apply = view => {
                grid.classList.toggle('mini-grid', view === 'mini');
                group.querySelectorAll('.view-toggle-btn').forEach(btn => {
                    const isActive = btn.dataset.view === view;
                    btn.classList.toggle('active', isActive);
                    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
                });
            };

            apply((path && window.brSettings && brSettings.get(path)) || 'normal');

            group.querySelectorAll('.view-toggle-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    apply(btn.dataset.view);
                    if (path && window.brSettings) brSettings.set(path, btn.dataset.view);
                });
            });
        });
    });
})();

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
        const existing  = document.getElementById('spotify-connect-btn');

        if (existing) {
            existing.classList.toggle('connected', connected);
            existing.title = connected ? 'Spotify conectado' : 'Conectar Spotify';
            return;
        }

        const headerRight = document.querySelector('.header-right');
        if (!headerRight) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'spotify-connect-btn';
        btn.className = 'spotify-connect-btn' + (connected ? ' connected' : '');
        btn.title = connected ? 'Spotify conectado' : 'Conectar Spotify';
        btn.innerHTML = SPOTIFY_SVG;
        btn.addEventListener('click', () => { window.location.href = 'music.html'; });

        const avatarEl = headerRight.querySelector('.header-avatar');
        const avatar   = avatarEl ? (avatarEl.closest('.avatar-menu') || avatarEl) : null;
        if (avatar) headerRight.insertBefore(btn, avatar);
        else headerRight.appendChild(btn);
    });
})();

// ═══════════════════════════════════════════════════════════════════════════
// BUSCADOR GLOBAL
// ═══════════════════════════════════════════════════════════════════════════
(function initGlobalSearch() {

    // ── INYECTAR UI ──────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        const headerRight = document.querySelector('.header-right');
        if (!headerRight) return;

        const wrap = document.createElement('div');
        wrap.className = 'gs-wrap';
        wrap.innerHTML = `
            <svg class="gs-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" id="gs-input" class="gs-input" placeholder="Buscar…" autocomplete="off" spellcheck="false">
            <div id="gs-results" class="gs-results"></div>`;

        // Insert as first child of header-right
        headerRight.insertBefore(wrap, headerRight.firstChild);
        setupSearch();
    });

    // ── ESTADO ───────────────────────────────────────────────────────────
    let _cache     = null;
    let _debounce  = null;
    let _focused   = -1;
    let _results   = [];   // flat list of navigable items

    // ── CONTEXTO ─────────────────────────────────────────────────────────
    function getContext() {
        const page   = (window.location.pathname.split('/').pop() || '').replace('.html', '');
        const params = new URLSearchParams(window.location.search);
        const musicPages = ['music','album','artist','genre','compare','compare-artists'];
        const moviePages = ['movies','director','country','movie-genre'];
        if (musicPages.includes(page)) return 'music';
        if (moviePages.includes(page)) return 'movies';
        if (page === 'series') return 'series';
        if (page === 'media-detail') return params.get('type') === 'movies' ? 'movies' : 'series';
        return 'all';
    }

    // ── CACHÉ ─────────────────────────────────────────────────────────────
    async function loadCache() {
        if (_cache) return _cache;
        const ctx = getContext();
        const c   = { albums: [], movies: [], series: [] };
        try {
            if (ctx === 'all' || ctx === 'music')  c.albums  = await getAllAlbumsFromDB();
            if (ctx === 'all' || ctx === 'movies') c.movies  = await getAllItemsFromDB('movies');
            if (ctx === 'all' || ctx === 'series') c.series  = await getAllItemsFromDB('series');
        } catch(e) {}
        _cache = c;
        return c;
    }

    // ── SCORING ──────────────────────────────────────────────────────────
    function score(text, q) {
        if (!text) return 0;
        const t = text.toLowerCase(), qL = q.toLowerCase();
        if (t === qL)              return 100;
        if (t.startsWith(qL))     return 80;
        if (t.includes(' '+qL))   return 60;
        if (t.includes(qL))       return 40;
        return 0;
    }

    // ── BÚSQUEDA ─────────────────────────────────────────────────────────
    async function search(q) {
        if (!q.trim()) { hide(); return; }
        const ctx = getContext();
        const c   = await loadCache();
        const groups = [];

        // Helper
        function col(clr) { return (typeof getColorByRating==='function') ? getColorByRating(clr) : '#666'; }
        function fmt(r)   { return (typeof formatRating==='function') ? formatRating(r) : r; }

        // ── ÁLBUMES ──
        if (ctx==='all'||ctx==='music') {
            const rows = [];
            c.albums.forEach(a => {
                const s = Math.max(score(a.title,q), score(a.artist,q)*0.8);
                if (!s) return;
                const boost = Math.min(20,(a.tracks?.filter(t=>parseFloat(t.rating)>0).length||0))
                            + (parseFloat(a.rating)||0);
                rows.push({ type:'album', title:a.title,
                    sub:`${a.artist||''}${a.year?' · '+a.year:''}`,
                    cover:a.coverBase64, href:`album.html?id=${a.id}`,
                    rating:a.rating, sc:s+boost });
            });
            rows.sort((a,b)=>b.sc-a.sc);
            if (rows.length) groups.push({ label:'Álbumes', items:rows.slice(0,4) });
        }

        // ── CANCIONES ──
        if (ctx==='all'||ctx==='music') {
            const rows=[], seen=new Set();
            c.albums.forEach(a => {
                (a.tracks||[]).forEach(t => {
                    if (t.isInterlude) return;
                    const k = t.title+'__'+(a.artist||'');
                    if (seen.has(k)) return;
                    const s = score(t.title,q);
                    if (!s) return;
                    seen.add(k);
                    rows.push({ type:'track', title:t.title,
                        sub:`${a.artist||''} · ${a.title}`,
                        cover:a.coverBase64, href:`album.html?id=${a.id}`,
                        rating:t.rating, sc:s+(parseFloat(t.rating)||0)+(parseFloat(a.rating)||0)*0.5 });
                });
            });
            rows.sort((a,b)=>b.sc-a.sc);
            if (rows.length) groups.push({ label:'Canciones', items:rows.slice(0,4) });
        }

        // ── ARTISTAS ──
        if (ctx==='all'||ctx==='music') {
            const map={};
            c.albums.forEach(a => {
                if (!a.artist) return;
                if (!map[a.artist]) map[a.artist]={count:0};
                map[a.artist].count++;
            });
            const rows=[];
            Object.entries(map).forEach(([name,st]) => {
                const s=score(name,q); if(!s) return;
                rows.push({ type:'artist', title:name,
                    sub:`${st.count} álbum${st.count!==1?'es':''}`,
                    cover:null, href:`artist.html?name=${encodeURIComponent(name)}`,
                    rating:null, sc:s+st.count*4 });
            });
            rows.sort((a,b)=>b.sc-a.sc);
            if (rows.length) groups.push({ label:'Artistas', items:rows.slice(0,3) });
        }

        // ── PELÍCULAS ──
        if (ctx==='all'||ctx==='movies') {
            const rows=[];
            c.movies.forEach(m => {
                const s=Math.max(score(m.title,q),score(m.director,q)*0.8);
                if(!s) return;
                rows.push({ type:'movie', title:m.title,
                    sub:`${m.director?m.director+' · ':''}${m.year||''}`,
                    cover:m.coverBase64, href:`media-detail.html?type=movies&id=${m.id}`,
                    rating:m.rating, sc:s+(parseFloat(m.rating)||0) });
            });
            rows.sort((a,b)=>b.sc-a.sc);
            if (rows.length) groups.push({ label:'Películas', items:rows.slice(0,4) });
        }

        // ── DIRECTORES ──
        if (ctx==='all'||ctx==='movies') {
            const map={};
            c.movies.forEach(m=>{ if(!m.director) return; if(!map[m.director]) map[m.director]={count:0}; map[m.director].count++; });
            const rows=[];
            Object.entries(map).forEach(([name,st])=>{
                const s=score(name,q); if(!s) return;
                rows.push({ type:'director', title:name,
                    sub:`${st.count} película${st.count!==1?'s':''}`,
                    cover:null, href:`director.html?name=${encodeURIComponent(name)}`,
                    rating:null, sc:s+st.count*4 });
            });
            rows.sort((a,b)=>b.sc-a.sc);
            if (rows.length) groups.push({ label:'Directores', items:rows.slice(0,2) });
        }

        // ── SERIES ──
        if (ctx==='all'||ctx==='series') {
            const rows=[];
            c.series.forEach(s => {
                const sc=Math.max(score(s.title,q),score(s.creator,q)*0.8);
                if(!sc) return;
                rows.push({ type:'series', title:s.title,
                    sub:`${s.creator?s.creator+' · ':''}${s.year||''}`,
                    cover:s.coverBase64, href:`media-detail.html?type=series&id=${s.id}`,
                    rating:s.rating, sc:sc+(parseFloat(s.rating)||0) });
            });
            rows.sort((a,b)=>b.sc-a.sc);
            if (rows.length) groups.push({ label:'Series', items:rows.slice(0,4) });
        }

        render(groups);
    }

    // ── RENDER ───────────────────────────────────────────────────────────
    function render(groups) {
        const box = document.getElementById('gs-results');
        if (!box) return;
        _results = [];

        if (!groups.length) {
            box.innerHTML = '<div class="gs-empty">Sin resultados</div>';
            box.classList.add('open'); return;
        }

        function col(r) { return (typeof getColorByRating==='function') ? getColorByRating(r) : '#888'; }
        function fmt(r) { return (typeof formatRating==='function') ? formatRating(r) : (r||''); }

        let html = '';
        groups.forEach(g => {
            html += `<div class="gs-group"><div class="gs-group-label">${g.label}</div>`;
            g.items.forEach(item => {
                const idx = _results.length;
                _results.push(item);
                const c = item.rating && parseFloat(item.rating)>0 ? col(item.rating) : '#4D4D4D';
                const badge = item.rating && parseFloat(item.rating)>0
                    ? `<span class="gs-badge" style="background:${c}">${fmt(item.rating)}</span>` : '';
                const media = item.cover
                    ? `<img class="gs-thumb" src="${item.cover}" alt="">`
                    : `<div class="gs-avatar" style="background:${c}">${(item.title||'?').charAt(0).toUpperCase()}</div>`;
                html += `<div class="gs-item" data-idx="${idx}">
                    ${media}
                    <div class="gs-item-info">
                        <div class="gs-item-title">${esc(item.title)}</div>
                        <div class="gs-item-sub">${item.sub}</div>
                    </div>${badge}</div>`;
            });
            html += `</div>`;
        });

        box.innerHTML = html;
        box.classList.add('open');
        _focused = -1;

        box.querySelectorAll('.gs-item').forEach(el => {
            el.addEventListener('mousedown', e => {
                e.preventDefault();
                const item = _results[parseInt(el.dataset.idx)];
                if (item) window.location.href = item.href;
            });
        });
    }

    function hide() {
        const box = document.getElementById('gs-results');
        if (box) box.classList.remove('open');
        _focused = -1;
    }

    function moveFocus(dir) {
        const items = document.querySelectorAll('.gs-item');
        if (!items.length) return;
        _focused = Math.max(-1, Math.min(_focused + dir, items.length - 1));
        items.forEach((el,i) => el.classList.toggle('gs-focused', i===_focused));
        if (_focused>=0) items[_focused].scrollIntoView({block:'nearest'});
    }

    // ── SETUP ─────────────────────────────────────────────────────────────
    function setupSearch() {
        const input = document.getElementById('gs-input');
        if (!input) return;

        input.addEventListener('input', () => {
            clearTimeout(_debounce);
            _debounce = setTimeout(() => search(input.value), 140);
        });

        input.addEventListener('keydown', e => {
            if (e.key==='ArrowDown')  { e.preventDefault(); moveFocus(1); }
            else if (e.key==='ArrowUp')   { e.preventDefault(); moveFocus(-1); }
            else if (e.key==='Enter') {
                e.preventDefault();
                if (_focused>=0 && _results[_focused]) window.location.href = _results[_focused].href;
                else if (_results.length) window.location.href = _results[0].href;
            }
            else if (e.key==='Escape') { hide(); input.blur(); }
        });

        input.addEventListener('focus', () => { if (input.value.trim()) search(input.value); });
        input.addEventListener('blur',  () => { setTimeout(hide, 160); });
        document.addEventListener('click', e => { if (!e.target.closest('.gs-wrap')) hide(); });
    }

})();
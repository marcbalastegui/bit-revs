// header.js - Logo y menú principal, iguales en todas las páginas.
//
// Cada página solo tiene en su HTML:
//   <header>
//       <div class="header-right"> ...botones propios de la página + avatar... </div>
//   </header>
//   <script src="js/core/header.js"></script>   ← justo después, sin defer
//
// Este script añade el logo y el menú al principio del <header> y marca la sección activa.
// Para añadir o renombrar una sección del menú basta con tocar este archivo.
(function renderSiteHeader() {
    const header = document.querySelector('header');
    if (!header || header.querySelector('nav')) return;

    // Página actual → sección del menú que se marca como activa
    const SECTION_BY_PAGE = {
        'index.html': 'home', 'home.html': 'home',
        'music.html': 'music', 'album.html': 'music', 'genre.html': 'music', 'artist.html': 'music',
        'compare.html': 'music', 'compare-artists.html': 'music',
        'movies.html': 'movies', 'country.html': 'movies', 'director.html': 'movies', 'movie-genre.html': 'movies',
        'series.html': 'series',
        'collections.html': 'collections',
        'top.html': 'top', 'wrapped.html': 'wrapped', 'lists.html': 'lists',
    };
    const REVIEW_LINKS = [
        ['movies',      'movies.html',      'Películas'],
        ['series',      'series.html',      'Series'],
        ['music',       'music.html',       'Música'],
        ['collections', 'collections.html', 'Colecciones'],
    ];
    const MAIN_LINKS = [
        ['top',     'top.html',     'Top'],
        ['wrapped', 'wrapped.html', 'Wrapped'],
        ['lists',   'lists.html',   'Listas'],
    ];

    const page = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const section = page === 'media-detail.html'
        ? (new URLSearchParams(window.location.search).get('type') === 'series' ? 'series' : 'movies')
        : (SECTION_BY_PAGE[page] || '');
    const inReviews = REVIEW_LINKS.some(([s]) => s === section);
    const activeAttrs = isActive => isActive ? ' class="active" aria-current="page"' : '';

    const HOME_SVG  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
    const ARROW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="nav-dropdown-arrow"><polyline points="6 9 12 15 18 9"/></svg>`;

    header.insertAdjacentHTML('afterbegin', `
        <div class="header-left">
            <a href="home.html" class="logo">BitRevs</a>
        </div>
        <nav>
            <a href="home.html" class="nav-home-icon${section === 'home' ? ' active' : ''}" title="Inicio" aria-label="Inicio"${section === 'home' ? ' aria-current="page"' : ''}>${HOME_SVG}</a>
            <div class="nav-dropdown">
                <span class="nav-dropdown-trigger${inReviews ? ' active' : ''}" tabindex="0">Reviews ${ARROW_SVG}</span>
                <div class="nav-dropdown-menu">
                    ${REVIEW_LINKS.map(([s, href, label]) => `<a href="${href}"${activeAttrs(s === section)}>${label}</a>`).join('')}
                </div>
            </div>
            ${MAIN_LINKS.map(([s, href, label]) => `<a href="${href}"${activeAttrs(s === section)}>${label}</a>`).join('')}
        </nav>`);

    // ── Menú de la foto de perfil: Perfil / Ajustes ───────────────────────
    const avatar = header.querySelector('.header-avatar');
    if (avatar) {
        const wrap = document.createElement('div');
        wrap.className = 'avatar-menu';
        avatar.parentNode.insertBefore(wrap, avatar);
        wrap.appendChild(avatar);
        if (page === 'profile.html' || page === 'settings.html') avatar.classList.add('active');
        avatar.setAttribute('aria-haspopup', 'menu');
        avatar.setAttribute('aria-expanded', 'false');
        avatar.removeAttribute('title');

        const USER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 16 0v1"/></svg>`;
        const GEAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
        wrap.insertAdjacentHTML('beforeend', `
            <div class="avatar-menu-list" role="menu">
                <a href="profile.html" role="menuitem"${page === 'profile.html' ? ' class="active"' : ''}>${USER_SVG}Perfil</a>
                <a href="settings.html" role="menuitem"${page === 'settings.html' ? ' class="active"' : ''}>${GEAR_SVG}Ajustes</a>
            </div>`);

        const setOpen = open => {
            wrap.classList.toggle('open', open);
            avatar.setAttribute('aria-expanded', open ? 'true' : 'false');
        };
        avatar.addEventListener('click', e => { e.preventDefault(); setOpen(!wrap.classList.contains('open')); });
        document.addEventListener('click', e => { if (!wrap.contains(e.target)) setOpen(false); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
    }

    // En móvil el menú se desliza en horizontal: dejar visible la sección activa
    const nav    = header.querySelector('nav');
    const active = nav.querySelector('a.active');
    if (active && nav.scrollWidth > nav.clientWidth) {
        const offset = active.getBoundingClientRect().left - nav.getBoundingClientRect().left;
        if (offset + active.offsetWidth > nav.clientWidth) nav.scrollLeft = offset - 16;
    }
})();

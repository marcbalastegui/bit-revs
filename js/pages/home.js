
// home.js - Lógica de la página principal

// ── SLIDER DE ARTISTAS ─────────────────────────────────────────────────────
let allTopArtists = [];
let artistPage    = 0; // kept for compat but unused
const ARTIST_SCROLL_PX = 800;

async function renderArtistsPage() {
    const artistGrid = document.getElementById('grid-artists');
    if (!artistGrid) return;
    artistGrid.innerHTML = '';
    for (const artist of allTopArtists) {
        const html = await artistCard(artist);
        const el = document.createElement('div');
        el.innerHTML = html;
        if (el.firstElementChild) artistGrid.appendChild(el.firstElementChild);
    }
    // Hide indicator, keep arrows only if there are enough artists to scroll
    const indicator = document.getElementById('artists-page-indicator');
    if (indicator) indicator.style.display = 'none';
}

// ── PAÍSES / BANDERAS ─────────────────────────────────────────────────────
const HOME_COUNTRY_CODES = {
    'afghanistan':'af','albania':'al','alemania':'de','algeria':'dz','andorra':'ad',
    'angola':'ao','arabia saudita':'sa','argentina':'ar','armenia':'am','australia':'au',
    'austria':'at','azerbaiyán':'az','bangladesh':'bd','bélgica':'be','bolivia':'bo',
    'bosnia':'ba','brasil':'br','bulgaria':'bg','camboya':'kh','camerún':'cm',
    'canadá':'ca','chile':'cl','china':'cn','chipre':'cy','colombia':'co',
    'corea del norte':'kp','corea del sur':'kr','costa rica':'cr','croacia':'hr',
    'cuba':'cu','dinamarca':'dk','ecuador':'ec','egipto':'eg',
    'emiratos árabes unidos':'ae','emiratos árabes':'ae','eslovaquia':'sk',
    'eslovenia':'si','españa':'es','estados unidos':'us','estonia':'ee',
    'etiopía':'et','filipinas':'ph','finlandia':'fi','francia':'fr',
    'georgia':'ge','ghana':'gh','grecia':'gr','guatemala':'gt','hong kong':'hk',
    'hungría':'hu','india':'in','indonesia':'id','irán':'ir','irak':'iq',
    'irlanda':'ie','islandia':'is','israel':'il','italia':'it','jamaica':'jm',
    'japón':'jp','jordania':'jo','kazajistán':'kz','kenia':'ke','letonia':'lv',
    'líbano':'lb','lituania':'lt','luxemburgo':'lu','malasia':'my','malta':'mt',
    'marruecos':'ma','méxico':'mx','moldavia':'md','mongolia':'mn',
    'montenegro':'me','myanmar':'mm','nepal':'np','nicaragua':'ni','nigeria':'ng',
    'noruega':'no','nueva zelanda':'nz','países bajos':'nl','holanda':'nl',
    'pakistan':'pk','palestina':'ps','panamá':'pa','paraguay':'py','perú':'pe',
    'polonia':'pl','portugal':'pt','puerto rico':'pr','reino unido':'gb',
    'república checa':'cz','república dominicana':'do','rumanía':'ro','rusia':'ru',
    'senegal':'sn','serbia':'rs','singapur':'sg','siria':'sy','sudáfrica':'za',
    'suecia':'se','suiza':'ch','tailandia':'th','taiwán':'tw','tanzania':'tz',
    'túnez':'tn','turquía':'tr','ucrania':'ua','uruguay':'uy','uzbekistán':'uz',
    'venezuela':'ve','vietnam':'vn','zimbabue':'zw'
};
function homeCountryCode(name) {
    return name ? (HOME_COUNTRY_CODES[name.toLowerCase().trim()] || null) : null;
}
function genrePillHtml(name, count, href) {
    return `<div class="home-genre-pill" onclick="window.location.href='${href}'">
        <span class="home-genre-pill-name">${esc(name)}</span>
        <span class="home-genre-pill-count">${count}</span>
    </div>`;
}
function countryPillHtml(name, count, href) {
    const code = homeCountryCode(name);
    const flag = code
        ? `<img src="https://flagcdn.com/w20/${code}.png" alt="${esc(name)}" style="width:18px;height:auto;border-radius:2px;flex-shrink:0;">`
        : '';
    return `<div class="home-genre-pill" onclick="window.location.href='${href}'">
        ${flag}<span class="home-genre-pill-name">${esc(name)}</span>
        <span class="home-genre-pill-count">${count}</span>
    </div>`;
}

// ── ORDEN Y VISIBILIDAD DE SECCIONES (Ajustes → Inicio) ───────────────────
function applyHomeLayout() {
    const main = document.querySelector('main');
    if (!main) return;
    (setting('home.sections', []) || []).forEach(({ id, visible }) => {
        const el = document.getElementById('section-' + id);
        if (!el) return;
        main.appendChild(el);                       // el orden del DOM es el orden en pantalla
        if (!visible) el.style.display = 'none';
    });
    refreshHomeDividers();
}

// Una línea separadora entre secciones visibles (también al ocultarse alguna sin datos)
function refreshHomeDividers() {
    const main = document.querySelector('main');
    if (!main) return;
    main.querySelectorAll(':scope > hr.home-divider').forEach(hr => hr.remove());
    const visible = [...main.querySelectorAll(':scope > .home-section')].filter(s => s.style.display !== 'none');
    visible.slice(1).forEach(section => {
        const hr = document.createElement('hr');
        hr.className = 'home-divider';
        main.insertBefore(hr, section);
    });
}

// ── AVISO DE BACKUP (Ajustes → Datos) ─────────────────────────────────────
function showBackupReminder(totalItems) {
    const days = parseInt(setting('backup.reminderDays', 14)) || 0;
    if (!days || totalItems === 0) return;
    const last = setting('backup.lastBackupAt', null);
    const age  = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : Infinity;
    if (age < days) return;
    try { if (sessionStorage.getItem('bitrevs_backup_reminder_closed')) return; } catch {}

    const hero = document.querySelector('.home-hero');
    if (!hero) return;
    hero.insertAdjacentHTML('afterend', `
        <div class="backup-reminder" id="backup-reminder">
            <span>${last ? `Hace ${age} días de tu último backup.` : 'Todavía no has hecho ningún backup de tus reviews.'}</span>
            <a href="settings.html#sec-data" class="backup-reminder-link">Hacer backup</a>
            <button type="button" class="backup-reminder-close" aria-label="Cerrar aviso">✕</button>
        </div>`);
    document.querySelector('.backup-reminder-close').addEventListener('click', () => {
        document.getElementById('backup-reminder')?.remove();
        try { sessionStorage.setItem('bitrevs_backup_reminder_closed', '1'); } catch {}
    });
}

async function loadHome() {
    applyHomeLayout();
    const albums = await getAllAlbumsFromDB();
    const movies = await getAllItemsFromDB('movies');
    const series = await getAllItemsFromDB('series');

    const allReviews = [...albums, ...movies, ...series];

    // ── HERO STATS ────────────────────────────────────────────────────────
    const heroStats = document.getElementById('hero-stats');
    if (heroStats) {
        const totalAlbums = albums.length;
        const totalMovies = movies.length;
        const totalSeries = series.length;

        // Canciones puntuadas
        let totalTracks = 0;
        albums.forEach(a => { if (a.tracks) a.tracks.forEach(t => { if (!t.isInterlude && parseFloat(t.rating) > 0) totalTracks++; }); });

        heroStats.innerHTML = `
            <div class="hero-stat">
                <div class="hero-stat-number">${totalAlbums}</div>
                <div class="hero-stat-label">Álbumes</div>
            </div>
            <div class="hero-stat">
                <div class="hero-stat-number">${totalMovies + totalSeries}</div>
                <div class="hero-stat-label">Películas y series</div>
            </div>
            <div class="hero-stat">
                <div class="hero-stat-number">${totalTracks}</div>
                <div class="hero-stat-label">Canciones</div>
            </div>
        `;
    }

    // ── ÚLTIMAS AÑADIDAS ──────────────────────────────────────────────────
    const recent = [...allReviews].sort((a, b) => b.id - a.id);
    const movieIds = new Set(movies.map(m => m.id));
    const albumIds = new Set(albums.map(a => a.id));
    renderScrollGrid('grid-recent', recent, (item) => {
        const href = albumIds.has(item.id) ? `album.html?id=${item.id}`
                   : movieIds.has(item.id) ? `media-detail.html?type=movies&id=${item.id}`
                   : `media-detail.html?type=series&id=${item.id}`;
        return albumCard(item, href);
    });

    // ── MEJORES REVIEWS ───────────────────────────────────────────────────
    const best = [...albums]
        .filter(a => parseFloat(a.rating) > 0)
        .sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
    renderScrollGrid('grid-best', best, (item) => albumCard(item, `album.html?id=${item.id}`));

    // ── REVISITA REVIEWS ANTIGUAS ─────────────────────────────────────────
    // Los álbumes más antiguos que aún no has "revisado" recientemente
    // Ordenados por id ascendente (los más viejos primero), excluir los últimos 10
    const revisit = [...albums]
        .filter(a => parseFloat(a.rating) > 0)
        .sort((a, b) => a.id - b.id);

    renderScrollGrid('grid-revisit', revisit, (item) => albumCard(item, `album.html?id=${item.id}`));

    // ── ARTISTAS MEJOR VALORADOS (SLIDER) ────────────────────────────────
    const artistStats = {};
    albums.forEach(album => {
        if (!album.tracks) return;
        album.tracks.forEach(track => {
            if (!track.isInterlude && parseFloat(track.rating) > 0) {
                const artist = album.artist || 'Desconocido';
                if (!artistStats[artist]) artistStats[artist] = { total: 0, count: 0, albumCount: 0 };
                artistStats[artist].total += parseFloat(track.rating);
                artistStats[artist].count++;
            }
        });
        if (album.artist) {
            if (!artistStats[album.artist]) artistStats[album.artist] = { total: 0, count: 0, albumCount: 0 };
            artistStats[album.artist].albumCount++;
        }
    });

    allTopArtists = Object.entries(artistStats)
        .filter(([, s]) => s.count >= setting('ranking.minArtistTracks', 3))
        .map(([name, s]) => ({ name, avg: s.total / s.count, count: s.count, albumCount: s.albumCount }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, setting('display.rowsMax', 50));

    artistPage = 0;
    await renderArtistsPage();

    document.getElementById('btn-artists-prev')?.addEventListener('click', () => {
        document.getElementById('grid-artists')?.scrollBy({ left: -ARTIST_SCROLL_PX, behavior: 'smooth' });
    });
    document.getElementById('btn-artists-next')?.addEventListener('click', () => {
        document.getElementById('grid-artists')?.scrollBy({ left: ARTIST_SCROLL_PX, behavior: 'smooth' });
    });

    // ── DIRECTORES MEJOR VALORADOS ────────────────────────────────────────
    const directorStats = {};
    movies.forEach(movie => {
        if (!movie.director || !movie.director.trim()) return;
        const r = parseFloat(movie.rating);
        if (isNaN(r) || r <= 0) return;
        const name = movie.director.trim();
        if (!directorStats[name]) directorStats[name] = { total: 0, count: 0 };
        directorStats[name].total += r;
        directorStats[name].count++;
    });

    const topDirectors = Object.entries(directorStats)
        .filter(([, s]) => s.count >= setting('ranking.minDirectorMovies', 2))
        .map(([name, s]) => ({ name, avg: s.total / s.count, count: s.count }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, setting('display.rowsMax', 50));

    const directorGrid = document.getElementById('grid-directors');
    if (directorGrid) {
        if (topDirectors.length === 0) {
            document.getElementById('section-directors').style.display = 'none';
        } else {
            directorGrid.innerHTML = '';
            topDirectors.forEach(director => {
                const el = document.createElement('div');
                el.innerHTML = directorCard(director);
                if (el.firstElementChild) directorGrid.appendChild(el.firstElementChild);
            });
        }
    }

    // ── LÍNEA DE TIEMPO ──────────────────────────────────────────────────────
    const allWithDate = [
        ...albums.filter(a => a.reviewDate).map(a => ({ ...a, _type: 'album' })),
        ...movies.filter(m => m.reviewDate).map(m => ({ ...m, _type: 'movie' })),
        ...series.filter(s => s.reviewDate).map(s => ({ ...s, _type: 'series' })),
    ].sort((a, b) => b.reviewDate.localeCompare(a.reviewDate));

    renderTimeline(allWithDate, 'all');

    // Filter buttons
    document.querySelectorAll('.timeline-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.timeline-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const type = btn.dataset.type;
            const filtered = type === 'all' ? allWithDate : allWithDate.filter(i => i._type === type);
            renderTimeline(filtered, type);
        });
    });

    // ── GÉNEROS MUSICALES ─────────────────────────────────────────────────
    const musicGenreCount = {};
    albums.forEach(a => {
        (a.genres || []).forEach(g => { musicGenreCount[g] = (musicGenreCount[g] || 0) + 1; });
    });
    const topMusicGenres = Object.entries(musicGenreCount).sort((a, b) => b[1] - a[1]);
    const gridMusicGenres = document.getElementById('grid-music-genres');
    if (gridMusicGenres) {
        if (topMusicGenres.length === 0) {
            document.getElementById('section-music-genres').style.display = 'none';
        } else {
            gridMusicGenres.innerHTML = topMusicGenres
                .map(([name, count]) => genrePillHtml(name, count, `genre.html?g=${encodeParam(name)}`))
                .join('');
        }
    }

    // ── GÉNEROS CINEMATOGRÁFICOS ──────────────────────────────────────────
    const movieGenreCount = {};
    movies.forEach(m => {
        if (!m.genre) return;
        m.genre.split(',').map(g => g.trim()).filter(Boolean)
            .forEach(g => { movieGenreCount[g] = (movieGenreCount[g] || 0) + 1; });
    });
    const topMovieGenres = Object.entries(movieGenreCount).sort((a, b) => b[1] - a[1]);
    const gridMovieGenres = document.getElementById('grid-movie-genres');
    if (gridMovieGenres) {
        if (topMovieGenres.length === 0) {
            document.getElementById('section-movie-genres').style.display = 'none';
        } else {
            gridMovieGenres.innerHTML = topMovieGenres
                .map(([name, count]) => genrePillHtml(name, count, `movie-genre.html?g=${encodeParam(name)}`))
                .join('');
        }
    }

    // ── PAÍSES ────────────────────────────────────────────────────────────
    const countryCount = {};
    movies.forEach(m => {
        if (m.country?.trim()) countryCount[m.country.trim()] = (countryCount[m.country.trim()] || 0) + 1;
    });
    const topCountries = Object.entries(countryCount).sort((a, b) => b[1] - a[1]);
    const gridCountries = document.getElementById('grid-countries');
    if (gridCountries) {
        if (topCountries.length === 0) {
            document.getElementById('section-countries').style.display = 'none';
        } else {
            gridCountries.innerHTML = topCountries
                .map(([name, count]) => countryPillHtml(name, count, `country.html?country=${encodeParam(name)}`))
                .join('');
        }
    }

    refreshHomeDividers();
    showBackupReminder(allReviews.length);
}

// ── HELPERS DE RENDER ─────────────────────────────────────────────────────

// Fila deslizable: carga más tarjetas al llegar al final (hasta 25 o 50, según Ajustes)
function renderScrollGrid(containerId, items, cardFn) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = `<p class="home-empty">Nada aquí todavía.</p>`;
        return;
    }
    brRenderScrollRow(container, items, cardFn);
}

function albumCard(item, href) {
    const badgeColor = getColorByRating(item.rating);
    // Álbumes sin canciones → '—'; películas/series (sin tracks) → mostrar nota directamente
    const displayRating = Array.isArray(item.tracks) && item.tracks.length === 0
        ? '—' : formatRating(item.rating);
    const onclick = href ? `onclick="window.location.href='${href}'"` : '';

    return `
        <div class="home-card" ${onclick}>
            <img class="home-card-cover" src="${item.coverBase64}" alt="${esc(item.title)}">
            <div class="home-card-info">
                <div class="home-card-title">${esc(item.title)}</div>
                <div class="home-card-meta">${esc(item.artist || '')} ${item.year ? '· ' + item.year : ''}</div>
                <span class="home-card-badge" style="background:${badgeColor}">${displayRating}</span>
            </div>
        </div>`;
}


function directorCard(director) {
    const badgeColor = getColorByRating(director.avg);
    return `
        <div class="home-artist-card" onclick="window.location.href='director.html?name=${encodeParam(director.name)}'">
            <div class="home-artist-avatar" style="background:${badgeColor}">${director.name.charAt(0).toUpperCase()}</div>
            <div class="home-artist-name">${esc(director.name)}</div>
            <div class="home-artist-meta">${formatRating(director.avg)} · ${director.count} película${director.count !== 1 ? 's' : ''}</div>
        </div>`;
}

async function artistCard(artist) {
    const badgeColor = getColorByRating(artist.avg);
    const artistData = await getArtistFromDB(artist.name);
    const hasPhoto   = artistData && artistData.photo;
    const avatarHtml = hasPhoto
        ? `<img src="${artistData.photo}" style="width:60px;height:60px;border-radius:50%;object-fit:cover;margin:0 auto 10px;">`
        : `<div class="home-artist-avatar" style="background:${badgeColor}">${artist.name.charAt(0).toUpperCase()}</div>`;
    return `
        <div class="home-artist-card" onclick="window.location.href='artist.html?name=${encodeParam(artist.name)}'">
            ${avatarHtml}
            <div class="home-artist-name">${esc(artist.name)}</div>
            <div class="home-artist-meta">${formatRating(artist.avg)} · ${artist.count} canciones</div>
        </div>`;
}

loadHome();


// ── TIMELINE ──────────────────────────────────────────────────────────────
function renderTimeline(items, filter) {
    const container = document.getElementById('timeline-container');
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = `<p class="home-empty">
            ${filter === 'all'
                ? 'Añade fechas de puntuación a tus reviews para ver la línea de tiempo.'
                : 'No hay items de esta categoría con fecha de puntuación.'}
        </p>`;
        return;
    }

    const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    // Agrupar por año → mes
    const grouped = {};
    items.forEach(item => {
        const parts = item.reviewDate.split('-');
        const year  = parts[0];
        const month = parseInt(parts[1]) - 1;
        if (!grouped[year]) grouped[year] = {};
        if (!grouped[year][month]) grouped[year][month] = [];
        grouped[year][month].push(item);
    });

    const years = Object.keys(grouped).sort((a, b) => b - a);

    container.innerHTML = years.map(year => {
        const months = Object.keys(grouped[year]).sort((a, b) => b - a);
        const monthsHtml = months.map(month => {
            const monthItems = grouped[year][month];
            const cardsHtml  = monthItems.map(item => {
                const isVertical = item._type !== 'album';
                const badgeColor = getColorByRating(item.rating);
                const href = item._type === 'album'
                    ? `album.html?id=${item.id}`
                    : `media-detail.html?type=${item._type === 'movie' ? 'movies' : 'series'}&id=${item.id}`;
                return `
                    <div class="timeline-card${isVertical ? ' vertical' : ''}" onclick="window.location.href='${href}'">
                        <img src="${item.coverBase64}" alt="${esc(item.title)}">
                        <div class="timeline-card-info">
                            <div class="timeline-card-title">${esc(item.title)}</div>
                            <span class="timeline-card-badge" style="background:${badgeColor}">${formatRating(item.rating)}</span>
                        </div>
                    </div>`;
            }).join('');

            return `
                <div class="timeline-month-group">
                    <div class="timeline-month-label">${MONTHS[parseInt(month)]} · ${monthItems.length} review${monthItems.length !== 1 ? 's' : ''}</div>
                    <div class="timeline-row">${cardsHtml}</div>
                </div>`;
        }).join('');

        return `
            <div class="timeline-year-group">
                <div class="timeline-year-label">${year}</div>
                ${monthsHtml}
            </div>`;
    }).join('');
}
// country.js - Página de país cinematográfico

const COUNTRY_CODES = {
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

function getCountryCode(name) {
    if (!name) return null;
    return COUNTRY_CODES[name.toLowerCase().trim()] || null;
}

async function loadCountryPage() {
    const params  = new URLSearchParams(window.location.search);
    const country = params.get('country');
    if (!country) {
        document.getElementById('country-name').textContent = 'País no encontrado';
        return;
    }

    document.title = `BitRevs - ${country}`;
    document.getElementById('country-name').textContent = country;

    // ── BANDERA ───────────────────────────────────────────────────────────
    const code   = getCountryCode(country);
    const flagEl = document.getElementById('country-flag-img');
    if (code && flagEl) {
        flagEl.src = `https://flagcdn.com/h160/${code}.png`;
        flagEl.srcset = `https://flagcdn.com/h240/${code}.png 1.5x`;
        flagEl.alt = country;
        flagEl.style.display = 'block';
    }

    // ── DATOS ─────────────────────────────────────────────────────────────
    const allMovies = await getAllItemsFromDB('movies');
    const countryMovies = allMovies.filter(m =>
        m.country && m.country.trim().toLowerCase() === country.toLowerCase()
    );
    const ratedMovies = [...countryMovies]
        .filter(m => parseFloat(m.rating) > 0)
        .sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));

    const avg = ratedMovies.length
        ? ratedMovies.reduce((s, m) => s + parseFloat(m.rating), 0) / ratedMovies.length
        : 0;

    document.getElementById('country-meta').textContent =
        `${countryMovies.length} película${countryMovies.length !== 1 ? 's' : ''}` +
        (ratedMovies.length > 0 ? ` · media ${formatRating(avg)}` : '');

    // ── STATS RÁPIDAS ─────────────────────────────────────────────────────
    const statsEl = document.getElementById('country-stats');
    if (countryMovies.length > 0) {
        // Director más frecuente
        const dirCount = {};
        ratedMovies.forEach(m => {
            if (m.director) dirCount[m.director] = (dirCount[m.director] || 0) + 1;
        });
        const topDir = Object.entries(dirCount).sort((a, b) => b[1] - a[1])[0];

        statsEl.innerHTML = `
            <div class="country-stat-box">
                <div class="country-stat-label">Total vistas</div>
                <div class="country-stat-value">${countryMovies.length}</div>
            </div>
            ${ratedMovies.length > 0 ? `
            <div class="country-stat-box">
                <div class="country-stat-label">Nota media</div>
                <div class="country-stat-value" style="color:${getColorByRating(avg)}">${formatRating(avg)}</div>
            </div>` : ''}
            ${topDir && topDir[1] > 1 ? `
            <div class="country-stat-box">
                <div class="country-stat-label">Director favorito</div>
                <div class="country-stat-value" style="font-size:1.15rem;letter-spacing:-0.5px;">${topDir[0]}</div>
            </div>` : ''}
        `;
    }

    // ── MEJOR PELÍCULA ────────────────────────────────────────────────────
    if (ratedMovies.length > 0) {
        const best = ratedMovies[0];
        const badgeColor = getColorByRating(best.rating);
        const meta = [best.director ? `Dir. ${best.director}` : null, best.year].filter(Boolean).join(' · ');
        document.getElementById('country-best-section').style.display = 'block';
        document.getElementById('country-best-card').innerHTML = `
            <div class="country-best-card" onclick="window.location.href='media-detail.html?type=movies&id=${best.id}'">
                <img class="country-best-cover" src="${best.coverBase64 || ''}" alt="${best.title}">
                <div class="country-best-info">
                    <div class="country-best-title">${best.title}</div>
                    <div class="country-best-meta">${meta}</div>
                </div>
                <span class="country-best-badge" style="background:${badgeColor}">${formatRating(best.rating)}</span>
            </div>`;
    }

    // ── GRID DE PELÍCULAS ─────────────────────────────────────────────────
    const grid = document.getElementById('country-movies-grid');
    const titleEl = document.getElementById('movies-section-title');

    // Mostrar las que tienen nota primero, luego las sin nota
    const toShow = [
        ...ratedMovies,
        ...countryMovies.filter(m => !(parseFloat(m.rating) > 0))
    ];

    if (toShow.length === 0) {
        grid.innerHTML = '<p class="country-empty">No hay películas de este país todavía.</p>';
        titleEl.style.display = 'none';
    } else {
        // Omitir la mejor película del grid si ya se muestra arriba (evitar duplicado)
        const gridMovies = ratedMovies.length > 0
            ? toShow.filter(m => m.id !== ratedMovies[0].id)
            : toShow;

        if (gridMovies.length === 0) {
            titleEl.style.display = 'none';
        } else {
            titleEl.textContent = `Resto de películas (${gridMovies.length})`;
            grid.innerHTML = gridMovies.map(movieCardHtml).join('');
        }
    }
}

function movieCardHtml(m) {
    const badgeColor = getColorByRating(m.rating);
    const meta = [
        m.director ? `Dir. ${m.director}` : null,
        m.year || null
    ].filter(Boolean).join(' · ');
    const badge = parseFloat(m.rating) > 0
        ? `<span class="genre-movie-card-badge" style="background:${badgeColor}">${formatRating(m.rating)}</span>`
        : '';
    return `
        <div class="genre-movie-card" onclick="window.location.href='media-detail.html?type=movies&id=${m.id}'">
            <img src="${m.coverBase64 || ''}" alt="${m.title}" loading="lazy">
            <div class="genre-movie-card-info">
                <div class="genre-movie-card-title">${m.title}</div>
                <div class="genre-movie-card-meta">${meta}</div>
                ${badge}
            </div>
        </div>`;
}

loadCountryPage();

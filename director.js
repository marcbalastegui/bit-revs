
// director.js - Página de director de cine

const DIRECTOR_COUNTRY_CODES = {
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

function directorCountryCode(name) {
    if (!name) return null;
    return DIRECTOR_COUNTRY_CODES[name.toLowerCase().trim()] || null;
}

// ── CARGA Y RENDERIZADO ───────────────────────────────────────────────────
async function loadDirectorPage() {
    const params = new URLSearchParams(window.location.search);
    const name   = params.get('name');

    if (!name) {
        document.getElementById('director-name').textContent = 'Director no encontrado';
        return;
    }

    document.title = `BitRevs - ${name}`;
    document.getElementById('director-name').textContent = name;
    document.getElementById('director-initial').textContent = name.charAt(0).toUpperCase();

    // ── FOTO DEL DIRECTOR ─────────────────────────────────────────────────
    const directorId = name.toLowerCase().replace(/\s+/g, '_');
    const allDirectors = await getAllItemsFromDB('directors').catch(() => []);
    const dirData = (allDirectors || []).find(d => d.id === directorId) || {};

    if (dirData.photo) {
        showDirectorPhoto(dirData.photo);
    }

    // Botón de subir foto
    const photoBtn   = document.getElementById('director-photo-btn');
    const photoInput = document.getElementById('director-photo-input');

    photoBtn.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async ev => {
            const base64 = ev.target.result;
            showDirectorPhoto(base64);
            try {
                await saveItemToDB('directors', { id: directorId, name, photo: base64 });
                photoBtn.textContent = 'Cambiar foto';
            } catch (err) {
                console.error('Error guardando foto:', err);
            }
        };
        reader.readAsDataURL(file);
    });

    // ── PELÍCULAS DEL DIRECTOR ────────────────────────────────────────────
    const allMovies = await getAllItemsFromDB('movies');
    const dirMovies = allMovies.filter(m =>
        m.director && m.director.trim().toLowerCase() === name.toLowerCase()
    );

    const ratedMovies = [...dirMovies]
        .filter(m => parseFloat(m.rating) > 0)
        .sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));

    const avg = ratedMovies.length
        ? ratedMovies.reduce((s, m) => s + parseFloat(m.rating), 0) / ratedMovies.length
        : 0;

    // Meta bajo el nombre
    document.getElementById('director-meta').textContent =
        `${dirMovies.length} película${dirMovies.length !== 1 ? 's' : ''} en tu colección` +
        (ratedMovies.length > 0 ? ` · media ${formatRating(avg)}` : '');

    // ── STATS ─────────────────────────────────────────────────────────────
    const statsEl = document.getElementById('director-stats');

    // Años de actividad
    const years = dirMovies.map(m => parseInt(m.year)).filter(y => !isNaN(y));
    const yearSpan = years.length > 0
        ? (Math.min(...years) === Math.max(...years)
            ? `${Math.min(...years)}`
            : `${Math.min(...years)} – ${Math.max(...years)}`)
        : null;

    // Género más frecuente
    const genreCount = {};
    dirMovies.forEach(m => {
        if (!m.genre) return;
        m.genre.split(',').map(g => g.trim()).filter(Boolean)
            .forEach(g => { genreCount[g] = (genreCount[g] || 0) + 1; });
    });
    const topGenre = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0];

    // País más frecuente
    const countryCount = {};
    dirMovies.forEach(m => {
        if (m.country?.trim()) countryCount[m.country.trim()] = (countryCount[m.country.trim()] || 0) + 1;
    });
    const topCountry = Object.entries(countryCount).sort((a, b) => b[1] - a[1])[0];
    const countryCode = topCountry ? directorCountryCode(topCountry[0]) : null;

    let statsHtml = '';
    if (ratedMovies.length > 0) {
        statsHtml += `
            <div class="dir-stat-box">
                <div class="dir-stat-label">Nota media</div>
                <div class="dir-stat-value" style="color:${getColorByRating(avg)}">${formatRating(avg)}</div>
            </div>`;
    }
    if (yearSpan) {
        statsHtml += `
            <div class="dir-stat-box">
                <div class="dir-stat-label">Años</div>
                <div class="dir-stat-value" style="font-size:${years.length > 1 ? '1.4rem' : '2rem'};">${yearSpan}</div>
            </div>`;
    }
    if (topGenre) {
        statsHtml += `
            <div class="dir-stat-box">
                <div class="dir-stat-label">Género más visto</div>
                <div class="dir-stat-value" style="font-size:1.1rem;letter-spacing:-0.3px;">${topGenre[0]}</div>
            </div>`;
    }
    if (topCountry) {
        const flagHtml = countryCode
            ? `<img src="https://flagcdn.com/w40/${countryCode}.png" alt="${topCountry[0]}" style="width:28px;height:auto;border-radius:3px;margin-right:8px;vertical-align:middle;">`
            : '';
        statsHtml += `
            <div class="dir-stat-box" style="cursor:pointer;" onclick="window.location.href='country.html?country=${encodeURIComponent(topCountry[0])}'">
                <div class="dir-stat-label">País</div>
                <div class="dir-stat-value" style="font-size:1rem;display:flex;align-items:center;">${flagHtml}${topCountry[0]}</div>
            </div>`;
    }
    statsEl.innerHTML = statsHtml;

    // ── MEJOR PELÍCULA ────────────────────────────────────────────────────
    if (ratedMovies.length > 0) {
        const best = ratedMovies[0];
        document.getElementById('director-best-section').style.display = 'block';
        document.getElementById('director-best-card').innerHTML = `
            <div class="dir-best-card" onclick="window.location.href='media-detail.html?type=movies&id=${best.id}'">
                <img class="dir-best-cover" src="${best.coverBase64 || ''}" alt="${best.title}">
                <div class="dir-best-info">
                    <div class="dir-best-title">${best.title}</div>
                    <div class="dir-best-meta">${best.year || ''}</div>
                </div>
                <span class="dir-best-badge" style="background:${getColorByRating(best.rating)}">${formatRating(best.rating)}</span>
            </div>`;
    }

    // ── GRID DE PELÍCULAS ─────────────────────────────────────────────────
    const grid    = document.getElementById('director-movies-grid');
    const titleEl = document.getElementById('dir-movies-title');

    // Todas: mejor primero, sin nota al final
    const toShow = [
        ...ratedMovies,
        ...dirMovies.filter(m => !(parseFloat(m.rating) > 0))
    ];
    // Excluir la mejor del grid (ya se muestra arriba)
    const gridMovies = ratedMovies.length > 0
        ? toShow.filter(m => m.id !== ratedMovies[0].id)
        : toShow;

    if (gridMovies.length === 0) {
        titleEl.style.display = 'none';
        if (dirMovies.length === 0) {
            grid.innerHTML = '<p class="dir-empty">No hay películas de este director todavía.</p>';
        }
    } else {
        titleEl.textContent = `Resto de películas (${gridMovies.length})`;
        grid.innerHTML = gridMovies.map(movieCardHtml).join('');
    }
}

function showDirectorPhoto(src) {
    const img      = document.getElementById('director-photo-img');
    const initial  = document.getElementById('director-initial');
    const photoBtn = document.getElementById('director-photo-btn');
    img.src = src;
    img.style.display = 'block';
    initial.style.display = 'none';
    photoBtn.textContent = 'Cambiar foto';
}

function movieCardHtml(m) {
    const badgeColor = getColorByRating(m.rating);
    const badge = parseFloat(m.rating) > 0
        ? `<span class="dir-movie-badge" style="background:${badgeColor}">${formatRating(m.rating)}</span>`
        : '';
    return `
        <div class="dir-movie-card" onclick="window.location.href='media-detail.html?type=movies&id=${m.id}'">
            <img src="${m.coverBase64 || ''}" alt="${m.title}" loading="lazy">
            <div class="dir-movie-info">
                <div class="dir-movie-title">${m.title}</div>
                <div class="dir-movie-meta">${m.year || ''}</div>
                ${badge}
            </div>
        </div>`;
}

loadDirectorPage();

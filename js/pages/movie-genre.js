// movie-genre.js - Página de género cinematográfico

async function loadMovieGenrePage() {
    const params = new URLSearchParams(window.location.search);
    const genre  = params.get('g');
    if (!genre) {
        document.getElementById('genre-title').textContent = 'Género no encontrado';
        return;
    }

    document.title = `BitRevs - ${genre}`;
    document.getElementById('genre-title').textContent = genre;

    const allMovies = await getAllItemsFromDB('movies');

    // Filtrar películas de este género (split por coma, case-insensitive)
    const genreMovies = allMovies.filter(m => {
        if (!m.genre) return false;
        return m.genre.split(',').map(g => g.trim().toLowerCase())
            .includes(genre.toLowerCase());
    });

    const ratedMovies = [...genreMovies]
        .filter(m => parseFloat(m.rating) > 0)
        .sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));

    const avg = ratedMovies.length
        ? ratedMovies.reduce((s, m) => s + parseFloat(m.rating), 0) / ratedMovies.length
        : 0;

    document.getElementById('genre-meta').textContent =
        `${genreMovies.length} película${genreMovies.length !== 1 ? 's' : ''}` +
        (ratedMovies.length > 0 ? ` · media ${formatRating(avg)}` : '');

    // ── MEJORES PELÍCULAS (top 8) ─────────────────────────────────────────
    const bestGrid = document.getElementById('grid-best-movies');
    if (ratedMovies.length === 0) {
        bestGrid.innerHTML = '<p class="genre-empty">No hay películas puntuadas en este género.</p>';
        document.getElementById('section-best').style.display = 'none';
    } else {
        bestGrid.innerHTML = ratedMovies.slice(0, 8).map(movieCardHtml).join('');
    }

    // ── TODAS (colapsable) ────────────────────────────────────────────────
    const allGrid = document.getElementById('grid-all-movies');
    if (genreMovies.length === 0) {
        document.getElementById('section-all').style.display = 'none';
    } else {
        // En el colapsable mostramos todas ordenadas por nota (las sin nota al final)
        const sorted = [
            ...ratedMovies,
            ...genreMovies.filter(m => !(parseFloat(m.rating) > 0))
        ];
        allGrid.innerHTML = sorted.map(movieCardHtml).join('');
    }

    document.getElementById('todo-toggle').addEventListener('click', () => {
        document.getElementById('todo-body').classList.toggle('open');
        document.getElementById('todo-chevron').classList.toggle('open');
    });
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
            <img src="${m.coverBase64 || ''}" alt="${esc(m.title)}" loading="lazy">
            <div class="genre-movie-card-info">
                <div class="genre-movie-card-title">${esc(m.title)}</div>
                <div class="genre-movie-card-meta">${meta}</div>
                ${badge}
            </div>
        </div>`;
}

loadMovieGenrePage();

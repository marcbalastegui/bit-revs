// home.js - Lógica de la página principal

async function loadHome() {
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
    const recent = [...allReviews].sort((a, b) => b.id - a.id).slice(0, 12);
    renderScrollGrid('grid-recent', recent, (item) => {
        const isAlbum = albums.find(a => a.id === item.id);
        return albumCard(item, isAlbum ? `album.html?id=${item.id}` : null);
    });

    // ── MEJORES REVIEWS ───────────────────────────────────────────────────
    const best = [...albums]
        .filter(a => parseFloat(a.rating) > 0)
        .sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating))
        .slice(0, 12);
    renderScrollGrid('grid-best', best, (item) => albumCard(item, `album.html?id=${item.id}`));

    // ── ESTO HACE UN AÑO ──────────────────────────────────────────────────
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const margin = 30; // ±30 días de margen

    const flashback = albums.filter(a => {
        if (!a.reviewDate) return false;
        const parts = a.reviewDate.split('-');
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const diffDays = Math.abs((d - oneYearAgo) / (1000 * 60 * 60 * 24));
        return diffDays <= margin;
    });

    const gridFlashback = document.getElementById('grid-flashback');
    if (flashback.length === 0) {
        gridFlashback.innerHTML = `<p class="home-empty">No hay álbumes puntuados hace un año. ¡Vuelve dentro de un tiempo!</p>`;
    } else {
        renderScrollGrid('grid-flashback', flashback, (item) => flashbackCard(item));
    }

    // ── REVISITA REVIEWS ANTIGUAS ─────────────────────────────────────────
    // Los álbumes más antiguos que aún no has "revisado" recientemente
    // Ordenados por id ascendente (los más viejos primero), excluir los últimos 10
    const revisit = [...albums]
        .filter(a => parseFloat(a.rating) > 0)
        .sort((a, b) => a.id - b.id)
        .slice(0, 12);

    renderScrollGrid('grid-revisit', revisit, (item) => albumCard(item, `album.html?id=${item.id}`));

    // ── ARTISTAS MEJOR VALORADOS ──────────────────────────────────────────
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

    const topArtists = Object.entries(artistStats)
        .filter(([, s]) => s.count >= 3)
        .map(([name, s]) => ({ name, avg: s.total / s.count, count: s.count, albumCount: s.albumCount }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 10);

    // Artists need async card generation
    const artistGrid = document.getElementById('grid-artists');
    if (artistGrid) {
        artistGrid.innerHTML = '';
        for (const artist of topArtists) {
            const html = await artistCard(artist);
            const el = document.createElement('div');
            el.innerHTML = html;
            if (el.firstElementChild) artistGrid.appendChild(el.firstElementChild);
        }
    }

    // ── ALEATORIO ─────────────────────────────────────────────────────────
    renderRandom(albums);
    document.getElementById('btn-shuffle')?.addEventListener('click', () => renderRandom(albums));
}

function renderRandom(albums) {
    const scored = albums.filter(a => parseFloat(a.rating) > 0);
    if (scored.length === 0) {
        document.getElementById('grid-random').innerHTML = `<p class="home-empty">No hay álbumes puntuados todavía.</p>`;
        return;
    }
    const pick = scored[Math.floor(Math.random() * scored.length)];
    renderScrollGrid('grid-random', [pick], (item) => albumCard(item, `album.html?id=${item.id}`));
}

// ── HELPERS DE RENDER ─────────────────────────────────────────────────────

function renderScrollGrid(containerId, items, cardFn) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = `<p class="home-empty">Nada aquí todavía.</p>`;
        return;
    }

    container.innerHTML = '';
    items.forEach(item => {
        const el = document.createElement('div');
        el.innerHTML = cardFn(item);
        const card = el.firstElementChild;
        if (card) container.appendChild(card);
    });
}

function albumCard(item, href) {
    const badgeColor = getColorByRating(item.rating);
    const displayRating = item.tracks && item.tracks.length > 0
        ? formatRating(item.rating) : '—';
    const onclick = href ? `onclick="window.location.href='${href}'"` : '';

    return `
        <div class="home-card" ${onclick}>
            <img class="home-card-cover" src="${item.coverBase64}" alt="${item.title}">
            <div class="home-card-info">
                <div class="home-card-title">${item.title}</div>
                <div class="home-card-meta">${item.artist || ''} ${item.year ? '· ' + item.year : ''}</div>
                <span class="home-card-badge" style="background:${badgeColor}">${displayRating}</span>
            </div>
        </div>`;
}

function flashbackCard(item) {
    const badgeColor = getColorByRating(item.rating);
    const parts = item.reviewDate.split('-');
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const dateLabel = `${parseInt(parts[2])} de ${months[parseInt(parts[1]) - 1]} de ${parseInt(parts[0]) - 1}`;

    return `
        <div class="home-flashback-card" onclick="window.location.href='album.html?id=${item.id}'">
            <img class="home-flashback-cover" src="${item.coverBase64}" alt="${item.title}">
            <div class="home-flashback-info">
                <div class="home-flashback-label">Hace un año</div>
                <div class="home-flashback-title">${item.title}</div>
                <div class="home-flashback-meta">${item.artist} · ${dateLabel}</div>
                <span class="home-card-badge" style="background:${badgeColor}; margin-top:4px; display:inline-block;">${formatRating(item.rating)}</span>
            </div>
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
        <div class="home-artist-card" onclick="window.location.href='artist.html?name=${encodeURIComponent(artist.name)}'">
            ${avatarHtml}
            <div class="home-artist-name">${artist.name}</div>
            <div class="home-artist-meta">${formatRating(artist.avg)} · ${artist.count} canciones</div>
        </div>`;
}

loadHome();
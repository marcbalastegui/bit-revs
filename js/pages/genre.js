// genre.js - Página de género musical

async function loadGenrePage() {
    const params = new URLSearchParams(window.location.search);
    const genre  = params.get('g');
    if (!genre) { document.getElementById('genre-title').textContent = 'Género no encontrado'; return; }

    document.title = `BitRevs - ${genre}`;
    document.getElementById('genre-title').textContent = genre;

    const allAlbums = await getAllAlbumsFromDB();
    const allLists  = await getAllItemsFromDB('lists');

    // Álbumes de este género
    const genreAlbums = allAlbums.filter(a => a.genres && a.genres.includes(genre));
    const ratedAlbums = genreAlbums.filter(a => parseFloat(a.rating) > 0)
        .sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));

    // Meta
    document.getElementById('genre-meta').textContent =
        `${genreAlbums.length} álbum${genreAlbums.length !== 1 ? 'es' : ''} · ${ratedAlbums.length} puntuados`;

    // ── MEJORES ÁLBUMES! (top 12) ─────────────────────────────────────────────
    const bestGrid = document.getElementById('grid-best-albums');
    if (ratedAlbums.length === 0) {
        bestGrid.innerHTML = `<p class="genre-empty">No hay álbumes puntuados en este género.</p>`;
    } else {
        bestGrid.innerHTML = ratedAlbums.slice(0, 8).map(album => albumCard(album)).join('');
    }

    // ── LISTAS ───────────────────────────────────────────────────────────────
    const genreAlbumIds = new Set(genreAlbums.map(a => a.id));
    const relatedLists = allLists.filter(list =>
        // Listas etiquetadas con este género explícitamente
        (list.genre && list.genre.toLowerCase() === genre.toLowerCase()) ||
        // O listas que contienen álbumes de este género
        (list.items || []).some(ref => ref.type === 'album' && genreAlbumIds.has(ref.id))
    );

    const listsContainer = document.getElementById('grid-lists');
    if (relatedLists.length === 0) {
        document.getElementById('section-lists').style.display = 'none';
    } else {
        listsContainer.innerHTML = relatedLists.map(list => {
            // Primeras 3 portadas de álbumes del género dentro de la lista
            const covers = (list.items || [])
                .filter(ref => ref.type === 'album' && genreAlbumIds.has(ref.id))
                .slice(0, 3)
                .map(ref => {
                    const album = genreAlbums.find(a => a.id === ref.id);
                    return album?.coverBase64
                        ? `<img src="${album.coverBase64}" alt="${esc(album.title)}" onerror="this.style.display='none'">`
                        : '';
                }).join('');

            const total = (list.items || []).length;
            return `
                <div class="genre-list-row" onclick="window.location.href='lists.html'">
                    <div class="genre-list-covers">${covers}</div>
                    <span class="genre-list-name">${esc(list.name)}</span>
                    <span class="genre-list-count">${total} elemento${total !== 1 ? 's' : ''}</span>
                </div>`;
        }).join('');
    }

    // ── MEJORES CANCIONES (top 20) ────────────────────────────────────────────
    const allTracks = [];
    genreAlbums.forEach(album => {
        (album.tracks || []).forEach(track => {
            if (!track.isInterlude && parseFloat(track.rating) > 0) {
                allTracks.push({ ...track, _mainArtist: album.artist, albumId: album.id, albumTitle: album.title, albumCover: album.coverBase64, albumRating: parseFloat(album.rating) || 0 });
            }
        });
    });
    const uniqueGenreTracks = deduplicateTracks(allTracks);
    const boost = await computeTopBoost();
    uniqueGenreTracks.sort((a, b) => compareTrackRanking(a, b, boost, 'best'));

    const tracksContainer = document.getElementById('grid-tracks');
    if (uniqueGenreTracks.length === 0) {
        tracksContainer.innerHTML = `<p class="genre-empty">No hay canciones puntuadas en este género.</p>`;
    } else {
        tracksContainer.innerHTML = uniqueGenreTracks.slice(0, 20).map((track, idx) => {
            const color = getColorByRating(track.rating);
            return `
                <div class="genre-track-row" onclick="window.location.href='album.html?id=${track.albumId}'">
                    <span class="genre-track-pos">${idx + 1}</span>
                    <img class="genre-track-cover" src="${track.albumCover || ''}" alt="${esc(track.albumTitle)}"
                        loading="lazy" onerror="this.style.visibility='hidden'">
                    <div class="genre-track-info">
                        <div class="genre-track-title">${esc(track.title)}</div>
                        <div class="genre-track-meta">${esc(track.albumTitle)}${track.artist ? ' · ' + esc(track.artist) : ''}</div>
                    </div>
                    ${favStarHtml(track.favorite)}
                    <span class="rating-badge" style="background:${color}; font-size:0.85rem;">${formatRating(track.rating)}</span>
                </div>`;
        }).join('');
    }

    // ── TODO (colapsable) ─────────────────────────────────────────────────────
    const allGrid = document.getElementById('grid-all-albums');
    if (genreAlbums.length === 0) {
        allGrid.innerHTML = `<p class="genre-empty">No hay álbumes en este género.</p>`;
    } else {
        const sorted = [...genreAlbums].sort((a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0));
        allGrid.innerHTML = sorted.map(album => albumCard(album)).join('');
    }

    // Toggle colapsable
    document.getElementById('todo-toggle').addEventListener('click', () => {
        const body    = document.getElementById('todo-body');
        const chevron = document.getElementById('todo-chevron');
        body.classList.toggle('open');
        chevron.classList.toggle('open');
    });
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function albumCard(album) {
    const badgeColor   = getColorByRating(album.rating);
    const displayRating = parseFloat(album.rating) > 0 ? formatRating(album.rating) : '—';
    return `
        <div class="genre-album-card" onclick="window.location.href='album.html?id=${album.id}'">
            <img src="${album.coverBase64 || ''}" alt="${esc(album.title)}" loading="lazy"
                onerror="this.style.display='none'">
            <div class="genre-album-card-info">
                <div class="genre-album-card-title">${esc(album.title)}</div>
                <div class="genre-album-card-meta">${esc(album.artist || '')} ${album.year ? '· ' + album.year : ''}</div>
                <span class="genre-album-card-badge" style="background:${badgeColor}">${displayRating}</span>
            </div>
        </div>`;
}

loadGenrePage();

// top.js - Lógica del Top 100 Canciones

const SNAPSHOT_KEY = 'bitrevs_top_snapshot';

function loadSnapshot() {
    try {
        const raw = localStorage.getItem(SNAPSHOT_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function saveSnapshot(rankedTracks) {
    const snapshot = rankedTracks.map((t, i) => ({ uid: t._uid, rank: i + 1 }));
    try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot)); } catch {}
}

function buildUid(albumId, trackTitle) {
    return `${albumId}__${trackTitle.toLowerCase().trim()}`;
}

async function buildRanking() {
    const albums = await getAllAlbumsFromDB();
    const allTracks = [];

    albums.forEach(album => {
        if (!album.tracks) return;
        const albumRating = parseFloat(album.rating) || 0;

        album.tracks.forEach(track => {
            if (track.isInterlude) return;
            const r = parseFloat(track.rating);
            if (isNaN(r) || r <= 0) return;

            // Artista: album.artist principal + invitados sin duplicar el principal
            let artistDisplay = album.artist || '';
            if (track.artist && track.artist.trim() !== '') {
                const featured = track.artist.split(',')
                    .map(a => a.trim())
                    .filter(a => a !== '' && a.toLowerCase() !== (album.artist || '').toLowerCase());
                if (featured.length > 0) {
                    artistDisplay = `${album.artist} ft. ${featured.join(', ')}`;
                }
            }

            allTracks.push({
                _uid:        buildUid(album.id, track.title),
                title:       track.title,
                artist:      artistDisplay,
                albumTitle:  album.title,
                albumYear:   album.year,
                albumRating: albumRating,
                cover:       album.coverBase64,
                albumId:     album.id,
                rating:      r
            });
        });
    });

    // Ordenar: mayor nota primero
    // Empate → álbum con mejor nota primero
    // Doble empate → título de canción alfabético
    allTracks.sort((a, b) => {
        if (b.rating !== a.rating) return b.rating - a.rating;
        if (b.albumRating !== a.albumRating) return b.albumRating - a.albumRating;
        return a.title.localeCompare(b.title);
    });

    return allTracks.slice(0, 100);
}

function calcMovement(uid, currentRank, snapshotMap) {
    if (!snapshotMap) return null;
    if (!(uid in snapshotMap)) return 'new';
    const prev = snapshotMap[uid];
    if (currentRank < prev) return 'up';
    if (currentRank > prev) return 'down';
    return null;
}

function renderRanking(tracks, snapshotMap, filterQuery) {
    const list     = document.getElementById('top-list');
    const subtitle = document.getElementById('top-subtitle');
    list.innerHTML = '';

    let filtered = tracks;
    if (filterQuery && filterQuery.trim() !== '') {
        const q = filterQuery.toLowerCase().trim();
        filtered = tracks.filter(t =>
            t.artist.toLowerCase().includes(q) ||
            t.albumTitle.toLowerCase().includes(q)
        );
    }

    if (filtered.length === 0) {
        subtitle.textContent = 'No hay canciones que coincidan con tu búsqueda.';
        list.innerHTML = '<p class="top-empty">Prueba con otro artista o álbum.</p>';
        return;
    }

    const totalSinFiltro = tracks.length;
    if (filterQuery && filterQuery.trim() !== '') {
        subtitle.textContent = `Mostrando ${filtered.length} canción${filtered.length !== 1 ? 'es' : ''} filtradas de ${totalSinFiltro} en el ranking.`;
    } else {
        subtitle.textContent = `Top ${totalSinFiltro} canción${totalSinFiltro !== 1 ? 'es' : ''} mejor puntuadas.`;
    }

    filtered.forEach((track) => {
        const realRank = tracks.indexOf(track) + 1;
        const movement = calcMovement(track._uid, realRank, snapshotMap);

        let arrowHtml = '<span class="top-arrow"></span>';
        if (movement === 'up')   arrowHtml = '<span class="top-arrow up">▲</span>';
        if (movement === 'down') arrowHtml = '<span class="top-arrow down">▼</span>';
        if (movement === 'new')  arrowHtml = '<span class="top-arrow new">NEW</span>';

        const badgeColor = typeof getColorByRating === 'function'
            ? getColorByRating(track.rating) : '#666';

        const displayRating = typeof formatRating === 'function'
            ? formatRating(track.rating) : track.rating;

        const row = document.createElement('div');
        row.className = 'top-row';
        row.style.cursor = 'pointer';
        row.title = `Ir a ${track.albumTitle}`;
        row.addEventListener('click', () => {
            window.location.href = `album.html?id=${track.albumId}`;
        });

        row.innerHTML = `
            <span class="top-rank">${realRank}</span>
            ${arrowHtml}
            <img class="top-cover" src="${track.cover}" alt="${track.albumTitle}">
            <div class="top-info">
                <div class="top-track-title">${track.title}</div>
                <div class="top-track-meta">${track.artist} · ${track.albumTitle} (${track.albumYear})</div>
            </div>
            <span class="top-badge" style="background-color:${badgeColor};">${displayRating}</span>
        `;
        list.appendChild(row);
    });
}

async function initTop() {
    const rankedTracks = await buildRanking();

    const prevSnapshot = loadSnapshot();
    let snapshotMap = null;
    if (prevSnapshot) {
        snapshotMap = {};
        prevSnapshot.forEach(entry => { snapshotMap[entry.uid] = entry.rank; });
    }

    saveSnapshot(rankedTracks);
    renderRanking(rankedTracks, snapshotMap, '');

    const filterInput = document.getElementById('top-filter');
    if (filterInput) {
        filterInput.addEventListener('input', () => {
            renderRanking(rankedTracks, snapshotMap, filterInput.value);
        });
    }
}

initTop();
// top.js - Lógica del Top 100 Canciones

const SNAPSHOT_KEY = 'bitrevs_top_snapshot';
let currentMode       = 'best';   // 'best' | 'worst'
let currentTiebreaker = 'album-rating';
let fullRanking       = [];       // ranking completo sin filtrar

// ── SNAPSHOT ──────────────────────────────────────────────────────────────
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

// ── BUILD RANKING ─────────────────────────────────────────────────────────
async function buildRanking(mode, tiebreaker) {
    const albums = await getAllAlbumsFromDB();
    const allTracks = [];

    albums.forEach((album, albumIndex) => {
        if (!album.tracks) return;
        const albumRating = parseFloat(album.rating) || 0;

        album.tracks.forEach(track => {
            if (track.isInterlude) return;
            const r = parseFloat(track.rating);
            if (isNaN(r) || r <= 0) return;

            let artistDisplay = album.artist || '';
            if (track.artist && track.artist.trim() !== '') {
                const guests = track.artist.split(',')
                    .map(a => a.trim())
                    .filter(a => a !== '' && a.toLowerCase() !== (album.artist || '').toLowerCase());
                if (guests.length > 0) {
                    artistDisplay = `${album.artist} ft. ${guests.join(', ')}`;
                }
            }

            allTracks.push({
                _uid:         buildUid(album.id, track.title),
                _addedIndex:  albumIndex, // para desempate por orden de añadido
                title:        track.title,
                artist:       artistDisplay,
                albumTitle:   album.title,
                albumYear:    album.year,
                albumRating:  albumRating,
                cover:        album.coverBase64,
                albumId:      album.id,
                rating:       r
            });
        });
    });

    // Ordenar según modo y criterio de desempate
    allTracks.sort((a, b) => {
        // Primero por nota: mejores arriba si 'best', peores arriba si 'worst'
        const primaryDiff = mode === 'best'
            ? b.rating - a.rating
            : a.rating - b.rating;

        if (primaryDiff !== 0) return primaryDiff;

        // Desempate
        if (tiebreaker === 'album-rating') {
            const albumDiff = mode === 'best'
                ? b.albumRating - a.albumRating
                : a.albumRating - b.albumRating;
            if (albumDiff !== 0) return albumDiff;
        }

        if (tiebreaker === 'alphabetical') {
            return a.title.localeCompare(b.title);
        }

        if (tiebreaker === 'added') {
            return a._addedIndex - b._addedIndex;
        }

        // Fallback alfabético
        return a.title.localeCompare(b.title);
    });

    return allTracks.slice(0, 100);
}

// ── MOVIMIENTO ────────────────────────────────────────────────────────────
function calcMovement(uid, currentRank, snapshotMap) {
    if (!snapshotMap) return null;
    if (!(uid in snapshotMap)) return 'new';
    const prev = snapshotMap[uid];
    if (currentRank < prev) return 'up';
    if (currentRank > prev) return 'down';
    return null;
}

// ── RENDER ────────────────────────────────────────────────────────────────
function renderRanking(tracks, snapshotMap, filterQuery) {
    const list     = document.getElementById('top-list');
    const subtitle = document.getElementById('top-subtitle');
    list.innerHTML = '';

    const isFiltered = filterQuery && filterQuery.trim() !== '';
    let filtered = tracks;

    if (isFiltered) {
        const q = filterQuery.toLowerCase().trim();
        filtered = tracks.filter(t =>
            t.artist.toLowerCase().includes(q) ||
            t.albumTitle.toLowerCase().includes(q)
        );
    }

    if (filtered.length === 0) {
        subtitle.textContent = 'No hay canciones que coincidan con tu búsqueda.';
        list.innerHTML = `
            <div class="top-empty">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--border-color)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:48px;height:48px;margin-bottom:12px;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                <p>Prueba con otro artista o álbum.</p>
            </div>`;
        return;
    }

    const modeLabel = currentMode === 'best' ? 'mejores' : 'peores';
    if (isFiltered) {
        subtitle.textContent = `${filtered.length} canción${filtered.length !== 1 ? 'es' : ''} filtradas · posición global entre paréntesis`;
    } else {
        subtitle.textContent = `Top ${tracks.length} canciones ${modeLabel} puntuadas`;
    }

    filtered.forEach((track, filteredIndex) => {
        const globalRank   = tracks.indexOf(track) + 1;
        const filteredRank = filteredIndex + 1;
        const movement     = calcMovement(track._uid, globalRank, snapshotMap);

        let arrowHtml = '<span class="top-arrow"></span>';
        if (movement === 'up')   arrowHtml = '<span class="top-arrow up">▲</span>';
        if (movement === 'down') arrowHtml = '<span class="top-arrow down">▼</span>';
        if (movement === 'new')  arrowHtml = '<span class="top-arrow new">NEW</span>';

        const badgeColor    = typeof getColorByRating === 'function' ? getColorByRating(track.rating) : '#666';
        const displayRating = typeof formatRating === 'function' ? formatRating(track.rating) : track.rating;

        // Ranking: si hay filtro activo, mostrar posición filtrada + global
        let rankHtml = '';
        if (isFiltered) {
            rankHtml = `
                <div class="top-rank-dual">
                    <span class="top-rank-global">${filteredRank}</span>
                    <span class="top-rank-filtered">#${globalRank} global</span>
                </div>`;
        } else {
            rankHtml = `<span class="top-rank">${globalRank}</span>`;
        }

        const row = document.createElement('div');
        row.className = 'top-row';
        row.title = `Ir a ${track.albumTitle}`;
        row.addEventListener('click', () => {
            window.location.href = `album.html?id=${track.albumId}`;
        });

        row.innerHTML = `
            ${rankHtml}
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

// ── INIT ──────────────────────────────────────────────────────────────────
async function initTop() {
    const prevSnapshot = loadSnapshot();
    let snapshotMap = null;
    if (prevSnapshot) {
        snapshotMap = {};
        prevSnapshot.forEach(entry => { snapshotMap[entry.uid] = entry.rank; });
    }

    // Construir ranking inicial
    fullRanking = await buildRanking(currentMode, currentTiebreaker);
    saveSnapshot(fullRanking);
    renderRanking(fullRanking, snapshotMap, '');

    // Buscador
    const filterInput = document.getElementById('top-filter');
    filterInput?.addEventListener('input', () => {
        renderRanking(fullRanking, snapshotMap, filterInput.value);
    });

    // Cambio de modo (mejor/peor)
    document.getElementById('btn-mode-best')?.addEventListener('click', async () => {
        if (currentMode === 'best') return;
        currentMode = 'best';
        document.getElementById('btn-mode-best').classList.add('active');
        document.getElementById('btn-mode-worst').classList.remove('active');
        fullRanking = await buildRanking(currentMode, currentTiebreaker);
        saveSnapshot(fullRanking);
        renderRanking(fullRanking, snapshotMap, filterInput?.value || '');
    });

    document.getElementById('btn-mode-worst')?.addEventListener('click', async () => {
        if (currentMode === 'worst') return;
        currentMode = 'worst';
        document.getElementById('btn-mode-worst').classList.add('active');
        document.getElementById('btn-mode-best').classList.remove('active');
        fullRanking = await buildRanking(currentMode, currentTiebreaker);
        saveSnapshot(fullRanking);
        renderRanking(fullRanking, snapshotMap, filterInput?.value || '');
    });

    // Cambio de criterio de desempate
    document.getElementById('top-tiebreaker')?.addEventListener('change', async (e) => {
        currentTiebreaker = e.target.value;
        fullRanking = await buildRanking(currentMode, currentTiebreaker);
        saveSnapshot(fullRanking);
        renderRanking(fullRanking, snapshotMap, filterInput?.value || '');
    });
}

initTop();
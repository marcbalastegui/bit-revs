// top.js - Lógica del Top 100 Canciones

const SNAPSHOT_KEY    = 'bitrevs_top_snapshot';
let currentMode       = 'best';         // 'best' | 'worst'
let currentTiebreaker = 'album-rating'; // 'album-rating' | 'alphabetical' | 'added'
let tiebreakerDir     = 'asc';          // 'asc' | 'desc' (solo aplica a alphabetical y added)
let fullRanking       = [];
let snapshotMap       = null;           // se carga UNA vez al inicio y no cambia

// ── SNAPSHOT ──────────────────────────────────────────────────────────────
function loadSnapshot() {
    try {
        const raw = localStorage.getItem(SNAPSHOT_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

// Solo se guarda si NO existe uno previo — nunca se sobreescribe al reordenar
function saveSnapshotIfEmpty(rankedTracks) {
    try {
        if (localStorage.getItem(SNAPSHOT_KEY)) return;
        const snapshot = rankedTracks.map((t, i) => ({ uid: t._uid, rank: i + 1 }));
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
    } catch {}
}

function buildUid(albumId, trackTitle) {
    return `${albumId}__${trackTitle.toLowerCase().trim()}`;
}

// ── BUILD RANKING ─────────────────────────────────────────────────────────
async function buildRanking(mode, tiebreaker, dir) {
    const albums = await getAllAlbumsFromDB();
    const { albumBoost, trackBoost } = await computeTopBoost();
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
                _uid:        buildUid(album.id, track.title),
                _addedIndex: albumIndex,
                _boost:      getTrackBoostScore(album.id, track.title, albumBoost, trackBoost),
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

    allTracks.sort((a, b) => {
        // 1. Nota de canción
        const primaryDiff = mode === 'best'
            ? b.rating - a.rating
            : a.rating - b.rating;
        if (primaryDiff !== 0) return primaryDiff;

        // 2. Boost de listas Top (automático, siempre)
        const boostDiff = b._boost - a._boost;
        if (boostDiff !== 0) return boostDiff;

        // 3. Desempate manual según criterio
        if (tiebreaker === 'album-rating') return b.albumRating - a.albumRating;
        if (tiebreaker === 'alphabetical') {
            const cmp = a.title.localeCompare(b.title);
            return dir === 'asc' ? cmp : -cmp;
        }
        if (tiebreaker === 'added') {
            const cmp = a._addedIndex - b._addedIndex;
            return dir === 'asc' ? cmp : -cmp;
        }
        return a.title.localeCompare(b.title);
    });

    return allTracks.slice(0, 100);
}

// ── MOVIMIENTO ────────────────────────────────────────────────────────────
function calcMovement(uid, currentRank) {
    if (!snapshotMap) return null;
    if (!(uid in snapshotMap)) return 'new';
    const prev = snapshotMap[uid];
    if (currentRank < prev) return 'up';
    if (currentRank > prev) return 'down';
    return null;
}

// ── RENDER ────────────────────────────────────────────────────────────────
function renderRanking(tracks, filterQuery) {
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
    subtitle.textContent = isFiltered
        ? `${filtered.length} canción${filtered.length !== 1 ? 'es' : ''} filtradas · posición global entre paréntesis`
        : `Top ${tracks.length} canciones ${modeLabel} puntuadas`;

    filtered.forEach((track, filteredIndex) => {
        const globalRank   = tracks.indexOf(track) + 1;
        const filteredRank = filteredIndex + 1;

        // Las flechas usan el snapshotMap cargado al inicio — no cambia con el orden
        const movement = calcMovement(track._uid, globalRank);

        let arrowHtml = '<span class="top-arrow"></span>';
        if (movement === 'up')   arrowHtml = '<span class="top-arrow up">▲</span>';
        if (movement === 'down') arrowHtml = '<span class="top-arrow down">▼</span>';
        if (movement === 'new')  arrowHtml = '<span class="top-arrow new">NEW</span>';

        const badgeColor    = typeof getColorByRating === 'function' ? getColorByRating(track.rating) : '#666';
        const displayRating = typeof formatRating === 'function' ? formatRating(track.rating) : track.rating;

        const rankHtml = isFiltered
            ? `<div class="top-rank-dual">
                    <span class="top-rank-global">${filteredRank}</span>
                    <span class="top-rank-filtered">#${globalRank} global</span>
               </div>`
            : `<span class="top-rank">${globalRank}</span>`;

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

// ── ACTUALIZAR DIRECCIÓN DEL BOTÓN ────────────────────────────────────────
function updateDirButton() {
    const btn = document.getElementById('btn-tiebreaker-dir');
    const tiebreaker = currentTiebreaker;

    // El botón solo tiene sentido para alphabetical y added
    if (tiebreaker === 'album-rating') {
        btn.style.visibility = 'hidden';
    } else {
        btn.style.visibility = 'visible';
        btn.textContent = tiebreakerDir === 'asc' ? '↓' : '↑';
        btn.title = tiebreakerDir === 'asc' ? 'Orden ascendente (A→Z / primero→último)' : 'Orden descendente (Z→A / último→primero)';
    }
}

// ── REORDENAR SIN GUARDAR SNAPSHOT ───────────────────────────────────────
async function reorder() {
    const filterInput = document.getElementById('top-filter');
    fullRanking = await buildRanking(currentMode, currentTiebreaker, tiebreakerDir);
    // NO llamamos saveSnapshotIfEmpty aquí — solo al cargar la página
    renderRanking(fullRanking, filterInput?.value || '');
}

// ── INIT ──────────────────────────────────────────────────────────────────
async function initTop() {
    // Cargar snapshot ANTES de construir el ranking
    const prevSnapshot = loadSnapshot();
    if (prevSnapshot) {
        snapshotMap = {};
        prevSnapshot.forEach(entry => { snapshotMap[entry.uid] = entry.rank; });
    }

    // Construir ranking inicial
    fullRanking = await buildRanking(currentMode, currentTiebreaker, tiebreakerDir);

    // Guardar snapshot UNA sola vez — al cargar la página
    saveSnapshotIfEmpty(fullRanking);

    updateDirButton();
    renderRanking(fullRanking, '');

    const filterInput = document.getElementById('top-filter');

    // Buscador
    filterInput?.addEventListener('input', () => {
        renderRanking(fullRanking, filterInput.value);
    });

    // Modo mejor/peor
    document.getElementById('btn-mode-best')?.addEventListener('click', async () => {
        if (currentMode === 'best') return;
        currentMode = 'best';
        document.getElementById('btn-mode-best').classList.add('active');
        document.getElementById('btn-mode-worst').classList.remove('active');
        await reorder();
    });

    document.getElementById('btn-mode-worst')?.addEventListener('click', async () => {
        if (currentMode === 'worst') return;
        currentMode = 'worst';
        document.getElementById('btn-mode-worst').classList.add('active');
        document.getElementById('btn-mode-best').classList.remove('active');
        await reorder();
    });

    // Criterio de desempate
    document.getElementById('top-tiebreaker')?.addEventListener('change', async (e) => {
        currentTiebreaker = e.target.value;
        updateDirButton();
        await reorder();
    });

    // Dirección asc/desc
    document.getElementById('btn-tiebreaker-dir')?.addEventListener('click', async () => {
        tiebreakerDir = tiebreakerDir === 'asc' ? 'desc' : 'asc';
        updateDirButton();
        await reorder();
    });
}

initTop();
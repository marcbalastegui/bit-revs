// top.js - Lógica del Top 100

const SNAPSHOT_KEY    = 'bitrevs_top_snapshot';
let currentContent    = 'songs';        // 'songs' | 'movies' | 'series'
let currentMode       = 'best';         // 'best' | 'worst'
let currentTiebreaker = 'album-rating'; // 'album-rating' | 'alphabetical' | 'added'
let tiebreakerDir     = 'asc';          // 'asc' | 'desc' (solo aplica a alphabetical y added)
let fullRanking       = [];
let fullMediaRanking  = [];
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
                _mainArtist: album.artist,
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

    const uniqueTracks = deduplicateTracks(allTracks);
    uniqueTracks.sort((a, b) => {
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

    return uniqueTracks.slice(0, 100);
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

// ── RANKING DE PELÍCULAS / SERIES ────────────────────────────────────────
async function buildMediaRanking(storeType, mode) {
    const items = await getAllItemsFromDB(storeType);
    const rated = items.filter(i => parseFloat(i.rating) > 0);
    rated.sort((a, b) => {
        const diff = mode === 'best'
            ? parseFloat(b.rating) - parseFloat(a.rating)
            : parseFloat(a.rating) - parseFloat(b.rating);
        if (diff !== 0) return diff;
        return (a.title || '').localeCompare(b.title || '');
    });
    return rated.slice(0, 100);
}

function renderMediaRanking(items, filterQuery, storeType) {
    const list     = document.getElementById('top-list');
    const subtitle = document.getElementById('top-subtitle');
    list.innerHTML = '';

    const q = (filterQuery || '').toLowerCase().trim();
    const filtered = q ? items.filter(i =>
        (i.title    && i.title.toLowerCase().includes(q))    ||
        (i.director && i.director.toLowerCase().includes(q)) ||
        (i.creator  && i.creator.toLowerCase().includes(q))
    ) : items;

    const contentLabel = storeType === 'movies' ? 'películas' : 'series';
    const modeLabel    = currentMode === 'best' ? 'mejores' : 'peores';

    if (filtered.length === 0) {
        subtitle.textContent = `No hay ${contentLabel} que coincidan con tu búsqueda.`;
        list.innerHTML = `<div class="top-empty"><p>Prueba con otro título.</p></div>`;
        return;
    }

    subtitle.textContent = q
        ? `${filtered.length} ${contentLabel} filtradas`
        : `Top ${filtered.length} ${contentLabel} ${modeLabel} puntuadas`;

    filtered.forEach((item, idx) => {
        const rank         = idx + 1;
        const badgeColor   = getColorByRating(item.rating);
        const displayRating = formatRating(item.rating);
        const credit       = storeType === 'movies'
            ? (item.director ? `${item.director} · ` : '')
            : (item.creator  ? `${item.creator} · `  : '');
        const detailUrl    = `media-detail.html?type=${storeType}&id=${item.id}`;

        const row = document.createElement('div');
        row.className = 'top-row';
        row.addEventListener('click', () => { window.location.href = detailUrl; });
        row.innerHTML = `
            <span class="top-rank">${rank}</span>
            <span class="top-arrow"></span>
            <img class="top-cover" src="${item.coverBase64 || ''}" alt="${item.title}" style="border-radius:6px;">
            <div class="top-info">
                <div class="top-track-title">${item.title}</div>
                <div class="top-track-meta">${credit}${item.year || ''}</div>
            </div>
            <span class="top-badge" style="background-color:${badgeColor};">${displayRating}</span>
        `;
        list.appendChild(row);
    });
}

// ── REORDENAR SIN GUARDAR SNAPSHOT ───────────────────────────────────────
async function reorder() {
    if (currentContent !== 'songs') {
        const mediaFilter = document.getElementById('top-media-filter');
        fullMediaRanking = await buildMediaRanking(currentContent, currentMode);
        renderMediaRanking(fullMediaRanking, mediaFilter?.value || '', currentContent);
        return;
    }
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

    // ── TABS DE CONTENIDO ────────────────────────────────────────────────
    function switchContent(content) {
        currentContent = content;
        const songsControls = document.getElementById('songs-controls');
        const mediaControls = document.getElementById('media-controls');
        const mediaFilter   = document.getElementById('top-media-filter');
        const titleEl       = document.getElementById('top-title');

        ['songs', 'movies', 'series'].forEach(c => {
            document.getElementById(`btn-content-${c}`)?.classList.toggle('active', c === content);
        });

        if (content === 'songs') {
            songsControls.style.display = '';
            mediaControls.style.display = 'none';
            if (titleEl) titleEl.textContent = 'Top Canciones';
            if (mediaFilter) mediaFilter.value = '';
        } else {
            songsControls.style.display = 'none';
            mediaControls.style.display = '';
            if (titleEl) titleEl.textContent = content === 'movies' ? 'Top Películas' : 'Top Series';
        }
        reorder();
    }

    document.getElementById('btn-content-songs')?.addEventListener('click',  () => switchContent('songs'));
    document.getElementById('btn-content-movies')?.addEventListener('click', () => switchContent('movies'));
    document.getElementById('btn-content-series')?.addEventListener('click', () => switchContent('series'));

    // Buscador de películas/series
    document.getElementById('top-media-filter')?.addEventListener('input', (e) => {
        renderMediaRanking(fullMediaRanking, e.target.value, currentContent);
    });
}

initTop();
// top.js - Lógica del Top 100

let currentContent    = 'songs';        // 'songs' | 'movies' | 'series' | 'artists'
let currentMode       = 'best';         // 'best' | 'worst'
let currentTiebreaker = 'album-rating'; // 'album-rating' | 'alphabetical' | 'added'
let mediaTiebreaker   = 'alphabetical'; // tiebreaker for movies/series
let tiebreakerDir     = 'asc';
let fullRanking       = [];
let fullMediaRanking  = [];
let fullArtistsRanking = [];
let snapshotMap       = null;

// ── SNAPSHOT DIARIO ────────────────────────────────────────────────────────
// SNAP_A = snapshot del día actual (se guarda una vez al día)
// SNAP_B = snapshot del día anterior (usado para calcular movimiento)
const SNAP_A      = 'bitrevs_snap_a';
const SNAP_A_DATE = 'bitrevs_snap_a_date';
const SNAP_B      = 'bitrevs_snap_b';

function getTodayStr() {
    return new Date().toISOString().slice(0, 10);
}

// Inicializa snapshots y devuelve el mapa del día anterior (para comparar)
function initSnapshots() {
    const today     = getTodayStr();
    const savedDate = localStorage.getItem(SNAP_A_DATE) || '';

    if (savedDate !== today) {
        // Nuevo día: rotar A → B, limpiar A
        const currentA = localStorage.getItem(SNAP_A);
        if (currentA) localStorage.setItem(SNAP_B, currentA);
        localStorage.removeItem(SNAP_A);
        localStorage.setItem(SNAP_A_DATE, today);
    }

    // Devolver mapa de SNAP_B (ayer) para comparar movimientos
    try {
        const raw = localStorage.getItem(SNAP_B);
        if (!raw) return null;
        const data = JSON.parse(raw);
        const map  = {};
        data.forEach(e => { map[e.uid] = e.rank; });
        return map;
    } catch { return null; }
}

// Guardar snapshot del día actual (solo una vez)
function saveSnapshotIfEmpty(rankedTracks) {
    try {
        if (localStorage.getItem(SNAP_A)) return;
        const snapshot = rankedTracks.map((t, i) => ({ uid: t._uid, rank: i + 1 }));
        localStorage.setItem(SNAP_A, JSON.stringify(snapshot));
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
async function buildMediaRanking(storeType, mode, tiebreaker = 'alphabetical') {
    const items = await getAllItemsFromDB(storeType);
    const rated = items.filter(i => parseFloat(i.rating) > 0);
    rated.sort((a, b) => {
        const diff = mode === 'best'
            ? parseFloat(b.rating) - parseFloat(a.rating)
            : parseFloat(a.rating) - parseFloat(b.rating);
        if (diff !== 0) return diff;
        if (tiebreaker === 'year-desc') return (parseInt(b.year) || 0) - (parseInt(a.year) || 0);
        if (tiebreaker === 'year-asc')  return (parseInt(a.year) || 0) - (parseInt(b.year) || 0);
        if (tiebreaker === 'added')     return (a.id || 0) - (b.id || 0);
        return (a.title || '').localeCompare(b.title || '');
    });
    return rated.slice(0, 100);
}

// ── RANKING DE ARTISTAS ───────────────────────────────────────────────────
async function buildArtistsRanking(mode) {
    const albums = await getAllAlbumsFromDB();
    const artistStats = {};

    albums.forEach(album => {
        if (!album.tracks || !album.artist) return;
        album.tracks.forEach(track => {
            if (track.isInterlude) return;
            const r = parseFloat(track.rating);
            if (isNaN(r) || r <= 0) return;
            if (!artistStats[album.artist]) artistStats[album.artist] = { total: 0, count: 0, albumCount: 0 };
            artistStats[album.artist].total += r;
            artistStats[album.artist].count++;
        });
        if (!artistStats[album.artist]) artistStats[album.artist] = { total: 0, count: 0, albumCount: 0 };
        artistStats[album.artist].albumCount++;
    });

    return Object.entries(artistStats)
        .filter(([, s]) => s.count >= 3)
        .map(([name, s]) => ({ name, avg: s.total / s.count, count: s.count, albumCount: s.albumCount }))
        .sort((a, b) => mode === 'best' ? b.avg - a.avg : a.avg - b.avg)
        .slice(0, 100);
}

function renderArtistsRanking(artists) {
    const list     = document.getElementById('top-list');
    const subtitle = document.getElementById('top-subtitle');
    list.innerHTML = '';

    if (artists.length === 0) {
        subtitle.textContent = 'No hay artistas con suficientes canciones puntuadas.';
        list.innerHTML = `<div class="top-empty"><p>Puntúa al menos 3 canciones de un artista para que aparezca.</p></div>`;
        return;
    }

    const modeLabel = currentMode === 'best' ? 'mejores' : 'peores';
    subtitle.textContent = `Top ${artists.length} artistas ${modeLabel} valorados`;

    artists.forEach((artist, idx) => {
        const rank        = idx + 1;
        const badgeColor  = getColorByRating(artist.avg);
        const displayRating = formatRating(artist.avg);

        const row = document.createElement('div');
        row.className = 'top-row';
        row.addEventListener('click', () => {
            window.location.href = `artist.html?name=${encodeURIComponent(artist.name)}`;
        });
        row.innerHTML = `
            <span class="top-rank">${rank}</span>
            <span class="top-arrow"></span>
            <div class="top-info">
                <div class="top-track-title">${artist.name}</div>
                <div class="top-track-meta">${artist.albumCount} álbum${artist.albumCount !== 1 ? 'es' : ''} · ${artist.count} canciones puntuadas</div>
            </div>
            <span class="top-badge" style="background-color:${badgeColor};">${displayRating}</span>
        `;
        list.appendChild(row);
    });
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
    if (currentContent === 'artists') {
        fullArtistsRanking = await buildArtistsRanking(currentMode);
        renderArtistsRanking(fullArtistsRanking);
        return;
    }
    if (currentContent !== 'songs') {
        const mediaFilter = document.getElementById('top-media-filter');
        fullMediaRanking = await buildMediaRanking(currentContent, currentMode, mediaTiebreaker);
        renderMediaRanking(fullMediaRanking, mediaFilter?.value || '', currentContent);
        return;
    }
    const filterInput = document.getElementById('top-filter');
    fullRanking = await buildRanking(currentMode, currentTiebreaker, tiebreakerDir);
    renderRanking(fullRanking, filterInput?.value || '');
}

// ── INIT ──────────────────────────────────────────────────────────────────
async function initTop() {
    // Snapshot diario: rotar si es un nuevo día, devolver mapa de ayer
    snapshotMap = initSnapshots();

    // Construir ranking inicial de canciones
    fullRanking = await buildRanking(currentMode, currentTiebreaker, tiebreakerDir);

    // Guardar snapshot del día actual (solo una vez)
    saveSnapshotIfEmpty(fullRanking);

    updateDirButton();
    renderRanking(fullRanking, '');

    const filterInput = document.getElementById('top-filter');

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

    // Criterio de desempate (canciones)
    document.getElementById('top-tiebreaker')?.addEventListener('change', async (e) => {
        currentTiebreaker = e.target.value;
        updateDirButton();
        await reorder();
    });

    document.getElementById('btn-tiebreaker-dir')?.addEventListener('click', async () => {
        tiebreakerDir = tiebreakerDir === 'asc' ? 'desc' : 'asc';
        updateDirButton();
        await reorder();
    });

    // Criterio de desempate (películas/series)
    const savedMediaTiebreaker = localStorage.getItem('bitrevs_media_tiebreaker');
    if (savedMediaTiebreaker) {
        mediaTiebreaker = savedMediaTiebreaker;
        const sel = document.getElementById('top-media-tiebreaker');
        if (sel) sel.value = savedMediaTiebreaker;
    }

    document.getElementById('top-media-tiebreaker')?.addEventListener('change', async (e) => {
        mediaTiebreaker = e.target.value;
        localStorage.setItem('bitrevs_media_tiebreaker', mediaTiebreaker);
        await reorder();
    });

    // ── TABS DE CONTENIDO ────────────────────────────────────────────────
    function switchContent(content) {
        currentContent = content;
        const songsControls = document.getElementById('songs-controls');
        const mediaControls = document.getElementById('media-controls');
        const mediaFilter   = document.getElementById('top-media-filter');
        const titleEl       = document.getElementById('top-title');

        ['songs', 'movies', 'series', 'artists'].forEach(c => {
            document.getElementById(`btn-content-${c}`)?.classList.toggle('active', c === content);
        });

        if (content === 'songs') {
            songsControls.style.display = '';
            mediaControls.style.display = 'none';
            if (titleEl) titleEl.textContent = 'Top Canciones';
            if (mediaFilter) mediaFilter.value = '';
        } else if (content === 'artists') {
            songsControls.style.display = 'none';
            mediaControls.style.display = 'none';
            if (titleEl) titleEl.textContent = 'Top Artistas';
        } else {
            songsControls.style.display = 'none';
            mediaControls.style.display = '';
            if (titleEl) titleEl.textContent = content === 'movies' ? 'Top Películas' : 'Top Series';
        }
        reorder();
    }

    document.getElementById('btn-content-songs')?.addEventListener('click',   () => switchContent('songs'));
    document.getElementById('btn-content-movies')?.addEventListener('click',  () => switchContent('movies'));
    document.getElementById('btn-content-series')?.addEventListener('click',  () => switchContent('series'));
    document.getElementById('btn-content-artists')?.addEventListener('click', () => switchContent('artists'));

    // Buscador de películas/series
    document.getElementById('top-media-filter')?.addEventListener('input', (e) => {
        renderMediaRanking(fullMediaRanking, e.target.value, currentContent);
    });
}

initTop();
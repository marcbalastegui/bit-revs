// top.js - Lógica del Top 100 Canciones

const SNAPSHOT_KEY = 'bitrevs_top_snapshot'; // clave en localStorage

// ── UTILIDAD: lee el snapshot anterior (puede no existir) ──────────────────
function loadSnapshot() {
    try {
        const raw = localStorage.getItem(SNAPSHOT_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

// ── UTILIDAD: guarda el ranking actual como snapshot ──────────────────────
function saveSnapshot(rankedTracks) {
    // Guardamos solo el id único de cada canción y su posición
    const snapshot = rankedTracks.map((t, i) => ({
        uid: t._uid,
        rank: i + 1
    }));
    try {
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
    } catch {
        // si localStorage está lleno no rompemos nada
    }
}

// ── CONSTRUYE UN UID ESTABLE POR CANCIÓN ──────────────────────────────────
// Usamos albumId + título de la canción (en minúsculas) para identificar
// de forma única cada canción entre sesiones.
function buildUid(albumId, trackTitle) {
    return `${albumId}__${trackTitle.toLowerCase().trim()}`;
}

// ── EXTRAE Y ORDENA TODAS LAS CANCIONES PUNTUADAS ────────────────────────
async function buildRanking() {
    const albums = await getAllAlbumsFromDB();
    const allTracks = [];

    albums.forEach(album => {
        if (!album.tracks) return;
        album.tracks.forEach(track => {
            // Ignoramos interludes y canciones sin nota válida
            if (track.isInterlude) return;
            const r = parseFloat(track.rating);
            if (isNaN(r) || r <= 0) return;

            allTracks.push({
                _uid:        buildUid(album.id, track.title),
                title:       track.title,
                // Si la canción tiene artista invitado, lo mostramos; si no, usamos el del álbum
                artist:      track.artist && track.artist.trim() !== ''
                                 ? `${album.artist} ft. ${track.artist}`
                                 : album.artist,
                albumTitle:  album.title,
                albumYear:   album.year,
                cover:       album.coverBase64,
                albumId:     album.id,
                rating:      r
            });
        });
    });

    // Ordenar: mayor nota primero; empate → orden alfabético de título
    allTracks.sort((a, b) => {
        if (b.rating !== a.rating) return b.rating - a.rating;
        return a.title.localeCompare(b.title);
    });

    // Máximo top 100
    return allTracks.slice(0, 100);
}

// ── CALCULA EL MOVIMIENTO DE CADA CANCIÓN ─────────────────────────────────
// Devuelve 'up', 'down', 'new' o null (sin cambio)
function calcMovement(uid, currentRank, snapshotMap) {
    if (!snapshotMap) return null; // primera carga, no hay referencia
    if (!(uid in snapshotMap)) return 'new'; // canción nueva en el top

    const prev = snapshotMap[uid];
    if (currentRank < prev) return 'up';
    if (currentRank > prev) return 'down';
    return null; // misma posición
}

// ── RENDERIZA EL RANKING ──────────────────────────────────────────────────
function renderRanking(tracks, snapshotMap, filterQuery) {
    const list      = document.getElementById('top-list');
    const subtitle  = document.getElementById('top-subtitle');
    list.innerHTML  = '';

    // Aplicar filtro por artista o álbum
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

    // El subtítulo refleja si hay filtro activo
    const totalSinFiltro = tracks.length;
    if (filterQuery && filterQuery.trim() !== '') {
        subtitle.textContent = `Mostrando ${filtered.length} canción${filtered.length !== 1 ? 'es' : ''} filtradas de ${totalSinFiltro} en el ranking.`;
    } else {
        subtitle.textContent = `Top ${totalSinFiltro} canción${totalSinFiltro !== 1 ? 'es' : ''} mejor puntuadas.`;
    }

    // Al filtrar, mantenemos el número de posición REAL del ranking global
    // (no renumeramos del 1 al filtrar)
    filtered.forEach((track) => {
        // Posición real en el ranking global (tracks sin filtrar, ordenados)
        const realRank = tracks.indexOf(track) + 1;
        const movement = calcMovement(track._uid, realRank, snapshotMap);

        // HTML de la flecha
        let arrowHtml = '<span class="top-arrow"></span>';
        if (movement === 'up')   arrowHtml = '<span class="top-arrow up">▲</span>';
        if (movement === 'down') arrowHtml = '<span class="top-arrow down">▼</span>';
        if (movement === 'new')  arrowHtml = '<span class="top-arrow new">NEW</span>';

        const badgeColor = typeof getColorByRating === 'function'
            ? getColorByRating(track.rating)
            : '#666';

        const displayRating = typeof formatRating === 'function'
            ? formatRating(track.rating)
            : track.rating;

        const row = document.createElement('div');
        row.className = 'top-row';
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

// ── INIT ──────────────────────────────────────────────────────────────────
async function initTop() {
    const rankedTracks = await buildRanking();

    // Cargamos snapshot ANTES de guardar el nuevo
    const prevSnapshot = loadSnapshot();
    let snapshotMap = null;
    if (prevSnapshot) {
        // Convertimos array [{uid, rank}] → objeto {uid: rank}
        snapshotMap = {};
        prevSnapshot.forEach(entry => { snapshotMap[entry.uid] = entry.rank; });
    }

    // Guardamos el ranking actual como nuevo snapshot
    // (la próxima vez que se cargue, éste será la referencia)
    saveSnapshot(rankedTracks);

    // Renderizado inicial sin filtro
    renderRanking(rankedTracks, snapshotMap, '');

    // Buscador en tiempo real
    const filterInput = document.getElementById('top-filter');
    if (filterInput) {
        filterInput.addEventListener('input', () => {
            renderRanking(rankedTracks, snapshotMap, filterInput.value);
        });
    }
}

initTop();

// compare-artists.js - Comparativa entre dos artistas

let allAlbums = [];
let artistA   = null;
let artistB   = null;

async function initCompareArtists() {
    allAlbums = await getAllAlbumsFromDB();

    const params = new URLSearchParams(window.location.search);
    const preA   = params.get('a');
    const preB   = params.get('b');

    initSearchSide('a', preA);
    initSearchSide('b', preB);

    if (preA) selectArtist('a', preA);
    if (preB) selectArtist('b', preB);
}

// ── BÚSQUEDA ──────────────────────────────────────────────────────────────
function getArtistNames() {
    const names = new Set();
    allAlbums.forEach(a => {
        if (a.artist) names.add(a.artist);
        if (a.featuredArtists) a.featuredArtists.forEach(f => names.add(f));
    });
    return [...names].sort();
}

function initSearchSide(side, preValue) {
    const input    = document.getElementById(`artist-search-${side}`);
    const dropdown = document.getElementById(`artist-dropdown-${side}`);

    input.addEventListener('input',  () => renderArtistDropdown(side, input.value.toLowerCase().trim()));
    input.addEventListener('focus',  () => renderArtistDropdown(side, input.value.toLowerCase().trim()));
    document.addEventListener('click', (e) => {
        if (!document.getElementById(`artist-selector-${side}`).contains(e.target)) dropdown.classList.remove('open');
    });

    if (preValue) { input.value = preValue; }
}

function renderArtistDropdown(side, query) {
    const dropdown  = document.getElementById(`artist-dropdown-${side}`);
    const otherName = side === 'a' ? artistB : artistA;
    const names     = getArtistNames().filter(n => {
        if (otherName && n.toLowerCase() === otherName.toLowerCase()) return false;
        return !query || n.toLowerCase().includes(query);
    });

    if (names.length === 0) {
        dropdown.innerHTML = `<div class="dropdown-empty">No hay resultados</div>`;
        dropdown.classList.add('open');
        return;
    }

    dropdown.innerHTML = names.slice(0, 20).map(name => {
        const artistAlbums = allAlbums.filter(a => a.artist && a.artist.toLowerCase() === name.toLowerCase());
        const cover = artistAlbums.length > 0 ? (artistAlbums[0].coverBase64 || '') : '';
        const count = artistAlbums.length;
        return `
            <div class="dropdown-item" data-name="${name}">
                <img src="${cover}" alt="${name}" onerror="this.style.display='none'" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;">
                <div class="dropdown-item-info">
                    <div class="dropdown-item-title">${name}</div>
                    <div class="dropdown-item-meta">${count} álbum${count !== 1 ? 'es' : ''}</div>
                </div>
            </div>`;
    }).join('');

    dropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            selectArtist(side, item.dataset.name);
            dropdown.classList.remove('open');
        });
    });
    dropdown.classList.add('open');
}

function selectArtist(side, name) {
    const input = document.getElementById(`artist-search-${side}`);
    input.value = name;
    if (side === 'a') artistA = name;
    else              artistB = name;
    document.getElementById(`artist-dropdown-${side}`).classList.remove('open');
    tryRenderComparison();
}

// ── RENDER ────────────────────────────────────────────────────────────────
function tryRenderComparison() {
    if (!artistA || !artistB) return;
    if (artistA.toLowerCase() === artistB.toLowerCase()) {
        document.getElementById('compare-artists-results').innerHTML = `<div class="compare-empty"><p>Selecciona dos artistas distintos.</p></div>`;
        return;
    }
    renderArtistComparison(artistA, artistB);
}

function getArtistStats(name) {
    const ownAlbums  = allAlbums.filter(a => a.artist && a.artist.toLowerCase() === name.toLowerCase());
    const ratedAlbums = ownAlbums.filter(a => parseFloat(a.rating) > 0);
    const avgAlbum    = ratedAlbums.length > 0
        ? ratedAlbums.reduce((s, a) => s + parseFloat(a.rating), 0) / ratedAlbums.length
        : 0;

    const bestAlbum = [...ratedAlbums].sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating))[0] || null;

    const allTracks = [];
    ownAlbums.forEach(album => {
        (album.tracks || []).forEach(t => {
            if (!t.isInterlude && parseFloat(t.rating) > 0) {
                allTracks.push({ ...t, albumTitle: album.title, albumCover: album.coverBase64 });
            }
        });
    });

    const avgTrack = allTracks.length > 0
        ? allTracks.reduce((s, t) => s + parseFloat(t.rating), 0) / allTracks.length
        : 0;
    const bestTrack = [...allTracks].sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating))[0] || null;
    const perfects  = allTracks.filter(t => parseFloat(t.rating) === 10).length;
    const genres    = new Set();
    ownAlbums.forEach(a => { if (a.genres) a.genres.forEach(g => genres.add(g)); });

    // Artista en colaboraciones (featured en otros álbumes)
    let featCount = 0;
    allAlbums.forEach(album => {
        if (album.artist && album.artist.toLowerCase() === name.toLowerCase()) return;
        (album.tracks || []).forEach(t => {
            if (t.artist) {
                const guests = t.artist.split(',').map(x => x.trim());
                if (guests.some(g => g.toLowerCase() === name.toLowerCase())) featCount++;
            }
        });
    });

    return { ownAlbums, ratedAlbums, avgAlbum, bestAlbum, allTracks, avgTrack, bestTrack, perfects, genres, featCount };
}

function renderArtistComparison(nameA, nameB) {
    const sA = getArtistStats(nameA);
    const sB = getArtistStats(nameB);
    const results = document.getElementById('compare-artists-results');

    let html = '';

    // Cabecera con nombre
    html += `<div class="compare-grid">
        ${artistHeaderHtml(nameA, sA)}
        ${artistHeaderHtml(nameB, sB)}
    </div>`;

    // Álbumes
    html += sectionTitle('Álbumes');
    html += `<div class="compare-row">
        ${statCell('Álbumes en total', sA.ownAlbums.length, sA.ownAlbums.length > sB.ownAlbums.length)}
        ${statCell('Álbumes en total', sB.ownAlbums.length, sB.ownAlbums.length > sA.ownAlbums.length)}
    </div>`;
    html += `<div class="compare-row" style="margin-top:12px;">
        ${statCell('Nota media álbumes', formatRating(sA.avgAlbum), parseFloat(sA.avgAlbum) > parseFloat(sB.avgAlbum))}
        ${statCell('Nota media álbumes', formatRating(sB.avgAlbum), parseFloat(sB.avgAlbum) > parseFloat(sA.avgAlbum))}
    </div>`;
    html += `<div class="compare-row" style="margin-top:12px;">
        ${bestAlbumCell(sA.bestAlbum, sB.bestAlbum)}
        ${bestAlbumCell(sB.bestAlbum, sA.bestAlbum)}
    </div>`;

    // Canciones
    html += sectionTitle('Canciones');
    html += `<div class="compare-row">
        ${statCell('Canciones puntuadas', sA.allTracks.length, sA.allTracks.length > sB.allTracks.length)}
        ${statCell('Canciones puntuadas', sB.allTracks.length, sB.allTracks.length > sA.allTracks.length)}
    </div>`;
    html += `<div class="compare-row" style="margin-top:12px;">
        ${statCell('Nota media canciones', formatRating(sA.avgTrack), parseFloat(sA.avgTrack) > parseFloat(sB.avgTrack))}
        ${statCell('Nota media canciones', formatRating(sB.avgTrack), parseFloat(sB.avgTrack) > parseFloat(sA.avgTrack))}
    </div>`;
    html += `<div class="compare-row" style="margin-top:12px;">
        ${statCell('Canciones perfectas (10)', sA.perfects, sA.perfects > sB.perfects)}
        ${statCell('Canciones perfectas (10)', sB.perfects, sB.perfects > sA.perfects)}
    </div>`;
    html += `<div class="compare-row" style="margin-top:12px;">
        ${bestTrackCell(sA.bestTrack, sB.bestTrack)}
        ${bestTrackCell(sB.bestTrack, sA.bestTrack)}
    </div>`;

    // Colaboraciones
    html += sectionTitle('Colaboraciones');
    html += `<div class="compare-row">
        ${statCell('Aparece como feat. en', sA.featCount, sA.featCount > sB.featCount)}
        ${statCell('Aparece como feat. en', sB.featCount, sB.featCount > sA.featCount)}
    </div>`;

    // Géneros
    const sharedGenres = [...sA.genres].filter(g => sB.genres.has(g));
    if (sA.genres.size > 0 || sB.genres.size > 0) {
        html += sectionTitle(`Géneros${sharedGenres.length > 0 ? ` · ${sharedGenres.length} en común` : ''}`);
        html += `<div class="compare-row">
            ${genreCellHtml([...sA.genres], sharedGenres)}
            ${genreCellHtml([...sB.genres], sharedGenres)}
        </div>`;
    }

    results.innerHTML = html;
}

// ── HELPERS ───────────────────────────────────────────────────────────────
function artistHeaderHtml(name, stats) {
    const cover = stats.bestAlbum?.coverBase64 || '';
    return `
        <div class="compare-album-header">
            <img class="compare-cover" src="${cover}" alt="${name}" onerror="this.style.visibility='hidden'" loading="lazy">
            <div class="compare-album-info">
                <div class="compare-album-title">${name}</div>
                <div class="compare-album-meta">${stats.ownAlbums.length} álbum${stats.ownAlbums.length !== 1 ? 'es' : ''} · ${stats.allTracks.length} canciones</div>
                ${stats.avgAlbum > 0 ? `<span class="compare-rating-badge" style="background:${getColorByRating(stats.avgAlbum)}">${formatRating(stats.avgAlbum)}</span>` : ''}
            </div>
        </div>`;
}

function sectionTitle(text) {
    return `<div class="compare-section-title">${text}</div>`;
}

function statCell(label, value, isWinner) {
    return `
        <div class="compare-cell${isWinner ? ' winner' : ''}">
            ${isWinner ? `<span class="compare-winner-badge">▲ Mejor</span>` : ''}
            <div class="compare-stat-label">${label}</div>
            <div class="compare-stat-value accent">${value ?? '–'}</div>
        </div>`;
}

function bestAlbumCell(album, other) {
    const isWinner = album && other ? parseFloat(album.rating) > parseFloat(other.rating) : !!album;
    if (!album) return `<div class="compare-cell"><div class="compare-stat-label">Mejor álbum</div><div style="color:var(--text-muted);">Sin álbumes</div></div>`;
    const color = getColorByRating(album.rating);
    return `
        <div class="compare-cell${isWinner ? ' winner' : ''}">
            ${isWinner ? `<span class="compare-winner-badge">▲ Mejor</span>` : ''}
            <div class="compare-stat-label">Mejor álbum</div>
            <div class="compare-track-item" style="gap:10px;">
                <img src="${album.coverBase64 || ''}" alt="${album.title}" onerror="this.style.display='none'" loading="lazy"
                    style="width:40px;height:40px;border-radius:6px;object-fit:cover;flex-shrink:0;">
                <div class="compare-track-info">
                    <div class="compare-track-title">${album.title}</div>
                    <div style="font-size:0.78rem;color:var(--text-muted);">${album.year || ''}</div>
                </div>
                <span class="compare-track-badge" style="background:${color}">${formatRating(album.rating)}</span>
            </div>
        </div>`;
}

function bestTrackCell(track, other) {
    const isWinner = track && other ? parseFloat(track.rating) > parseFloat(other.rating) : !!track;
    if (!track) return `<div class="compare-cell"><div class="compare-stat-label">Mejor canción</div><div style="color:var(--text-muted);">Sin canciones</div></div>`;
    const color = getColorByRating(track.rating);
    return `
        <div class="compare-cell${isWinner ? ' winner' : ''}">
            ${isWinner ? `<span class="compare-winner-badge">▲ Mejor</span>` : ''}
            <div class="compare-stat-label">Mejor canción</div>
            <div class="compare-track-item">
                <div class="compare-track-info">
                    <div class="compare-track-title">${track.title}</div>
                    <div style="font-size:0.78rem;color:var(--text-muted);">${track.albumTitle || ''}</div>
                </div>
                <span class="compare-track-badge" style="background:${color}">${formatRating(parseFloat(track.rating))}</span>
            </div>
        </div>`;
}

function genreCellHtml(genres, shared) {
    if (genres.length === 0) return `<div class="compare-cell"><div class="compare-stat-label">Géneros</div><div style="color:var(--text-muted);">Sin géneros</div></div>`;
    return `
        <div class="compare-cell">
            <div class="compare-stat-label">Géneros</div>
            <div class="compare-genres">
                ${genres.map(g => `<span class="compare-genre-tag${shared.includes(g) ? ' shared' : ''}">${g}</span>`).join('')}
            </div>
        </div>`;
}

initCompareArtists();

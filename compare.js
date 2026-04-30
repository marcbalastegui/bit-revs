// compare.js - Lógica de comparación de álbumes

let allAlbums = [];

// ── INIT ──────────────────────────────────────────────────────────────────
async function initCompare() {
    allAlbums = await getAllAlbumsFromDB();

    // Ordenar alfabéticamente para los selects
    const sorted = [...allAlbums].sort((a, b) => (a.title || "").localeCompare(b.title || ""));

    populateSelect('select-album-a', sorted);
    populateSelect('select-album-b', sorted);

    document.getElementById('select-album-a').addEventListener('change', onSelectionChange);
    document.getElementById('select-album-b').addEventListener('change', onSelectionChange);
}

function populateSelect(selectId, albums) {
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">Selecciona un álbum…</option>';
    albums.forEach(album => {
        const opt = document.createElement('option');
        opt.value = album.id;
        opt.textContent = `${album.title} — ${album.artist}`;
        select.appendChild(opt);
    });
}

function onSelectionChange() {
    const idA = document.getElementById('select-album-a').value;
    const idB = document.getElementById('select-album-b').value;

    // Actualizar previews
    updatePreview('a', idA);
    updatePreview('b', idB);

    // Renderizar comparativa si ambos están seleccionados
    if (idA && idB) {
        if (idA === idB) {
            document.getElementById('compare-results').innerHTML = `
                <div class="compare-empty">
                    <p>Selecciona dos álbumes distintos para compararlos.</p>
                </div>`;
            return;
        }
        const albumA = allAlbums.find(a => a.id == idA);
        const albumB = allAlbums.find(a => a.id == idB);
        renderComparison(albumA, albumB);
    } else {
        document.getElementById('compare-results').innerHTML = `
            <div class="compare-empty">
                <p style="font-size:1.5rem;">🎵</p>
                <p>Selecciona dos álbumes para compararlos</p>
            </div>`;
    }
}

function updatePreview(side, id) {
    const preview = document.getElementById(`preview-${side}`);
    const cover   = document.getElementById(`preview-${side}-cover`);
    const title   = document.getElementById(`preview-${side}-title`);
    const meta    = document.getElementById(`preview-${side}-meta`);

    if (!id) {
        preview.classList.remove('visible');
        return;
    }

    const album = allAlbums.find(a => a.id == id);
    if (!album) return;

    cover.src = album.coverBase64;
    title.textContent = album.title;

    let artistDisplay = album.artist;
    if (album.featuredArtists && album.featuredArtists.length > 0) {
        artistDisplay += ' ft. ' + album.featuredArtists.join(', ');
    }
    meta.textContent = `${artistDisplay} · ${album.year}`;
    preview.classList.add('visible');
}

// ── RENDER COMPARATIVA ────────────────────────────────────────────────────
function renderComparison(a, b) {
    const ratingA = parseFloat(a.rating) || 0;
    const ratingB = parseFloat(b.rating) || 0;

    const tracksA = (a.tracks || []).filter(t => !t.isInterlude && parseFloat(t.rating) > 0);
    const tracksB = (b.tracks || []).filter(t => !t.isInterlude && parseFloat(t.rating) > 0);

    const avgA = tracksA.length > 0
        ? tracksA.reduce((s, t) => s + parseFloat(t.rating), 0) / tracksA.length
        : 0;
    const avgB = tracksB.length > 0
        ? tracksB.reduce((s, t) => s + parseFloat(t.rating), 0) / tracksB.length
        : 0;

    // Mejor y peor canción
    const bestA = [...tracksA].sort((x, y) => parseFloat(y.rating) - parseFloat(x.rating))[0];
    const bestB = [...tracksB].sort((x, y) => parseFloat(y.rating) - parseFloat(x.rating))[0];
    const worstA = [...tracksA].sort((x, y) => parseFloat(x.rating) - parseFloat(y.rating))[0];
    const worstB = [...tracksB].sort((x, y) => parseFloat(x.rating) - parseFloat(y.rating))[0];

    // Géneros compartidos
    const genresA = new Set(a.genres || []);
    const genresB = new Set(b.genres || []);
    const sharedGenres = [...genresA].filter(g => genresB.has(g));

    let html = '';

    // ── HEADERS ──────────────────────────────────────────────────────────
    html += `<div class="compare-grid">`;
    html += albumHeader(a);
    html += albumHeader(b);
    html += `</div>`;

    // ── NOTAS ────────────────────────────────────────────────────────────
    html += sectionTitle('Notas');
    html += `<div class="compare-row">`;
    html += statCell(
        'Nota del álbum',
        formatRating(ratingA),
        ratingA > ratingB ? 'winner' : ratingA === ratingB ? '' : ''
    );
    html += statCell(
        'Nota del álbum',
        formatRating(ratingB),
        ratingB > ratingA ? 'winner' : ''
    );
    html += `</div>`;

    html += `<div class="compare-row" style="margin-top:12px;">`;
    html += statCell(
        'Media de canciones',
        formatRating(avgA),
        avgA > avgB ? 'winner' : ''
    );
    html += statCell(
        'Media de canciones',
        formatRating(avgB),
        avgB > avgA ? 'winner' : ''
    );
    html += `</div>`;

    // ── CANCIONES ────────────────────────────────────────────────────────
    html += sectionTitle('Canciones');
    html += `<div class="compare-row">`;
    html += statCell(
        'Total canciones puntuadas',
        tracksA.length,
        tracksA.length > tracksB.length ? 'winner' : ''
    );
    html += statCell(
        'Total canciones puntuadas',
        tracksB.length,
        tracksB.length > tracksA.length ? 'winner' : ''
    );
    html += `</div>`;

    // Mejor canción
    if (bestA || bestB) {
        html += `<div class="compare-row" style="margin-top:12px;">`;
        html += trackHighlightCell('Mejor canción', bestA, bestB, true);
        html += trackHighlightCell('Mejor canción', bestB, bestA, true);
        html += `</div>`;
    }

    // Peor canción
    if (worstA || worstB) {
        html += `<div class="compare-row" style="margin-top:12px;">`;
        html += trackHighlightCell('Peor canción', worstA, worstB, false);
        html += trackHighlightCell('Peor canción', worstB, worstA, false);
        html += `</div>`;
    }

    // ── AÑO Y ARTISTA ─────────────────────────────────────────────────────
    html += sectionTitle('Info');
    html += `<div class="compare-row">`;
    html += infoCell('Año', a.year, b.year);
    html += infoCell('Año', b.year, a.year);
    html += `</div>`;

    html += `<div class="compare-row" style="margin-top:12px;">`;
    html += artistCell(a);
    html += artistCell(b);
    html += `</div>`;

    // ── GÉNEROS ──────────────────────────────────────────────────────────
    if (genresA.size > 0 || genresB.size > 0) {
        html += sectionTitle(`Géneros${sharedGenres.length > 0 ? ` · ${sharedGenres.length} en común` : ''}`);
        html += `<div class="compare-row">`;
        html += genreCell([...genresA], sharedGenres);
        html += genreCell([...genresB], sharedGenres);
        html += `</div>`;
    }

    document.getElementById('compare-results').innerHTML = html;
}

// ── HELPERS DE RENDER ─────────────────────────────────────────────────────

function albumHeader(album) {
    const badgeColor = getColorByRating(album.rating);
    let artistDisplay = album.artist || '';
    if (album.featuredArtists && album.featuredArtists.length > 0) {
        artistDisplay += ' ft. ' + album.featuredArtists.join(', ');
    }
    return `
        <div class="compare-album-header">
            <img class="compare-cover" src="${album.coverBase64}" alt="${album.title}">
            <div class="compare-album-info">
                <div class="compare-album-title">${album.title}</div>
                <div class="compare-album-meta">${artistDisplay} · ${album.year}</div>
                <span class="compare-rating-badge" style="background:${badgeColor}">${formatRating(album.rating)}</span>
            </div>
        </div>`;
}

function sectionTitle(text) {
    return `
        <div class="compare-section">
            <div class="compare-section-title">${text}</div>
        </div>`;
}

function statCell(label, value, winnerClass = '') {
    return `
        <div class="compare-cell ${winnerClass}">
            <div class="compare-stat-label">${label}</div>
            <div class="compare-stat-value accent">${value}</div>
        </div>`;
}

function infoCell(label, value, other) {
    const isWinner = value > other ? 'winner' : '';
    return `
        <div class="compare-cell ${isWinner}">
            <div class="compare-stat-label">${label}</div>
            <div class="compare-stat-value">${value || '—'}</div>
        </div>`;
}

function artistCell(album) {
    let artistDisplay = album.artist || '—';
    if (album.featuredArtists && album.featuredArtists.length > 0) {
        artistDisplay += ' ft. ' + album.featuredArtists.join(', ');
    }
    return `
        <div class="compare-cell">
            <div class="compare-stat-label">Artista</div>
            <div class="compare-stat-value" style="font-size:1rem; letter-spacing:0;">${artistDisplay}</div>
        </div>`;
}

function trackHighlightCell(label, track, other, higherIsBetter) {
    if (!track) {
        return `<div class="compare-cell"><div class="compare-stat-label">${label}</div><div style="color:var(--text-muted); font-size:0.9rem;">Sin canciones</div></div>`;
    }

    const myRating  = parseFloat(track.rating);
    const itsRating = other ? parseFloat(other.rating) : null;
    const isWinner  = itsRating === null
        ? false
        : higherIsBetter ? myRating > itsRating : myRating < itsRating;

    const badgeColor = getColorByRating(myRating);

    return `
        <div class="compare-cell ${isWinner ? 'winner' : ''}">
            <div class="compare-stat-label">${label}</div>
            <div class="compare-track-item">
                <div class="compare-track-info">
                    <div class="compare-track-title">${track.title}</div>
                </div>
                <span class="compare-track-badge" style="background:${badgeColor}">${formatRating(myRating)}</span>
            </div>
        </div>`;
}

function genreCell(genres, sharedGenres) {
    if (genres.length === 0) {
        return `<div class="compare-cell"><div class="compare-stat-label">Géneros</div><div style="color:var(--text-muted); font-size:0.9rem;">Sin géneros</div></div>`;
    }
    const tagsHtml = genres.map(g => {
        const isShared = sharedGenres.includes(g);
        return `<span class="compare-genre-tag${isShared ? ' shared' : ''}">${g}</span>`;
    }).join('');
    return `
        <div class="compare-cell">
            <div class="compare-stat-label">Géneros</div>
            <div class="compare-genres">${tagsHtml}</div>
        </div>`;
}

initCompare();
// compare.js - Lógica de comparación de álbumes con buscador

let allAlbums = [];
let selectedA = null;
let selectedB = null;

// ── INIT ──────────────────────────────────────────────────────────────────
async function initCompare() {
    allAlbums = await getAllAlbumsFromDB();

    initSearchSide('a');
    initSearchSide('b');
}

// ── BUSCADOR POR LADO ─────────────────────────────────────────────────────
function initSearchSide(side) {
    const input    = document.getElementById(`search-${side}`);
    const dropdown = document.getElementById(`dropdown-${side}`);
    const clearBtn = document.getElementById(`clear-${side}`);

    // Mostrar dropdown al escribir
    input.addEventListener('input', () => {
        const query = input.value.toLowerCase().trim();
        renderDropdown(side, query);
    });

    // Abrir dropdown al hacer focus
    input.addEventListener('focus', () => {
        const query = input.value.toLowerCase().trim();
        renderDropdown(side, query);
    });

    // Cerrar dropdown al hacer click fuera
    document.addEventListener('click', (e) => {
        if (!document.getElementById(`selector-${side}`).contains(e.target)) {
            dropdown.classList.remove('open');
        }
    });

    // Botón de limpiar selección
    clearBtn.addEventListener('click', () => {
        clearSelection(side);
    });
}

function renderDropdown(side, query) {
    const dropdown = document.getElementById(`dropdown-${side}`);
    const otherSelected = side === 'a' ? selectedB : selectedA;

    // Filtrar álbumes
    let results = allAlbums.filter(album => {
        const matchesQuery = query === '' ||
            (album.title && album.title.toLowerCase().includes(query)) ||
            (album.artist && album.artist.toLowerCase().includes(query));
        // Excluir el álbum ya seleccionado en el otro lado
        const notOther = !otherSelected || album.id !== otherSelected.id;
        return matchesQuery && notOther;
    });

    // Ordenar alfabéticamente
    results.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

    if (results.length === 0) {
        dropdown.innerHTML = `<div class="dropdown-empty">No se encontraron álbumes</div>`;
        dropdown.classList.add('open');
        return;
    }

    dropdown.innerHTML = results.map(album => {
        const isSelected = (side === 'a' ? selectedA : selectedB)?.id === album.id;
        let artistDisplay = album.artist || '';
        if (album.featuredArtists && album.featuredArtists.length > 0) {
            artistDisplay += ' ft. ' + album.featuredArtists.join(', ');
        }
        return `
            <div class="dropdown-item${isSelected ? ' selected' : ''}" data-id="${album.id}">
                <img src="${album.coverBase64}" alt="${album.title}">
                <div class="dropdown-item-info">
                    <div class="dropdown-item-title">${album.title}</div>
                    <div class="dropdown-item-meta">${artistDisplay} · ${album.year}</div>
                </div>
            </div>`;
    }).join('');

    // Eventos de click en cada item
    dropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = parseInt(item.dataset.id);
            const album = allAlbums.find(a => a.id === id);
            selectAlbum(side, album);
        });
    });

    dropdown.classList.add('open');
}

function selectAlbum(side, album) {
    const input    = document.getElementById(`search-${side}`);
    const dropdown = document.getElementById(`dropdown-${side}`);

    if (side === 'a') selectedA = album;
    else              selectedB = album;

    // Actualizar input y cerrar dropdown
    input.value = album.title;
    dropdown.classList.remove('open');

    // Mostrar preview
    updatePreview(side, album);

    // Renderizar comparativa si ambos están seleccionados
    tryRenderComparison();
}

function clearSelection(side) {
    if (side === 'a') selectedA = null;
    else              selectedB = null;

    document.getElementById(`search-${side}`).value = '';
    document.getElementById(`preview-${side}`).classList.remove('visible');
    document.getElementById(`compare-results`).innerHTML = `
        <div class="compare-empty">
            <p style="font-size:1.5rem;">🎵</p>
            <p>Selecciona dos álbumes para compararlos</p>
        </div>`;
}

function updatePreview(side, album) {
    const preview = document.getElementById(`preview-${side}`);
    const cover   = document.getElementById(`preview-${side}-cover`);
    const title   = document.getElementById(`preview-${side}-title`);
    const meta    = document.getElementById(`preview-${side}-meta`);

    cover.src = album.coverBase64;
    title.textContent = album.title;

    let artistDisplay = album.artist;
    if (album.featuredArtists && album.featuredArtists.length > 0) {
        artistDisplay += ' ft. ' + album.featuredArtists.join(', ');
    }
    meta.textContent = `${artistDisplay} · ${album.year}`;
    preview.classList.add('visible');
}

function tryRenderComparison() {
    if (!selectedA || !selectedB) return;
    if (selectedA.id === selectedB.id) {
        document.getElementById('compare-results').innerHTML = `
            <div class="compare-empty"><p>Selecciona dos álbumes distintos para compararlos.</p></div>`;
        return;
    }
    renderComparison(selectedA, selectedB);
}

// ── HELPERS ───────────────────────────────────────────────────────────────
function maxStreak(tracks, threshold) {
    let max = 0, current = 0;
    tracks.forEach(t => {
        if (parseFloat(t.rating) >= threshold) { current++; max = Math.max(max, current); }
        else { current = 0; }
    });
    return max;
}

function stdDev(tracks) {
    if (tracks.length < 2) return 0;
    const avg = tracks.reduce((s, t) => s + parseFloat(t.rating), 0) / tracks.length;
    const variance = tracks.reduce((s, t) => s + Math.pow(parseFloat(t.rating) - avg, 2), 0) / tracks.length;
    return Math.sqrt(variance);
}

// ── RENDER COMPARATIVA ────────────────────────────────────────────────────
function renderComparison(a, b) {
    const ratingA = parseFloat(a.rating) || 0;
    const ratingB = parseFloat(b.rating) || 0;

    const tracksA = (a.tracks || []).filter(t => !t.isInterlude && parseFloat(t.rating) > 0);
    const tracksB = (b.tracks || []).filter(t => !t.isInterlude && parseFloat(t.rating) > 0);

    const bestA  = [...tracksA].sort((x, y) => parseFloat(y.rating) - parseFloat(x.rating))[0];
    const bestB  = [...tracksB].sort((x, y) => parseFloat(y.rating) - parseFloat(x.rating))[0];
    const worstA = [...tracksA].sort((x, y) => parseFloat(x.rating) - parseFloat(y.rating))[0];
    const worstB = [...tracksB].sort((x, y) => parseFloat(x.rating) - parseFloat(y.rating))[0];

    const above7A = tracksA.filter(t => parseFloat(t.rating) >= 7).length;
    const above7B = tracksB.filter(t => parseFloat(t.rating) >= 7).length;
    const pctA    = tracksA.length > 0 ? Math.round((above7A / tracksA.length) * 100) : 0;
    const pctB    = tracksB.length > 0 ? Math.round((above7B / tracksB.length) * 100) : 0;
    const devA    = stdDev(tracksA);
    const devB    = stdDev(tracksB);
    const streakA = maxStreak(tracksA, 7);
    const streakB = maxStreak(tracksB, 7);

    const genresA      = new Set(a.genres || []);
    const genresB      = new Set(b.genres || []);
    const sharedGenres = [...genresA].filter(g => genresB.has(g));

    let html = '';

    html += `<div class="compare-grid">${albumHeader(a)}${albumHeader(b)}</div>`;

    html += sectionTitle('Notas');
    html += `<div class="compare-row">
        ${statCell('Nota del álbum', formatRating(ratingA), ratingA > ratingB)}
        ${statCell('Nota del álbum', formatRating(ratingB), ratingB > ratingA)}
    </div>`;

html += sectionTitle('Canciones');
html += `<div class="compare-row">
    ${infoCell('Total canciones puntuadas', tracksA.length)}
    ${infoCell('Total canciones puntuadas', tracksB.length)}
</div>`;

    if (bestA || bestB) {
        const bestRatingA = bestA ? parseFloat(bestA.rating) : -1;
        const bestRatingB = bestB ? parseFloat(bestB.rating) : -1;
        html += `<div class="compare-row" style="margin-top:12px;">
            ${trackHighlightCell('Mejor canción', bestA, bestRatingA > bestRatingB)}
            ${trackHighlightCell('Mejor canción', bestB, bestRatingB > bestRatingA)}
        </div>`;
    }

    if (worstA || worstB) {
        const worstRatingA = worstA ? parseFloat(worstA.rating) : -1;
        const worstRatingB = worstB ? parseFloat(worstB.rating) : -1;
        html += `<div class="compare-row" style="margin-top:12px;">
            ${trackHighlightCell('Peor canción', worstA, worstRatingA > worstRatingB)}
            ${trackHighlightCell('Peor canción', worstB, worstRatingB > worstRatingA)}
        </div>`;
    }

    html += sectionTitle('Calidad');
    html += `<div class="compare-row">
        ${statCell(`Canciones ≥ 7 (${above7A} de ${tracksA.length})`, `${pctA}%`, pctA > pctB)}
        ${statCell(`Canciones ≥ 7 (${above7B} de ${tracksB.length})`, `${pctB}%`, pctB > pctA)}
    </div>`;
    html += `<div class="compare-row" style="margin-top:12px;">
        ${statCell('Consistencia (desviación)', formatRating(devA), devA < devB && devA !== devB)}
        ${statCell('Consistencia (desviación)', formatRating(devB), devB < devA && devA !== devB)}
    </div>`;
    html += `<p style="font-size:0.75rem; color:var(--text-muted); margin-top:6px; margin-bottom:12px;">▲ Mejor = menor desviación (notas más consistentes entre canciones)</p>`;
    html += `<div class="compare-row" style="margin-top:6px;">
        ${statCell('Racha máxima ≥ 7', `${streakA} canciones`, streakA > streakB)}
        ${statCell('Racha máxima ≥ 7', `${streakB} canciones`, streakB > streakA)}
    </div>`;

    html += sectionTitle('Info');
    html += `<div class="compare-row">
        ${infoCell('Año', a.year)}
        ${infoCell('Año', b.year)}
    </div>`;
    html += `<div class="compare-row" style="margin-top:12px;">
        ${artistCell(a)}
        ${artistCell(b)}
    </div>`;

    if (genresA.size > 0 || genresB.size > 0) {
        html += sectionTitle(`Géneros${sharedGenres.length > 0 ? ` · ${sharedGenres.length} en común` : ''}`);
        html += `<div class="compare-row">
            ${genreCell([...genresA], sharedGenres)}
            ${genreCell([...genresB], sharedGenres)}
        </div>`;
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
    return `<div class="compare-section-title">${text}</div>`;
}

function winnerBadgeHtml(isWinner) {
    return isWinner ? `<span class="compare-winner-badge">▲ Mejor</span>` : '';
}

function statCell(label, value, isWinner) {
    return `
        <div class="compare-cell${isWinner ? ' winner' : ''}">
            ${winnerBadgeHtml(isWinner)}
            <div class="compare-stat-label">${label}</div>
            <div class="compare-stat-value accent">${value}</div>
        </div>`;
}

function infoCell(label, value) {
    return `
        <div class="compare-cell">
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

function trackHighlightCell(label, track, isWinner) {
    if (!track) {
        return `
            <div class="compare-cell">
                <div class="compare-stat-label">${label}</div>
                <div style="color:var(--text-muted); font-size:0.9rem;">Sin canciones</div>
            </div>`;
    }
    const badgeColor = getColorByRating(parseFloat(track.rating));
    return `
        <div class="compare-cell${isWinner ? ' winner' : ''}">
            ${winnerBadgeHtml(isWinner)}
            <div class="compare-stat-label">${label}</div>
            <div class="compare-track-item">
                <div class="compare-track-info">
                    <div class="compare-track-title">${track.title}</div>
                </div>
                <span class="compare-track-badge" style="background:${badgeColor}">${formatRating(parseFloat(track.rating))}</span>
            </div>
        </div>`;
}

function genreCell(genres, sharedGenres) {
    if (genres.length === 0) {
        return `
            <div class="compare-cell">
                <div class="compare-stat-label">Géneros</div>
                <div style="color:var(--text-muted); font-size:0.9rem;">Sin géneros</div>
            </div>`;
    }
    const tagsHtml = genres.map(g =>
        `<span class="compare-genre-tag${sharedGenres.includes(g) ? ' shared' : ''}">${g}</span>`
    ).join('');
    return `
        <div class="compare-cell">
            <div class="compare-stat-label">Géneros</div>
            <div class="compare-genres">${tagsHtml}</div>
        </div>`;
}

initCompare();
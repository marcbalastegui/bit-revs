// compare.js - Lógica de comparación de álbumes

let allAlbums = [];
let selectedA = null;
let selectedB = null;

async function initCompare() {
    allAlbums = await getAllAlbumsFromDB();
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
    updatePreview('a', idA);
    updatePreview('b', idB);

    if (idA && idB) {
        if (idA === idB) {
            document.getElementById('compare-results').innerHTML = `
                <div class="compare-empty"><p>Selecciona dos álbumes distintos para compararlos.</p></div>`;
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

    if (!id) { preview.classList.remove('visible'); return; }
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

// ── HELPERS ───────────────────────────────────────────────────────────────

// Racha máxima como % del total de canciones
function maxStreakPct(tracks, threshold) {
    let max = 0, current = 0;
    tracks.forEach(t => {
        if (parseFloat(t.rating) >= threshold) { current++; max = Math.max(max, current); }
        else { current = 0; }
    });
    return tracks.length > 0 ? Math.round((max / tracks.length) * 100) : 0;
}

function stdDev(tracks) {
    if (tracks.length < 2) return 0;
    const avg = tracks.reduce((s, t) => s + parseFloat(t.rating), 0) / tracks.length;
    const variance = tracks.reduce((s, t) => s + Math.pow(parseFloat(t.rating) - avg, 2), 0) / tracks.length;
    return Math.sqrt(variance);
}

// ── RENDER ────────────────────────────────────────────────────────────────
function renderComparison(a, b) {
    const ratingA = parseFloat(a.rating) || 0;
    const ratingB = parseFloat(b.rating) || 0;

    const tracksA = (a.tracks || []).filter(t => !t.isInterlude && parseFloat(t.rating) > 0);
    const tracksB = (b.tracks || []).filter(t => !t.isInterlude && parseFloat(t.rating) > 0);

    // Mejor canción — todas las empatadas en primer lugar
    const sortedByBestA = [...tracksA].sort((x, y) => parseFloat(y.rating) - parseFloat(x.rating));
    const sortedByBestB = [...tracksB].sort((x, y) => parseFloat(y.rating) - parseFloat(x.rating));
    const bestA = sortedByBestA[0];
    const bestB = sortedByBestB[0];
    const bestTiesA = bestA ? sortedByBestA.filter(t => parseFloat(t.rating) === parseFloat(bestA.rating)) : [];
    const bestTiesB = bestB ? sortedByBestB.filter(t => parseFloat(t.rating) === parseFloat(bestB.rating)) : [];

    // Peor canción — todas las empatadas en último lugar
    const sortedByWorstA = [...tracksA].sort((x, y) => parseFloat(x.rating) - parseFloat(y.rating));
    const sortedByWorstB = [...tracksB].sort((x, y) => parseFloat(x.rating) - parseFloat(y.rating));
    const worstA = sortedByWorstA[0];
    const worstB = sortedByWorstB[0];
    const worstTiesA = worstA ? sortedByWorstA.filter(t => parseFloat(t.rating) === parseFloat(worstA.rating)) : [];
    const worstTiesB = worstB ? sortedByWorstB.filter(t => parseFloat(t.rating) === parseFloat(worstB.rating)) : [];

    // Canciones perfectas (10)
    const perfectA = tracksA.filter(t => parseFloat(t.rating) === 10).length;
    const perfectB = tracksB.filter(t => parseFloat(t.rating) === 10).length;

    const above7A  = tracksA.filter(t => parseFloat(t.rating) >= 7).length;
    const above7B  = tracksB.filter(t => parseFloat(t.rating) >= 7).length;
    const pctA     = tracksA.length > 0 ? Math.round((above7A / tracksA.length) * 100) : 0;
    const pctB     = tracksB.length > 0 ? Math.round((above7B / tracksB.length) * 100) : 0;

    const devA     = stdDev(tracksA);
    const devB     = stdDev(tracksB);

    const streakA  = maxStreakPct(tracksA, 7);
    const streakB  = maxStreakPct(tracksB, 7);

    const genresA      = new Set(a.genres || []);
    const genresB      = new Set(b.genres || []);
    const sharedGenres = [...genresA].filter(g => genresB.has(g));

    let html = '';

    // Headers
    html += `<div class="compare-grid">${albumHeader(a)}${albumHeader(b)}</div>`;

    // Notas
    html += sectionTitle('Notas');
    html += `<div class="compare-row">
        ${statCell('Nota del álbum', formatRating(ratingA), ratingA > ratingB)}
        ${statCell('Nota del álbum', formatRating(ratingB), ratingB > ratingA)}
    </div>`;

    // Canciones
    html += sectionTitle('Canciones');
    html += `<div class="compare-row">
        ${infoCell('Total canciones puntuadas', tracksA.length)}
        ${infoCell('Total canciones puntuadas', tracksB.length)}
    </div>`;

    // Canciones perfectas
    html += `<div class="compare-row" style="margin-top:12px;">
        ${statCell('Canciones perfectas (10)', perfectA, perfectA > perfectB)}
        ${statCell('Canciones perfectas (10)', perfectB, perfectB > perfectA)}
    </div>`;

    // Mejor canción con "Más" si hay empate
    html += `<div class="compare-row" style="margin-top:12px;">
        ${trackHighlightCell('Mejor canción', bestA, bestTiesA, parseFloat(bestA?.rating || -1) > parseFloat(bestB?.rating || -1))}
        ${trackHighlightCell('Mejor canción', bestB, bestTiesB, parseFloat(bestB?.rating || -1) > parseFloat(bestA?.rating || -1))}
    </div>`;

    // Peor canción con "Más" si hay empate
    html += `<div class="compare-row" style="margin-top:12px;">
        ${trackHighlightCell('Peor canción', worstA, worstTiesA, parseFloat(worstA?.rating || -1) > parseFloat(worstB?.rating || -1))}
        ${trackHighlightCell('Peor canción', worstB, worstTiesB, parseFloat(worstB?.rating || -1) > parseFloat(worstA?.rating || -1))}
    </div>`;

    // Calidad
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
        ${statCell('Racha máxima ≥ 7', `${streakA}%`, streakA > streakB)}
        ${statCell('Racha máxima ≥ 7', `${streakB}%`, streakB > streakA)}
    </div>`;

    // Info
    html += sectionTitle('Info');
    html += `<div class="compare-row">
        ${infoCell('Año', a.year)}
        ${infoCell('Año', b.year)}
    </div>`;
    html += `<div class="compare-row" style="margin-top:12px;">
        ${artistCell(a)}
        ${artistCell(b)}
    </div>`;

    // Géneros
    if (genresA.size > 0 || genresB.size > 0) {
        html += sectionTitle(`Géneros${sharedGenres.length > 0 ? ` · ${sharedGenres.length} en común` : ''}`);
        html += `<div class="compare-row">
            ${genreCell([...genresA], sharedGenres)}
            ${genreCell([...genresB], sharedGenres)}
        </div>`;
    }

    document.getElementById('compare-results').innerHTML = html;

    // Añadir eventos a los botones "Más"
    document.querySelectorAll('.compare-more-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const list = btn.nextElementSibling;
            if (list) {
                const isOpen = list.style.display === 'block';
                list.style.display = isOpen ? 'none' : 'block';
                btn.textContent = isOpen ? `+${btn.dataset.count} más` : 'Ocultar';
            }
        });
    });
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

function trackHighlightCell(label, track, allTied, isWinner) {
    if (!track) {
        return `
            <div class="compare-cell">
                <div class="compare-stat-label">${label}</div>
                <div style="color:var(--text-muted); font-size:0.9rem;">Sin canciones</div>
            </div>`;
    }

    const badgeColor = getColorByRating(parseFloat(track.rating));
    const extraTies = allTied.slice(1); // las demás empatadas (sin la primera)

    // Lista de canciones empatadas (oculta por defecto)
    const tiesListHtml = extraTies.length > 0 ? `
        <button class="compare-more-btn" data-count="${extraTies.length}" style="margin-top:8px; background:none; border:1px solid var(--border-color); border-radius:8px; padding:3px 10px; font-size:0.72rem; font-weight:700; color:var(--text-muted); cursor:pointer; font-family:'Inter',sans-serif;">+${extraTies.length} más</button>
        <div style="display:none; margin-top:6px; display:none;">
            ${extraTies.map(t => `
                <div class="compare-track-item" style="padding:6px 0;">
                    <div class="compare-track-info">
                        <div class="compare-track-title" style="font-size:0.82rem;">${t.title}</div>
                    </div>
                    <span class="compare-track-badge" style="background:${getColorByRating(parseFloat(t.rating))}; font-size:0.72rem;">${formatRating(parseFloat(t.rating))}</span>
                </div>`).join('')}
        </div>` : '';

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
            ${tiesListHtml}
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
// compare.js - Lógica de comparación de álbumes

let allAlbums = [];

// ── INIT ──────────────────────────────────────────────────────────────────
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

// Racha máxima de canciones consecutivas por encima de un umbral
function maxStreak(tracks, threshold) {
    let max = 0, current = 0;
    tracks.forEach(t => {
        if (parseFloat(t.rating) >= threshold) {
            current++;
            max = Math.max(max, current);
        } else {
            current = 0;
        }
    });
    return max;
}

// Desviación estándar de las notas
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

    // Mejor y peor canción
    const bestA  = [...tracksA].sort((x, y) => parseFloat(y.rating) - parseFloat(x.rating))[0];
    const bestB  = [...tracksB].sort((x, y) => parseFloat(y.rating) - parseFloat(x.rating))[0];
    const worstA = [...tracksA].sort((x, y) => parseFloat(x.rating) - parseFloat(y.rating))[0];
    const worstB = [...tracksB].sort((x, y) => parseFloat(x.rating) - parseFloat(y.rating))[0];

    // Nuevas métricas
    const above7A  = tracksA.filter(t => parseFloat(t.rating) >= 7).length;
    const above7B  = tracksB.filter(t => parseFloat(t.rating) >= 7).length;
    const pctA     = tracksA.length > 0 ? Math.round((above7A / tracksA.length) * 100) : 0;
    const pctB     = tracksB.length > 0 ? Math.round((above7B / tracksB.length) * 100) : 0;

    const devA     = stdDev(tracksA);
    const devB     = stdDev(tracksB);

    const streakA  = maxStreak(tracksA, 7);
    const streakB  = maxStreak(tracksB, 7);

    // Géneros compartidos
    const genresA    = new Set(a.genres || []);
    const genresB    = new Set(b.genres || []);
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
    html += statCell('Nota del álbum', formatRating(ratingA), ratingA > ratingB ? 'winner' : '');
    html += statCell('Nota del álbum', formatRating(ratingB), ratingB > ratingA ? 'winner' : '');
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

    // Mejor canción — gana la de nota más ALTA
    if (bestA || bestB) {
        const bestRatingA = bestA ? parseFloat(bestA.rating) : -1;
        const bestRatingB = bestB ? parseFloat(bestB.rating) : -1;
        html += `<div class="compare-row" style="margin-top:12px;">`;
        html += trackHighlightCell('Mejor canción', bestA, bestRatingA > bestRatingB);
        html += trackHighlightCell('Mejor canción', bestB, bestRatingB > bestRatingA);
        html += `</div>`;
    }

    // Peor canción — gana la de nota más ALTA (la menos mala)
    if (worstA || worstB) {
        const worstRatingA = worstA ? parseFloat(worstA.rating) : -1;
        const worstRatingB = worstB ? parseFloat(worstB.rating) : -1;
        html += `<div class="compare-row" style="margin-top:12px;">`;
        html += trackHighlightCell('Peor canción', worstA, worstRatingA > worstRatingB);
        html += trackHighlightCell('Peor canción', worstB, worstRatingB > worstRatingA);
        html += `</div>`;
    }

    // ── MÉTRICAS AVANZADAS ────────────────────────────────────────────────
    html += sectionTitle('Calidad');

    // % canciones por encima de 7
    html += `<div class="compare-row">`;
    html += statCell(`Canciones ≥ 7 (${above7A} de ${tracksA.length})`, `${pctA}%`, pctA > pctB ? 'winner' : '');
    html += statCell(`Canciones ≥ 7 (${above7B} de ${tracksB.length})`, `${pctB}%`, pctB > pctA ? 'winner' : '');
    html += `</div>`;

    // Consistencia (menor desviación = más consistente)
    html += `<div class="compare-row" style="margin-top:12px;">`;
    html += statCell('Consistencia (desviación)', formatRating(devA), devA < devB ? 'winner' : '');
    html += statCell('Consistencia (desviación)', formatRating(devB), devB < devA ? 'winner' : '');
    html += `</div>`;
    // Nota aclaratoria debajo
    html += `<p style="font-size:0.75rem; color:var(--text-muted); margin-top:6px; margin-bottom:12px;">
        ▲ Mejor = menor desviación (notas más consistentes entre canciones)
    </p>`;

    // Racha máxima ≥ 7
    html += `<div class="compare-row" style="margin-top:6px;">`;
    html += statCell('Racha máxima ≥ 7', `${streakA} canciones`, streakA > streakB ? 'winner' : '');
    html += statCell('Racha máxima ≥ 7', `${streakB} canciones`, streakB > streakA ? 'winner' : '');
    html += `</div>`;

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
    return `<div class="compare-section-title">${text}</div>`;
}

function statCell(label, value, winnerClass = '') {
    const winnerBadge = winnerClass === 'winner'
        ? `<span style="display:block; font-size:0.65rem; font-weight:800; color:var(--accent-red); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">▲ Mejor</span>`
        : `<span style="display:block; font-size:0.65rem; margin-bottom:8px; visibility:hidden;">▲</span>`;
    return `
        <div class="compare-cell ${winnerClass}">
            ${winnerBadge}
            <div class="compare-stat-label">${label}</div>
            <div class="compare-stat-value accent">${value}</div>
        </div>`;
}

function infoCell(label, value, other) {
    const isWinner = value > other ? 'winner' : '';
    const winnerBadge = isWinner
        ? `<span style="display:block; font-size:0.65rem; font-weight:800; color:var(--accent-red); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">▲ Mejor</span>`
        : `<span style="display:block; font-size:0.65rem; margin-bottom:8px; visibility:hidden;">▲</span>`;
    return `
        <div class="compare-cell ${isWinner}">
            ${winnerBadge}
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
            <span style="display:block; font-size:0.65rem; margin-bottom:8px; visibility:hidden;">▲</span>
            <div class="compare-stat-label">Artista</div>
            <div class="compare-stat-value" style="font-size:1rem; letter-spacing:0;">${artistDisplay}</div>
        </div>`;
}

function trackHighlightCell(label, track, isWinner) {
    if (!track) {
        return `
            <div class="compare-cell">
                <span style="display:block; font-size:0.65rem; margin-bottom:8px; visibility:hidden;">▲</span>
                <div class="compare-stat-label">${label}</div>
                <div style="color:var(--text-muted); font-size:0.9rem;">Sin canciones</div>
            </div>`;
    }

    const badgeColor = getColorByRating(parseFloat(track.rating));
    const winnerBadge = isWinner
        ? `<span style="display:block; font-size:0.65rem; font-weight:800; color:var(--accent-red); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">▲ Mejor</span>`
        : `<span style="display:block; font-size:0.65rem; margin-bottom:8px; visibility:hidden;">▲</span>`;

    return `
        <div class="compare-cell ${isWinner ? 'winner' : ''}">
            ${winnerBadge}
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
                <span style="display:block; font-size:0.65rem; margin-bottom:8px; visibility:hidden;">▲</span>
                <div class="compare-stat-label">Géneros</div>
                <div style="color:var(--text-muted); font-size:0.9rem;">Sin géneros</div>
            </div>`;
    }
    const tagsHtml = genres.map(g => {
        const isShared = sharedGenres.includes(g);
        return `<span class="compare-genre-tag${isShared ? ' shared' : ''}">${g}</span>`;
    }).join('');
    return `
        <div class="compare-cell">
            <span style="display:block; font-size:0.65rem; margin-bottom:8px; visibility:hidden;">▲</span>
            <div class="compare-stat-label">Géneros</div>
            <div class="compare-genres">${tagsHtml}</div>
        </div>`;
}

initCompare();
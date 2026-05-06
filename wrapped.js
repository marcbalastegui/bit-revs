// wrapped.js - Estadísticas globales de BitRevs

async function loadWrapped() {
    const grid   = document.getElementById('wrapped-grid');
    const albums = await getAllAlbumsFromDB();

    const allTracks = [];
    albums.forEach(album => {
        if (!album.tracks) return;
        album.tracks.forEach(track => {
            if (!track.isInterlude && parseFloat(track.rating) > 0) {
                allTracks.push({
                    ...track,
                    albumTitle:  album.title,
                    albumCover:  album.coverBase64,
                    albumId:     album.id,
                    albumRating: parseFloat(album.rating) || 0,
                    albumArtist: album.artist
                });
            }
        });
    });

    const scoredAlbums = albums.filter(a => a.tracks && a.tracks.length > 0 && parseFloat(a.rating) > 0);

    if (scoredAlbums.length === 0 && allTracks.length === 0) {
        grid.innerHTML = `
            <div class="stat-card col-12 wrapped-empty">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--border-color)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:48px;height:48px;margin-bottom:16px;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                <p>Todavía no tienes suficientes valoraciones.<br>Añade álbumes y puntúa canciones para ver tu Wrapped.</p>
            </div>`;
        return;
    }

    // ── ESTADÍSTICAS ──────────────────────────────────────────────────────

    const globalAvg = allTracks.length > 0
        ? allTracks.reduce((sum, t) => sum + parseFloat(t.rating), 0) / allTracks.length : 0;
    const totalTracks = allTracks.length;

    const genreCount = {};
    albums.forEach(a => { if (!a.genres) return; a.genres.forEach(g => { genreCount[g] = (genreCount[g] || 0) + 1; }); });
    const topGenre = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0];

    const topAlbum = [...scoredAlbums].sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating))[0];

    const sortedBest = [...allTracks].sort((a, b) => {
        const diff = parseFloat(b.rating) - parseFloat(a.rating);
        return diff !== 0 ? diff : b.albumRating - a.albumRating;
    });
    const sortedWorst = [...allTracks].sort((a, b) => {
        const diff = parseFloat(a.rating) - parseFloat(b.rating);
        return diff !== 0 ? diff : a.albumRating - b.albumRating;
    });

    const topTrack   = sortedBest[0];
    const worstTrack = sortedWorst[0];
    const bestRating  = topTrack   ? parseFloat(topTrack.rating)   : -1;
    const worstRating = worstTrack ? parseFloat(worstTrack.rating) : -1;
    const bestTies    = sortedBest.filter(t  => parseFloat(t.rating) === bestRating);
    const worstTies   = sortedWorst.filter(t => parseFloat(t.rating) === worstRating);

    const artistStats = {};
    allTracks.forEach(t => {
        const artist = t.albumArtist || 'Desconocido';
        if (!artistStats[artist]) artistStats[artist] = { total: 0, count: 0 };
        artistStats[artist].total += parseFloat(t.rating);
        artistStats[artist].count++;
    });
    const artistEntries = Object.entries(artistStats)
        .filter(([, s]) => s.count >= 3)
        .map(([name, s]) => ({ name, avg: s.total / s.count, count: s.count }))
        .sort((a, b) => b.avg - a.avg);
    const bestArtist  = artistEntries[0];
    const worstArtist = artistEntries[artistEntries.length - 1];

    const artistAlbumCount = {};
    albums.forEach(a => { if (!a.artist) return; artistAlbumCount[a.artist] = (artistAlbumCount[a.artist] || 0) + 1; });
    const topListenedArtist = Object.entries(artistAlbumCount).sort((a, b) => b[1] - a[1])[0];

    // Distribución de notas
    const ranges = [
        { label: '0-2', min: 0, max: 2 }, { label: '2-4', min: 2, max: 4 },
        { label: '4-5', min: 4, max: 5 }, { label: '5-6', min: 5, max: 6 },
        { label: '6-7', min: 6, max: 7 }, { label: '7-8', min: 7, max: 8 },
        { label: '8-9', min: 8, max: 9 }, { label: '9-10', min: 9, max: 10.1 },
    ];
    const distribution = ranges.map(r => ({
        label: r.label,
        count: allTracks.filter(t => { const v = parseFloat(t.rating); return v >= r.min && v < r.max; }).length
    }));
    const maxCount = Math.max(...distribution.map(d => d.count), 1);

    // ── GRÁFICA DE ÁLBUMES POR MES ─────────────────────────────────────────
    // Solo álbumes que tienen reviewDate
    const albumsWithDate = albums.filter(a => a.reviewDate);
    const monthMap = {};
    const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

    albumsWithDate.forEach(a => {
        const d = new Date(a.reviewDate);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthMap[key]) monthMap[key] = { label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`, count: 0 };
        monthMap[key].count++;
    });

    const monthEntries = Object.entries(monthMap).sort(([a], [b]) => a.localeCompare(b));
    const maxMonthCount = Math.max(...monthEntries.map(([, v]) => v.count), 1);

    // ── HTML ──────────────────────────────────────────────────────────────
    let html = '';

    html += `
        <div class="stat-card col-4">
            <div class="stat-label">Media global</div>
            <div class="stat-value-big">${formatRating(globalAvg)}</div>
            <div class="stat-value-sub">sobre 10 puntos</div>
        </div>`;

    html += `
        <div class="stat-card col-4">
            <div class="stat-label">Canciones puntuadas</div>
            <div class="stat-value-big">${totalTracks}</div>
            <div class="stat-value-sub">en ${scoredAlbums.length} álbum${scoredAlbums.length !== 1 ? 'es' : ''}</div>
        </div>`;

    html += topGenre ? `
        <div class="stat-card col-4">
            <div class="stat-label">Género más escuchado</div>
            <span class="genre-pill">${topGenre[0]}</span>
            <div class="stat-value-sub" style="margin-top:10px;">${topGenre[1]} álbum${topGenre[1] !== 1 ? 'es' : ''}</div>
        </div>` : '';

    if (topListenedArtist) {
        html += `
            <div class="stat-card col-6" style="cursor:pointer;" onclick="window.location.href='artist.html?name='+encodeURIComponent('${topListenedArtist[0]}')">
                <div class="stat-label">Artista más escuchado</div>
                <div class="artist-card">
                    <div class="artist-initials">${topListenedArtist[0].charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="artist-name">${topListenedArtist[0]}</div>
                        <div class="artist-count">${topListenedArtist[1]} álbum${topListenedArtist[1] !== 1 ? 'es' : ''} en tu colección</div>
                    </div>
                </div>
            </div>`;
    }

    if (topAlbum) {
        const badgeColor = getColorByRating(topAlbum.rating);
        html += `
            <div class="stat-card col-6" style="cursor:pointer;" onclick="window.location.href='album.html?id=${topAlbum.id}'">
                <div class="stat-label">Álbum mejor puntuado</div>
                <div class="highlight-card">
                    <img class="highlight-cover square" src="${topAlbum.coverBase64}" alt="${topAlbum.title}">
                    <div class="highlight-info">
                        <div class="highlight-title">${topAlbum.title}</div>
                        <div class="highlight-meta">${topAlbum.artist} · ${topAlbum.year}</div>
                        <span class="highlight-badge" style="background:${badgeColor}">${formatRating(topAlbum.rating)}</span>
                    </div>
                </div>
            </div>`;
    }

    if (topTrack) {
        html += `
            <div class="stat-card col-6" style="cursor:pointer;" onclick="window.location.href='album.html?id=${topTrack.albumId}'">
                <div class="stat-label">Canción mejor puntuada</div>
                ${trackHighlightHtml(topTrack, bestTies)}
            </div>`;
    }

    if (worstTrack) {
        html += `
            <div class="stat-card col-6" style="cursor:pointer;" onclick="window.location.href='album.html?id=${worstTrack.albumId}'">
                <div class="stat-label">Canción peor puntuada</div>
                ${trackHighlightHtml(worstTrack, worstTies)}
            </div>`;
    }

    if (bestArtist) {
        html += `
            <div class="stat-card col-6" style="cursor:pointer;" onclick="window.location.href='artist.html?name='+encodeURIComponent('${bestArtist.name}')">
                <div class="stat-label">Artista mejor puntuado</div>
                <div class="artist-card">
                    <div class="artist-initials" style="background:${getColorByRating(bestArtist.avg)}">${bestArtist.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="artist-name">${bestArtist.name}</div>
                        <div class="artist-count">Media <strong>${formatRating(bestArtist.avg)}</strong> · ${bestArtist.count} canciones</div>
                    </div>
                </div>
            </div>`;
    }

    if (worstArtist && worstArtist.name !== bestArtist?.name) {
        html += `
            <div class="stat-card col-6" style="cursor:pointer;" onclick="window.location.href='artist.html?name='+encodeURIComponent('${worstArtist.name}')">
                <div class="stat-label">Artista peor puntuado</div>
                <div class="artist-card">
                    <div class="artist-initials" style="background:${getColorByRating(worstArtist.avg)}">${worstArtist.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="artist-name">${worstArtist.name}</div>
                        <div class="artist-count">Media <strong>${formatRating(worstArtist.avg)}</strong> · ${worstArtist.count} canciones</div>
                    </div>
                </div>
            </div>`;
    }

    // Distribución de notas
    const barsHtml = distribution.map(d => {
        const heightPct = Math.round((d.count / maxCount) * 100);
        const barColor = d.label === '9-10' ? '#B533FF' : d.label === '8-9' ? '#3366FF'
            : d.label === '7-8' ? '#66CC33' : d.label === '6-7' ? '#FFD11A'
            : d.label === '5-6' ? '#FF8533' : '#FF3333';
        return `
            <div class="chart-bar-wrap">
                <div class="chart-bar" style="height:${heightPct}%; background:${barColor};">
                    ${d.count > 0 ? `<span class="chart-bar-count">${d.count}</span>` : ''}
                </div>
                <span class="chart-label">${d.label}</span>
            </div>`;
    }).join('');

    html += `
        <div class="stat-card col-6">
            <div class="stat-label">Distribución de notas</div>
            <div class="chart-container">${barsHtml}</div>
        </div>`;

    // Gráfica de álbumes por mes
    if (monthEntries.length > 0) {
        const monthBarsHtml = monthEntries.map(([, v]) => {
            const heightPct = Math.round((v.count / maxMonthCount) * 100);
            return `
                <div class="chart-bar-wrap">
                    <div class="chart-bar" style="height:${heightPct}%; background:var(--accent-red);">
                        ${v.count > 0 ? `<span class="chart-bar-count">${v.count}</span>` : ''}
                    </div>
                    <span class="chart-label">${v.label}</span>
                </div>`;
        }).join('');

        html += `
            <div class="stat-card col-6">
                <div class="stat-label">Álbumes puntuados por mes</div>
                <div class="chart-container" style="height:140px;">${monthBarsHtml}</div>
            </div>`;
    }

    grid.innerHTML = html;

    // Eventos botones "Más"
    document.querySelectorAll('.wrapped-more-btn').forEach(btn => {
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

// ── HELPER: canción destacada con botón "Más" ─────────────────────────────
function trackHighlightHtml(track, allTied) {
    const badgeColor = getColorByRating(parseFloat(track.rating));
    const extraTies  = allTied.slice(1);

    const tiesHtml = extraTies.length > 0 ? `
        <button class="wrapped-more-btn" data-count="${extraTies.length}"
            style="margin-top:8px; background:none; border:1px solid var(--border-color); border-radius:8px; padding:3px 10px; font-size:0.72rem; font-weight:700; color:var(--text-muted); cursor:pointer; font-family:'Inter',sans-serif;">
            +${extraTies.length} más
        </button>
        <div style="display:none; margin-top:8px;">
            ${extraTies.map(t => `
                <div style="display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--border-color);">
                    <img src="${t.albumCover}" style="width:32px;height:32px;border-radius:4px;object-fit:cover;flex-shrink:0;">
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:0.85rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.title}</div>
                        <div style="font-size:0.72rem;color:var(--text-muted);">${t.albumTitle}</div>
                    </div>
                    <span style="padding:2px 8px;border-radius:6px;background:${getColorByRating(parseFloat(t.rating))};color:white;font-size:0.75rem;font-weight:900;">${formatRating(parseFloat(t.rating))}</span>
                </div>`).join('')}
        </div>` : '';

    return `
        <div class="highlight-card">
            <img class="highlight-cover" src="${track.albumCover}" alt="${track.albumTitle}">
            <div class="highlight-info">
                <div class="highlight-title">${track.title}</div>
                <div class="highlight-meta">${track.albumTitle}</div>
                <span class="highlight-badge" style="background:${badgeColor}">${formatRating(parseFloat(track.rating))}</span>
            </div>
        </div>
        ${tiesHtml}`;
}

loadWrapped();
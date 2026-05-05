// wrapped.js - Estadísticas globales de BitRevs

async function loadWrapped() {
    const grid = document.getElementById('wrapped-grid');
    const albums = await getAllAlbumsFromDB();

    const allTracks = [];
    albums.forEach(album => {
        if (!album.tracks) return;
        album.tracks.forEach(track => {
            if (!track.isInterlude && parseFloat(track.rating) > 0) {
                allTracks.push({ ...track, albumTitle: album.title, albumCover: album.coverBase64, albumId: album.id });
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

    // ── CALCULAR ESTADÍSTICAS ─────────────────────────────────────────────

    const globalAvg = allTracks.length > 0
        ? allTracks.reduce((sum, t) => sum + parseFloat(t.rating), 0) / allTracks.length
        : 0;

    const totalTracks = allTracks.length;

    const artistCount = {};
    albums.forEach(a => {
        if (!a.artist) return;
        artistCount[a.artist] = (artistCount[a.artist] || 0) + 1;
    });
    const topArtist = Object.entries(artistCount).sort((a, b) => b[1] - a[1])[0];

    const topAlbum = [...scoredAlbums].sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating))[0];

    const topTrack = [...allTracks].sort((a, b) => {
        const diff = parseFloat(b.rating) - parseFloat(a.rating);
        if (diff !== 0) return diff;
        const albumA = albums.find(al => al.id === a.albumId);
        const albumB = albums.find(al => al.id === b.albumId);
        return parseFloat(albumB?.rating || 0) - parseFloat(albumA?.rating || 0);
    })[0];

    const genreCount = {};
    albums.forEach(a => {
        if (!a.genres) return;
        a.genres.forEach(g => { genreCount[g] = (genreCount[g] || 0) + 1; });
    });
    const topGenre = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0];

    const ranges = [
        { label: '0-2', min: 0,  max: 2  },
        { label: '2-4', min: 2,  max: 4  },
        { label: '4-5', min: 4,  max: 5  },
        { label: '5-6', min: 5,  max: 6  },
        { label: '6-7', min: 6,  max: 7  },
        { label: '7-8', min: 7,  max: 8  },
        { label: '8-9', min: 8,  max: 9  },
        { label: '9-10', min: 9, max: 10.1 },
    ];

    const distribution = ranges.map(r => ({
        label: r.label,
        count: allTracks.filter(t => {
            const v = parseFloat(t.rating);
            return v >= r.min && v < r.max;
        }).length
    }));

    const maxCount = Math.max(...distribution.map(d => d.count), 1);

    // ── CONSTRUIR HTML ────────────────────────────────────────────────────
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

    if (topGenre) {
        html += `
            <div class="stat-card col-4">
                <div class="stat-label">Género más escuchado</div>
                <span class="genre-pill">${topGenre[0]}</span>
                <div class="stat-value-sub" style="margin-top:10px;">${topGenre[1]} álbum${topGenre[1] !== 1 ? 'es' : ''}</div>
            </div>`;
    } else {
        html += `
            <div class="stat-card col-4">
                <div class="stat-label">Género más escuchado</div>
                <div class="stat-value-sub" style="margin-top:10px;">Sin géneros asignados</div>
            </div>`;
    }

    if (topArtist) {
        html += `
            <div class="stat-card col-6">
                <div class="stat-label">Artista más escuchado</div>
                <div class="artist-card">
                    <div class="artist-initials">${topArtist[0].charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="artist-name">${topArtist[0]}</div>
                        <div class="artist-count">${topArtist[1]} álbum${topArtist[1] !== 1 ? 'es' : ''} en tu colección</div>
                    </div>
                </div>
            </div>`;
    }

    if (topAlbum) {
        const badgeColor = getColorByRating(topAlbum.rating);
        html += `
            <div class="stat-card col-6">
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
        const badgeColor = getColorByRating(topTrack.rating);
        html += `
            <div class="stat-card col-6">
                <div class="stat-label">Canción mejor puntuada</div>
                <div class="highlight-card">
                    <img class="highlight-cover" src="${topTrack.albumCover}" alt="${topTrack.albumTitle}">
                    <div class="highlight-info">
                        <div class="highlight-title">${topTrack.title}</div>
                        <div class="highlight-meta">${topTrack.albumTitle}</div>
                        <span class="highlight-badge" style="background:${badgeColor}">${formatRating(topTrack.rating)}</span>
                    </div>
                </div>
            </div>`;
    }

    const barsHtml = distribution.map(d => {
        const heightPct = maxCount > 0 ? Math.round((d.count / maxCount) * 100) : 0;
        const barColor = d.label === '9-10' ? '#B533FF'
                       : d.label === '8-9'  ? '#3366FF'
                       : d.label === '7-8'  ? '#66CC33'
                       : d.label === '6-7'  ? '#FFD11A'
                       : d.label === '5-6'  ? '#FF8533'
                       : '#FF3333';
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

    grid.innerHTML = html;
}

loadWrapped();
// wrapped.js - Estadísticas globales de BitRevs

async function loadWrapped() {
    const grid = document.getElementById('wrapped-grid');

    const albums = await getAllAlbumsFromDB();

    // Extraer todas las canciones puntuadas
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
                <p style="font-size:2rem;">🎵</p>
                <p>Todavía no tienes suficientes valoraciones.<br>Añade álbumes y puntúa canciones para ver tu Wrapped.</p>
            </div>`;
        return;
    }

    // ── CALCULAR ESTADÍSTICAS ─────────────────────────────────────────────

    // 1. Media global de canciones
    const globalAvg = allTracks.length > 0
        ? allTracks.reduce((sum, t) => sum + parseFloat(t.rating), 0) / allTracks.length
        : 0;

    // 2. Total canciones puntuadas
    const totalTracks = allTracks.length;

    // 3. Artista más puntuado (más álbumes)
    const artistCount = {};
    albums.forEach(a => {
        if (!a.artist) return;
        artistCount[a.artist] = (artistCount[a.artist] || 0) + 1;
    });
    const topArtist = Object.entries(artistCount).sort((a, b) => b[1] - a[1])[0];

    // 4. Álbum mejor puntuado
    const topAlbum = [...scoredAlbums].sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating))[0];

    // 5. Canción mejor puntuada
    const topTrack = [...allTracks].sort((a, b) => {
        const diff = parseFloat(b.rating) - parseFloat(a.rating);
        if (diff !== 0) return diff;
        const albumA = albums.find(al => al.id === a.albumId);
        const albumB = albums.find(al => al.id === b.albumId);
        return parseFloat(albumB?.rating || 0) - parseFloat(albumA?.rating || 0);
    })[0];

    // 6. Género más frecuente
    const genreCount = {};
    albums.forEach(a => {
        if (!a.genres) return;
        a.genres.forEach(g => { genreCount[g] = (genreCount[g] || 0) + 1; });
    });
    const topGenre = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0];

    // 7. Distribución de notas (rangos)
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

    // 8. Distribución por década
    const decades = {};
    albums.forEach(a => {
        if (!a.year) return;
        const decade = Math.floor(a.year / 10) * 10;
        decades[decade] = (decades[decade] || 0) + 1;
    });
    const sortedDecades = Object.entries(decades).sort((a, b) => a[0] - b[0]);
    const maxDecadeCount = Math.max(...sortedDecades.map(d => d[1]), 1);

    // ── CONSTRUIR HTML ────────────────────────────────────────────────────

    let html = '';

    // Media global
    html += `
        <div class="stat-card col-4">
            <div class="stat-label">Media global</div>
            <div class="stat-value-big">${formatRating(globalAvg)}</div>
            <div class="stat-value-sub">sobre 10 puntos</div>
        </div>`;

    // Total canciones
    html += `
        <div class="stat-card col-4">
            <div class="stat-label">Canciones puntuadas</div>
            <div class="stat-value-big">${totalTracks}</div>
            <div class="stat-value-sub">en ${scoredAlbums.length} álbum${scoredAlbums.length !== 1 ? 'es' : ''}</div>
        </div>`;

    // Género favorito
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

    // Artista más escuchado
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

    // Álbum mejor puntuado
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

    // Canción mejor puntuada
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

    // Gráfico de distribución de notas
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

    // Distribución por década
    const decadesBarsHtml = sortedDecades.map(([decade, count]) => {
        const heightPct = Math.round((count / maxDecadeCount) * 100);
        return `
            <div class="chart-bar-wrap">
                <div class="chart-bar" style="height:${heightPct}%; background:var(--accent-red);">
                    ${count > 0 ? `<span class="chart-bar-count">${count}</span>` : ''}
                </div>
                <span class="chart-label">${decade}s</span>
            </div>`;
    }).join('');

    html += `
        <div class="stat-card col-6">
            <div class="stat-label">Álbumes por década</div>
            <div class="chart-container">${decadesBarsHtml}</div>
        </div>`;

    grid.innerHTML = html;
}

loadWrapped();
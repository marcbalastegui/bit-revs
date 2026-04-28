// artist.js - Estadísticas por artista

async function loadArtistStats() {
    const params = new URLSearchParams(window.location.search);
    const artistName = params.get('name');

    if (!artistName) {
        document.getElementById('artist-grid').innerHTML = `
            <div class="stat-card col-12" style="text-align:center; color:var(--text-muted);">
                <p>No se especificó un artista.</p>
            </div>`;
        return;
    }

    const albums = await getAllAlbumsFromDB();
    const artistAlbums = albums.filter(a => a.artist && a.artist.toLowerCase() === artistName.toLowerCase());

    if (artistAlbums.length === 0) {
        document.getElementById('artist-grid').innerHTML = `
            <div class="stat-card col-12" style="text-align:center; color:var(--text-muted);">
                <p>No hay álbumes de este artista.</p>
            </div>`;
        return;
    }

    // Actualizar hero
    document.getElementById('artist-name').textContent = artistName;
    document.getElementById('artist-initial').textContent = artistName.charAt(0).toUpperCase();

    // ── EXTRAER DATOS ─────────────────────────────────────────────────────

    // Todas las canciones del artista
    const allTracks = [];
    artistAlbums.forEach(album => {
        if (!album.tracks) return;
        album.tracks.forEach(track => {
            if (!track.isInterlude && parseFloat(track.rating) > 0) {
                allTracks.push({ ...track, albumId: album.id, albumTitle: album.title, albumCover: album.coverBase64 });
            }
        });
    });

    // Media de álbumes
    const albumsWithRating = artistAlbums.filter(a => parseFloat(a.rating) > 0);
    const avgAlbumRating = albumsWithRating.length > 0
        ? albumsWithRating.reduce((sum, a) => sum + parseFloat(a.rating), 0) / albumsWithRating.length
        : 0;

    // Media de canciones
    const avgTrackRating = allTracks.length > 0
        ? allTracks.reduce((sum, t) => sum + parseFloat(t.rating), 0) / allTracks.length
        : 0;

    // Mejor álbum
    const bestAlbum = [...albumsWithRating].sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating))[0];

    // Mejor canción
    const bestTrack = [...allTracks].sort((a, b) => {
        const diff = parseFloat(b.rating) - parseFloat(a.rating);
        if (diff !== 0) return diff;
        const albumA = albums.find(al => al.id === a.albumId);
        const albumB = albums.find(al => al.id === b.albumId);
        return parseFloat(albumB?.rating || 0) - parseFloat(albumA?.rating || 0);
    })[0];

    // Géneros
    const genreSet = new Set();
    artistAlbums.forEach(a => {
        if (a.genres) a.genres.forEach(g => genreSet.add(g));
    });

    // Distribución de notas
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

    // Media de álbumes
    html += `
        <div class="stat-card col-4">
            <div class="stat-label">Media de álbumes</div>
            <div class="stat-value-big">${formatRating(avgAlbumRating)}</div>
            <div class="stat-value-sub">${albumsWithRating.length} álbum${albumsWithRating.length !== 1 ? 'es' : ''}</div>
        </div>`;

    // Total de álbumes
    html += `
        <div class="stat-card col-4">
            <div class="stat-label">Total de álbumes</div>
            <div class="stat-value-big">${artistAlbums.length}</div>
            <div class="stat-value-sub">en tu colección</div>
        </div>`;

    // Total de canciones
    html += `
        <div class="stat-card col-4">
            <div class="stat-label">Canciones puntuadas</div>
            <div class="stat-value-big">${allTracks.length}</div>
            <div class="stat-value-sub">media: ${formatRating(avgTrackRating)}</div>
        </div>`;

    // Mejor álbum
    if (bestAlbum) {
        const badgeColor = getColorByRating(bestAlbum.rating);
        html += `
            <div class="stat-card col-6">
                <div class="stat-label">Mejor álbum</div>
                <div class="highlight-card">
                    <img class="highlight-cover" src="${bestAlbum.coverBase64}" alt="${bestAlbum.title}">
                    <div class="highlight-info">
                        <div class="highlight-title">${bestAlbum.title}</div>
                        <div class="highlight-meta">${bestAlbum.year}</div>
                        <span class="highlight-badge" style="background:${badgeColor}">${formatRating(bestAlbum.rating)}</span>
                    </div>
                </div>
            </div>`;
    }

    // Mejor canción
    if (bestTrack) {
        const badgeColor = getColorByRating(bestTrack.rating);
        html += `
            <div class="stat-card col-6">
                <div class="stat-label">Mejor canción</div>
                <div class="highlight-card">
                    <img class="highlight-cover" src="${bestTrack.albumCover}" alt="${bestTrack.albumTitle}">
                    <div class="highlight-info">
                        <div class="highlight-title">${bestTrack.title}</div>
                        <div class="highlight-meta">${bestTrack.albumTitle}</div>
                        <span class="highlight-badge" style="background:${badgeColor}">${formatRating(bestTrack.rating)}</span>
                    </div>
                </div>
            </div>`;
    }

    // Géneros
    if (genreSet.size > 0) {
        const genresHtml = [...genreSet].sort().map(g => `<span class="genre-pill">${g}</span>`).join('');
        html += `
            <div class="stat-card col-6">
                <div class="stat-label">Géneros</div>
                <div class="genres-list">${genresHtml}</div>
            </div>`;
    }

    // Distribución de notas
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

    // Lista de álbumes
    const albumsListHtml = artistAlbums
        .filter(a => parseFloat(a.rating) > 0)
        .sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating))
        .map(album => {
            const badgeColor = getColorByRating(album.rating);
            return `
                <div class="album-row">
                    <img class="album-row-cover" src="${album.coverBase64}" alt="${album.title}">
                    <div class="album-row-info">
                        <div class="album-row-title">${album.title}</div>
                        <div class="album-row-meta">${album.year}</div>
                    </div>
                    <span class="album-row-badge" style="background:${badgeColor}">${formatRating(album.rating)}</span>
                </div>`;
        }).join('');

    html += `
        <div class="stat-card col-12">
            <div class="stat-label">Todos los álbumes</div>
            <div class="albums-list">${albumsListHtml}</div>
        </div>`;

    document.getElementById('artist-grid').innerHTML = html;
}

loadArtistStats();
// artist.js - Estadísticas por artista (incluye colaboraciones)

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

    // Encontrar álbumes donde el artista es principal O colaborador
    const artistAlbums = albums.filter(a => {
        const isPrincipal = a.artist && a.artist.toLowerCase() === artistName.toLowerCase();
        const isFeatured = a.featuredArtists && a.featuredArtists.some(f => f.toLowerCase() === artistName.toLowerCase());
        return isPrincipal || isFeatured;
    });

    // Comprobar si al menos tiene canciones como feature aunque no tenga álbumes propios
    const hasTrackFeatures = albums.some(album => {
        if (!album.tracks) return false;
        return album.tracks.some(track => {
            if (!track.artist) return false;
            return track.artist.split(',').map(a => a.trim())
                .some(a => a.toLowerCase() === artistName.toLowerCase());
        });
    });

    if (artistAlbums.length === 0 && !hasTrackFeatures) {
        document.getElementById('artist-grid').innerHTML = `
            <div class="stat-card col-12" style="text-align:center; color:var(--text-muted);">
                <p>No hay álbumes de este artista.</p>
            </div>`;
        return;
    }

    // Actualizar hero — siempre, independientemente de si tiene álbumes propios
    document.getElementById('artist-name').textContent = artistName;
    document.getElementById('artist-initial').textContent = artistName.charAt(0).toUpperCase();
    document.getElementById('artist-subtitle').textContent = 'Perfil de artista';

    // Cargar foto y banner del artista si existen
    const artistData = await getArtistFromDB(artistName);
    if (artistData && artistData.photo)  applyArtistPhoto(artistData.photo);
    if (artistData && artistData.banner) applyArtistBanner(artistData.banner);

    // Click en avatar → subir foto
    const avatarContainer = document.getElementById('artist-avatar-container');
    const inputPhoto      = document.getElementById('input-artist-photo');
    if (avatarContainer && inputPhoto) {
        avatarContainer.addEventListener('click', () => inputPhoto.click());
        inputPhoto.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file || !file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const photoData = ev.target.result;
                const existing  = await getArtistFromDB(artistName) || { name: artistName };
                existing.photo  = photoData;
                await saveArtistToDB(existing);
                applyArtistPhoto(photoData);
            };
            reader.readAsDataURL(file);
        });
    }

    // Click en botón banner → subir banner
    const btnBanner   = document.getElementById('btn-change-banner');
    const inputBanner = document.getElementById('input-artist-banner');
    if (btnBanner && inputBanner) {
        btnBanner.addEventListener('click', (e) => { e.stopPropagation(); inputBanner.click(); });
        inputBanner.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file || !file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const bannerData = ev.target.result;
                const existing   = await getArtistFromDB(artistName) || { name: artistName };
                existing.banner  = bannerData;
                await saveArtistToDB(existing);
                applyArtistBanner(bannerData);
            };
            reader.readAsDataURL(file);
        });
    }

    // ── EXTRAER DATOS ─────────────────────────────────────────────────────

    // Canciones donde el artista aparece:
    // 1. Álbumes donde es principal → todas las canciones
    // 2. Cualquier álbum donde aparece en track.artist (feature a nivel de canción)
    const allTracks = [];
    const principalAlbums = artistAlbums.filter(a => a.artist && a.artist.toLowerCase() === artistName.toLowerCase());

    // Canciones de álbumes propios
    principalAlbums.forEach(album => {
        if (!album.tracks) return;
        album.tracks.forEach(track => {
            if (!track.isInterlude && parseFloat(track.rating) > 0) {
                allTracks.push({ ...track, albumId: album.id, albumTitle: album.title, albumCover: album.coverBase64 });
            }
        });
    });

    // Canciones en otros álbumes donde aparece como feature en track.artist
    albums.forEach(album => {
        // Saltamos álbumes donde ya es principal (ya los hemos contado)
        if (album.artist && album.artist.toLowerCase() === artistName.toLowerCase()) return;
        if (!album.tracks) return;
        album.tracks.forEach(track => {
            if (!track.isInterlude && parseFloat(track.rating) > 0 && track.artist) {
                const guests = track.artist.split(',').map(a => a.trim());
                const isFeature = guests.some(g => g.toLowerCase() === artistName.toLowerCase());
                if (isFeature) {
                    // Evitar duplicados
                    const exists = allTracks.find(t => t.title === track.title && t.albumId === album.id);
                    if (!exists) {
                        allTracks.push({ ...track, albumId: album.id, albumTitle: album.title, albumCover: album.coverBase64 });
                    }
                }
            }
        });
    });

    // Media de álbumes (como principal)
    const albumsWithRating = principalAlbums.filter(a => parseFloat(a.rating) > 0);
    const avgAlbumRating = albumsWithRating.length > 0
        ? albumsWithRating.reduce((sum, a) => sum + parseFloat(a.rating), 0) / albumsWithRating.length
        : 0;

    // Media de canciones
    const avgTrackRating = allTracks.length > 0
        ? allTracks.reduce((sum, t) => sum + parseFloat(t.rating), 0) / allTracks.length
        : 0;

    // Mejor álbum (como principal)
    const bestAlbum = [...albumsWithRating].sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating))[0];

    // Mejor canción
    const bestTrack = [...allTracks].sort((a, b) => {
        const diff = parseFloat(b.rating) - parseFloat(a.rating);
        if (diff !== 0) return diff;
        const albumA = albums.find(al => al.id === a.albumId);
        const albumB = albums.find(al => al.id === b.albumId);
        return parseFloat(albumB?.rating || 0) - parseFloat(albumA?.rating || 0);
    })[0];

    // Géneros (de todos sus álbumes, principal y featured)
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

    // Separar álbumes propios de colaboraciones
    const ownAlbums = artistAlbums.filter(a => a.artist && a.artist.toLowerCase() === artistName.toLowerCase());
    const collaborations = artistAlbums.filter(a => !ownAlbums.includes(a));

    // ── CONSTRUIR HTML ────────────────────────────────────────────────────

    let html = '';

    // Media de álbumes — solo si tiene álbumes propios
    if (ownAlbums.length > 0) {
        html += `
            <div class="stat-card col-4">
                <div class="stat-label">Media de álbumes</div>
                <div class="stat-value-big">${formatRating(avgAlbumRating)}</div>
                <div class="stat-value-sub">${albumsWithRating.length} álbum${albumsWithRating.length !== 1 ? 'es' : ''}</div>
            </div>`;

        html += `
            <div class="stat-card col-4">
                <div class="stat-label">Total de álbumes</div>
                <div class="stat-value-big">${ownAlbums.length}</div>
                <div class="stat-value-sub">${collaborations.length} colaboración${collaborations.length !== 1 ? 'es' : ''}</div>
            </div>`;
    }

    // Total de canciones — siempre
    const trackColSize = ownAlbums.length > 0 ? 'col-4' : 'col-6';
    html += `
        <div class="stat-card ${trackColSize}">
            <div class="stat-label">Canciones puntuadas</div>
            <div class="stat-value-big">${allTracks.length}</div>
            <div class="stat-value-sub">media: ${formatRating(avgTrackRating)}</div>
        </div>`;

    // Si solo tiene features, mostrar una card informativa
    if (ownAlbums.length === 0) {
        html += `
            <div class="stat-card col-6">
                <div class="stat-label">Aparece como</div>
                <div class="stat-value-big" style="font-size:1.4rem; letter-spacing:-0.5px;">Artista invitado</div>
                <div class="stat-value-sub">Solo aparece como feature en canciones de otros artistas</div>
            </div>`;
    }

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

    // Lista de álbumes propios
    const albumsListHtml = ownAlbums
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

    // Lista de colaboraciones
    if (collaborations.length > 0) {
        const collabsListHtml = collaborations
            .filter(a => parseFloat(a.rating) > 0)
            .sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating))
            .map(album => {
                const badgeColor = getColorByRating(album.rating);
                const roleText = album.artist === artistName ? 'Principal' : 'Feat.';
                return `
                    <div class="album-row">
                        <img class="album-row-cover" src="${album.coverBase64}" alt="${album.title}">
                        <div class="album-row-info">
                            <div class="album-row-title">${album.title}</div>
                            <div class="album-row-meta">${album.artist}${album.featuredArtists && album.featuredArtists.length > 0 ? ' ft. ' + album.featuredArtists.join(', ') : ''}</div>
                        </div>
                        <span class="album-row-badge" style="background:${badgeColor}">${formatRating(album.rating)}</span>
                    </div>`;
            }).join('');

        html += `
            <div class="stat-card col-12">
                <div class="stat-label">Colaboraciones</div>
                <div class="albums-list">${collabsListHtml}</div>
            </div>`;
    }

    document.getElementById('artist-grid').innerHTML = html;
}

loadArtistStats();


// ── HELPERS: aplicar foto y banner ───────────────────────────────────────
function applyArtistPhoto(photoData) {
    const initial   = document.getElementById('artist-initial');
    const photoEl   = document.getElementById('artist-photo');
    const container = document.getElementById('artist-avatar-container');
    if (initial)   initial.style.display = 'none';
    if (photoEl)   { photoEl.src = photoData; photoEl.style.display = 'block'; }
    if (container) container.style.background = 'transparent';
}

function applyArtistBanner(bannerData) {
    const banner = document.getElementById('artist-banner');
    if (!banner) return;
    banner.style.backgroundImage = `url(${bannerData})`;
    banner.classList.remove('no-banner');
}
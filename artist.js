// artist.js - Estadísticas por artista (incluye colaboraciones)

function buildEvolutionChart(albums) {
    const sorted = [...albums]
        .filter(a => parseFloat(a.rating) > 0)
        .sort((a, b) => {
            const yearDiff = (a.year || 0) - (b.year || 0);
            return yearDiff !== 0 ? yearDiff : a.id - b.id;
        });
    if (sorted.length < 2) return '';

    const W = 600, H = 190;
    const COVER = 32; // cover thumbnail diameter
    const PAD = { top: 26, right: 24, bottom: 60, left: 28 };
    const cW = W - PAD.left - PAD.right;
    const cH = H - PAD.top - PAD.bottom;

    const ratings = sorted.map(a => parseFloat(a.rating));
    const minR = Math.max(0,  Math.min(...ratings) - 0.8);
    const maxR = Math.min(10, Math.max(...ratings) + 0.8);
    const range = maxR - minR || 1;
    const n = sorted.length;

    const pts = sorted.map((a, i) => ({
        x: PAD.left + (n === 1 ? cW / 2 : (i / (n - 1)) * cW),
        y: PAD.top + (1 - (parseFloat(a.rating) - minR) / range) * cH,
        album: a
    }));

    const polyline  = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const areaPoints = [
        `${pts[0].x.toFixed(1)},${(PAD.top + cH).toFixed(1)}`,
        ...pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
        `${pts[pts.length - 1].x.toFixed(1)},${(PAD.top + cH).toFixed(1)}`
    ].join(' ');

    const R = 4; // corner radius for square covers

    // clipPath defs for cover thumbnails (rounded square)
    const clipDefs = pts.map((p, i) => {
        const coverY = PAD.top + cH + 14;
        return `<clipPath id="evo-clip-${i}"><rect x="${(p.x - COVER/2).toFixed(1)}" y="${coverY.toFixed(1)}" width="${COVER}" height="${COVER}" rx="${R}" ry="${R}"/></clipPath>`;
    }).join('');

    const dotsHtml = pts.map((p, i) => {
        const color = getColorByRating(p.album.rating);
        const coverY = PAD.top + cH + 14; // top of cover image
        const yearY  = coverY + COVER + 11;
        const tooltip = `${p.album.title} (${p.album.year || '?'}) · ${formatRating(p.album.rating)}`;
        const coverSrc = p.album.coverBase64 || '';

        return `
            <!-- cover thumbnail (square) -->
            ${coverSrc ? `<image href="${coverSrc}" x="${(p.x - COVER/2).toFixed(1)}" y="${coverY.toFixed(1)}" width="${COVER}" height="${COVER}" clip-path="url(#evo-clip-${i})" preserveAspectRatio="xMidYMid slice">
                <title>${tooltip}</title>
            </image>` : ''}
            <rect x="${(p.x - COVER/2).toFixed(1)}" y="${coverY.toFixed(1)}" width="${COVER}" height="${COVER}" rx="${R}" ry="${R}" fill="none" stroke="${color}" stroke-width="1.5">
                <title>${tooltip}</title>
            </rect>
            <!-- year -->
            <text x="${p.x.toFixed(1)}" y="${yearY.toFixed(1)}" text-anchor="middle" font-size="9" fill="#999" font-family="Inter,sans-serif">${p.album.year || ''}</text>
            <!-- dot on line -->
            <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="${color}" stroke="white" stroke-width="1.5">
                <title>${tooltip}</title>
            </circle>
            <!-- rating label -->
            <text x="${p.x.toFixed(1)}" y="${(p.y - 9).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="${color}" font-family="Inter,sans-serif">${formatRating(p.album.rating)}</text>`;
    }).join('');

    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;overflow:visible;display:block;">
        <defs>
            <linearGradient id="evo-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--text-main)" stop-opacity="0.1"/>
                <stop offset="100%" stop-color="var(--text-main)" stop-opacity="0"/>
            </linearGradient>
            ${clipDefs}
        </defs>
        <polygon points="${areaPoints}" fill="url(#evo-grad)"/>
        <polyline points="${polyline}" fill="none" stroke="var(--text-main)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        ${dotsHtml}
    </svg>`;
}

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
                allTracks.push({ ...track, _mainArtist: album.artist, albumId: album.id, albumTitle: album.title, albumCover: album.coverBase64 });
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
                        allTracks.push({ ...track, _mainArtist: album.artist, albumId: album.id, albumTitle: album.title, albumCover: album.coverBase64 });
                    }
                }
            }
        });
    });

    const dedupedTracks = deduplicateTracks(allTracks);

    // Media de álbumes (como principal)
    const albumsWithRating = principalAlbums.filter(a => parseFloat(a.rating) > 0);
    const avgAlbumRating = albumsWithRating.length > 0
        ? albumsWithRating.reduce((sum, a) => sum + parseFloat(a.rating), 0) / albumsWithRating.length
        : 0;

    // Media de canciones
    const avgTrackRating = dedupedTracks.length > 0
        ? dedupedTracks.reduce((sum, t) => sum + parseFloat(t.rating), 0) / dedupedTracks.length
        : 0;

    // Ranking entre todos los artistas principales (por media de canciones de sus propios álbumes)
    const artistScoreMap = {};
    albums.forEach(album => {
        if (!album.artist) return;
        const key = album.artist.toLowerCase();
        if (!artistScoreMap[key]) artistScoreMap[key] = { name: album.artist, total: 0, count: 0 };
        (album.tracks || []).forEach(t => {
            if (!t.isInterlude && parseFloat(t.rating) > 0) {
                artistScoreMap[key].total += parseFloat(t.rating);
                artistScoreMap[key].count++;
            }
        });
    });
    const rankedArtists = Object.values(artistScoreMap)
        .filter(a => a.count > 0)
        .map(a => ({ ...a, avg: a.total / a.count }))
        .sort((a, b) => b.avg - a.avg);
    const artistRank = rankedArtists.findIndex(a => a.name.toLowerCase() === artistName.toLowerCase()) + 1;
    const totalRanked = rankedArtists.length;

    // Mejor y peor álbum (como principal)
    const sortedByRating = [...albumsWithRating].sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
    const bestAlbum  = sortedByRating[0];
    const worstAlbum = albumsWithRating.length > 1 ? sortedByRating[sortedByRating.length - 1] : null;

    // Mejor canción
    const { albumBoost, trackBoost } = await computeTopBoost();
    const bestTrack = [...dedupedTracks].sort((a, b) => {
        const diff = parseFloat(b.rating) - parseFloat(a.rating);
        if (diff !== 0) return diff;
        const boostDiff = getTrackBoostScore(b.albumId, b.title, albumBoost, trackBoost)
                        - getTrackBoostScore(a.albumId, a.title, albumBoost, trackBoost);
        if (boostDiff !== 0) return boostDiff;
        const albumA = albums.find(al => al.id === a.albumId);
        const albumB = albums.find(al => al.id === b.albumId);
        return parseFloat(albumB?.rating || 0) - parseFloat(albumA?.rating || 0);
    })[0];

    // Top 10 canciones
    const top10Tracks = [...dedupedTracks].sort((a, b) => {
        const diff = parseFloat(b.rating) - parseFloat(a.rating);
        if (diff !== 0) return diff;
        const boostDiff = getTrackBoostScore(b.albumId, b.title, albumBoost, trackBoost)
                        - getTrackBoostScore(a.albumId, a.title, albumBoost, trackBoost);
        if (boostDiff !== 0) return boostDiff;
        const albumA = albums.find(al => al.id === a.albumId);
        const albumB = albums.find(al => al.id === b.albumId);
        return parseFloat(albumB?.rating || 0) - parseFloat(albumA?.rating || 0);
    }).slice(0, 10);

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
        count: dedupedTracks.filter(t => {
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

    // Ranking
    if (artistRank > 0) {
        const rankColors = ['#B533FF', '#3366FF', '#66CC33'];
        const rankColor = rankColors[artistRank - 1] || 'var(--text-main)';
        html += `
            <div class="stat-card col-4">
                <div class="stat-label">Ranking</div>
                <div class="stat-value-big" style="color:${rankColor}; font-size:2.6rem;">#${artistRank}</div>
                <div class="stat-value-sub">de ${totalRanked} artistas</div>
            </div>`;
    }

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
            <div class="stat-value-big">${dedupedTracks.length}</div>
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
            <div class="stat-card col-6" onclick="window.location.href='album.html?id=${bestAlbum.id}'" style="cursor:pointer;">
                <div class="stat-label">Mejor álbum</div>
                <div class="highlight-card">
                    <img class="highlight-cover" src="${bestAlbum.coverBase64 || ''}" alt="${bestAlbum.title}" loading="lazy" onerror="this.style.visibility='hidden'">
                    <div class="highlight-info">
                        <div class="highlight-title">${bestAlbum.title}</div>
                        <div class="highlight-meta">${bestAlbum.year}</div>
                        <span class="highlight-badge" style="background:${badgeColor}">${formatRating(bestAlbum.rating)}</span>
                    </div>
                </div>
            </div>`;
    }

    // Peor álbum
    if (worstAlbum) {
        const badgeColor = getColorByRating(worstAlbum.rating);
        html += `
            <div class="stat-card col-6" onclick="window.location.href='album.html?id=${worstAlbum.id}'" style="cursor:pointer;">
                <div class="stat-label">Peor álbum</div>
                <div class="highlight-card">
                    <img class="highlight-cover" src="${worstAlbum.coverBase64 || ''}" alt="${worstAlbum.title}" loading="lazy" onerror="this.style.visibility='hidden'">
                    <div class="highlight-info">
                        <div class="highlight-title">${worstAlbum.title}</div>
                        <div class="highlight-meta">${worstAlbum.year}</div>
                        <span class="highlight-badge" style="background:${badgeColor}">${formatRating(worstAlbum.rating)}</span>
                    </div>
                </div>
            </div>`;
    }

    // Evolución de nota por álbum
    const evolutionChart = buildEvolutionChart(ownAlbums);
    if (evolutionChart) {
        html += `
            <div class="stat-card col-12">
                <div class="stat-label" style="margin-bottom:12px;">Evolución de nota</div>
                ${evolutionChart}
            </div>`;
    }

    // Mejor canción
    if (bestTrack) {
        const badgeColor = getColorByRating(bestTrack.rating);
        html += `
            <div class="stat-card col-6" onclick="window.location.href='album.html?id=${bestTrack.albumId}'" style="cursor:pointer;">
                <div class="stat-label">Mejor canción</div>
                <div class="highlight-card">
                    <img class="highlight-cover" src="${bestTrack.albumCover || ''}" alt="${bestTrack.albumTitle}" loading="lazy" onerror="this.style.visibility='hidden'">
                    <div class="highlight-info">
                        <div class="highlight-title">${bestTrack.title}</div>
                        <div class="highlight-meta">${bestTrack.albumTitle}</div>
                        <span class="highlight-badge" style="background:${badgeColor}">${formatRating(bestTrack.rating)}</span>
                    </div>
                </div>
            </div>`;
    }

    // Top 10 canciones
    if (top10Tracks.length > 0) {
        const rankColors10 = ['#B533FF', '#3366FF', '#66CC33'];
        const rowsHtml = top10Tracks.map((t, i) => {
            const color = rankColors10[i] || 'var(--text-muted)';
            return `
                <div class="artist-track-row" onclick="window.location.href='album.html?id=${t.albumId}'">
                    <div class="artist-track-rank" style="color:${color};">${i + 1}</div>
                    <img class="artist-track-cover" src="${t.albumCover || ''}" alt="${t.albumTitle}" loading="lazy" onerror="this.style.visibility='hidden'">
                    <div class="artist-track-info">
                        <div class="artist-track-title">${t.title}</div>
                        <div class="artist-track-meta">${t.albumTitle}</div>
                    </div>
                    <span class="highlight-badge" style="background:${getColorByRating(t.rating)}">${formatRating(t.rating)}</span>
                </div>`;
        }).join('');
        html += `
            <div class="stat-card col-12">
                <div class="stat-label">Top 10 canciones</div>
                ${rowsHtml}
            </div>`;
    }

    // Géneros
    if (genreSet.size > 0) {
        const genresHtml = [...genreSet].sort().map(g =>
            `<span class="genre-pill" onclick="window.location.href='genre.html?g=${encodeURIComponent(g)}'" style="cursor:pointer;" title="Ver género">${g}</span>`
        ).join('');
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
                       : d.label === '4-5'  ? '#FF3333'
                       : d.label === '2-4'  ? '#996600'
                       : '#4D4D4D'; // '0-2'
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
                <div class="album-row" onclick="window.location.href='album.html?id=${album.id}'" style="cursor:pointer;">
                    <img class="album-row-cover" src="${album.coverBase64 || ''}" alt="${album.title}" loading="lazy" onerror="this.style.visibility='hidden'">
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
                return `
                    <div class="album-row" onclick="window.location.href='album.html?id=${album.id}'" style="cursor:pointer;">
                        <img class="album-row-cover" src="${album.coverBase64 || ''}" alt="${album.title}" loading="lazy" onerror="this.style.visibility='hidden'">
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


// ── HELPERS: aplicar foto y banner! ───────────────────────────────────────
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
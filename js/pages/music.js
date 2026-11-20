// script.js - Lógica principal de Music (Álbumes + Singles)

const btnAddAlbum = document.getElementById('btn-add-album');
const modalAdd    = document.getElementById('modal-add');
const btnCancel   = document.getElementById('btn-cancel');
const albumForm   = document.getElementById('album-form');
let editingAlbumId = null;

// Estado de las sugerencias de Spotify en el modal (ver sección "SPOTIFY" al final del archivo)
let spotifySelectedCoverBase64 = null;
let spotifySelectedTracks = null;
let spotifyActiveTab = 'liked';
let spotifyTypeFilter = 'album';
let spotifySearchDebounceTimer = null;

// ── GÉNEROS PREDEFINIDOS ──────────────────────────────────────────────────

function spotifyMapGenresToBitRevs(spotifyGenres) {
    const result = new Set();
    for (const g of spotifyGenres.map(x => x.toLowerCase())) {
        if (g.includes('rap') || g.includes('hip hop') || g.includes('hip-hop') || g.includes('trap') || g.includes('drill') || g.includes('gangster')) result.add('Rap/Hip-Hop');
        if (g.includes('r&b') || g.includes('soul') || g.includes('rhythm and blues') || g.includes('neo soul')) result.add('R&B/Soul');
        if (g === 'pop' || g.includes('pop') && !g.includes('hip') && !g.includes('indie') && !g.includes('k-pop')) result.add('Pop');
        if (g.includes('rock') || g.includes('alternative') || g.includes('punk') || g.includes('grunge')) result.add('Rock');
        if (g.includes('electronic') || g.includes('electro') || g.includes('edm') || g.includes('techno') || g.includes('house') || g.includes('dance') || g.includes('synth')) result.add('Electrónica');
        if (g.includes('jazz')) result.add('Jazz');
        if (g.includes('reggaeton') || g.includes('urbano') || g.includes('latin') || g.includes('reggae')) result.add('Reggaeton');
        if (g.includes('indie')) result.add('Indie');
        if (g.includes('metal') || g.includes('hardcore')) result.add('Metal');
    }
    return Array.from(result);
}

const GENRES_PREDEFINED = [
    'Rap/Hip-Hop', 'Pop', 'R&B/Soul', 'Rock',
    'Electrónica', 'Jazz', 'Reggaeton', 'Indie', 'Metal'
];

function renderGenreSelector(selectedGenres = []) {
    const container = document.getElementById('genre-chips');
    if (!container) return;
    container.innerHTML = '';
    GENRES_PREDEFINED.forEach(genre => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'genre-chip' + (selectedGenres.includes(genre) ? ' selected' : '');
        chip.textContent = genre;
        chip.dataset.genre = genre;
        chip.addEventListener('click', () => chip.classList.toggle('selected'));
        container.appendChild(chip);
    });
}

function getSelectedGenres() {
    const chips = document.querySelectorAll('.genre-chip.selected');
    const selected = Array.from(chips).map(c => c.dataset.genre);
    const customInput = document.getElementById('genre-custom');
    if (customInput && customInput.value.trim() !== '') {
        const customs = customInput.value.split(',').map(g => g.trim()).filter(g => g !== '');
        customs.forEach(g => { if (!selected.includes(g)) selected.push(g); });
    }
    return selected;
}

function heartSVG() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
}

// ── FAVORITO EN CARD ──────────────────────────────────────────────────────
window.toggleAlbumFavoriteCard = async function(event, id) {
    event.stopPropagation();
    const album = await getAlbumByIdFromDB(id);
    if (!album) return;
    album.favorite = !album.favorite;
    await saveAlbumToDB(album);
    const btn = document.querySelector(`.card-fav-btn[data-id="${id}"]`);
    if (btn) btn.classList.toggle('active', album.favorite);
}

// ── BORRAR / EDITAR ───────────────────────────────────────────────────────
window.deleteAlbum = async function(event, id) {
    event.stopPropagation();
    if (await brConfirm("Esta acción no se puede deshacer.", "¿Borrar álbum?")) {
        await deleteAlbumFromDB(id);
        processAndRenderAlbums();
    }
};

window.editAlbum = async function(event, id) {
    event.stopPropagation();
    const album = await getAlbumByIdFromDB(id);
    if (!album) return;

    editingAlbumId = album.id;
    document.getElementById('title').value = album.title;
    document.getElementById('artist').value = album.artist;
    document.getElementById('featured-artists').value = (album.featuredArtists || []).join(', ');
    document.getElementById('year').value = album.year;
    if (document.getElementById('album-type')) document.getElementById('album-type').value = album.type || '';
    const reviewDateEl = document.getElementById('review-date');
    if (reviewDateEl) reviewDateEl.value = album.reviewDate || '';

    const genres = album.genres || [];
    const customGenres = genres.filter(g => !GENRES_PREDEFINED.includes(g));
    renderGenreSelector(genres);
    const customInput = document.getElementById('genre-custom');
    if (customInput) customInput.value = customGenres.join(', ');

    document.querySelector('#modal-add .modal-content h2').textContent = "Editar";
    document.getElementById('cover').removeAttribute('required');

    // Las sugerencias de Spotify solo tienen sentido al crear una reseña nueva
    const spotifySuggestionsEl = document.getElementById('spotify-suggestions');
    if (spotifySuggestionsEl) spotifySuggestionsEl.classList.add('hidden');
    spotifySelectedCoverBase64 = null;

    modalAdd.classList.remove('hidden');
};

// ── MODAL NUEVO ───────────────────────────────────────────────────────────
if (btnAddAlbum && modalAdd) {
    btnAddAlbum.addEventListener('click', () => {
        editingAlbumId = null;
        document.querySelector('#modal-add .modal-content h2').textContent = "Nueva Reseña";
        document.getElementById('cover').setAttribute('required', 'true');
        if (albumForm) albumForm.reset();
        renderGenreSelector([]);
        document.getElementById('genre-custom').value = '';
        document.getElementById('featured-artists').value = '';
        const rdEl = document.getElementById('review-date');
        if (rdEl) rdEl.value = '';
        resetSpotifySuggestions();
        modalAdd.classList.remove('hidden');
    });
}

if (btnCancel && modalAdd) {
    btnCancel.addEventListener('click', () => {
        modalAdd.classList.add('hidden');
        if (albumForm) albumForm.reset();
        spotifySelectedCoverBase64 = null;
    });
}

// ── GUARDAR ───────────────────────────────────────────────────────────────
if (albumForm) {
    albumForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const title              = document.getElementById('title').value.trim();
        const artist             = document.getElementById('artist').value.trim();
        const featuredArtistsRaw = document.getElementById('featured-artists').value.trim();
        const featuredArtists    = featuredArtistsRaw !== ''
            ? featuredArtistsRaw.split(',').map(a => a.trim()).filter(a => a !== '')
            : [];
        const year       = document.getElementById('year').value;
        const typeElement = document.getElementById('album-type');
        const type       = typeElement ? typeElement.value : "";
        const genres     = getSelectedGenres();
        const reviewDate = document.getElementById('review-date')?.value || '';
        const fileInput  = document.getElementById('cover');
        const file       = fileInput.files[0];

        let albumToSave = editingAlbumId
            ? await getAlbumByIdFromDB(editingAlbumId)
            : { id: Date.now(), tracks: spotifySelectedTracks ? [...spotifySelectedTracks] : [], rating: 0 };

        albumToSave.title           = title;
        albumToSave.artist          = artist;
        albumToSave.featuredArtists = featuredArtists;
        albumToSave.year            = parseInt(year) || 0;
        albumToSave.type            = type;
        albumToSave.genres          = genres;
        if (reviewDate) albumToSave.reviewDate = reviewDate;

        if (file) {
            try {
                albumToSave.coverBase64 = await resizeImageToDataURL(file, IMAGE_SIZES.cover);
            } catch (err) {
                await brAlert('No se pudo leer la imagen de la portada. Prueba con otro archivo.', 'Error');
                return;
            }
            await finalizeSave(albumToSave);
        } else if (spotifySelectedCoverBase64) {
            // Portada elegida desde las sugerencias de Spotify (ver sección "SPOTIFY")
            albumToSave.coverBase64 = spotifySelectedCoverBase64;
            await finalizeSave(albumToSave);
        } else {
            await finalizeSave(albumToSave);
        }
    });
}

async function finalizeSave(album) {
    try {
        await saveAlbumToDB(album);
        if (albumForm) albumForm.reset();
        modalAdd.classList.add('hidden');
        spotifySelectedCoverBase64 = null;
        spotifySelectedTracks = null;
        await processAndRenderAlbums();
    } catch (error) {
        await brAlert("Error al guardar: " + error, "Error");
    }
}

// ── ARTISTAS LINKS ────────────────────────────────────────────────────────
function getArtistLinks(album) {
    const allArtists = [album.artist, ...(album.featuredArtists || [])].filter(a => a);
    return allArtists.map(artist =>
        `<a href="artist.html?name=${encodeURIComponent(artist)}" style="color:var(--text-muted); text-decoration:none; font-weight:500; cursor:pointer; transition:color 0.2s;" onmouseover="this.style.color='var(--accent-red)'" onmouseout="this.style.color='var(--text-muted)'">${esc(artist)}</a>`
    ).join(' ft. ');
}

// ── FILTRAR Y DIBUJAR ─────────────────────────────────────────────────────
async function processAndRenderAlbums() {
    try {
        const grid = document.getElementById('album-grid');
        if (!grid) return;

        let currentAlbums = await getAllAlbumsFromDB();
        if (!currentAlbums || !Array.isArray(currentAlbums)) currentAlbums = [];

        let filteredAlbums = [...currentAlbums];

        // Actualizar contadores de los botones de tipo
        const albumCount  = currentAlbums.filter(a => a.type !== 'Single' && a.type !== 'EP').length;
        const singleCount = currentAlbums.filter(a => a.type === 'Single').length;
        const epCount     = currentAlbums.filter(a => a.type === 'EP').length;
        const countAlbumEl  = document.getElementById('count-album');
        const countSingleEl = document.getElementById('count-single');
        const countEpEl     = document.getElementById('count-ep');
        if (countAlbumEl)  countAlbumEl.textContent  = albumCount;
        if (countSingleEl) countSingleEl.textContent  = singleCount;
        if (countEpEl)     countEpEl.textContent      = epCount;

        // Filtro por tipo
        if (typeFilter === 'album') {
            filteredAlbums = filteredAlbums.filter(a => a.type !== 'Single' && a.type !== 'EP');
        } else if (typeFilter === 'Single') {
            filteredAlbums = filteredAlbums.filter(a => a.type === 'Single');
        } else if (typeFilter === 'EP') {
            filteredAlbums = filteredAlbums.filter(a => a.type === 'EP');
        }

        // Filtro por texto
        const filterInput = document.getElementById('filter-input');
        if (filterInput && filterInput.value) {
            const query = filterInput.value.toLowerCase().trim();
            if (query !== "") {
                filteredAlbums = filteredAlbums.filter(a => {
                    const artistMatch   = a.artist && a.artist.toLowerCase().includes(query);
                    const titleMatch    = a.title && a.title.toLowerCase().includes(query);
                    const yearMatch     = a.year && a.year.toString().includes(query);
                    const featuredMatch = a.featuredArtists && a.featuredArtists.some(f => f.toLowerCase().includes(query));
                    return artistMatch || titleMatch || yearMatch || featuredMatch;
                });
            }
        }

        // Filtro por género
        const genreFilter = document.getElementById('genre-filter');
        if (genreFilter && genreFilter.value !== '') {
            filteredAlbums = filteredAlbums.filter(a =>
                a.genres && a.genres.includes(genreFilter.value)
            );
        }

        // Ordenación
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect && sortSelect.value && sortSelect.value !== 'default') {
            const sortMethod = sortSelect.value;
            filteredAlbums.sort((a, b) => {
                if (sortMethod === 'rating-desc') return b.rating - a.rating;
                if (sortMethod === 'rating-asc')  return a.rating - b.rating;
                if (sortMethod === 'year-desc')   return b.year - a.year;
                if (sortMethod === 'year-asc')    return a.year - b.year;
                if (sortMethod === 'title-asc')   return (a.title || "").localeCompare(b.title || "");
                if (sortMethod === 'artist-asc')  return (a.artist || "").localeCompare(b.artist || "");
                return 0;
            });
        } else {
            filteredAlbums.sort((a, b) => b.id - a.id);
        }

        renderAlbums(filteredAlbums, grid);
    } catch (error) {
        console.error("Error crítico al procesar álbumes:", error);
    }
}

function renderAlbums(albumsToRender, gridElement) {
    gridElement.innerHTML = '';
    if (albumsToRender.length === 0) {
        gridElement.innerHTML = '<p style="color: var(--text-muted); grid-column: 1 / -1; margin-top: 20px;">No se encontraron álbumes.</p>';
        return;
    }

    albumsToRender.forEach(album => {
        const card = document.createElement('div');
        card.classList.add('album-card');
        card.title = `${album.title || 'Sin Título'} · ${album.artist || ''}`;
        card.onclick = () => window.location.href = `album.html?id=${album.id}`;

        const badgeColor   = typeof getColorByRating === 'function' ? getColorByRating(album.rating) : '#b3b3b3';
        const tagHtml      = (album.type && album.type !== "") ? `<div class="album-tag">${album.type}</div>` : '';
        const isFav        = album.favorite || false;
        const genresHtml   = (album.genres && album.genres.length > 0)
            ? `<div class="card-genres">${album.genres.map(g => `<span class="card-genre-tag">${esc(g)}</span>`).join('')}</div>`
            : '';
        let displayRating = "-";
        if (album.tracks && album.tracks.length > 0) {
            displayRating = typeof formatRating === 'function' ? formatRating(album.rating) : album.rating;
        }
        const artistLinks = getArtistLinks(album);

        card.innerHTML = `
            <div class="card-actions">
                <button class="action-btn btn-edit" onclick="editAlbum(event, ${album.id})" title="Editar">✎</button>
                <button class="action-btn btn-delete" onclick="deleteAlbum(event, ${album.id})" title="Borrar">✖</button>
                <button class="action-btn" onclick="addAlbumToCollection(event, ${album.id})" title="Añadir a colección" style="background:rgba(100,100,100,0.8); font-size:0.7rem;">+C</button>
            </div>
            <button class="card-fav-btn${isFav ? ' active' : ''}" data-id="${album.id}" onclick="toggleAlbumFavoriteCard(event, ${album.id})" title="${isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}">${heartSVG()}</button>
            <div class="cover-container">
                ${album.coverBase64
                    ? `<img src="${album.coverBase64}" alt="${esc(album.title || 'Álbum')}" loading="lazy" onerror="this.style.display='none'; this.parentElement.classList.add('no-cover')">`
                    : `<div class="cover-placeholder">🎵</div>`
                }
            </div>
            <span class="card-mini-badge" style="background-color: ${badgeColor};">${displayRating}</span>
            <div class="album-info">
                <div class="title-row">
                    <h3>${esc(album.title || 'Sin Título')}</h3>
                    <span class="rating-badge" style="background-color: ${badgeColor};">${displayRating}</span>
                </div>
                <p>${artistLinks} • ${album.year || 'N/A'}</p>
                ${tagHtml}
                ${genresHtml}
            </div>
        `;
        gridElement.appendChild(card);
    });
}

async function populateGenreFilter() {
    const genreFilter = document.getElementById('genre-filter');
    if (!genreFilter) return;
    const albums = await getAllAlbumsFromDB();
    const allGenres = new Set();
    albums.forEach(a => { if (a.genres) a.genres.forEach(g => allGenres.add(g)); });
    genreFilter.innerHTML = '<option value="">Todos los géneros</option>';
    [...allGenres].sort().forEach(genre => {
        const opt = document.createElement('option');
        opt.value = genre;
        opt.textContent = genre;
        genreFilter.appendChild(opt);
    });
}

// ── EVENTOS ───────────────────────────────────────────────────────────────
// Pestaña y orden iniciales: Ajustes → Orden por defecto
let typeFilter = setting('defaults.musicType', 'album'); // 'album' | 'Single' | 'EP' | '' (todos)
document.querySelectorAll('.type-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.type === typeFilter));
if (document.getElementById('sort-select')) document.getElementById('sort-select').value = setting('defaults.musicSort', 'default');

const globalFilterInput = document.getElementById('filter-input');
const globalSortSelect  = document.getElementById('sort-select');
const globalGenreFilter = document.getElementById('genre-filter');

if (globalFilterInput) globalFilterInput.addEventListener('input', processAndRenderAlbums);
if (globalSortSelect)  globalSortSelect.addEventListener('change', processAndRenderAlbums);
if (globalGenreFilter) globalGenreFilter.addEventListener('change', processAndRenderAlbums);

document.querySelectorAll('.type-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const t = btn.dataset.type;
        if (typeFilter === t) {
            // Deseleccionar → mostrar todos
            typeFilter = '';
            document.querySelectorAll('.type-filter-btn').forEach(b => b.classList.remove('active'));
        } else {
            typeFilter = t;
            document.querySelectorAll('.type-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }
        processAndRenderAlbums();
    });
});

(async () => {
    await populateGenreFilter();
    await processAndRenderAlbums();
})();



// ── AÑADIR A COLECCIÓN DESDE CARD ─────────────────────────────────────────
window.addAlbumToCollection = async function(event, albumId) {
    event.stopPropagation();
    window.location.href = `collections.html?add=album_${albumId}`;
};

// ═══════════════════════════════════════════════════════════════════════
// SPOTIFY — botón de conexión en el header + sugerencias en el modal
// Depende de spotify-auth.js y spotify-api.js (cargados antes que este archivo).
// No toca saveAlbumToDB ni processAndRenderAlbums: solo rellena el formulario.
// ═══════════════════════════════════════════════════════════════════════

// ── Botón "Conectar Spotify" del header ───────────────────────────────────
function updateSpotifyHeaderButton() {
    const btn = document.getElementById('spotify-connect-btn');
    if (!btn) return;
    const connected = typeof isSpotifyConnected === 'function' && isSpotifyConnected();
    btn.classList.toggle('connected', connected);
    btn.title = connected ? 'Conectado con Spotify' : 'Conectar Spotify';
}

const spotifyConnectBtn = document.getElementById('spotify-connect-btn');
if (spotifyConnectBtn) {
    spotifyConnectBtn.addEventListener('click', async () => {
        const connected = typeof isSpotifyConnected === 'function' && isSpotifyConnected();
        if (connected) {
            const doDisconnect = typeof brConfirm === 'function'
                ? await brConfirm('Se cerrará la conexión con tu cuenta de Spotify en este navegador.', 'Desconectar Spotify')
                : confirm('¿Desconectar Spotify?');
            if (doDisconnect) {
                spotifyLogout();
                updateSpotifyHeaderButton();
                const spotifySuggestionsEl = document.getElementById('spotify-suggestions');
                if (spotifySuggestionsEl) spotifySuggestionsEl.classList.add('hidden');
            }
        } else if (typeof spotifyLogin === 'function') {
            spotifyLogin();
        }
    });
}

// ── Callback OAuth: si la URL trae ?code=..., completar el login ─────────
(async () => {
    if (window.location.search.includes('code=') && typeof handleSpotifyCallback === 'function') {
        await handleSpotifyCallback();
    }
    // Desde Ajustes → Cuenta → Spotify "Conectar" (el login tiene que empezar en esta página)
    const params = new URLSearchParams(window.location.search);
    if (params.get('spotify') === 'connect' && typeof spotifyLogin === 'function'
        && !(typeof isSpotifyConnected === 'function' && isSpotifyConnected())) {
        spotifyLogin();
        return;
    }
    updateSpotifyHeaderButton();
})();

// ── Sugerencias en el modal de añadir álbum ───────────────────────────────

function resetSpotifySuggestions() {
    spotifySelectedCoverBase64 = null;
    spotifySelectedTracks = null;
    spotifyActiveTab = 'liked';
    spotifyTypeFilter = 'album';

    const section = document.getElementById('spotify-suggestions');
    if (!section) return;

    const connected = typeof isSpotifyConnected === 'function' && isSpotifyConnected();
    section.classList.toggle('hidden', !connected);
    if (!connected) return;

    const searchInput = document.getElementById('spotify-search-input');
    if (searchInput) searchInput.value = '';

    document.querySelectorAll('.spotify-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === 'liked');
    });
    document.querySelectorAll('.spotify-type-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.type === 'album');
    });

    loadSpotifySuggestions('liked');
}

document.querySelectorAll('.spotify-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.spotify-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        spotifyActiveTab = tab.dataset.tab;

        const searchInput = document.getElementById('spotify-search-input');
        if (searchInput) searchInput.value = '';

        loadSpotifySuggestions(spotifyActiveTab);
    });
});

document.querySelectorAll('.spotify-type-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.spotify-type-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        spotifyTypeFilter = tab.dataset.type;

        const searchInput = document.getElementById('spotify-search-input');
        if (searchInput && searchInput.value.trim()) {
            // Si hay búsqueda activa, refiltrar sin recargar
            renderSpotifyAlbumGrid(window._spotifyLastResults || [], window._spotifyLastReviewedSet || null);
        } else {
            loadSpotifySuggestions(spotifyActiveTab);
        }
    });
});

function normalizeTitle(t) {
    return (t || '').toLowerCase()
        .replace(/\s*[\(\[](deluxe|bonus|remastered|special|expanded|edition|version|explicit|anniversary|complete)[^\)\]]*[\)\]]/gi, '')
        .replace(/\s*[-–]\s*(deluxe|bonus|remastered|special|expanded|edition|version|explicit)[^\n]*/gi, '')
        .trim();
}

async function loadSpotifySuggestions(kind) {
    const grid = document.getElementById('spotify-suggestions-grid');
    const status = document.getElementById('spotify-suggestions-status');
    if (!grid || !status) return;

    grid.innerHTML = '';
    status.textContent = 'Cargando...';

    try {
        let albums = kind === 'recent'
            ? await getRecentAlbums(50)
            : await getLikedAlbums(50);

        // Filtrar ya reviewados usando título normalizado
        const reviewed = await getAllAlbumsFromDB();
        const reviewedTitles = new Set(reviewed.map(a => normalizeTitle(a.title)));
        albums = albums.filter(a => !reviewedTitles.has(normalizeTitle(a.title)));

        window._spotifyLastResults = albums;
        window._spotifyLastReviewedSet = null;
        renderSpotifyAlbumGrid(albums);
        status.textContent = albums.length === 0 ? 'No hay álbumes nuevos para añadir.' : '';
    } catch (err) {
        console.error('spotify: error al cargar sugerencias:', err);
        status.textContent = 'No se pudieron cargar las sugerencias de Spotify.';
    }
}

function spotifyRelativeTime(isoString) {
    if (!isoString) return '';
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `Hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Hace ${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'Ayer';
    if (days < 7) return `Hace ${days} días`;
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? 'Hace 1 semana' : `Hace ${weeks} semanas`;
}

function renderSpotifyAlbumGrid(albums, reviewedSet = null) {
    const grid = document.getElementById('spotify-suggestions-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // Filtrar por tipo: 'album' → album/compilation; 'single' → single/ep
    const typeFiltered = albums.filter(a => {
        const t = (a.albumType || 'album').toLowerCase();
        if (spotifyTypeFilter === 'single') return t === 'single' || t === 'ep';
        return t === 'album' || t === 'compilation';
    });

    if (typeFiltered.length === 0) {
        const status = document.getElementById('spotify-suggestions-status');
        if (status) status.textContent = 'No hay resultados para este filtro.';
        return;
    }

    typeFiltered.slice(0, 18).forEach(album => {
        const alreadyAdded = reviewedSet ? reviewedSet.has(normalizeTitle(album.title)) : false;
        const item = document.createElement('div');
        item.className = 'spotify-suggestion-item' + (alreadyAdded ? ' spotify-already-added' : '');
        let statHtml = '';
        if (alreadyAdded) {
            statHtml = `<div class="spotify-suggestion-stat spotify-added-badge">Ya añadido</div>`;
        } else if (album.playedAt) {
            statHtml = `<div class="spotify-suggestion-stat">${spotifyRelativeTime(album.playedAt)}</div>`;
        }
        item.innerHTML = `
            <img class="spotify-suggestion-cover" src="${album.coverUrl}" alt="${esc(album.title || '')}" loading="lazy">
            <div class="spotify-suggestion-title">${esc(album.title || 'Sin título')}</div>
            <div class="spotify-suggestion-artist">${esc(album.artist || '')}</div>
            ${statHtml}
        `;
        item.addEventListener('click', () => selectSpotifyAlbum(album, item));
        grid.appendChild(item);
    });
}

async function selectSpotifyAlbum(album, itemEl) {
    const status = document.getElementById('spotify-suggestions-status');

    document.querySelectorAll('.spotify-suggestion-item').forEach(el => el.classList.remove('selected'));
    if (itemEl) itemEl.classList.add('selected');

    // Rellenar campos básicos
    const titleEl  = document.getElementById('title');
    const artistEl = document.getElementById('artist');
    const yearEl   = document.getElementById('year');
    if (titleEl)  titleEl.value  = album.title || '';
    if (artistEl) artistEl.value = album.artist || '';
    if (yearEl && album.year) yearEl.value = album.year;

    // Fecha de review = hoy
    const reviewDateEl = document.getElementById('review-date');
    if (reviewDateEl) reviewDateEl.value = localDateStr();

    // Limpiar portada local para que use la de Spotify
    const coverInput = document.getElementById('cover');
    if (coverInput) { coverInput.value = ''; coverInput.removeAttribute('required'); }

    if (status) status.textContent = 'Cargando géneros, canciones y portada...';

    // Lanzar las tres peticiones en paralelo
    const [, genres, tracks] = await Promise.allSettled([
        // 1. Portada
        album.coverUrl
            ? spotifyFetchImageAsBase64(album.coverUrl)
                .then(b64 => { spotifySelectedCoverBase64 = b64; })
                .catch(() => { spotifySelectedCoverBase64 = null; if (coverInput) coverInput.setAttribute('required', 'true'); })
            : Promise.resolve(),
        // 2. Géneros del artista
        (typeof getArtistGenres === 'function' && album.artistId)
            ? getArtistGenres(album.artistId)
            : Promise.resolve([]),
        // 3. Canciones del álbum
        (typeof getAlbumTracks === 'function' && album.spotifyId)
            ? getAlbumTracks(album.spotifyId)
            : Promise.resolve([])
    ]);

    // Aplicar géneros
    const spotifyGenres = (genres.status === 'fulfilled' && genres.value) ? genres.value : [];
    if (spotifyGenres.length > 0) {
        const mapped = spotifyMapGenresToBitRevs(spotifyGenres);
        renderGenreSelector(mapped);
    }

    // Guardar tracks para cuando se guarde el álbum
    spotifySelectedTracks = (tracks.status === 'fulfilled' && tracks.value?.length > 0)
        ? tracks.value
        : null;

    if (status) status.textContent = spotifySelectedCoverBase64
        ? `"${album.title || ''}" lista para guardar (${spotifySelectedTracks?.length || 0} canciones importadas).`
        : `Portada no disponible, súbela manualmente.`;
}

function spotifyFetchImageAsBase64(url) {
    return fetch(url)
        .then(res => res.blob())
        .then(blob => resizeImageToDataURL(blob, IMAGE_SIZES.cover));
}

// Si el usuario elige un archivo local manualmente, tiene prioridad sobre
// la portada de Spotify seleccionada previamente.
const spotifyCoverInputEl = document.getElementById('cover');
if (spotifyCoverInputEl) {
    spotifyCoverInputEl.addEventListener('change', () => {
        if (spotifyCoverInputEl.files && spotifyCoverInputEl.files[0]) {
            spotifySelectedCoverBase64 = null;
            document.querySelectorAll('.spotify-suggestion-item').forEach(el => el.classList.remove('selected'));
        }
    });
}

// ── Buscador de Spotify (debounce 400ms) ──────────────────────────────────
const spotifySearchInputEl = document.getElementById('spotify-search-input');
if (spotifySearchInputEl) {
    spotifySearchInputEl.addEventListener('input', () => {
        clearTimeout(spotifySearchDebounceTimer);
        const query = spotifySearchInputEl.value.trim();

        spotifySearchDebounceTimer = setTimeout(async () => {
            if (query === '') {
                loadSpotifySuggestions(spotifyActiveTab);
                return;
            }

            const status = document.getElementById('spotify-suggestions-status');
            if (status) status.textContent = 'Buscando...';

            try {
                const [results, reviewed] = await Promise.all([
                    searchSpotifyAlbum(query),
                    getAllAlbumsFromDB()
                ]);
                const reviewedSet = new Set(reviewed.map(a => normalizeTitle(a.title)));
                window._spotifyLastResults = results;
                window._spotifyLastReviewedSet = reviewedSet;
                renderSpotifyAlbumGrid(results, reviewedSet);
                if (status) status.textContent = results.length === 0 ? 'Sin resultados.' : '';
            } catch (err) {
                console.error('spotify: error en la búsqueda:', err);
                if (status) status.textContent = 'Error al buscar en Spotify.';
            }
        }, 400);
    });
}
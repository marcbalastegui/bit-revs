// script.js - Lógica principal de Álbumes

const btnAddAlbum = document.getElementById('btn-add-album');
const modalAdd = document.getElementById('modal-add');
const btnCancel = document.getElementById('btn-cancel');
const albumForm = document.getElementById('album-form');
let editingAlbumId = null;

// ── GÉNEROS PREDEFINIDOS ──────────────────────────────────────────────────
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

window.toggleAlbumFavoriteCard = async function(event, id) {
    event.stopPropagation();
    const album = await getAlbumByIdFromDB(id);
    if (!album) return;
    album.favorite = !album.favorite;
    await saveAlbumToDB(album);
    const btn = document.querySelector(`.card-fav-btn[data-id="${id}"]`);
    if (btn) btn.classList.toggle('active', album.favorite);
}

window.deleteAlbum = async function(event, id) {
    event.stopPropagation();
    if (confirm("¿Estás seguro de que quieres borrar este álbum?")) {
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
    if (document.getElementById('album-type')) document.getElementById('album-type').value = album.type;

    const genres = album.genres || [];
    const customGenres = genres.filter(g => !GENRES_PREDEFINED.includes(g));
    renderGenreSelector(genres);
    const customInput = document.getElementById('genre-custom');
    if (customInput) customInput.value = customGenres.join(', ');

    document.querySelector('#modal-add .modal-content h2').textContent = "Editar Álbum";
    document.getElementById('cover').removeAttribute('required');
    const reviewDateEl = document.getElementById('review-date');
    if (reviewDateEl) reviewDateEl.value = album.reviewDate || '';
    modalAdd.classList.remove('hidden');
};

if (btnAddAlbum && modalAdd) {
    btnAddAlbum.addEventListener('click', () => {
        editingAlbumId = null;
        document.querySelector('#modal-add .modal-content h2').textContent = "Nueva Reseña de Álbum";
        document.getElementById('cover').setAttribute('required', 'true');
        if (albumForm) albumForm.reset();
        renderGenreSelector([]);
        document.getElementById('genre-custom').value = '';
        document.getElementById('featured-artists').value = '';
        const rdEl = document.getElementById('review-date');
        if (rdEl) rdEl.value = '';
        modalAdd.classList.remove('hidden');
    });
}

if (btnCancel && modalAdd) {
    btnCancel.addEventListener('click', () => {
        modalAdd.classList.add('hidden');
        if (albumForm) albumForm.reset();
    });
}

if (albumForm) {
    albumForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const title = document.getElementById('title').value.trim();
        const artist = document.getElementById('artist').value.trim();
        const featuredArtistsRaw = document.getElementById('featured-artists').value.trim();
        const featuredArtists = featuredArtistsRaw !== ''
            ? featuredArtistsRaw.split(',').map(a => a.trim()).filter(a => a !== '')
            : [];
        const year = document.getElementById('year').value;
        const typeElement = document.getElementById('album-type');
        const type = typeElement ? typeElement.value : "";
        const genres = getSelectedGenres();
        const reviewDate = document.getElementById('review-date')?.value || '';
        const fileInput = document.getElementById('cover');
        const file = fileInput.files[0];

        let albumToSave = null;
        if (editingAlbumId) {
            albumToSave = await getAlbumByIdFromDB(editingAlbumId);
        } else {
            albumToSave = { id: Date.now(), tracks: [], rating: 0 };
        }

        albumToSave.title = title;
        albumToSave.artist = artist;
        albumToSave.featuredArtists = featuredArtists;
        albumToSave.year = parseInt(year) || 0;
        albumToSave.type = type;
        albumToSave.genres = genres;
        if (reviewDate) albumToSave.reviewDate = reviewDate;

        if (file) {
            const reader = new FileReader();
            reader.onload = async function(event) {
                albumToSave.coverBase64 = event.target.result;
                await finalizeSave(albumToSave);
            };
            reader.readAsDataURL(file);
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
        await processAndRenderAlbums();
    } catch (error) {
        alert("Error al guardar: " + error);
    }
}

function getArtistLinks(album) {
    const allArtists = [album.artist, ...(album.featuredArtists || [])].filter(a => a);
    return allArtists.map(artist =>
        `<a href="artist.html?name=${encodeURIComponent(artist)}" style="color:var(--text-muted); text-decoration:none; font-weight:500; cursor:pointer; transition:color 0.2s;" onmouseover="this.style.color='var(--accent-red)'" onmouseout="this.style.color='var(--text-muted)'">${artist}</a>`
    ).join(' ft. ');
}

async function processAndRenderAlbums() {
    try {
        const grid = document.getElementById('album-grid');
        if (!grid) return;

        let currentAlbums = await getAllAlbumsFromDB();
        if (!currentAlbums || !Array.isArray(currentAlbums)) currentAlbums = [];

        let filteredAlbums = [...currentAlbums];

        const filterInput = document.getElementById('filter-input');
        if (filterInput && filterInput.value) {
            const query = filterInput.value.toLowerCase().trim();
            if (query !== "") {
                filteredAlbums = filteredAlbums.filter(a => {
                    const artistMatch = a.artist && a.artist.toLowerCase().includes(query);
                    const titleMatch = a.title && a.title.toLowerCase().includes(query);
                    const yearMatch = a.year && a.year.toString().includes(query);
                    const featuredMatch = a.featuredArtists && a.featuredArtists.some(f => f.toLowerCase().includes(query));
                    return artistMatch || titleMatch || yearMatch || featuredMatch;
                });
            }
        }

        const genreFilter = document.getElementById('genre-filter');
        if (genreFilter && genreFilter.value !== '') {
            filteredAlbums = filteredAlbums.filter(a =>
                a.genres && a.genres.includes(genreFilter.value)
            );
        }

        const sortSelect = document.getElementById('sort-select');
        if (sortSelect && sortSelect.value && sortSelect.value !== 'default') {
            const sortMethod = sortSelect.value;
            filteredAlbums.sort((a, b) => {
                if (sortMethod === 'rating-desc') return b.rating - a.rating;
                if (sortMethod === 'rating-asc') return a.rating - b.rating;
                if (sortMethod === 'year-desc') return b.year - a.year;
                if (sortMethod === 'year-asc') return a.year - b.year;
                if (sortMethod === 'title-asc') return (a.title || "").localeCompare(b.title || "");
                if (sortMethod === 'artist-asc') return (a.artist || "").localeCompare(b.artist || "");
                return 0;
            });
        } else {
            // Orden por defecto: más recientes primero (mayor id = más reciente)
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
        card.onclick = () => window.location.href = `album.html?id=${album.id}`;

        const badgeColor = typeof getColorByRating === 'function' ? getColorByRating(album.rating) : '#b3b3b3';
        const tagHtml = (album.type && album.type !== "") ? `<div class="album-tag">${album.type}</div>` : '';
        const isFav = album.favorite || false;

        const genresHtml = (album.genres && album.genres.length > 0)
            ? `<div class="card-genres">${album.genres.map(g => `<span class="card-genre-tag">${g}</span>`).join('')}</div>`
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
            </div>
            <button class="card-fav-btn${isFav ? ' active' : ''}" data-id="${album.id}" onclick="toggleAlbumFavoriteCard(event, ${album.id})" title="${isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}">${heartSVG()}</button>
            <div class="cover-container">
                <img src="${album.coverBase64}" alt="${album.title || 'Álbum'}">
            </div>
            <div class="album-info">
                <div class="title-row">
                    <h3>${album.title || 'Sin Título'}</h3>
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

const globalFilterInput = document.getElementById('filter-input');
const globalSortSelect = document.getElementById('sort-select');
const globalGenreFilter = document.getElementById('genre-filter');

if (globalFilterInput) globalFilterInput.addEventListener('input', processAndRenderAlbums);
if (globalSortSelect) globalSortSelect.addEventListener('change', processAndRenderAlbums);
if (globalGenreFilter) globalGenreFilter.addEventListener('change', processAndRenderAlbums);

(async () => {
    await populateGenreFilter();
    await processAndRenderAlbums();
})();
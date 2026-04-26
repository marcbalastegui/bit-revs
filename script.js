// script.js - Lógica principal de Álbumes (Edición + Cálculo automático de notas)

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

// Renderiza los chips de género en el modal
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
        chip.addEventListener('click', () => {
            chip.classList.toggle('selected');
        });
        container.appendChild(chip);
    });
}

// Recoge los géneros seleccionados (chips + custom)
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

// BORRAR ÁLBUM
window.deleteAlbum = async function(event, id) {
    event.stopPropagation();
    if (confirm("¿Estás seguro de que quieres borrar este álbum?")) {
        await deleteAlbumFromDB(id);
        processAndRenderAlbums();
    }
};

// EDITAR ÁLBUM
window.editAlbum = async function(event, id) {
    event.stopPropagation();
    const album = await getAlbumByIdFromDB(id);
    if (!album) return;

    editingAlbumId = album.id;
    document.getElementById('title').value = album.title;
    document.getElementById('artist').value = album.artist;
    document.getElementById('year').value = album.year;
    if (document.getElementById('album-type')) document.getElementById('album-type').value = album.type;

    // Géneros: separamos predefinidos de customs
    const genres = album.genres || [];
    const customGenres = genres.filter(g => !GENRES_PREDEFINED.includes(g));
    renderGenreSelector(genres);
    const customInput = document.getElementById('genre-custom');
    if (customInput) customInput.value = customGenres.join(', ');

    document.querySelector('#modal-add .modal-content h2').textContent = "Editar Álbum";
    document.getElementById('cover').removeAttribute('required');
    modalAdd.classList.remove('hidden');
};

// ABRIR MODAL NUEVO
if (btnAddAlbum && modalAdd) {
    btnAddAlbum.addEventListener('click', () => {
        editingAlbumId = null;
        document.querySelector('#modal-add .modal-content h2').textContent = "Nueva Reseña de Álbum";
        document.getElementById('cover').setAttribute('required', 'true');
        if (albumForm) albumForm.reset();
        renderGenreSelector([]);
        const customInput = document.getElementById('genre-custom');
        if (customInput) customInput.value = '';
        modalAdd.classList.remove('hidden');
    });
}

if (btnCancel && modalAdd) {
    btnCancel.addEventListener('click', () => {
        modalAdd.classList.add('hidden');
        if (albumForm) albumForm.reset();
    });
}

// GUARDAR (CREAR O EDITAR)
if (albumForm) {
    albumForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const title = document.getElementById('title').value;
        const artist = document.getElementById('artist').value;
        const year = document.getElementById('year').value;
        const typeElement = document.getElementById('album-type');
        const type = typeElement ? typeElement.value : "";
        const genres = getSelectedGenres();

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
        albumToSave.year = parseInt(year) || 0;
        albumToSave.type = type;
        albumToSave.genres = genres;

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

// FILTRAR Y DIBUJAR
async function processAndRenderAlbums() {
    try {
        const grid = document.getElementById('album-grid');
        if (!grid) return;

        let currentAlbums = await getAllAlbumsFromDB();
        if (!currentAlbums || !Array.isArray(currentAlbums)) currentAlbums = [];

        let filteredAlbums = [...currentAlbums];

        // Filtro por texto
        const filterInput = document.getElementById('filter-input');
        if (filterInput && filterInput.value) {
            const query = filterInput.value.toLowerCase().trim();
            if (query !== "") {
                filteredAlbums = filteredAlbums.filter(a =>
                    (a.artist && a.artist.toLowerCase().includes(query)) ||
                    (a.title && a.title.toLowerCase().includes(query)) ||
                    (a.year && a.year.toString().includes(query))
                );
            }
        }

        // Filtro por género
        const genreFilter = document.getElementById('genre-filter');
        if (genreFilter && genreFilter.value !== '') {
            const selectedGenre = genreFilter.value;
            filteredAlbums = filteredAlbums.filter(a =>
                a.genres && a.genres.includes(selectedGenre)
            );
        }

        // Ordenación
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

        // Géneros como chips pequeños en la card
        const genresHtml = (album.genres && album.genres.length > 0)
            ? `<div class="card-genres">${album.genres.map(g => `<span class="card-genre-tag">${g}</span>`).join('')}</div>`
            : '';

        let displayRating = "-";
        if (album.tracks && album.tracks.length > 0) {
            displayRating = typeof formatRating === 'function' ? formatRating(album.rating) : album.rating;
        }

        card.innerHTML = `
            <div class="card-actions">
                <button class="action-btn btn-edit" onclick="editAlbum(event, ${album.id})" title="Editar">✎</button>
                <button class="action-btn btn-delete" onclick="deleteAlbum(event, ${album.id})" title="Borrar">✖</button>
            </div>
            <div class="cover-container">
                <img src="${album.coverBase64}" alt="${album.title || 'Álbum'}">
            </div>
            <div class="album-info">
                <div class="title-row">
                    <h3>${album.title || 'Sin Título'}</h3>
                    <span class="rating-badge" style="background-color: ${badgeColor};">${displayRating}</span>
                </div>
                <p>${album.artist || 'Artista Desconocido'} • ${album.year || 'N/A'}</p>
                ${tagHtml}
                ${genresHtml}
            </div>
        `;
        gridElement.appendChild(card);
    });
}

// Poblar el select de filtro por género con los géneros que realmente existen
async function populateGenreFilter() {
    const genreFilter = document.getElementById('genre-filter');
    if (!genreFilter) return;

    const albums = await getAllAlbumsFromDB();
    const allGenres = new Set();
    albums.forEach(a => { if (a.genres) a.genres.forEach(g => allGenres.add(g)); });

    // Limpiamos opciones excepto la primera
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

// Init
(async () => {
    await populateGenreFilter();
    await processAndRenderAlbums();
})();
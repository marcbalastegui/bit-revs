// script.js - Lógica principal de Álbumes

const btnAddAlbum = document.getElementById('btn-add-album');
const modalAdd = document.getElementById('modal-add');
const btnCancel = document.getElementById('btn-cancel');
const albumForm = document.getElementById('album-form');
let editingAlbumId = null;

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
        customInput.value.split(',').map(g => g.trim()).filter(g => g !== '').forEach(g => {
            if (!selected.includes(g)) selected.push(g);
        });
    }
    return selected;
}

window.deleteAlbum = async function(event, id) {
    event.stopPropagation();
    if (confirm("¿Borrar este álbum?")) {
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
    document.getElementById('year').value = album.year;
    if (document.getElementById('album-type')) document.getElementById('album-type').value = album.type || '';
    const genres = album.genres || [];
    const customGenres = genres.filter(g => !GENRES_PREDEFINED.includes(g));
    renderGenreSelector(genres);
    document.getElementById('genre-custom').value = customGenres.join(', ');
    document.querySelector('#modal-add .modal-content h2').textContent = "Editar Álbum";
    document.getElementById('cover').removeAttribute('required');
    modalAdd.classList.remove('hidden');
};

if (btnAddAlbum) {
    btnAddAlbum.addEventListener('click', () => {
        editingAlbumId = null;
        albumForm.reset();
        document.querySelector('#modal-add .modal-content h2').textContent = "Nueva Reseña de Álbum";
        document.getElementById('cover').setAttribute('required', 'true');
        renderGenreSelector([]);
        document.getElementById('genre-custom').value = '';
        modalAdd.classList.remove('hidden');
    });
}

if (btnCancel) btnCancel.addEventListener('click', () => modalAdd.classList.add('hidden'));

albumForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const title = document.getElementById('title').value;
    const artist = document.getElementById('artist').value;
    const year = document.getElementById('year').value;
    const type = document.getElementById('album-type') ? document.getElementById('album-type').value : '';
    const genres = getSelectedGenres();
    const fileInput = document.getElementById('cover');
    const file = fileInput.files[0];

    let albumToSave = editingAlbumId ? await getAlbumByIdFromDB(editingAlbumId) : { id: Date.now(), tracks: [], rating: 0 };
    albumToSave.title = title;
    albumToSave.artist = artist;
    albumToSave.year = parseInt(year) || 0;
    albumToSave.type = type;
    albumToSave.genres = genres;

    if (file) {
        const reader = new FileReader();
        reader.onload = async (ev) => {
            albumToSave.coverBase64 = ev.target.result;
            await saveAlbumToDB(albumToSave);
            modalAdd.classList.add('hidden');
            albumForm.reset();
            processAndRenderAlbums();
        };
        reader.readAsDataURL(file);
    } else {
        await saveAlbumToDB(albumToSave);
        modalAdd.classList.add('hidden');
        albumForm.reset();
        processAndRenderAlbums();
    }
});

async function processAndRenderAlbums() {
    try {
        const grid = document.getElementById('album-grid');
        if (!grid) return;
        let currentAlbums = await getAllAlbumsFromDB() || [];
        const filterInput = document.getElementById('filter-input');
        const genreFilter = document.getElementById('genre-filter');
        const sortSelect = document.getElementById('sort-select');

        if (filterInput && filterInput.value) {
            const query = filterInput.value.toLowerCase().trim();
            currentAlbums = currentAlbums.filter(a =>
                (a.artist && a.artist.toLowerCase().includes(query)) ||
                (a.title && a.title.toLowerCase().includes(query)) ||
                (a.year && a.year.toString().includes(query))
            );
        }
        if (genreFilter && genreFilter.value) {
            currentAlbums = currentAlbums.filter(a => a.genres && a.genres.includes(genreFilter.value));
        }
        if (sortSelect && sortSelect.value !== 'default') {
            currentAlbums.sort((a, b) => {
                switch (sortSelect.value) {
                    case 'rating-desc': return b.rating - a.rating;
                    case 'rating-asc': return a.rating - b.rating;
                    case 'year-desc': return b.year - a.year;
                    case 'year-asc': return a.year - b.year;
                    case 'title-asc': return (a.title || '').localeCompare(b.title || '');
                    case 'artist-asc': return (a.artist || '').localeCompare(b.artist || '');
                    default: return 0;
                }
            });
        }

        grid.innerHTML = '';
        if (currentAlbums.length === 0) {
            grid.innerHTML = '<p style="color:var(--text-muted); grid-column:1/-1; margin-top:20px;">No se encontraron álbumes.</p>';
            return;
        }
        currentAlbums.forEach(album => {
            const badgeColor = getColorByRating(album.rating);
            const tagHtml = album.type ? `<div class="album-tag">${album.type}</div>` : '';
            const genresHtml = album.genres && album.genres.length
                ? `<div class="card-genres">${album.genres.map(g => `<span class="card-genre-tag">${g}</span>`).join('')}</div>`
                : '';
            let displayRating = "-";
            if (album.tracks && album.tracks.length > 0) displayRating = formatRating(album.rating);
            const card = document.createElement('div');
            card.className = 'album-card';
            card.onclick = () => window.location.href = `album.html?id=${album.id}`;
            card.innerHTML = `
                <div class="card-actions">
                    <button class="action-btn btn-edit" onclick="editAlbum(event, ${album.id})">✎</button>
                    <button class="action-btn btn-delete" onclick="deleteAlbum(event, ${album.id})">✖</button>
                </div>
                <div class="cover-container"><img src="${album.coverBase64}" alt="${album.title}"></div>
                <div class="album-info">
                    <div class="title-row">
                        <h3>${album.title}</h3>
                        <span class="rating-badge" style="background-color:${badgeColor};">${displayRating}</span>
                    </div>
                    <p>${album.artist} • ${album.year}</p>
                    ${tagHtml}
                    ${genresHtml}
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (error) {
        console.error(error);
        document.getElementById('album-grid').innerHTML = '<p style="color:red;">Error al cargar álbumes. Revisa la consola.</p>';
    }
}

// Inicializar
(async () => {
    // Poblar género filter
    const genreFilter = document.getElementById('genre-filter');
    if (genreFilter) {
        const albums = await getAllAlbumsFromDB() || [];
        const allGenres = new Set();
        albums.forEach(a => { if (a.genres) a.genres.forEach(g => allGenres.add(g)); });
        genreFilter.innerHTML = '<option value="">Todos los géneros</option>';
        [...allGenres].sort().forEach(g => genreFilter.appendChild(new Option(g, g)));
    }
    await processAndRenderAlbums();

    // Listeners para filtros
    document.getElementById('filter-input')?.addEventListener('input', processAndRenderAlbums);
    document.getElementById('sort-select')?.addEventListener('change', processAndRenderAlbums);
    genreFilter?.addEventListener('change', processAndRenderAlbums);
})();
// script.js - Lógica principal de Álbumes (Edición + Cálculo automático de notas)

const btnAddAlbum = document.getElementById('btn-add-album');
const modalAdd = document.getElementById('modal-add');
const btnCancel = document.getElementById('btn-cancel');
const albumForm = document.getElementById('album-form');
let editingAlbumId = null;

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
    if(document.getElementById('album-type')) document.getElementById('album-type').value = album.type;

    // Cambiamos el título del modal y quitamos la obligación de subir foto nueva
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

        const fileInput = document.getElementById('cover');
        const file = fileInput.files[0];

        // Rescatamos los datos antiguos si estamos editando (para no perder las canciones)
        let albumToSave = null;
        if (editingAlbumId) {
            albumToSave = await getAlbumByIdFromDB(editingAlbumId);
        } else {
            albumToSave = { id: Date.now(), tracks: [], rating: 0 }; // Nota inicial 0
        }

        albumToSave.title = title;
        albumToSave.artist = artist;
        albumToSave.year = parseInt(year) || 0;
        albumToSave.type = type;

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
        if(albumForm) albumForm.reset();
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

        // Formatear nota: Si hay canciones se muestra calculada y sin el .0 (Ej: 10 en lugar de 10.0)
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
            </div>
        `;
        gridElement.appendChild(card);
    });
}

const globalFilterInput = document.getElementById('filter-input');
const globalSortSelect = document.getElementById('sort-select');

if (globalFilterInput) globalFilterInput.addEventListener('input', processAndRenderAlbums);
if (globalSortSelect) globalSortSelect.addEventListener('change', processAndRenderAlbums);

processAndRenderAlbums();
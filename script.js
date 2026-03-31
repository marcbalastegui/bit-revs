// script.js - Lógica de Álbumes (Con Edición)

const btnAddAlbum = document.getElementById('btn-add-album');
const modalAdd = document.getElementById('modal-add');
const btnCancel = document.getElementById('btn-cancel');
const albumForm = document.getElementById('album-form');
let editingAlbumId = null; // Variable para saber si estamos editando o creando

// Borrar Álbum
window.deleteAlbum = async function(event, id) {
    event.stopPropagation();
    if (confirm("¿Borrar este álbum definitivamente?")) {
        await deleteAlbumFromDB(id);
        processAndRenderAlbums();
    }
};

// Editar Álbum (NUEVO)
window.editAlbum = async function(event, id) {
    event.stopPropagation();
    const album = await getAlbumByIdFromDB(id);
    if (!album) return;

    editingAlbumId = album.id;
    document.getElementById('title').value = album.title;
    document.getElementById('artist').value = album.artist;
    document.getElementById('year').value = album.year;
    if(document.getElementById('album-type')) document.getElementById('album-type').value = album.type;
    document.getElementById('rating').value = album.rating;

    // Mostramos el modal
    modalAdd.classList.remove('hidden');
    document.querySelector('#album-form h2').textContent = "Editar Álbum";
    document.getElementById('cover').removeAttribute('required'); // No es obligatorio resubir foto al editar
};

// Mostrar/Ocultar Modal
if (btnAddAlbum) btnAddAlbum.addEventListener('click', () => {
    editingAlbumId = null;
    document.querySelector('#album-form h2').textContent = "Nueva Reseña de Álbum";
    document.getElementById('cover').setAttribute('required', 'true');
    albumForm.reset();
    modalAdd.classList.remove('hidden');
});

if (btnCancel) btnCancel.addEventListener('click', () => {
    modalAdd.classList.add('hidden');
    albumForm.reset();
});

// Procesar Formulario (Crear o Editar)
if (albumForm) {
    albumForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const title = document.getElementById('title').value;
        const artist = document.getElementById('artist').value;
        const year = document.getElementById('year').value;
        const type = document.getElementById('album-type') ? document.getElementById('album-type').value : "";
        let rating = document.getElementById('rating').value.replace(',', '.');

        if (isNaN(rating) || rating < 0 || rating > 10 || rating.trim() === "") {
            alert("Puntuación válida entre 0 y 10."); return;
        }

        const fileInput = document.getElementById('cover');
        const file = fileInput.files[0];

        // Si estamos editando, recuperamos el álbum original para no perder sus canciones ni su portada si no sube otra
        let albumToSave = null;
        if (editingAlbumId) {
            albumToSave = await getAlbumByIdFromDB(editingAlbumId);
        } else {
            albumToSave = { id: Date.now(), tracks: [] };
        }

        albumToSave.title = title;
        albumToSave.artist = artist;
        albumToSave.year = parseInt(year) || 0;
        albumToSave.type = type;
        albumToSave.rating = parseFloat(rating).toFixed(1);

        // Si hay foto nueva, la leemos. Si no, guardamos directo.
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
    await saveAlbumToDB(album);
    albumForm.reset();
    modalAdd.classList.add('hidden');
    processAndRenderAlbums();
}

async function processAndRenderAlbums() {
    const grid = document.getElementById('album-grid');
    if (!grid) return;

    let currentAlbums = await getAllAlbumsFromDB();
    let filteredAlbums = [...currentAlbums];

    const filterInput = document.getElementById('filter-input');
    if (filterInput && filterInput.value) {
        const query = filterInput.value.toLowerCase().trim();
        filteredAlbums = filteredAlbums.filter(a => a.artist.toLowerCase().includes(query) || a.title.toLowerCase().includes(query));
    }

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect && sortSelect.value && sortSelect.value !== 'default') {
        const s = sortSelect.value;
        filteredAlbums.sort((a, b) => s==='rating-desc'?b.rating-a.rating : s==='rating-asc'?a.rating-b.rating : s==='year-desc'?b.year-a.year : s==='year-asc'?a.year-b.year : s==='title-asc'?a.title.localeCompare(b.title) : a.artist.localeCompare(b.artist));
    }
    renderAlbums(filteredAlbums, grid);
}

function renderAlbums(albumsToRender, gridElement) {
    gridElement.innerHTML = '';
    if (albumsToRender.length === 0) {
        gridElement.innerHTML = '<p style="color: var(--text-muted); margin-top: 20px;">No se encontraron álbumes.</p>'; return;
    }

    albumsToRender.forEach(album => {
        const card = document.createElement('div');
        card.classList.add('album-card');
        card.onclick = () => window.location.href = `album.html?id=${album.id}`;

        const badgeColor = getColorByRating(album.rating);
        const tagHtml = (album.type) ? `<div class="album-tag">${album.type}</div>` : '';

        // NUEVO: Botones de editar y borrar integrados
        card.innerHTML = `
            <div class="card-actions">
                <button class="action-btn btn-edit" onclick="editAlbum(event, ${album.id})" title="Editar">✎</button>
                <button class="action-btn btn-delete" onclick="deleteAlbum(event, ${album.id})" title="Borrar">✖</button>
            </div>
            <div class="cover-container"><img src="${album.coverBase64}" alt="${album.title}"></div>
            <div class="album-info">
                <div class="title-row">
                    <h3>${album.title}</h3>
                    <span class="rating-badge" style="background-color: ${badgeColor};">${album.rating}</span>
                </div>
                <p>${album.artist} • ${album.year}</p>
                ${tagHtml}
            </div>
        `;
        gridElement.appendChild(card);
    });
}

document.getElementById('filter-input')?.addEventListener('input', processAndRenderAlbums);
document.getElementById('sort-select')?.addEventListener('change', processAndRenderAlbums);
processAndRenderAlbums();
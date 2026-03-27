// script.js - Lógica de la página principal (Grid)

const btnAddAlbum = document.getElementById('btn-add-album');
const modalAdd = document.getElementById('modal-add');
const btnCancel = document.getElementById('btn-cancel');
const albumForm = document.getElementById('album-form');
const albumGrid = document.getElementById('album-grid');
const filterInput = document.getElementById('filter-input');
const sortSelect = document.getElementById('sort-select');

async function processAndRenderAlbums() {
    if (!albumGrid) return;

    // Usamos la función de db.js
    let currentAlbums = await getAllAlbumsFromDB();
    let filteredAlbums = [...currentAlbums];

    if (filterInput && filterInput.value) {
        const query = filterInput.value.toLowerCase().trim();
        filteredAlbums = filteredAlbums.filter(a =>
            (a.artist && a.artist.toLowerCase().includes(query)) ||
            (a.year && a.year.toString().includes(query))
        );
    }

    if (sortSelect && sortSelect.value) {
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

    renderAlbumsToGrid(filteredAlbums);
}

function renderAlbumsToGrid(albumsToRender) {
    albumGrid.innerHTML = '';
    if (albumsToRender.length === 0) {
        albumGrid.innerHTML = '<p style="color: var(--text-muted); margin-top: 20px;">No se encontraron álbumes.</p>';
        return;
    }

    albumsToRender.forEach(album => {
        const card = document.createElement('div');
        card.classList.add('album-card');

        // MAGIA AQUÍ: Al hacer clic, enviamos el ID en la URL a la nueva página
        card.onclick = () => {
            window.location.href = `album.html?id=${album.id}`;
        };

        const badgeColor = getColorByRating(album.rating); // Usa la función de db.js
        const tagHtml = (album.type && album.type !== "") ? `<div class="album-tag">${album.type}</div>` : '';

        card.innerHTML = `
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
        albumGrid.appendChild(card);
    });
}

// Eventos del modal
if (btnAddAlbum) btnAddAlbum.addEventListener('click', () => modalAdd.classList.remove('hidden'));
if (btnCancel) btnCancel.addEventListener('click', () => { modalAdd.classList.add('hidden'); albumForm.reset(); });

// Guardar nuevo álbum
if (albumForm) {
    albumForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const title = document.getElementById('title').value;
        const artist = document.getElementById('artist').value;
        const year = document.getElementById('year').value;
        const type = document.getElementById('album-type') ? document.getElementById('album-type').value : "";
        let rating = document.getElementById('rating').value.replace(',', '.');

        const fileInput = document.getElementById('cover');
        const file = fileInput.files[0];

        const reader = new FileReader();
        reader.onload = async function(event) {
            const newAlbum = {
                id: Date.now(),
                title: title, artist: artist, year: parseInt(year) || 0, type: type,
                rating: parseFloat(rating).toFixed(1), coverBase64: event.target.result
            };

            await saveAlbumToDB(newAlbum); // Guarda usando db.js
            albumForm.reset();
            modalAdd.classList.add('hidden');
            processAndRenderAlbums();
        };
        reader.readAsDataURL(file);
    });
}

if (filterInput) filterInput.addEventListener('input', processAndRenderAlbums);
if (sortSelect) sortSelect.addEventListener('change', processAndRenderAlbums);

processAndRenderAlbums();
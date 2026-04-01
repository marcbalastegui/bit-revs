¡// script.js - Lógica principal de la aplicación con DETECTOR DE ERRORES

const btnAddAlbum = document.getElementById('btn-add-album');
const modalAdd = document.getElementById('modal-add');
const btnCancel = document.getElementById('btn-cancel');
const albumForm = document.getElementById('album-form');

window.deleteAlbum = async function(event, id) {
    event.stopPropagation();
    if (confirm("¿Estás seguro de que quieres borrar este álbum?")) {
        try {
            await deleteAlbumFromDB(id);
            processAndRenderAlbums();
        } catch (error) {
            alert("Error al borrar: " + (error.message || error.name));
        }
    }
};

// Eventos del Modal
if (btnAddAlbum && modalAdd) {
    btnAddAlbum.addEventListener('click', () => modalAdd.classList.remove('hidden'));
}
if (btnCancel && modalAdd) {
    btnCancel.addEventListener('click', () => {
        modalAdd.classList.add('hidden');
        if (albumForm) albumForm.reset();
    });
}

// Procesar el formulario de nuevo álbum
if (albumForm) {
    albumForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const title = document.getElementById('title').value;
        const artist = document.getElementById('artist').value;
        const year = document.getElementById('year').value;
        const typeElement = document.getElementById('album-type');
        const type = typeElement ? typeElement.value : "";

        // Ya no validamos la nota porque empieza en 0 y se calculará sola.
        const rating = "0";

        const fileInput = document.getElementById('cover');
        const file = fileInput.files[0];

        if (file) {
            const reader = new FileReader();
            reader.onload = async function(event) {
                const newAlbum = {
                    id: Date.now(),
                    title: title,
                    artist: artist,
                    year: parseInt(year) || 0,
                    type: type,
                    rating: rating, // Guardamos la nota inicial como 0
                    coverBase64: event.target.result,
                    tracks: []
                };

                try {
                    await saveAlbumToDB(newAlbum);
                    albumForm.reset();
                    modalAdd.classList.add('hidden');
                    await processAndRenderAlbums();
                } catch (error) {
                    alert("🚨 ERROR FASE 1 (Base de datos):\n" + (error.message || error.name || error));
                }
            };
            reader.readAsDataURL(file);
        } else {
            alert("Por favor, selecciona una portada.");
        }
    });
}

async function processAndRenderAlbums() {
    try {
        const grid = document.getElementById('album-grid');
        if (!grid) return;

        let currentAlbums = await getAllAlbumsFromDB();

        if (!currentAlbums || !Array.isArray(currentAlbums)) {
            currentAlbums = [];
        }

        let filteredAlbums = [...currentAlbums];

        const filterInput = document.getElementById('filter-input');
        if (filterInput && filterInput.value) {
            const query = filterInput.value.toLowerCase().trim();
            if (query !== "") {
                filteredAlbums = filteredAlbums.filter(album =>
                    (album.artist && album.artist.toLowerCase().includes(query)) ||
                    (album.year && album.year.toString().includes(query)) ||
                    (album.title && album.title.toLowerCase().includes(query))
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
        gridElement.innerHTML = '<p style="color: var(--text-muted); grid-column: 1 / -1; margin-top: 20px; font-size: 1.1rem;">No se encontraron álbumes. ¡Añade tu primera reseña!</p>';
        return;
    }

    albumsToRender.forEach(album => {
        const card = document.createElement('div');
        card.classList.add('album-card');

        card.onclick = () => {
            window.location.href = `album.html?id=${album.id}`;
        };

        const badgeColor = typeof getColorByRating === 'function' ? getColorByRating(album.rating) : '#b3b3b3';
        const tagHtml = (album.type && album.type !== "") ? `<div class="album-tag">${album.type}</div>` : '';

        // CAMBIO AQUÍ: Usamos formatRating para mostrar la nota
        let displayRating = "-"; // Por si no tiene canciones
        if (album.tracks && album.tracks.length > 0) {
            displayRating = formatRating(album.rating);
        }

        card.innerHTML = `
            <div class="card-actions">
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
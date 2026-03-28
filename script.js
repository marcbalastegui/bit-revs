// script.js - Lógica de la página principal (Grid de Álbumes)

const btnAddAlbum = document.getElementById('btn-add-album');
const modalAdd = document.getElementById('modal-add');
const btnCancel = document.getElementById('btn-cancel');
const albumForm = document.getElementById('album-form');
const albumGrid = document.getElementById('album-grid');
const filterInput = document.getElementById('filter-input');
const sortSelect = document.getElementById('sort-select');

// Función para borrar un álbum desde la página principal
window.deleteAlbum = async function(event, id) {
    event.stopPropagation(); // Evita que al hacer clic en borrar, entres al álbum
    if (confirm("¿Estás seguro de que quieres borrar este álbum? Esta acción no se puede deshacer.")) {
        await deleteAlbumFromDB(id);
        processAndRenderAlbums(); // Recarga la pantalla
    }
};

// Mostrar/Ocultar Modal
if (btnAddAlbum) btnAddAlbum.addEventListener('click', () => modalAdd.classList.remove('hidden'));
if (btnCancel) btnCancel.addEventListener('click', () => {
    modalAdd.classList.add('hidden');
    albumForm.reset();
});

// Procesar el formulario de nuevo álbum
if (albumForm) {
    albumForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const title = document.getElementById('title').value;
        const artist = document.getElementById('artist').value;
        const year = document.getElementById('year').value;
        const typeElement = document.getElementById('album-type');
        const type = typeElement ? typeElement.value : "";

        let rating = document.getElementById('rating').value;
        rating = rating.replace(',', '.');

        if (isNaN(rating) || rating < 0 || rating > 10 || rating.trim() === "") {
            alert("Por favor, introduce una puntuación válida entre 0 y 10. Ejemplo: 9.5");
            return;
        }

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
                    rating: parseFloat(rating).toFixed(1),
                    coverBase64: event.target.result,
                    tracks: [] // Dejamos el array listo para cuando entremos a añadir canciones
                };

                try {
                    await saveAlbumToDB(newAlbum);
                    albumForm.reset();
                    modalAdd.classList.add('hidden');
                    processAndRenderAlbums(); // Actualiza la pantalla
                } catch (error) {
                    console.error("Error al guardar:", error);
                    alert("Hubo un error al guardar la reseña.");
                }
            };
            reader.readAsDataURL(file);
        } else {
            alert("Por favor, selecciona una portada.");
        }
    });
}

// Filtrar, Ordenar y Dibujar
async function processAndRenderAlbums() {
    if (!albumGrid) return;

    let currentAlbums = await getAllAlbumsFromDB();
    let filteredAlbums = [...currentAlbums];

    // 1. Filtrado por texto de la barra de búsqueda
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

    // 2. Ordenamiento del menú desplegable
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

    // 3. Dibujar en el HTML
    renderAlbums(filteredAlbums);
}

function renderAlbums(albumsToRender) {
    albumGrid.innerHTML = '';

    if (albumsToRender.length === 0) {
        albumGrid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1 / -1; margin-top: 20px;">No se encontraron álbumes.</p>';
        return;
    }

    albumsToRender.forEach(album => {
        const card = document.createElement('div');
        card.classList.add('album-card');

        // Al hacer clic, navegamos a la página del álbum individual
        card.onclick = () => {
            window.location.href = `album.html?id=${album.id}`;
        };

        const badgeColor = typeof getColorByRating === 'function' ? getColorByRating(album.rating) : '#b3b3b3';
        const tagHtml = (album.type && album.type !== "") ? `<div class="album-tag">${album.type}</div>` : '';

        card.innerHTML = `
            <div class="delete-btn" onclick="deleteAlbum(event, ${album.id})" title="Borrar Álbum">✖</div>
            <div class="cover-container">
                <img src="${album.coverBase64}" alt="${album.title}">
            </div>
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

// Escuchar cambios en los filtros para actualizar en vivo
if (filterInput) filterInput.addEventListener('input', processAndRenderAlbums);
if (sortSelect) sortSelect.addEventListener('change', processAndRenderAlbums);

// Pintar los álbumes nada más cargar la página
processAndRenderAlbums();
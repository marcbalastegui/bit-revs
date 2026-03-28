// script.js - Lógica principal de la aplicación (Grid de Álbumes)

// Referencias seguras al DOM
const btnAddAlbum = document.getElementById('btn-add-album');
const modalAdd = document.getElementById('modal-add');
const btnCancel = document.getElementById('btn-cancel');
const albumForm = document.getElementById('album-form');

// Función para borrar un álbum desde la página principal
window.deleteAlbum = async function(event, id) {
    event.stopPropagation(); // Evita entrar al álbum al hacer clic en la X
    if (confirm("¿Estás seguro de que quieres borrar este álbum? Esta acción no se puede deshacer.")) {
        try {
            await deleteAlbumFromDB(id);
            processAndRenderAlbums(); // Recarga la cuadrícula
        } catch (error) {
            console.error("Error al borrar el álbum:", error);
            alert("No se pudo borrar el álbum.");
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
                    tracks: [] // Preparado para las canciones
                };

                try {
                    await saveAlbumToDB(newAlbum);
                    albumForm.reset();
                    modalAdd.classList.add('hidden');

                    // Forzar la recarga inmediata de la cuadrícula
                    await processAndRenderAlbums();
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

// Función BLINDADA para Filtrar, Ordenar y Dibujar
async function processAndRenderAlbums() {
    try {
        const grid = document.getElementById('album-grid');
        if (!grid) return; // Si no estamos en index.html, no hace nada

        // 1. Cargar datos
        let currentAlbums = await getAllAlbumsFromDB();

        // Seguro por si la base de datos devuelve algo que no es una lista
        if (!currentAlbums || !Array.isArray(currentAlbums)) {
            currentAlbums = [];
        }

        let filteredAlbums = [...currentAlbums];

        // 2. Filtrado por texto
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

        // 3. Ordenamiento
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

        // 4. Dibujar en el HTML
        renderAlbums(filteredAlbums, grid);

    } catch (error) {
        console.error("Error crítico al procesar álbumes:", error);
    }
}

// Función inyectora de HTML
function renderAlbums(albumsToRender, gridElement) {
    gridElement.innerHTML = '';

    if (albumsToRender.length === 0) {
        gridElement.innerHTML = '<p style="color: var(--text-muted); grid-column: 1 / -1; margin-top: 20px; font-size: 1.1rem;">No se encontraron álbumes. ¡Añade tu primera reseña!</p>';
        return;
    }

    albumsToRender.forEach(album => {
        const card = document.createElement('div');
        card.classList.add('album-card');

        // Navegar al álbum individual
        card.onclick = () => {
            window.location.href = `album.html?id=${album.id}`;
        };

        // Color dinámico de la base de datos
        const badgeColor = typeof getColorByRating === 'function' ? getColorByRating(album.rating) : '#b3b3b3';
        const tagHtml = (album.type && album.type !== "") ? `<div class="album-tag">${album.type}</div>` : '';

        card.innerHTML = `
            <div class="delete-btn" onclick="deleteAlbum(event, ${album.id})" title="Borrar Álbum">✖</div>
            <div class="cover-container">
                <img src="${album.coverBase64}" alt="${album.title || 'Álbum'}">
            </div>
            <div class="album-info">
                <div class="title-row">
                    <h3>${album.title || 'Sin Título'}</h3>
                    <span class="rating-badge" style="background-color: ${badgeColor};">${album.rating || '0'}</span>
                </div>
                <p>${album.artist || 'Artista Desconocido'} • ${album.year || 'N/A'}</p>
                ${tagHtml}
            </div>
        `;
        gridElement.appendChild(card);
    });
}

// Activar filtros en vivo (asegurando que existen primero)
const globalFilterInput = document.getElementById('filter-input');
const globalSortSelect = document.getElementById('sort-select');

if (globalFilterInput) globalFilterInput.addEventListener('input', processAndRenderAlbums);
if (globalSortSelect) globalSortSelect.addEventListener('change', processAndRenderAlbums);

// Iniciar la carga de álbumes al abrir la página
processAndRenderAlbums();
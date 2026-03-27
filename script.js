// Referencias principales al DOM
const btnAddAlbum = document.getElementById('btn-add-album');
const modalAdd = document.getElementById('modal-add');
const btnCancel = document.getElementById('btn-cancel');
const albumForm = document.getElementById('album-form');
const albumGrid = document.getElementById('album-grid');

const filterInput = document.getElementById('filter-input');
const sortSelect = document.getElementById('sort-select');

// Cargar álbumes (con seguro por si la memoria está corrupta)
let albums = JSON.parse(localStorage.getItem('myAlbums'));
if (!Array.isArray(albums)) {
    albums = [];
}

// Función para determinar los colores según la nota
function getColorByRating(rating) {
    const r = parseFloat(rating);
    if (isNaN(r)) return '#4D4D4D';
    if (r === 10) return '#FF66CC';
    if (r >= 9) return '#B533FF';
    if (r >= 8) return '#3366FF';
    if (r >= 7) return '#66CC33';
    if (r >= 6) return '#FFD11A';
    if (r >= 5) return '#FF8533';
    if (r >= 4) return '#FF3333';
    if (r >= 2) return '#996600';
    return '#4D4D4D';
}

// Eventos para abrir y cerrar la ventana flotante (Modal)
if (btnAddAlbum) btnAddAlbum.addEventListener('click', () => modalAdd.classList.remove('hidden'));
if (btnCancel) btnCancel.addEventListener('click', () => {
    modalAdd.classList.add('hidden');
    albumForm.reset();
});

// Lógica principal: Procesar y guardar el formulario
if (albumForm) {
    albumForm.addEventListener('submit', function(e) {
        e.preventDefault();

        // 1. Recoger datos
        const title = document.getElementById('title').value;
        const artist = document.getElementById('artist').value;
        const year = document.getElementById('year').value;

        const typeElement = document.getElementById('album-type');
        const type = typeElement ? typeElement.value : "";

        let rating = document.getElementById('rating').value;
        rating = rating.replace(',', '.'); // Cambiar coma por punto

        // 2. Validar puntuación
        if (isNaN(rating) || rating < 0 || rating > 10 || rating.trim() === "") {
            alert("Por favor, introduce un número válido entre 0 y 10.");
            return;
        }

        // 3. Procesar imagen
        const fileInput = document.getElementById('cover');
        const file = fileInput.files[0];

        if (!file) {
            alert("Por favor, selecciona una portada.");
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            const newAlbum = {
                id: Date.now(),
                title: title,
                artist: artist,
                year: parseInt(year) || 0,
                type: type,
                rating: parseFloat(rating).toFixed(1),
                coverBase64: event.target.result // La imagen convertida a texto
            };

            // Creamos una lista temporal para intentar guardarla
            const tempAlbums = [...albums, newAlbum];

            try {
                // INTENTO DE GUARDADO EN MEMORIA
                localStorage.setItem('myAlbums', JSON.stringify(tempAlbums));

                // Si funciona, actualizamos la lista oficial
                albums = tempAlbums;
                albumForm.reset();
                modalAdd.classList.add('hidden');
                processAndRenderAlbums();

            } catch (error) {
                // SI FALLA (Probablemente porque la imagen es muy grande y superamos los 5MB)
                console.error("Error al guardar en LocalStorage:", error);

                if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
                    alert("⚠️ ¡Memoria llena! Tu navegador solo permite guardar unos pocos Megabytes.\n\nSolución:\n1. Usa imágenes más pequeñas (menos de 150KB).\n2. Borra la memoria pulsando F12, yendo a Consola, escribiendo 'localStorage.clear()' y recargando la página.");
                } else {
                    alert("Hubo un error inesperado al guardar. Revisa la consola (F12).");
                }
            }
        };

        // Iniciar lectura de la imagen
        reader.readAsDataURL(file);
    });
}

// Función para Filtrar, Ordenar y Dibujar
function processAndRenderAlbums() {
    if (!albumGrid) return;

    let filteredAlbums = [...albums];

    // 1. Filtrado por texto (Artista o Año)
    if (filterInput && filterInput.value) {
        const query = filterInput.value.toLowerCase().trim();
        if (query !== "") {
            filteredAlbums = filteredAlbums.filter(album =>
                (album.artist && album.artist.toLowerCase().includes(query)) ||
                (album.year && album.year.toString().includes(query))
            );
        }
    }

    // 2. Ordenamiento
    if (sortSelect && sortSelect.value) {
        const sortMethod = sortSelect.value;
        filteredAlbums.sort((a, b) => {
            if (sortMethod === 'rating-desc') return b.rating - a.rating;
            if (sortMethod === 'rating-asc') return a.rating - b.rating;
            if (sortMethod === 'year-desc') return b.year - a.year;
            if (sortMethod === 'year-asc') return a.year - b.year;
            if (sortMethod === 'title-asc') return (a.title || "").localeCompare(b.title || "");
            if (sortMethod === 'artist-asc') return (a.artist || "").localeCompare(b.artist || "");
            return 0; // default
        });
    }

    // 3. Dibujar en el HTML
    renderAlbums(filteredAlbums);
}

// Función que inyecta el HTML de cada tarjeta
function renderAlbums(albumsToRender) {
    albumGrid.innerHTML = '';

    if (albumsToRender.length === 0) {
        albumGrid.innerHTML = '<p style="color: var(--text-muted);">No se encontraron álbumes.</p>';
        return;
    }

    albumsToRender.forEach(album => {
        const card = document.createElement('div');
        card.classList.add('album-card');
        card.onclick = () => alert(`Más adelante, esto te llevará a la review completa de: ${album.title}`);

        const badgeColor = getColorByRating(album.rating);
        const tagHtml = (album.type && album.type !== "") ? `<div class="album-tag">${album.type}</div>` : '';

        card.innerHTML = `
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

// Activar los eventos de búsqueda y orden en vivo
if (filterInput) filterInput.addEventListener('input', processAndRenderAlbums);
if (sortSelect) sortSelect.addEventListener('change', processAndRenderAlbums);

// Arrancar al inicio para mostrar lo que ya hay guardado
processAndRenderAlbums();
// album.js - Gestión detallada del álbum y sus canciones

let currentAlbum = null; // Guardamos el álbum que estamos viendo

async function loadAlbumDetails() {
    const container = document.getElementById('album-detail-container');
    const params = new URLSearchParams(window.location.search);
    const albumId = params.get('id');

    if (!albumId) {
        container.innerHTML = '<h1>Error: No se especificó ningún álbum.</h1>';
        return;
    }

    currentAlbum = await getAlbumByIdFromDB(albumId);

    if (!currentAlbum) {
        container.innerHTML = '<h1>Álbum no encontrado.</h1>';
        return;
    }

    // Asegurarnos de que el array de canciones existe
    if (!currentAlbum.tracks) {
        currentAlbum.tracks = [];
    }

    renderAlbumContent();
}

function renderAlbumContent() {
    const container = document.getElementById('album-detail-container');
    const badgeColor = getColorByRating(currentAlbum.rating);
    const typeText = currentAlbum.type ? currentAlbum.type : 'Álbum';

    // Construimos la lista de canciones HTML
    let tracksHtml = '';
    if (currentAlbum.tracks.length === 0) {
        tracksHtml = '<p style="color: var(--text-muted);">Aún no hay canciones reseñadas en este álbum.</p>';
    } else {
        currentAlbum.tracks.forEach(track => {
            const trackColor = track.isInterlude ? '#4D4D4D' : getColorByRating(track.rating);
            const displayRating = track.isInterlude ? 'INTERLUDE' : track.rating;
            // Etiqueta para interludes: un poco más pequeña y sutil
            const badgeClass = track.isInterlude ? 'rating-badge album-tag' : 'rating-badge';

            tracksHtml += `
                <div class="track-item">
                    <div class="track-info">
                        <h4>${track.title}</h4>
                        <p>${track.artist ? track.artist : currentAlbum.artist}</p>
                    </div>
                    <span class="${badgeClass}" style="background-color: ${trackColor}; font-size: ${track.isInterlude ? '0.7rem' : '1rem'}">${displayRating}</span>
                </div>
            `;
        });
    }

    container.innerHTML = `
        <div class="album-header-banner">
            <img src="${currentAlbum.coverBase64}" alt="${currentAlbum.title}" class="detail-cover">
            <div class="detail-info">
                <span class="detail-type">${typeText} • ${currentAlbum.year}</span>
                <h1 class="detail-title">${currentAlbum.title}</h1>
                <h2 class="detail-artist">${currentAlbum.artist}</h2>
                <div class="rating-big" style="background-color: ${badgeColor};">${currentAlbum.rating}</div>
            </div>
        </div>

        <div class="tracklist-section">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h2>Canciones</h2>
                <button class="btn-add-track" id="btn-add-track">+ Añadir Canción</button>
            </div>
            <div id="tracks-list">
                ${tracksHtml}
            </div>
        </div>
    `;

    // Reactivamos el evento del botón de añadir canción porque lo acabamos de inyectar
    document.getElementById('btn-add-track').addEventListener('click', () => {
        document.getElementById('modal-track').classList.remove('hidden');
    });
}

// LÓGICA DEL MODAL DE CANCIONES
const modalTrack = document.getElementById('modal-track');
const trackForm = document.getElementById('track-form');
const checkboxInterlude = document.getElementById('track-interlude');
const ratingContainer = document.getElementById('rating-container');
const ratingInput = document.getElementById('track-rating');

// Ocultar/Mostrar input de nota si es Interlude
checkboxInterlude.addEventListener('change', (e) => {
    if (e.target.checked) {
        ratingContainer.style.display = 'none';
        ratingInput.removeAttribute('required'); // No pedimos nota si es interlude
    } else {
        ratingContainer.style.display = 'block';
        ratingInput.setAttribute('required', 'true');
    }
});

// Cerrar modal
document.getElementById('btn-cancel-track').addEventListener('click', () => {
    modalTrack.classList.add('hidden');
    trackForm.reset();
    ratingContainer.style.display = 'block';
});

// Guardar Canción
trackForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const title = document.getElementById('track-title').value;
    const artist = document.getElementById('track-artist').value;
    const isInterlude = checkboxInterlude.checked;

    let rating = "";
    if (!isInterlude) {
        rating = ratingInput.value.replace(',', '.');
        if (isNaN(rating) || rating < 0 || rating > 10 || rating.trim() === "") {
            alert("Introduce un número válido entre 0 y 10.");
            return;
        }
        rating = parseFloat(rating).toFixed(1);
    }

    const newTrack = {
        title: title,
        artist: artist,
        isInterlude: isInterlude,
        rating: rating
    };

    // Añadimos la canción al álbum que tenemos en memoria
    currentAlbum.tracks.push(newTrack);

    // Guardamos el álbum actualizado en la Base de Datos
    await saveAlbumToDB(currentAlbum);

    // Limpiamos y recargamos la vista
    trackForm.reset();
    ratingContainer.style.display = 'block';
    modalTrack.classList.add('hidden');
    renderAlbumContent();
});

// Iniciar
loadAlbumDetails();
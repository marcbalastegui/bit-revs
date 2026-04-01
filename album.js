// album.js - Gestión detallada del álbum, canciones y CÁLCULO DE MEDIA

let currentAlbum = null;
let editingTrackIndex = null;

async function loadAlbumDetails() {
    const params = new URLSearchParams(window.location.search);
    const albumId = params.get('id');
    if (!albumId) return;

    currentAlbum = await getAlbumByIdFromDB(albumId);
    if (!currentAlbum) return;
    if (!currentAlbum.tracks) currentAlbum.tracks = [];

    renderAlbumContent();
}

// NUEVA FUNCIÓN: Recalcular la nota media del álbum
function recalculateAlbumRating() {
    if (!currentAlbum || !currentAlbum.tracks || currentAlbum.tracks.length === 0) {
        currentAlbum.rating = 0;
        return;
    }

    let totalScore = 0;
    let scoredTracksCount = 0;

    currentAlbum.tracks.forEach(track => {
        // Solo sumamos notas de canciones que NO son interludes
        if (!track.isInterlude && !isNaN(parseFloat(track.rating))) {
            totalScore += parseFloat(track.rating);
            scoredTracksCount++;
        }
    });

    if (scoredTracksCount === 0) {
        currentAlbum.rating = 0;
    } else {
        // Media aritmética (Suma total / Número de canciones)
        currentAlbum.rating = (totalScore / scoredTracksCount).toFixed(1);
    }
}


window.deleteTrack = async function(index) {
    if(confirm("¿Borrar esta canción?")) {
        currentAlbum.tracks.splice(index, 1);
        recalculateAlbumRating(); // Recalcular nota tras borrar
        await saveAlbumToDB(currentAlbum);
        renderAlbumContent();
    }
}

window.editTrack = function(index) {
    editingTrackIndex = index;
    const track = currentAlbum.tracks[index];

    document.getElementById('track-title').value = track.title;
    document.getElementById('track-artist').value = track.artist || "";
    document.getElementById('track-interlude').checked = track.isInterlude;
    document.getElementById('track-rating').value = track.rating || "";

    document.getElementById('rating-container').style.display = track.isInterlude ? 'none' : 'block';

    const modalTitle = document.querySelector('#modal-track h2') || document.querySelector('#modal-track .modal-content h2');
    if (modalTitle) modalTitle.textContent = "Editar Canción";

    document.getElementById('modal-track').classList.remove('hidden');
}

function renderAlbumContent() {
    const container = document.getElementById('album-detail-container');
    const badgeColor = getColorByRating(currentAlbum.rating);
    const typeText = currentAlbum.type ? currentAlbum.type : 'Álbum';

    let tracksHtml = '';
    currentAlbum.tracks.forEach((track, index) => {
        const trackColor = track.isInterlude ? '#4D4D4D' : getColorByRating(track.rating);

        // Usamos formatRating para quitar ".0" de las canciones
        const displayRating = track.isInterlude ? 'INTERLUDE' : formatRating(track.rating);
        const badgeClass = track.isInterlude ? 'rating-badge album-tag' : 'rating-badge';

        tracksHtml += `
            <div class="track-item">
                <div class="track-info">
                    <h4>${track.title}</h4>
                    <p>${track.artist ? track.artist : currentAlbum.artist}</p>
                </div>
                <div class="track-actions">
                    <button class="track-btn edit" onclick="editTrack(${index})" title="Editar">✎</button>
                    <button class="track-btn delete" onclick="deleteTrack(${index})" title="Borrar">✖</button>
                </div>
                <span class="${badgeClass}" style="background-color: ${trackColor}; font-size: ${track.isInterlude ? '0.7rem' : '1rem'}">${displayRating}</span>
            </div>
        `;
    });

    // Usamos formatRating para mostrar la nota grande del álbum sin ".0"
    let displayAlbumRating = "-";
    if (currentAlbum.tracks.length > 0) {
         displayAlbumRating = formatRating(currentAlbum.rating);
    }


    container.innerHTML = `
        <div class="album-header-banner">
            <img src="${currentAlbum.coverBase64}" alt="${currentAlbum.title}" class="detail-cover">
            <div class="detail-info">
                <span class="detail-type">${typeText} • ${currentAlbum.year}</span>
                <h1 class="detail-title">${currentAlbum.title}</h1>
                <h2 class="detail-artist">${currentAlbum.artist}</h2>
                <div class="rating-big" style="background-color: ${badgeColor};">${displayAlbumRating}</div>
            </div>
        </div>
        <div class="tracklist-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>Canciones</h2>
                <button class="btn" style="background-color: var(--text-main); color: var(--bg-primary);" id="btn-add-track">+ Añadir Canción</button>
            </div>
            <div id="tracks-list">${tracksHtml}</div>
        </div>
    `;

    document.getElementById('btn-add-track').addEventListener('click', () => {
        editingTrackIndex = null;
        const modalTitle = document.querySelector('#modal-track h2') || document.querySelector('#modal-track .modal-content h2');
        if (modalTitle) modalTitle.textContent = "Añadir Canción";

        document.getElementById('track-form').reset();
        document.getElementById('rating-container').style.display = 'block';
        document.getElementById('modal-track').classList.remove('hidden');
    });
}

document.getElementById('track-interlude').addEventListener('change', (e) => {
    document.getElementById('rating-container').style.display = e.target.checked ? 'none' : 'block';
    if (e.target.checked) {
        document.getElementById('track-rating').removeAttribute('required');
    } else {
        document.getElementById('track-rating').setAttribute('required', 'true');
    }
});

document.getElementById('btn-cancel-track').addEventListener('click', () => {
    document.getElementById('modal-track').classList.add('hidden');
});

document.getElementById('track-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const title = document.getElementById('track-title').value;
    const artist = document.getElementById('track-artist').value;
    const isInterlude = document.getElementById('track-interlude').checked;

    let rating = "";
    if (!isInterlude) {
        rating = document.getElementById('track-rating').value.replace(',', '.');
        if (isNaN(rating) || rating < 0 || rating > 10 || rating.trim() === "") {
            alert("Introduce una nota válida entre 0 y 10.");
            return;
        }
        rating = parseFloat(rating).toFixed(1);
    }

    const newTrack = { title, artist, isInterlude, rating };

    if (editingTrackIndex !== null) {
        currentAlbum.tracks[editingTrackIndex] = newTrack;
    } else {
        currentAlbum.tracks.push(newTrack);
    }

    // Recalcular nota tras añadir/editar
    recalculateAlbumRating();

    await saveAlbumToDB(currentAlbum);
    document.getElementById('modal-track').classList.add('hidden');
    renderAlbumContent();
});

loadAlbumDetails();
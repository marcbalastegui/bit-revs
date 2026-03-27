// album.js - Carga los detalles de un álbum específico

async function loadAlbumDetails() {
    const container = document.getElementById('album-detail-container');

    // Leer el ID de la URL (Ejemplo: album.html?id=123456789)
    const params = new URLSearchParams(window.location.search);
    const albumId = params.get('id');

    if (!albumId) {
        container.innerHTML = '<h1>Error: No se especificó ningún álbum.</h1>';
        return;
    }

    // Buscar el álbum en la base de datos
    const album = await getAlbumByIdFromDB(albumId);

    if (!album) {
        container.innerHTML = '<h1>Álbum no encontrado.</h1>';
        return;
    }

    const badgeColor = getColorByRating(album.rating);
    const typeText = album.type ? album.type : 'Álbum';

    container.innerHTML = `
        <div class="album-header-banner">
            <img src="${album.coverBase64}" alt="${album.title}" class="detail-cover">
            <div class="detail-info">
                <span class="detail-type">${typeText} • ${album.year}</span>
                <h1 class="detail-title">${album.title}</h1>
                <h2 class="detail-artist">${album.artist}</h2>
                <div class="rating-big" style="background-color: ${badgeColor};">${album.rating}</div>
            </div>
        </div>

        <div class="tracklist-section">
            <h2>Canciones</h2>
            <p style="color: var(--text-muted); margin-top: 10px;">(Aquí pondremos las canciones pronto...)</p>
        </div>
    `;
}

loadAlbumDetails();
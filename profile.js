// profile.js - Carga las estadísticas y mejores álbumes

async function loadProfile() {
    const albums = await getAllAlbumsFromDB();

    // Actualizar estadísticas
    const statsContainer = document.getElementById('profile-stats');
    statsContainer.textContent = `Has reseñado un total de ${albums.length} álbumes.`;

    // Ordenar por nota (de mayor a menor) y coger los 5 mejores
    const topAlbums = [...albums].sort((a, b) => b.rating - a.rating).slice(0, 5);

    const grid = document.getElementById('top-albums-grid');
    grid.innerHTML = '';

    if(topAlbums.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-muted);">Aún no has reseñado ningún álbum.</p>';
        return;
    }

    // Dibujamos las mismas tarjetas que en el index
    topAlbums.forEach(album => {
        const card = document.createElement('div');
        card.classList.add('album-card');
        card.onclick = () => window.location.href = `album.html?id=${album.id}`;

        const badgeColor = getColorByRating(album.rating);
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
        grid.appendChild(card);
    });
}

loadProfile();
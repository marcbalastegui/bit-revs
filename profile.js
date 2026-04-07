// profile.js - Gestión de interfaz de perfil, estadísticas y base de datos

// Estado local de los datos del perfil
let currentProfileData = null;

// Referencias a elementos del DOM (Vista normal)
const profileNameView = document.getElementById('profile-name-view');
const avatarCircle = document.getElementById('avatar-circle');
const avatarFallbackChar = document.getElementById('avatar-fallback-char');
const bannerView = document.getElementById('profile-banner-view');
const reviewsCountSpan = document.getElementById('total-reviews-count');

// Referencias a elementos del DOM (Edición)
const btnEditProfile = document.getElementById('btn-edit-profile');
const editActionsBar = document.getElementById('edit-actions');
const btnCancelEdit = document.getElementById('btn-cancel-edit');
const btnSaveEdit = document.getElementById('btn-save-edit');
const bannerEditOverlay = document.getElementById('banner-edit-overlay');
const avatarEditOverlay = document.getElementById('avatar-edit-overlay');
const profileNameEdit = document.getElementById('profile-name-edit');
const inputAvatar = document.getElementById('input-avatar');
const inputBanner = document.getElementById('input-banner');

// Temporales para edición de imágenes
let tempAvatarData = null;
let tempBannerData = null;

// 1. CARGA Y RENDERIZADO INICIAL
async function loadProfilePage() {
    // A. Cargar datos del usuario
    currentProfileData = await getUserProfileFromDB();
    applyProfileDataToUI(currentProfileData);

    // B. Cargar todos los datos de la DB
    const allAlbums = await getAllAlbumsFromDB();
    const allMovies = await getAllItemsFromDB('movies');
    const allSeries = await getAllItemsFromDB('series');

    // C. Calcular Estadísticas Globales
    const allReviews = [...allAlbums, ...allMovies, ...allSeries];
    let totalScore = 0;
    let scorableCount = 0;

    allReviews.forEach(item => {
        const rating = parseFloat(item.rating);
        if (!isNaN(rating) && rating > 0) {
            totalScore += rating;
            scorableCount++;
        }
    });

    const avgRating = scorableCount > 0 ? (totalScore / scorableCount) : 0;

    // Inyectar Estadísticas en el HTML (usando formatRating de db.js)
    const avgElement = document.getElementById('stat-avg-rating');
    const totalElement = document.getElementById('stat-total-reviews');

    if (avgElement) {
        avgElement.innerHTML = `<span class="star-icon">★</span> ${formatRating(avgRating)} Media`;
    }
    if (totalElement) {
        totalElement.textContent = `${allReviews.length} Valoraciones`;
    }

    // D. Dibujar secciones del perfil
    // Mis mejores álbumes
    renderSection(allAlbums, 'top-albums-grid', false, true);

    // Películas mejor puntuadas (Vertical)
    renderSection(allMovies, 'top-movies-grid', true, true);

    // Series mejor puntuadas (Vertical)
    renderSection(allSeries, 'top-series-grid', true, true);

    // Valoraciones recientes (Mezcla de todo, ordenado por ID/Fecha)
    const recentReviews = allReviews.sort((a, b) => b.id - a.id).slice(0, 10);
    renderSection(recentReviews, 'recent-albums-grid', false, false);
}

// Función unificada para renderizar grids en el perfil
function renderSection(items, containerId, isVertical, sortByRating = true) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let displayItems = [...items];

    if (sortByRating) {
        displayItems.sort((a, b) => b.rating - a.rating).slice(0, 5);
        displayItems = displayItems.slice(0, 5); // Solo los 5 mejores
    }

    if (displayItems.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); padding: 20px;">No hay valoraciones aquí todavía.</p>';
        return;
    }

    container.innerHTML = '';
    displayItems.forEach(item => {
        const card = document.createElement('div');
        card.classList.add('album-card');

        // Solo los álbumes tienen página de detalles por ahora
        // Detectamos si es álbum si no tiene una propiedad que lo identifique como peli/serie o por el ID del container
        if (containerId === 'top-albums-grid' || (!isVertical && !item.type)) {
            card.onclick = () => window.location.href = `album.html?id=${item.id}`;
        }

        const badgeColor = getColorByRating(item.rating);
        const coverClass = isVertical ? 'cover-container vertical' : 'cover-container';

        card.innerHTML = `
            <div class="${coverClass}"><img src="${item.coverBase64}" alt="${item.title}"></div>
            <div class="album-info">
                <div class="title-row">
                    <h3>${item.title}</h3>
                    <span class="rating-badge" style="background-color: ${badgeColor};">${formatRating(item.rating)}</span>
                </div>
                <p>${item.artist || item.year} ${item.artist ? '• ' + item.year : ''}</p>
            </div>
        `;
        container.appendChild(card);
    });
}

// Aplicar datos del perfil a la UI
function applyProfileDataToUI(data) {
    profileNameView.textContent = data.userName;
    profileNameEdit.value = data.userName;

    // Foto de perfil
    avatarCircle.style.backgroundImage = 'none';
    avatarFallbackChar.style.display = 'block';

    if (data.avatarData) {
        avatarCircle.style.backgroundImage = `url(${data.avatarData})`;
        avatarFallbackChar.style.display = 'none';
    } else {
        avatarFallbackChar.textContent = data.userName.charAt(0).toUpperCase();
    }

    // Banner
    if (data.bannerData) {
        bannerView.style.backgroundImage = `url(${data.bannerData})`;
        bannerView.classList.add('has-banner');
    } else {
        bannerView.style.backgroundImage = 'none';
        bannerView.classList.remove('has-banner');
    }
}

// 2. LÓGICA DE EDICIÓN
btnEditProfile.addEventListener('click', () => {
    toggleEditMode(true);
    tempAvatarData = currentProfileData.avatarData;
    tempBannerData = currentProfileData.bannerData;
});

btnCancelEdit.addEventListener('click', () => {
    toggleEditMode(false);
    applyProfileDataToUI(currentProfileData);
});

btnSaveEdit.addEventListener('click', async () => {
    const newName = profileNameEdit.value.trim();
    if (!newName) {
        alert("El nombre de usuario no puede estar vacío.");
        return;
    }

    const updatedProfile = {
        key: 'config',
        userName: newName,
        avatarData: tempAvatarData,
        bannerData: tempBannerData
    };

    await saveUserProfileToDB(updatedProfile);
    currentProfileData = updatedProfile;

    toggleEditMode(false);
    applyProfileDataToUI(updatedProfile);

    // Actualizar también el avatar del header si existe
    const headerAvatar = document.getElementById('global-header-avatar');
    if (headerAvatar) {
        if (tempAvatarData) {
            headerAvatar.style.backgroundImage = `url(${tempAvatarData})`;
            headerAvatar.textContent = '';
        } else {
            headerAvatar.textContent = newName.charAt(0).toUpperCase();
        }
    }
});

function toggleEditMode(isEditing) {
    if (isEditing) {
        btnEditProfile.classList.add('hidden');
        editActionsBar.classList.remove('hidden');
        bannerEditOverlay.classList.remove('hidden');
        avatarEditOverlay.classList.remove('hidden');
        profileNameView.classList.add('hidden');
        profileNameEdit.classList.remove('hidden');
        profileNameEdit.focus();
    } else {
        btnEditProfile.classList.remove('hidden');
        editActionsBar.classList.add('hidden');
        bannerEditOverlay.classList.add('hidden');
        avatarEditOverlay.classList.add('hidden');
        profileNameView.classList.remove('hidden');
        profileNameEdit.classList.add('hidden');
    }
}

// 3. PROCESAMIENTO DE IMÁGENES
avatarEditOverlay.addEventListener('click', () => inputAvatar.click());
bannerEditOverlay.addEventListener('click', () => inputBanner.click());

inputAvatar.addEventListener('change', (e) => processImageFile(e.target.files[0], 'avatar'));
inputBanner.addEventListener('change', (e) => processImageFile(e.target.files[0], 'banner'));

function processImageFile(file, type) {
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const dataURL = event.target.result;
        if (type === 'avatar') {
            tempAvatarData = dataURL;
            avatarCircle.style.backgroundImage = `url(${dataURL})`;
            avatarFallbackChar.style.display = 'none';
        } else {
            tempBannerData = dataURL;
            bannerView.style.backgroundImage = `url(${dataURL})`;
        }
    };
    reader.readAsDataURL(file);
}

// INICIAR PÁGINA
loadProfilePage();
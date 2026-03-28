// profile.js - Gestión de interfaz de perfil y base de datos (IndexedDB)

// Estado local de los datos del perfil cargados
let currentProfileData = null;

// Referencias a elementos del DOM (Vista normal)
const profileNameView = document.getElementById('profile-name-view');
const avatarCircle = document.getElementById('avatar-circle');
const avatarFallbackChar = document.getElementById('avatar-fallback-char');
const bannerView = document.getElementById('profile-banner-view');
const topAlbumsGrid = document.getElementById('top-albums-grid');
const recentAlbumsGrid = document.getElementById('recent-albums-grid');
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

// Temporales para guardar DataURLs antes de salvar en DB definitavente
let tempAvatarData = null;
let tempBannerData = null;


// 1. CARGA INICIAL DE DATOS
async function loadProfilePage() {
    // A. Cargar datos del usuario desde db.js
    currentProfileData = await getUserProfileFromDB();
    applyProfileDataToUI(currentProfileData);

    // B. Cargar Álbumes y generar estadísticas
    const allAlbums = await getAllAlbumsFromDB();

    // Actualizar contador entre paréntesis
    reviewsCountSpan.textContent = allAlbums.length;

    // Dibujar las secciones del grid
    renderGrids(allAlbums);
}

// Aplicar los datos recuperados de la base de datos a los elementos visuales
function applyProfileDataToUI(data) {
    profileNameView.textContent = data.userName;
    profileNameEdit.value = data.userName;

    // Resetear avatar
    avatarCircle.style.backgroundImage = 'none';
    avatarFallbackChar.style.display = 'block';

    if (data.avatarData) {
        // Si hay imagen guardada, la ponemos de fondo del círculo
        avatarCircle.style.backgroundImage = `url(${data.avatarData})`;
        avatarFallbackChar.style.display = 'none'; // Ocultar inicial
    } else {
        // Si no hay imagen, poner inicial del nombre
        avatarFallbackChar.textContent = data.userName.charAt(0).toUpperCase();
    }

    // Resetear banner
    bannerView.style.backgroundImage = 'none';
    if (data.bannerData) {
        bannerView.style.backgroundImage = `url(${data.bannerData})`;
        bannerView.classList.add('has-banner'); // Clase para ajustar estilos de cabecera si hay banner
    } else {
        bannerView.classList.remove('has-banner');
    }
}

// Dibujar las secciones del grid (Mejores y Recientes)
function renderGrids(allAlbums) {
    // 1. Mis Mejores Valoraciones (Top 5)
    const topAlbums = [...allAlbums].sort((a, b) => b.rating - a.rating).slice(0, 5);
    drawAlbumsToContainer(topAlbums, topAlbumsGrid);

    // 2. Valoraciones Recientes (Todos ordenados por fecha de creación, inversa)
    const recentAlbums = [...allAlbums].sort((a, b) => b.id - a.id);
    drawAlbumsToContainer(recentAlbums, recentAlbumsGrid);
}

// Función reutilizable para dibujar álbumes en un grid
function drawAlbumsToContainer(albums, container) {
    container.innerHTML = '';
    if (albums.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted);">Aún no hay álbumes aquí.</p>';
        return;
    }

    albums.forEach(album => {
        const card = document.createElement('div');
        card.classList.add('album-card');

        // Asignamos una función de color falsa si no existe en db.js aún
        const ratingColor = (typeof getColorByRating === 'function') ? getColorByRating(album.rating) : '#b3b3b3';

        card.innerHTML = `
            <div class="cover-container"><img src="${album.coverBase64}" alt="${album.title}"></div>
            <div class="album-info">
                <div class="title-row">
                    <h3>${album.title}</h3>
                    <span class="rating-badge" style="background-color: ${ratingColor};">${album.rating}</span>
                </div>
                <p>${album.artist} • ${album.year}</p>
            </div>
        `;
        container.appendChild(card);
    });
}


// 2. GESTIÓN DE LA EDICIÓN DEL PERFIL

// Activar modo edición
btnEditProfile.addEventListener('click', () => {
    toggleEditMode(true);
    // Resetear temporales con datos actuales por si acaso
    tempAvatarData = currentProfileData.avatarData;
    tempBannerData = currentProfileData.bannerData;
});

// Cancelar edición
btnCancelEdit.addEventListener('click', () => {
    toggleEditMode(false);
    applyProfileDataToUI(currentProfileData); // Revertir UI a los datos guardados
});

// Guardar edición
btnSaveEdit.addEventListener('click', async () => {
    const newName = profileNameEdit.value.trim();
    if (!newName) {
        alert("El nombre de usuario no puede estar vacío.");
        return;
    }

    // Preparar objeto de datos actualizado
    const updatedProfile = {
        key: 'config',
        userName: newName,
        avatarData: tempAvatarData, // GuardarDataURLs finales
        bannerData: tempBannerData
    };

    // Guardar en la Base de Datos (db.js)
    await saveUserProfileToDB(updatedProfile);
    currentProfileData = updatedProfile; // Actualizar estado local

    // Salir del modo edición y refrescar UI
    toggleEditMode(false);
    applyProfileDataToUI(updatedProfile);
});

// Función central para cambiar entre modo ver y modo editar
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


// 3. SUBIDA DE IMÁGENES (AVATAR Y BANNER)

// Click en "EDITAR" del avatar -> abre el input file
avatarEditOverlay.addEventListener('click', () => inputAvatar.click());

// Click en "Cambiar Banner" -> abre el input file
bannerEditOverlay.addEventListener('click', () => inputBanner.click());

// Procesar el archivo seleccionado para el Avatar
inputAvatar.addEventListener('change', (e) => processImageFile(e.target.files[0], 'avatar'));

// Procesar el archivo seleccionado para el Banner
inputBanner.addEventListener('change', (e) => processImageFile(e.target.files[0], 'banner'));

// Función genérica para leer el archivo de imagen como DataURL (FileReader)
function processImageFile(file, type) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        alert("Por favor, selecciona un archivo de imagen válido.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        const dataURL = event.target.result;

        if (type === 'avatar') {
            tempAvatarData = dataURL;
            // Actualización visual temporal inmediata
            avatarCircle.style.backgroundImage = `url(${dataURL})`;
            avatarFallbackChar.style.display = 'none';
        } else if (type === 'banner') {
            tempBannerData = dataURL;
            // Actualización visual temporal inmediata
            bannerView.style.backgroundImage = `url(${dataURL})`;
        }
    };
    reader.readAsDataURL(file); // Iniciar la lectura
}


// INICIAR
loadProfilePage();
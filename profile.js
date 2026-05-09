// profile.js - Gestión de perfil

let currentProfileData = null;

const profileNameView    = document.getElementById('profile-name-view');
const avatarCircle       = document.getElementById('avatar-circle');
const avatarFallbackChar = document.getElementById('avatar-fallback-char');
const bannerView         = document.getElementById('profile-banner-view');

const btnEditProfile    = document.getElementById('btn-edit-profile');
const editActionsBar    = document.getElementById('edit-actions');
const btnCancelEdit     = document.getElementById('btn-cancel-edit');
const btnSaveEdit       = document.getElementById('btn-save-edit');
const bannerEditOverlay = document.getElementById('banner-edit-overlay');
const avatarEditOverlay = document.getElementById('avatar-edit-overlay');
const profileNameEdit   = document.getElementById('profile-name-edit');
const inputAvatar       = document.getElementById('input-avatar');
const inputBanner       = document.getElementById('input-banner');

let tempAvatarData = null;
let tempBannerData = null;

// SVG helpers
function discSVG() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;flex-shrink:0;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>`;
}

function tagSVG() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;flex-shrink:0;"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`;
}

// ── CARGA INICIAL ─────────────────────────────────────────────────────────
async function loadProfilePage() {
    currentProfileData = await getUserProfileFromDB();
    applyProfileDataToUI(currentProfileData);

    const allAlbums = await getAllAlbumsFromDB();
    const allMovies = await getAllItemsFromDB('movies');
    const allSeries = await getAllItemsFromDB('series');

    // Stats: total álbumes y género más escuchado
    const genreCount = {};
    allAlbums.forEach(a => {
        if (a.genres) a.genres.forEach(g => { genreCount[g] = (genreCount[g] || 0) + 1; });
    });
    const topGenre = Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0];

    const statsRow = document.getElementById('profile-stats-row');
    if (statsRow) {
        const totalAlbums = allAlbums.length;
        const genrePill = topGenre
            ? `<div class="profile-stat-pill">${tagSVG()} <span class="highlight">${topGenre[0]}</span></div>`
            : '';
        statsRow.innerHTML = `
            <div class="profile-stat-pill">${discSVG()} <span class="highlight">${totalAlbums}</span> álbum${totalAlbums !== 1 ? 'es' : ''}</div>
            ${genrePill}
        `;
    }

    // Grids
    renderSection(allAlbums, 'top-albums-grid', false, true);
    renderSection(allMovies, 'top-movies-grid', true, true);
    renderSection(allSeries, 'top-series-grid', true, true);

    const allReviews = [...allAlbums, ...allMovies, ...allSeries];
    const recentReviews = [...allReviews].sort((a, b) => b.id - a.id).slice(0, 10);
    renderSection(recentReviews, 'recent-albums-grid', false, false);
}

function renderSection(items, containerId, isVertical, sortByRating = true) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let displayItems = [...items];
    if (sortByRating) {
        displayItems = displayItems.sort((a, b) => b.rating - a.rating).slice(0, 5);
    }

    if (displayItems.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); padding: 20px;">No hay valoraciones aquí todavía.</p>';
        return;
    }

    container.innerHTML = '';
    displayItems.forEach(item => {
        const card = document.createElement('div');
        card.classList.add('album-card');

        if (containerId === 'top-albums-grid' || containerId === 'recent-albums-grid') {
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

function applyProfileDataToUI(data) {
    profileNameView.textContent = data.userName;
    profileNameEdit.value = data.userName;

    avatarCircle.style.backgroundImage = 'none';
    if (avatarFallbackChar) {
        avatarFallbackChar.style.display = 'flex';
        avatarFallbackChar.textContent = data.userName.charAt(0).toUpperCase();
    }

    if (data.avatarData) {
        avatarCircle.style.backgroundImage = `url(${data.avatarData})`;
        avatarCircle.style.backgroundSize = 'cover';
        avatarCircle.style.backgroundPosition = 'center';
        if (avatarFallbackChar) avatarFallbackChar.style.display = 'none';
    }

    if (data.bannerData) {
        bannerView.style.backgroundImage = `url(${data.bannerData})`;
        bannerView.classList.add('has-banner');
    } else {
        bannerView.style.backgroundImage = 'none';
        bannerView.classList.remove('has-banner');
    }
}

// ── EDICIÓN ───────────────────────────────────────────────────────────────
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
    if (!newName) { await brAlert("El nombre de usuario no puede estar vacío.", "Campo requerido"); return; }

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

    const headerAvatar = document.getElementById('global-header-avatar');
    if (headerAvatar) {
        if (tempAvatarData) {
            headerAvatar.style.backgroundImage = `url(${tempAvatarData})`;
            headerAvatar.style.backgroundSize = 'cover';
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

// ── IMÁGENES ──────────────────────────────────────────────────────────────
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
            avatarCircle.style.backgroundSize = 'cover';
            avatarCircle.style.backgroundPosition = 'center';
            if (avatarFallbackChar) avatarFallbackChar.style.display = 'none';
        } else {
            tempBannerData = dataURL;
            bannerView.style.backgroundImage = `url(${dataURL})`;
        }
    };
    reader.readAsDataURL(file);
}

// ── EXPORTAR / IMPORTAR ───────────────────────────────────────────────────
async function exportData() {
    try {
        const albums      = await getAllAlbumsFromDB();
        const movies      = await getAllItemsFromDB('movies');
        const series      = await getAllItemsFromDB('series');
        const profile     = await getUserProfileFromDB();
        const artists     = await getAllItemsFromDB('artists');
        const collections = await getAllItemsFromDB('collections');

        const backup = { _version: 2, _exportedAt: new Date().toISOString(), albums, movies, series, profile, artists, collections };
        const json   = JSON.stringify(backup, null, 2);
        const blob   = new Blob([json], { type: 'application/json' });
        const url    = URL.createObjectURL(blob);
        const a      = document.createElement('a');
        a.href = url;
        a.download = `bitrevs_backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showBackupMessage('Backup exportado correctamente', 'success');
    } catch (err) {
        showBackupMessage('Error al exportar los datos', 'error');
    }
}

async function importData(file) {
    if (!file) return;
    const confirmed = await brConfirm("Importar un backup sobreescribirá todos tus datos actuales. Esta acción no se puede deshacer.", "Importar backup");
    if (!confirmed) { document.getElementById('input-import').value = ''; return; }

    try {
        const text   = await file.text();
        const backup = JSON.parse(text);
        if (!backup.albums || !backup.movies || !backup.series) throw new Error("Archivo no válido.");

        for (const album of backup.albums)       await saveAlbumToDB(album);
        for (const movie of backup.movies)        await saveItemToDB('movies', movie);
        for (const serie of backup.series)        await saveItemToDB('series', serie);
        if (backup.profile)                       await saveUserProfileToDB(backup.profile);
        if (backup.artists?.length)               for (const artist of backup.artists)         await saveItemToDB('artists', artist);
        if (backup.collections?.length)           for (const col of backup.collections)        await saveItemToDB('collections', col);

        showBackupMessage('Backup importado correctamente. Recargando…', 'success');
        setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
        showBackupMessage('Error: ' + err.message, 'error');
    }
    document.getElementById('input-import').value = '';
}

function showBackupMessage(text, type) {
    const el = document.getElementById('backup-message');
    if (!el) return;
    el.textContent = text;
    el.style.color = type === 'success' ? '#2e7d32' : '#c62828';
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 3000);
}

document.getElementById('btn-export')?.addEventListener('click', exportData);
document.getElementById('input-import')?.addEventListener('change', (e) => importData(e.target.files[0]));
document.getElementById('btn-import')?.addEventListener('click', () => document.getElementById('input-import')?.click());

loadProfilePage();
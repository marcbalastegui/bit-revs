// profile.js — Perfil de usuario

let currentProfileData = null;

const ACCENT_COLORS = ['#FF66CC','#B533FF','#3366FF','#66CC33','#FFD11A','#FF8533','#FF3333','#222222'];

// Element refs
const profileNameView    = document.getElementById('profile-name-view');
const profileNameEdit    = document.getElementById('profile-name-edit');
const avatarCircle       = document.getElementById('avatar-circle');
const avatarFallbackChar = document.getElementById('avatar-fallback-char');
const bannerView         = document.getElementById('profile-banner-view');
const btnEditProfile     = document.getElementById('btn-edit-profile');
const editActionsBar     = document.getElementById('edit-actions');
const btnCancelEdit      = document.getElementById('btn-cancel-edit');
const btnSaveEdit        = document.getElementById('btn-save-edit');
const bannerEditOverlay  = document.getElementById('banner-edit-overlay');
const avatarEditOverlay  = document.getElementById('avatar-edit-overlay');
const inputAvatar        = document.getElementById('input-avatar');
const inputBanner        = document.getElementById('input-banner');

let tempAvatarData  = null;
let tempBannerData  = null;
let tempAccentColor = '#FF66CC';

// ── HELPERS ───────────────────────────────────────────────────────────────

function getDefaultBannerGradient(accentColor) {
    const hex = accentColor.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `linear-gradient(135deg, rgba(${r},${g},${b},0.22) 0%, rgba(235,235,235,0.7) 100%)`;
}

// ── CARGA INICIAL ─────────────────────────────────────────────────────────

async function loadProfilePage() {
    currentProfileData = await getUserProfileFromDB();
    applyProfileDataToUI(currentProfileData);

    const [allAlbums, allMovies, allSeries] = await Promise.all([
        getAllAlbumsFromDB(),
        getAllItemsFromDB('movies'),
        getAllItemsFromDB('series')
    ]);

    renderStatCards(allAlbums, allMovies, allSeries);
    renderScrollSection(allAlbums, 'scroll-albums', 'album');
    renderScrollSection(allMovies, 'scroll-movies', 'movie');
    renderScrollSection(allSeries, 'scroll-series', 'series');
    renderActivity(allAlbums, allMovies, allSeries);
}

// ── APPLY PROFILE DATA ────────────────────────────────────────────────────

function applyProfileDataToUI(data) {
    const accent = data.accentColor || '#FF66CC';
    document.documentElement.style.setProperty('--profile-accent', accent);

    // Name
    profileNameView.textContent = data.userName;
    profileNameEdit.value       = data.userName;

    // Bio
    const bioView = document.getElementById('profile-bio-view');
    const bioEdit = document.getElementById('profile-bio-edit');
    if (data.bio) {
        bioView.textContent = data.bio;
        bioView.classList.remove('hidden');
    } else {
        bioView.classList.add('hidden');
    }
    if (bioEdit) bioEdit.value = data.bio || '';

    // Avatar
    avatarCircle.style.backgroundImage = 'none';
    if (avatarFallbackChar) {
        avatarFallbackChar.style.display = 'flex';
        avatarFallbackChar.textContent   = data.userName.charAt(0).toUpperCase();
    }
    if (data.avatarData) {
        avatarCircle.style.backgroundImage    = `url(${data.avatarData})`;
        avatarCircle.style.backgroundSize     = 'cover';
        avatarCircle.style.backgroundPosition = 'center';
        if (avatarFallbackChar) avatarFallbackChar.style.display = 'none';
    }

    // Avatar ring color
    avatarCircle.style.boxShadow = `0 0 0 3px ${accent}`;

    // Banner
    if (data.bannerData) {
        bannerView.style.backgroundImage = `url(${data.bannerData})`;
    } else {
        bannerView.style.backgroundImage = getDefaultBannerGradient(accent);
    }
}

// ── STAT CARDS ────────────────────────────────────────────────────────────

function renderStatCards(allAlbums, allMovies, allSeries) {
    const el = document.getElementById('profile-stat-cards');
    if (!el) return;

    const rated = [...allAlbums, ...allMovies, ...allSeries].filter(i => parseFloat(i.rating) > 0);
    const total = rated.length;

    const avg = total > 0
        ? formatRating(Math.round(rated.reduce((s, i) => s + parseFloat(i.rating), 0) / total * 10) / 10)
        : '—';

    const artistSet = new Set(allAlbums.map(a => a.artist).filter(Boolean));

    const stats = [
        { num: total,           label: 'Valoraciones' },
        { num: avg,             label: 'Nota media' },
        { num: allAlbums.length, label: 'Álbumes' },
        { num: artistSet.size,  label: 'Artistas' }
    ];

    el.innerHTML = stats.map(s => `
        <div class="profile-stat-card">
            <div class="profile-stat-num">${s.num}</div>
            <div class="profile-stat-label">${s.label}</div>
        </div>
    `).join('');
}

// ── SCROLL SECTIONS ───────────────────────────────────────────────────────

function applyMediaTiebreaker(a, b, tiebreaker) {
    if (tiebreaker === 'year-desc') return (parseInt(b.year) || 0) - (parseInt(a.year) || 0);
    if (tiebreaker === 'year-asc')  return (parseInt(a.year) || 0) - (parseInt(b.year) || 0);
    if (tiebreaker === 'added')     return (a.id || 0) - (b.id || 0);
    return (a.title || '').localeCompare(b.title || ''); // alphabetical (default)
}

function renderScrollSection(items, containerId, type) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const isPortrait  = type === 'movie' || type === 'series';
    const tiebreaker  = isPortrait ? (localStorage.getItem('bitrevs_media_tiebreaker') || 'alphabetical') : null;

    const displayItems = [...items]
        .filter(i => parseFloat(i.rating) > 0)
        .sort((a, b) => {
            const rDiff = parseFloat(b.rating) - parseFloat(a.rating);
            if (rDiff !== 0) return rDiff;
            return tiebreaker ? applyMediaTiebreaker(a, b, tiebreaker) : 0;
        })
        .slice(0, 15);

    if (displayItems.length === 0) {
        const section = container.closest('.profile-section');
        if (section) section.style.display = 'none';
        return;
    }

    const getHref = (item) => {
        if (type === 'album')  return `album.html?id=${item.id}`;
        if (type === 'movie')  return `media-detail.html?type=movies&id=${item.id}`;
        return `media-detail.html?type=series&id=${item.id}`;
    };

    container.innerHTML = displayItems.map(item => {
        const badgeColor = getColorByRating(item.rating);
        const sub  = item.artist || item.director || item.creator || '';
        const href = getHref(item);
        const portrait = isPortrait ? ' portrait' : '';

        return `<div class="ps-card${portrait}" onclick="window.location.href='${href}'">
            <div class="ps-card-cover${portrait}">
                <img src="${item.coverBase64 || ''}" alt="" onerror="this.style.display='none'">
                <div class="ps-card-badge" style="background:${badgeColor}">${formatRating(item.rating)}</div>
            </div>
            <div class="ps-card-title">${item.title}</div>
            <div class="ps-card-sub">${sub}${sub && item.year ? ' · ' : ''}${item.year || ''}</div>
        </div>`;
    }).join('');
}

// ── ACTIVITY LIST ─────────────────────────────────────────────────────────

function renderActivity(allAlbums, allMovies, allSeries) {
    const container = document.getElementById('activity-list');
    if (!container) return;

    const all = [
        ...allAlbums.map(i => ({ ...i, _type: 'album' })),
        ...allMovies.map(i => ({ ...i, _type: 'movie' })),
        ...allSeries.map(i => ({ ...i, _type: 'series' }))
    ]
        .filter(i => parseFloat(i.rating) > 0)
        .sort((a, b) => b.id - a.id)
        .slice(0, 10);

    if (all.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);padding:16px 0;">No hay actividad reciente todavía.</p>';
        return;
    }

    const labels = { album: 'Álbum', movie: 'Película', series: 'Serie' };
    const getHref = (item) => {
        if (item._type === 'album')  return `album.html?id=${item.id}`;
        if (item._type === 'movie')  return `media-detail.html?type=movies&id=${item.id}`;
        return `media-detail.html?type=series&id=${item.id}`;
    };

    container.innerHTML = all.map(item => {
        const badgeColor = getColorByRating(item.rating);
        const sub  = item.artist || item.director || item.creator || '';
        const href = getHref(item);

        return `<div class="activity-item" onclick="window.location.href='${href}'">
            <img class="activity-thumb" src="${item.coverBase64 || ''}" alt="" onerror="this.style.opacity='0'">
            <div class="activity-info">
                <div class="activity-title">${item.title}</div>
                <div class="activity-sub">${sub}${sub && item.year ? ' · ' : ''}${item.year || ''}</div>
            </div>
            <div class="activity-type">${labels[item._type]}</div>
            <div class="activity-badge" style="background:${badgeColor}">${formatRating(item.rating)}</div>
        </div>`;
    }).join('');
}

// ── ACCENT PICKER ─────────────────────────────────────────────────────────

function renderAccentPicker(currentAccent) {
    const swatchesEl = document.getElementById('accent-swatches');
    if (!swatchesEl) return;

    swatchesEl.innerHTML = '';
    ACCENT_COLORS.forEach(color => {
        const sw = document.createElement('div');
        sw.className = 'accent-swatch' + (color === currentAccent ? ' selected' : '');
        sw.style.background = color;
        sw.dataset.color = color;
        sw.addEventListener('click', () => {
            document.querySelectorAll('.accent-swatch').forEach(s => s.classList.remove('selected'));
            sw.classList.add('selected');
            tempAccentColor = color;
            // Live preview
            document.documentElement.style.setProperty('--profile-accent', color);
            avatarCircle.style.boxShadow = `0 0 0 3px ${color}`;
            if (!tempBannerData) {
                bannerView.style.backgroundImage = getDefaultBannerGradient(color);
            }
        });
        swatchesEl.appendChild(sw);
    });
}

// ── EDIT MODE ─────────────────────────────────────────────────────────────

function toggleEditMode(isEditing) {
    const bioView = document.getElementById('profile-bio-view');
    const bioEdit = document.getElementById('profile-bio-edit');
    const accentPicker = document.getElementById('accent-picker');

    if (isEditing) {
        btnEditProfile.classList.add('hidden');
        editActionsBar.classList.remove('hidden');
        bannerEditOverlay.classList.remove('hidden');
        avatarEditOverlay.classList.remove('hidden');
        profileNameView.classList.add('hidden');
        profileNameEdit.classList.remove('hidden');
        bioView.classList.add('hidden');
        bioEdit.classList.remove('hidden');
        accentPicker.classList.remove('hidden');
        renderAccentPicker(tempAccentColor);
        profileNameEdit.focus();
    } else {
        btnEditProfile.classList.remove('hidden');
        editActionsBar.classList.add('hidden');
        bannerEditOverlay.classList.add('hidden');
        avatarEditOverlay.classList.add('hidden');
        profileNameView.classList.remove('hidden');
        profileNameEdit.classList.add('hidden');
        bioEdit.classList.add('hidden');
        accentPicker.classList.add('hidden');
        // Show bio only if non-empty
        if (currentProfileData && currentProfileData.bio) {
            bioView.classList.remove('hidden');
        } else {
            bioView.classList.add('hidden');
        }
    }
}

btnEditProfile.addEventListener('click', () => {
    tempAvatarData  = currentProfileData.avatarData  ?? null;
    tempBannerData  = currentProfileData.bannerData  ?? null;
    tempAccentColor = currentProfileData.accentColor ?? '#FF66CC';
    toggleEditMode(true);
});

btnCancelEdit.addEventListener('click', () => {
    toggleEditMode(false);
    applyProfileDataToUI(currentProfileData);
});

btnSaveEdit.addEventListener('click', async () => {
    const newName = profileNameEdit.value.trim();
    if (!newName) {
        await brAlert('El nombre de usuario no puede estar vacío.', 'Campo requerido');
        return;
    }

    const bioEditEl = document.getElementById('profile-bio-edit');
    const newBio    = bioEditEl ? bioEditEl.value.trim() : '';

    const updatedProfile = {
        key:         'config',
        userName:    newName,
        bio:         newBio,
        avatarData:  tempAvatarData,
        bannerData:  tempBannerData,
        accentColor: tempAccentColor
    };

    btnSaveEdit.disabled    = true;
    btnSaveEdit.textContent = 'Guardando…';

    try {
        await saveUserProfileToDB(updatedProfile);
        currentProfileData = updatedProfile;
        toggleEditMode(false);
        applyProfileDataToUI(updatedProfile);

        // Update header avatar
        const headerAvatar = document.getElementById('global-header-avatar');
        if (headerAvatar) {
            if (tempAvatarData) {
                headerAvatar.style.backgroundImage    = `url(${tempAvatarData})`;
                headerAvatar.style.backgroundSize     = 'cover';
                headerAvatar.style.backgroundPosition = 'center';
                headerAvatar.textContent = '';
            } else {
                headerAvatar.style.backgroundImage = '';
                headerAvatar.textContent = newName.charAt(0).toUpperCase();
            }
        }
    } catch (err) {
        console.error('Error al guardar perfil:', err);
        await brAlert('No se pudo guardar el perfil. Comprueba tu conexión e inténtalo de nuevo.', 'Error al guardar');
    } finally {
        btnSaveEdit.disabled    = false;
        btnSaveEdit.textContent = 'Guardar Cambios';
    }
});

// ── IMAGES ────────────────────────────────────────────────────────────────

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
            avatarCircle.style.backgroundImage    = `url(${dataURL})`;
            avatarCircle.style.backgroundSize     = 'cover';
            avatarCircle.style.backgroundPosition = 'center';
            if (avatarFallbackChar) avatarFallbackChar.style.display = 'none';
        } else {
            tempBannerData = dataURL;
            bannerView.style.backgroundImage = `url(${dataURL})`;
        }
    };
    reader.readAsDataURL(file);
}

// ── EXPORT / IMPORT ───────────────────────────────────────────────────────

async function exportData() {
    try {
        const albums      = await getAllAlbumsFromDB();
        const movies      = await getAllItemsFromDB('movies');
        const series      = await getAllItemsFromDB('series');
        const profile     = await getUserProfileFromDB();
        const artists     = await getAllItemsFromDB('artists');
        const collections = await getAllItemsFromDB('collections');
        const lists       = await getAllItemsFromDB('lists');

        const backup = {
            _version:    3,
            _exportedAt: new Date().toISOString(),
            albums, movies, series, profile, artists, collections, lists
        };

        const json = JSON.stringify(backup, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `bitrevs_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showBackupMessage('Backup exportado correctamente', 'success');
    } catch {
        showBackupMessage('Error al exportar los datos', 'error');
    }
}

async function importData(file) {
    if (!file) return;
    const confirmed = await brConfirm(
        'Importar un backup sobreescribirá todos tus datos actuales. Esta acción no se puede deshacer.',
        'Importar backup'
    );
    if (!confirmed) { document.getElementById('input-import').value = ''; return; }

    try {
        const text   = await file.text();
        const backup = JSON.parse(text);
        if (!backup.albums || !backup.movies || !backup.series) throw new Error('Archivo no válido.');

        for (const album of backup.albums)  await saveAlbumToDB(album);
        for (const movie of backup.movies)  await saveItemToDB('movies', movie);
        for (const serie of backup.series)  await saveItemToDB('series', serie);
        if (backup.profile)                 await saveUserProfileToDB(backup.profile);
        if (backup.artists?.length)         for (const a of backup.artists)     await saveItemToDB('artists', a);
        if (backup.collections?.length)     for (const c of backup.collections) await saveItemToDB('collections', c);
        if (backup.lists?.length)           for (const l of backup.lists)       await saveItemToDB('lists', l);

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
    el.textContent  = text;
    el.style.color  = type === 'success' ? '#2e7d32' : '#c62828';
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 3000);
}

document.getElementById('btn-export')?.addEventListener('click', exportData);
document.getElementById('btn-import')?.addEventListener('click', () => document.getElementById('input-import')?.click());
document.getElementById('input-import')?.addEventListener('change', (e) => importData(e.target.files[0]));

loadProfilePage();

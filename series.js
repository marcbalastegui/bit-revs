// series.js - Gestión de Series

const storeType   = 'series';
const mediaGrid   = document.getElementById('media-grid');
const modalAdd    = document.getElementById('modal-add');
const mediaForm   = document.getElementById('media-form');
const filterInput = document.getElementById('filter-input');
const sortSelect  = document.getElementById('sort-select');
let editingId = null;
let detailsTargetId = null;

const DEFAULT_SORT_KEY = 'bitrevs_series_default_sort';

function updateDefaultBtn() {
    const btn   = document.getElementById('btn-default-sort');
    if (!btn || !sortSelect) return;
    const saved = localStorage.getItem(DEFAULT_SORT_KEY);
    const isDefault = saved !== null && saved === sortSelect.value;
    btn.style.background  = isDefault ? 'var(--text-main)' : 'none';
    btn.style.color       = isDefault ? '#fff'             : 'var(--text-muted)';
    btn.style.borderColor = isDefault ? 'var(--text-main)' : 'var(--border-color)';
    btn.title = isDefault ? 'Quitar predeterminado' : 'Guardar como orden predeterminado';
}

// ── BORRAR ────────────────────────────────────────────────────────────────
window.deleteMedia = async function(event, id) {
    event.stopPropagation();
    if (confirm("¿Borrar definitivamente?")) {
        await deleteItemFromDB(storeType, id);
        processAndRenderMedia();
    }
}

// ── EDITAR ────────────────────────────────────────────────────────────────
window.editMedia = async function(event, id) {
    event.stopPropagation();
    const item = await getItemByIdFromDB(storeType, id);
    editingId = item.id;

    document.getElementById('title').value    = item.title    || '';
    document.getElementById('creator').value  = item.creator  || '';
    document.getElementById('year').value     = item.year     || '';
    document.getElementById('duration').value = item.duration || '';
    document.getElementById('genre').value    = item.genre    || '';
    document.getElementById('rating').value   = item.rating   || '';
    document.getElementById('cover').removeAttribute('required');
    document.querySelector('#modal-add h2').textContent = 'Editar Serie';
    modalAdd.classList.remove('hidden');
}

// ── MODAL AÑADIR ──────────────────────────────────────────────────────────
document.getElementById('btn-add-media')?.addEventListener('click', () => {
    editingId = null;
    mediaForm.reset();
    document.getElementById('cover').setAttribute('required', 'true');
    document.querySelector('#modal-add h2').textContent = 'Nueva Serie';
    modalAdd.classList.remove('hidden');
});

document.getElementById('btn-cancel')?.addEventListener('click', () => {
    modalAdd.classList.add('hidden');
    mediaForm.reset();
});

// ── GUARDAR SERIE ─────────────────────────────────────────────────────────
mediaForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title    = document.getElementById('title').value.trim();
    const creator  = document.getElementById('creator').value.trim();
    const year     = document.getElementById('year').value;
    const duration = document.getElementById('duration').value;
    const genre    = document.getElementById('genre').value.trim();
    const rating   = document.getElementById('rating').value.replace(',', '.');
    const file     = document.getElementById('cover').files[0];

    let itemToSave = editingId
        ? await getItemByIdFromDB(storeType, editingId)
        : { id: Date.now() };

    itemToSave.title    = title;
    itemToSave.creator  = creator;
    itemToSave.year     = year;
    itemToSave.duration = duration;
    itemToSave.genre    = genre;
    itemToSave.rating   = parseFloat(rating).toFixed(1);

    if (file) {
        const reader = new FileReader();
        reader.onload = async (ev) => {
            itemToSave.coverBase64 = ev.target.result;
            await saveItemToDB(storeType, itemToSave);
            modalAdd.classList.add('hidden');
            mediaForm.reset();
            processAndRenderMedia();
        };
        reader.readAsDataURL(file);
    } else {
        await saveItemToDB(storeType, itemToSave);
        modalAdd.classList.add('hidden');
        mediaForm.reset();
        processAndRenderMedia();
    }
});

// ── MÁS DETALLES ──────────────────────────────────────────────────────────
window.openDetails = async function(event, id) {
    event.stopPropagation();
    const item = await getItemByIdFromDB(storeType, id);
    detailsTargetId = id;

    document.getElementById('details-title').textContent      = item.title || 'Más detalles';
    document.getElementById('details-seasons').value          = item.seasons   || '';
    document.getElementById('details-fav-season').value       = item.favSeason || '';
    document.getElementById('details-start-date').value       = item.startDate || '';
    document.getElementById('details-end-date').value         = item.endDate   || '';
    document.getElementById('details-quote').value            = item.quote     || '';
    document.getElementById('details-review').value           = item.review    || '';

    document.getElementById('modal-details').classList.remove('hidden');
}

document.getElementById('btn-cancel-details')?.addEventListener('click', () => {
    document.getElementById('modal-details').classList.add('hidden');
});

document.getElementById('details-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const item = await getItemByIdFromDB(storeType, detailsTargetId);
    item.seasons   = document.getElementById('details-seasons').value;
    item.favSeason = document.getElementById('details-fav-season').value;
    item.startDate = document.getElementById('details-start-date').value;
    item.endDate   = document.getElementById('details-end-date').value;
    item.quote     = document.getElementById('details-quote').value.trim();
    item.review    = document.getElementById('details-review').value.trim();

    await saveItemToDB(storeType, item);
    document.getElementById('modal-details').classList.add('hidden');
    processAndRenderMedia();
});

// ── FILTRAR Y RENDERIZAR ──────────────────────────────────────────────────
async function processAndRenderMedia() {
    let items = await getAllItemsFromDB(storeType);

    if (filterInput && filterInput.value) {
        const query = filterInput.value.toLowerCase().trim();
        items = items.filter(item =>
            (item.title   && item.title.toLowerCase().includes(query))   ||
            (item.creator && item.creator.toLowerCase().includes(query)) ||
            (item.year    && item.year.toString().includes(query))       ||
            (item.genre   && item.genre.toLowerCase().includes(query))
        );
    }

    if (sortSelect && sortSelect.value !== 'default') {
        const val = sortSelect.value;
        items.sort((a, b) => {
            if (val === 'rating-desc') return b.rating - a.rating;
            if (val === 'rating-asc')  return a.rating - b.rating;
            if (val === 'year-desc')   return b.year - a.year;
            if (val === 'year-asc')    return a.year - b.year;
            if (val === 'title-asc')   return a.title.localeCompare(b.title);
            return 0;
        });
    }

    renderMediaGrid(items);
}

function renderMediaGrid(items) {
    mediaGrid.innerHTML = items.length ? '' : '<p style="color:var(--text-muted)">No hay series todavía.</p>';

    items.forEach(item => {
        const card = document.createElement('div');
        card.classList.add('album-card');
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => window.location.href = `media-detail.html?type=series&id=${item.id}`);
        const badgeColor = getColorByRating(item.rating);

        const creatorHtml = item.creator
            ? `<p style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">Cr. ${item.creator}</p>`
            : '';

        const metaHtml = [
            item.genre    ? item.genre : null,
            item.duration ? `${item.duration} min/ep` : null,
            item.seasons  ? `${item.seasons} temp.` : null
        ].filter(Boolean).join(' · ');

        const metaLine = metaHtml
            ? `<p style="font-size:0.75rem; color:var(--text-muted); margin-top:3px;">${metaHtml}</p>`
            : '';

        const hasDetails = item.seasons || item.favSeason || item.startDate || item.endDate || item.quote || item.review;

        card.innerHTML = `
            <div class="card-actions">
                <button class="action-btn btn-edit" onclick="editMedia(event, ${item.id})" onclick="event.stopPropagation()">✎</button>
                <button class="action-btn btn-delete" onclick="deleteMedia(event, ${item.id})">✖</button>
            </div>
            <div class="cover-container vertical"><img src="${item.coverBase64}" alt="${item.title}"></div>
            <div class="album-info">
                <div class="title-row">
                    <h3>${item.title}</h3>
                    <span class="rating-badge" style="background-color: ${badgeColor};">${formatRating(item.rating)}</span>
                </div>
                <p>${item.year}</p>
                ${creatorHtml}
                ${metaLine}
                <button onclick="openDetails(event, ${item.id})"
                    style="margin-top:8px; background:${hasDetails ? 'rgba(230,57,70,0.08)' : 'var(--bg-secondary)'}; border:1px solid ${hasDetails ? 'rgba(230,57,70,0.3)' : 'var(--border-color)'}; color:${hasDetails ? 'var(--accent-red)' : 'var(--text-muted)'}; padding:4px 10px; border-radius:8px; font-size:0.72rem; font-weight:700; cursor:pointer; font-family:'Inter',sans-serif; transition:all 0.2s;">
                    ${hasDetails ? '★ Ver detalles' : '+ Más detalles'}
                </button>
            </div>
        `;
        mediaGrid.appendChild(card);
    });
}

filterInput?.addEventListener('input', processAndRenderMedia);

sortSelect?.addEventListener('change', () => {
    updateDefaultBtn();
    processAndRenderMedia();
});

document.getElementById('btn-default-sort')?.addEventListener('click', () => {
    const saved = localStorage.getItem(DEFAULT_SORT_KEY);
    if (saved !== null && saved === sortSelect.value) {
        localStorage.removeItem(DEFAULT_SORT_KEY);   // toggle off
    } else {
        localStorage.setItem(DEFAULT_SORT_KEY, sortSelect.value);
    }
    updateDefaultBtn();
});

// Cargar orden predeterminado guardado y renderizar
const _savedDefault = localStorage.getItem(DEFAULT_SORT_KEY);
if (_savedDefault && sortSelect) sortSelect.value = _savedDefault;
updateDefaultBtn();
processAndRenderMedia();

// ── MODO GALERÍA ──────────────────────────────────────────────────────────
let galleryMode = false;
const galleryBtn = document.getElementById('gallery-toggle');
if (galleryBtn) {
    galleryBtn.addEventListener('click', () => {
        galleryMode = !galleryMode;
        galleryBtn.classList.toggle('active', galleryMode);
        const grid = document.getElementById('media-grid');
        if (grid) {
            grid.classList.toggle('gallery-mode', galleryMode);
            if (galleryMode) {
                grid.querySelectorAll('.album-card').forEach(card => {
                    const badge = card.querySelector('.rating-badge');
                    if (badge && !card.querySelector('.card-gallery-badge')) {
                        const gb = document.createElement('span');
                        gb.className = 'card-gallery-badge';
                        gb.style.background = badge.style.backgroundColor;
                        gb.textContent = badge.textContent;
                        card.appendChild(gb);
                    }
                });
            } else {
                grid.querySelectorAll('.card-gallery-badge').forEach(b => b.remove());
            }
        }
    });
}
// movies.js - Gestión de Películas

const storeType  = 'movies';
const mediaGrid  = document.getElementById('media-grid');
const modalAdd   = document.getElementById('modal-add');
const mediaForm  = document.getElementById('media-form');
const filterInput = document.getElementById('filter-input');
const sortSelect  = document.getElementById('sort-select');
let editingId = null;
let detailsTargetId = null;

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
    document.getElementById('director').value = item.director || '';
    document.getElementById('year').value     = item.year     || '';
    document.getElementById('duration').value = item.duration || '';
    document.getElementById('genre').value    = item.genre    || '';
    document.getElementById('rating').value   = item.rating   || '';
    document.getElementById('cover').removeAttribute('required');
    document.querySelector('#modal-add h2').textContent = 'Editar Película';
    modalAdd.classList.remove('hidden');
}

// ── MODAL AÑADIR ──────────────────────────────────────────────────────────
document.getElementById('btn-add-media')?.addEventListener('click', () => {
    editingId = null;
    mediaForm.reset();
    document.getElementById('cover').setAttribute('required', 'true');
    document.querySelector('#modal-add h2').textContent = 'Nueva Película';
    modalAdd.classList.remove('hidden');
});

document.getElementById('btn-cancel')?.addEventListener('click', () => {
    modalAdd.classList.add('hidden');
    mediaForm.reset();
});

// ── GUARDAR PELÍCULA ──────────────────────────────────────────────────────
mediaForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title    = document.getElementById('title').value.trim();
    const director = document.getElementById('director').value.trim();
    const year     = document.getElementById('year').value;
    const duration = document.getElementById('duration').value;
    const genre    = document.getElementById('genre').value.trim();
    const rating   = document.getElementById('rating').value.replace(',', '.');
    const file     = document.getElementById('cover').files[0];

    let itemToSave = editingId
        ? await getItemByIdFromDB(storeType, editingId)
        : { id: Date.now() };

    itemToSave.title    = title;
    itemToSave.director = director;
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

    document.getElementById('details-title').textContent   = item.title || 'Más detalles';
    document.getElementById('details-country').value       = item.country   || '';
    document.getElementById('details-actors').value        = item.actors    || '';
    document.getElementById('details-watch-date').value    = item.watchDate || '';
    document.getElementById('details-review').value        = item.review    || '';

    document.getElementById('modal-details').classList.remove('hidden');
}

document.getElementById('btn-cancel-details')?.addEventListener('click', () => {
    document.getElementById('modal-details').classList.add('hidden');
});

document.getElementById('details-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const item = await getItemByIdFromDB(storeType, detailsTargetId);
    item.country   = document.getElementById('details-country').value.trim();
    item.actors    = document.getElementById('details-actors').value.trim();
    item.watchDate = document.getElementById('details-watch-date').value;
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
            (item.title    && item.title.toLowerCase().includes(query))    ||
            (item.director && item.director.toLowerCase().includes(query)) ||
            (item.year     && item.year.toString().includes(query))        ||
            (item.genre    && item.genre.toLowerCase().includes(query))
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
    mediaGrid.innerHTML = items.length ? '' : '<p style="color:var(--text-muted)">No hay películas todavía.</p>';

    items.forEach(item => {
        const card = document.createElement('div');
        card.classList.add('album-card');
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => window.location.href = `media-detail.html?type=movies&id=${item.id}`);
        const badgeColor = getColorByRating(item.rating);

        const directorHtml = item.director
            ? `<p style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">Dir. ${item.director}</p>`
            : '';

        const metaHtml = [
            item.genre    ? item.genre : null,
            item.duration ? `${item.duration} min` : null
        ].filter(Boolean).join(' · ');

        const metaLine = metaHtml
            ? `<p style="font-size:0.75rem; color:var(--text-muted); margin-top:3px;">${metaHtml}</p>`
            : '';

        const hasDetails = item.country || item.actors || item.watchDate || item.review;

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
                ${directorHtml}
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
sortSelect?.addEventListener('change', processAndRenderMedia);

processAndRenderMedia();
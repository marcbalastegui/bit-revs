// movies.js - Gestión de Películas

const storeType   = 'movies';
const mediaGrid   = document.getElementById('media-grid');
const modalAdd    = document.getElementById('modal-add');
const mediaForm   = document.getElementById('media-form');
const filterInput = document.getElementById('filter-input');
const sortSelect  = document.getElementById('sort-select');
const genreFilter   = document.getElementById('genre-filter');
const countryFilter = document.getElementById('country-filter');
const yearFrom      = document.getElementById('year-from');
const yearTo        = document.getElementById('year-to');

let editingId = null;
let detailsTargetId = null;

// ── HELPERS ───────────────────────────────────────────────────────────────
function parseGenres(genreStr) {
    if (!genreStr) return [];
    return genreStr.split(',').map(g => g.trim()).filter(g => g !== '');
}

// ── POBLAR FILTROS DINÁMICAMENTE ──────────────────────────────────────────
async function populateFilters() {
    const items = await getAllItemsFromDB(storeType);

    // Géneros
    const genreSet = new Set();
    items.forEach(item => parseGenres(item.genre).forEach(g => genreSet.add(g)));
    const prevGenre = genreFilter.value;
    genreFilter.innerHTML = '<option value="">Todos los géneros</option>';
    [...genreSet].sort().forEach(g => {
        const opt = document.createElement('option');
        opt.value = g; opt.textContent = g;
        if (g === prevGenre) opt.selected = true;
        genreFilter.appendChild(opt);
    });

    // Países
    const countrySet = new Set();
    items.forEach(item => { if (item.country?.trim()) countrySet.add(item.country.trim()); });
    const prevCountry = countryFilter.value;
    countryFilter.innerHTML = '<option value="">Todos los países</option>';
    [...countrySet].sort().forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        if (c === prevCountry) opt.selected = true;
        countryFilter.appendChild(opt);
    });
}

// ── BORRAR ────────────────────────────────────────────────────────────────
window.deleteMedia = async function(event, id) {
    event.stopPropagation();
    if (await brConfirm("Esta acción no se puede deshacer.", "¿Borrar película?")) {
        await deleteItemFromDB(storeType, id);
        await populateFilters();
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
    const ratingRaw = document.getElementById('rating').value.replace(',', '.');
    const file     = document.getElementById('cover').files[0];

    if (isNaN(parseFloat(ratingRaw)) || parseFloat(ratingRaw) < 0 || parseFloat(ratingRaw) > 10) {
        await brAlert("Introduce una nota válida entre 0 y 10.", "Nota inválida");
        return;
    }

    let itemToSave = editingId
        ? await getItemByIdFromDB(storeType, editingId)
        : { id: Date.now() };

    itemToSave.title    = title;
    itemToSave.director = director;
    itemToSave.year     = parseInt(year) || year;
    itemToSave.duration = duration ? parseInt(duration) : '';
    itemToSave.genre    = genre;
    itemToSave.rating   = parseFloat(ratingRaw).toFixed(1);

    const doSave = async () => {
        try {
            await saveItemToDB(storeType, itemToSave);
            modalAdd.classList.add('hidden');
            mediaForm.reset();
            await populateFilters();
            processAndRenderMedia();
        } catch (err) {
            console.error('Error al guardar:', err);
            await brAlert(`No se pudo guardar: ${err.message || err}`, "Error al guardar");
        }
    };

    if (file) {
        const reader = new FileReader();
        reader.onload = async (ev) => { itemToSave.coverBase64 = ev.target.result; await doSave(); };
        reader.readAsDataURL(file);
    } else {
        await doSave();
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

    try {
        await saveItemToDB(storeType, item);
        document.getElementById('modal-details').classList.add('hidden');
        await populateFilters();
        processAndRenderMedia();
    } catch (err) {
        await brAlert(`No se pudo guardar: ${err.message || err}`, "Error al guardar");
    }
});

// ── LIMPIAR FILTROS ───────────────────────────────────────────────────────
document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
    if (filterInput)  filterInput.value  = '';
    if (sortSelect)   sortSelect.value   = 'default';
    if (genreFilter)  genreFilter.value  = '';
    if (countryFilter) countryFilter.value = '';
    if (yearFrom)     yearFrom.value     = '';
    if (yearTo)       yearTo.value       = '';
    processAndRenderMedia();
});

// ── FILTRAR Y RENDERIZAR ──────────────────────────────────────────────────
async function processAndRenderMedia() {
    let items = await getAllItemsFromDB(storeType);

    // Texto libre
    const query = filterInput?.value.toLowerCase().trim();
    if (query) {
        items = items.filter(item =>
            (item.title    && item.title.toLowerCase().includes(query))    ||
            (item.director && item.director.toLowerCase().includes(query)) ||
            (item.year     && item.year.toString().includes(query))        ||
            (item.actors   && item.actors.toLowerCase().includes(query))
        );
    }

    // Género
    const selectedGenre = genreFilter?.value;
    if (selectedGenre) {
        items = items.filter(item =>
            parseGenres(item.genre).some(g => g === selectedGenre)
        );
    }

    // País
    const selectedCountry = countryFilter?.value;
    if (selectedCountry) {
        items = items.filter(item =>
            item.country?.trim() === selectedCountry
        );
    }

    // Rango de años
    const from = parseInt(yearFrom?.value);
    const to   = parseInt(yearTo?.value);
    if (!isNaN(from)) items = items.filter(item => parseInt(item.year) >= from);
    if (!isNaN(to))   items = items.filter(item => parseInt(item.year) <= to);

    // Orden
    const sort = sortSelect?.value;
    if (sort && sort !== 'default') {
        items.sort((a, b) => {
            if (sort === 'rating-desc') return parseFloat(b.rating) - parseFloat(a.rating);
            if (sort === 'rating-asc')  return parseFloat(a.rating) - parseFloat(b.rating);
            if (sort === 'year-desc')   return parseInt(b.year)  - parseInt(a.year);
            if (sort === 'year-asc')    return parseInt(a.year)  - parseInt(b.year);
            if (sort === 'title-asc')   return (a.title || '').localeCompare(b.title || '');
            if (sort === 'title-desc')  return (b.title || '').localeCompare(a.title || '');
            return 0;
        });
    }

    renderMediaGrid(items);
}

function renderMediaGrid(items) {
    mediaGrid.innerHTML = items.length
        ? ''
        : '<p style="color:var(--text-muted)">No hay películas que coincidan con los filtros.</p>';

    items.forEach(item => {
        const card = document.createElement('div');
        card.classList.add('album-card');
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => window.location.href = `media-detail.html?type=movies&id=${item.id}`);
        const badgeColor = getColorByRating(item.rating);

        const directorHtml = item.director
            ? `<p style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">Dir. ${item.director}</p>`
            : '';

        const metaParts = [item.genre, item.duration ? `${item.duration} min` : null].filter(Boolean);
        const metaLine  = metaParts.length
            ? `<p style="font-size:0.75rem;color:var(--text-muted);margin-top:3px;">${metaParts.join(' · ')}</p>`
            : '';

        const countryBadge = item.country
            ? `<span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:6px;background:var(--bg-secondary);border:1px solid var(--border-color);font-size:0.7rem;font-weight:700;color:var(--text-muted);">${item.country}</span>`
            : '';

        const hasDetails = item.country || item.actors || item.watchDate || item.review;

        card.innerHTML = `
            <div class="card-actions">
                <button class="action-btn btn-edit" onclick="editMedia(event, ${item.id})">✎</button>
                <button class="action-btn btn-delete" onclick="deleteMedia(event, ${item.id})">✖</button>
            </div>
            <div class="cover-container vertical"><img src="${item.coverBase64 || ''}" alt="${item.title}"></div>
            <div class="album-info">
                <div class="title-row">
                    <h3>${item.title}</h3>
                    <span class="rating-badge" style="background-color:${badgeColor};">${formatRating(item.rating)}</span>
                </div>
                <p>${item.year}</p>
                ${directorHtml}
                ${metaLine}
                ${countryBadge}
                <button onclick="openDetails(event, ${item.id})"
                    style="margin-top:8px;background:${hasDetails ? 'rgba(230,57,70,0.08)' : 'var(--bg-secondary)'};border:1px solid ${hasDetails ? 'rgba(230,57,70,0.3)' : 'var(--border-color)'};color:${hasDetails ? 'var(--accent-red)' : 'var(--text-muted)'};padding:4px 10px;border-radius:8px;font-size:0.72rem;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;transition:all 0.2s;">
                    ${hasDetails ? '★ Ver detalles' : '+ Más detalles'}
                </button>
            </div>
        `;
        mediaGrid.appendChild(card);
    });
}

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

// ── EVENT LISTENERS ───────────────────────────────────────────────────────
filterInput?.addEventListener('input',   processAndRenderMedia);
sortSelect?.addEventListener('change',   processAndRenderMedia);
genreFilter?.addEventListener('change',  processAndRenderMedia);
countryFilter?.addEventListener('change', processAndRenderMedia);
yearFrom?.addEventListener('input',      processAndRenderMedia);
yearTo?.addEventListener('input',        processAndRenderMedia);

// ── INIT ──────────────────────────────────────────────────────────────────
(async () => {
    await populateFilters();
    await processAndRenderMedia();
})();

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

const DEFAULT_SORT_KEY = 'bitrevs_movies_default_sort';

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

let editingId = null;
let detailsTargetId = null;

// ── SUGERENCIAS DE PAÍS ───────────────────────────────────────────────────
let _countrySuggestionsData = []; // [{name, count, lastId}] — cargado al init

async function loadCountrySuggestions() {
    const items = await getAllItemsFromDB(storeType);
    const map   = {};
    items.forEach(item => {
        if (!item.country?.trim()) return;
        const c = item.country.trim();
        if (!map[c]) map[c] = { count: 0, lastId: 0 };
        map[c].count++;
        if (item.id > map[c].lastId) map[c].lastId = item.id;
    });

    // Score = frecuencia × 3 + bonus de recencia
    // recencia: más peso cuanto más reciente (en base al id = Date.now() al crear)
    const recencyBonus = (lastId) => {
        const days = (Date.now() - lastId) / 86_400_000;
        if (days < 7)   return 9;   // última semana
        if (days < 30)  return 5;   // último mes
        if (days < 90)  return 2;   // últimos 3 meses
        return 0;
    };

    _countrySuggestionsData = Object.entries(map)
        .map(([name, { count, lastId }]) => ({
            name, count, lastId,
            score: count * 3 + recencyBonus(lastId),
            isRecent: (Date.now() - lastId) < 30 * 86_400_000
        }))
        .sort((a, b) => b.score - a.score);
}

function renderCountrySuggestions(query) {
    const container = document.getElementById('country-suggestions');
    if (!container) return;

    const q = (query || '').toLowerCase().trim();

    let filtered;
    if (q) {
        // Primero los que empiezan por el query, luego los que lo contienen
        const startsWith = _countrySuggestionsData.filter(s => s.name.toLowerCase().startsWith(q));
        const contains   = _countrySuggestionsData.filter(s =>
            !s.name.toLowerCase().startsWith(q) && s.name.toLowerCase().includes(q)
        );
        filtered = [...startsWith, ...contains];
    } else {
        // Sin filtro: mostrar los de mayor score (favoritos + recientes)
        filtered = _countrySuggestionsData;
    }

    const top = filtered.slice(0, 10);
    if (top.length === 0) { container.style.display = 'none'; return; }

    container.innerHTML = top.map(s => {
        const code  = getCountryCode(s.name);
        const flag  = code ? `<img src="https://flagcdn.com/w20/${code}.png" alt="" style="width:15px;height:auto;border-radius:1px;">` : '';
        let badge   = '';
        if (s.isRecent && s.count === 1) {
            badge = `<span class="country-chip-badge recent">Reciente</span>`;
        } else if (s.isRecent && s.count > 1) {
            badge = `<span class="country-chip-badge recent">${s.count}× Reciente</span>`;
        } else if (s.count > 1) {
            badge = `<span class="country-chip-badge">${s.count} pelis</span>`;
        }
        return `<button type="button" class="country-chip" data-name="${s.name}">${flag}${s.name}${badge}</button>`;
    }).join('');

    container.querySelectorAll('.country-chip').forEach(chip => {
        chip.addEventListener('mousedown', e => {
            e.preventDefault(); // evita blur antes del click
            const input = document.getElementById('details-country');
            if (input) { input.value = chip.dataset.name; updateCountryFlagPreview(chip.dataset.name); }
            container.style.display = 'none';
        });
    });

    container.style.display = 'flex';
}

// ── DRAG STATE ────────────────────────────────────────────────────────────
let dragSrcId     = null;
let dragSrcRating = null;
let isDragging    = false;
let _currentItems = [];
let _allCountries = []; // cache de países para el dropdown custom

// ── FLAGS ─────────────────────────────────────────────────────────────────
const COUNTRY_CODES = {
    'afghanistan':'af','albania':'al','alemania':'de','algeria':'dz','andorra':'ad',
    'angola':'ao','arabia saudita':'sa','argentina':'ar','armenia':'am','australia':'au',
    'austria':'at','azerbaiyán':'az','bangladesh':'bd','bélgica':'be','bolivia':'bo',
    'bosnia':'ba','brasil':'br','bulgaria':'bg','camboya':'kh','camerún':'cm',
    'canadá':'ca','chile':'cl','china':'cn','chipre':'cy','colombia':'co',
    'corea del norte':'kp','corea del sur':'kr','costa rica':'cr','croacia':'hr',
    'cuba':'cu','dinamarca':'dk','ecuador':'ec','egipto':'eg',
    'emiratos árabes unidos':'ae','emiratos árabes':'ae','eslovaquia':'sk',
    'eslovenia':'si','españa':'es','estados unidos':'us','estonia':'ee',
    'etiopía':'et','filipinas':'ph','finlandia':'fi','francia':'fr',
    'georgia':'ge','ghana':'gh','grecia':'gr','guatemala':'gt','hong kong':'hk',
    'hungría':'hu','india':'in','indonesia':'id','irán':'ir','irak':'iq',
    'irlanda':'ie','islandia':'is','israel':'il','italia':'it','jamaica':'jm',
    'japón':'jp','jordania':'jo','kazajistán':'kz','kenia':'ke','letonia':'lv',
    'líbano':'lb','lituania':'lt','luxemburgo':'lu','malasia':'my','malta':'mt',
    'marruecos':'ma','méxico':'mx','moldavia':'md','mongolia':'mn',
    'montenegro':'me','myanmar':'mm','nepal':'np','nicaragua':'ni','nigeria':'ng',
    'noruega':'no','nueva zelanda':'nz','países bajos':'nl','holanda':'nl',
    'pakistan':'pk','palestina':'ps','panamá':'pa','paraguay':'py','perú':'pe',
    'polonia':'pl','portugal':'pt','puerto rico':'pr','reino unido':'gb',
    'república checa':'cz','república dominicana':'do','rumanía':'ro','rusia':'ru',
    'senegal':'sn','serbia':'rs','singapur':'sg','siria':'sy','sudáfrica':'za',
    'suecia':'se','suiza':'ch','tailandia':'th','taiwán':'tw','tanzania':'tz',
    'túnez':'tn','turquía':'tr','ucrania':'ua','uruguay':'uy','uzbekistán':'uz',
    'venezuela':'ve','vietnam':'vn','zimbabue':'zw'
};

function getCountryCode(name) {
    if (!name) return null;
    return COUNTRY_CODES[name.toLowerCase().trim()] || null;
}

function flagImg(countryName, size = 20) {
    const code = getCountryCode(countryName);
    if (!code) return '';
    // flagcdn.com only supports: w20, w40, w80, w160, w320, w640
    const srcW = size <= 20 ? 20 : 40;
    return `<img src="https://flagcdn.com/w${srcW}/${code}.png" alt="${countryName}" style="width:${size}px;height:auto;border-radius:2px;vertical-align:middle;flex-shrink:0;" loading="lazy">`;
}

function updateCountryFlagPreview(val) {
    const preview = document.getElementById('country-flag-preview');
    if (!preview) return;
    const code = getCountryCode(val);
    if (code) {
        preview.src = `https://flagcdn.com/w40/${code}.png`;
        preview.style.display = 'inline-block';
    } else {
        preview.src = '';
        preview.style.display = 'none';
    }
}

// ── DROPDOWN CUSTOM DE PAÍS ───────────────────────────────────────────────
function buildCustomCountryDropdown(countries, selectedValue) {
    const dropdown = document.getElementById('country-filter-dropdown');
    const display  = document.getElementById('country-filter-display');
    if (!dropdown || !display) return;

    const val = selectedValue || '';
    const options = [
        { value: '', label: 'Todos los países' },
        ...countries.map(c => ({ value: c, label: c }))
    ];

    // Reconstruir opciones
    dropdown.innerHTML = options.map(opt => {
        const code = opt.value ? getCountryCode(opt.value) : null;
        const flag = code
            ? `<img src="https://flagcdn.com/w20/${code}.png" alt="${opt.label}" style="width:18px;height:auto;border-radius:2px;flex-shrink:0;">`
            : `<span style="width:18px;display:inline-block;flex-shrink:0;"></span>`;
        const isSel = opt.value === val;
        return `<div class="custom-country-option${isSel ? ' selected' : ''}" data-value="${opt.value}">${flag}<span>${opt.label}</span></div>`;
    }).join('');

    // Actualizar trigger con el valor actual
    const current = options.find(o => o.value === val) || options[0];
    const curCode = current.value ? getCountryCode(current.value) : null;
    const curFlag = curCode
        ? `<img src="https://flagcdn.com/w20/${curCode}.png" alt="${current.label}" style="width:18px;height:auto;border-radius:2px;">`
        : '';
    display.innerHTML = `${curFlag}<span>${current.label}</span>`;

    // Listeners de cada opción
    dropdown.querySelectorAll('.custom-country-option').forEach(el => {
        el.addEventListener('click', () => {
            const chosen = el.dataset.value;
            if (countryFilter) countryFilter.value = chosen;
            buildCustomCountryDropdown(countries, chosen);
            document.getElementById('country-filter-custom')?.classList.remove('open');
            processAndRenderMedia();
        });
    });
}

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
    _allCountries = [...countrySet].sort();
    countryFilter.innerHTML = '<option value="">Todos los países</option>';
    _allCountries.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        if (c === prevCountry) opt.selected = true;
        countryFilter.appendChild(opt);
    });
    buildCustomCountryDropdown(_allCountries, prevCountry);
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
        : { id: Date.now(), manualRank: Date.now() };

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

    const countryVal = item.country || '';
    document.getElementById('details-title').textContent   = item.title || 'Más detalles';
    document.getElementById('details-country').value       = countryVal;
    document.getElementById('details-actors').value        = item.actors    || '';
    document.getElementById('details-watch-date').value    = item.watchDate || '';
    document.getElementById('details-review').value        = item.review    || '';

    updateCountryFlagPreview(countryVal);
    document.getElementById('modal-details').classList.remove('hidden');
}

const _countryInput = document.getElementById('details-country');
_countryInput?.addEventListener('focus', () => {
    if (_countrySuggestionsData.length > 0) renderCountrySuggestions(_countryInput.value);
});
_countryInput?.addEventListener('input', e => {
    updateCountryFlagPreview(e.target.value);
    renderCountrySuggestions(e.target.value);
});
_countryInput?.addEventListener('blur', () => {
    // Pequeño delay para que el mousedown del chip se procese antes
    setTimeout(() => {
        const s = document.getElementById('country-suggestions');
        if (s) s.style.display = 'none';
    }, 180);
});

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
        await Promise.all([populateFilters(), loadCountrySuggestions()]);
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
    buildCustomCountryDropdown(_allCountries, '');
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
            if (sort === 'rating-desc' || sort === 'rating-asc') {
                const diff = sort === 'rating-desc'
                    ? parseFloat(b.rating) - parseFloat(a.rating)
                    : parseFloat(a.rating) - parseFloat(b.rating);
                if (diff !== 0) return diff;
                // Tiebreaker: orden manual dentro de la misma nota
                return (a.manualRank ?? a.id ?? 0) - (b.manualRank ?? b.id ?? 0);
            }
            if (sort === 'year-desc')  return parseInt(b.year)  - parseInt(a.year);
            if (sort === 'year-asc')   return parseInt(a.year)  - parseInt(b.year);
            if (sort === 'title-asc')  return (a.title || '').localeCompare(b.title || '');
            if (sort === 'title-desc') return (b.title || '').localeCompare(a.title || '');
            return 0;
        });
    }

    renderMediaGrid(items, sort);
}

function renderMediaGrid(items, sort) {
    _currentItems = items;
    const showDrag = sort === 'rating-desc' || sort === 'rating-asc';

    mediaGrid.innerHTML = items.length
        ? ''
        : '<p style="color:var(--text-muted)">No hay películas que coincidan con los filtros.</p>';

    items.forEach(item => {
        const card = document.createElement('div');
        card.classList.add('album-card');
        card.style.cursor = 'pointer';
        card.style.position = 'relative';

        card.addEventListener('click', () => {
            if (isDragging) return;
            window.location.href = `media-detail.html?type=movies&id=${item.id}`;
        });

        const badgeColor = getColorByRating(item.rating);

        const directorHtml = item.director
            ? `<p style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">Dir. ${item.director}</p>`
            : '';

        const metaParts = [item.genre, item.duration ? `${item.duration} min` : null].filter(Boolean);
        const metaLine  = metaParts.length
            ? `<p style="font-size:0.75rem;color:var(--text-muted);margin-top:3px;">${metaParts.join(' · ')}</p>`
            : '';

        const flag = item.country ? flagImg(item.country, 16) : '';
        const countryBadge = item.country
            ? `<span style="display:inline-flex;align-items:center;gap:4px;margin-top:4px;padding:2px 8px;border-radius:6px;background:var(--bg-secondary);border:1px solid var(--border-color);font-size:0.7rem;font-weight:700;color:var(--text-muted);">${flag}${item.country}</span>`
            : '';

        const hasDetails = item.country || item.actors || item.watchDate || item.review;

        card.innerHTML = `
            <div class="movie-drag-handle" style="display:${showDrag ? 'flex' : 'none'};" title="Arrastra para reordenar (solo entre películas con la misma nota)">
                <div></div><div></div><div></div>
            </div>
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

        // ── DRAG & DROP ───────────────────────────────────────────────────
        if (showDrag) {
            const handle = card.querySelector('.movie-drag-handle');
            handle.setAttribute('draggable', 'true');

            handle.addEventListener('dragstart', e => {
                dragSrcId     = item.id;
                dragSrcRating = String(parseFloat(item.rating).toFixed(1));
                isDragging    = true;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => { card.style.opacity = '0.4'; }, 0);
            });

            handle.addEventListener('dragend', () => {
                isDragging        = false;
                dragSrcId         = null;
                dragSrcRating     = null;
                card.style.opacity = '';
                mediaGrid.querySelectorAll('.album-card').forEach(c => {
                    c.style.outline      = '';
                    c.style.outlineOffset = '';
                });
            });

            card.addEventListener('dragover', e => {
                if (!dragSrcId || dragSrcId === item.id) return;
                if (String(parseFloat(item.rating).toFixed(1)) !== dragSrcRating) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                card.style.outline       = '2px solid var(--accent-red)';
                card.style.outlineOffset = '2px';
            });

            card.addEventListener('dragleave', () => {
                card.style.outline      = '';
                card.style.outlineOffset = '';
            });

            card.addEventListener('drop', async e => {
                e.preventDefault();
                card.style.outline      = '';
                card.style.outlineOffset = '';
                if (!dragSrcId || dragSrcId === item.id) return;
                if (String(parseFloat(item.rating).toFixed(1)) !== dragSrcRating) return;

                const sameRating = _currentItems.filter(i =>
                    String(parseFloat(i.rating).toFixed(1)) === dragSrcRating
                );
                const srcIdx = sameRating.findIndex(i => i.id === dragSrcId);
                const tgtIdx = sameRating.findIndex(i => i.id === item.id);
                if (srcIdx < 0 || tgtIdx < 0) return;

                const [moved] = sameRating.splice(srcIdx, 1);
                sameRating.splice(tgtIdx, 0, moved);

                await Promise.all(sameRating.map((it, idx) => {
                    it.manualRank = idx * 1000;
                    return saveItemToDB(storeType, it);
                }));

                processAndRenderMedia();
            });
        }

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
filterInput?.addEventListener('input',  processAndRenderMedia);
genreFilter?.addEventListener('change', processAndRenderMedia);
yearFrom?.addEventListener('input',     processAndRenderMedia);
yearTo?.addEventListener('input',       processAndRenderMedia);

// Toggle del dropdown custom de país
document.getElementById('country-filter-trigger')?.addEventListener('click', () => {
    document.getElementById('country-filter-custom')?.classList.toggle('open');
});
// Cerrar al hacer click fuera
document.addEventListener('click', e => {
    const wrap = document.getElementById('country-filter-custom');
    if (wrap && !wrap.contains(e.target)) wrap.classList.remove('open');
});

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

// ── INIT ──────────────────────────────────────────────────────────────────
(async () => {
    // Cargar orden predeterminado guardado
    const savedDefault = localStorage.getItem(DEFAULT_SORT_KEY);
    if (savedDefault && sortSelect) {
        sortSelect.value = savedDefault;
    }
    updateDefaultBtn();

    await Promise.all([
        populateFilters(),
        loadCountrySuggestions()
    ]);
    await processAndRenderMedia();
})();

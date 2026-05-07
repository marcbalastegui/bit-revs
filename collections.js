// collections.js - Colecciones mejoradas

const ACCENT_COLORS = [
    '#e63946', '#3a86ff', '#8338ec', '#fb5607',
    '#06d6a0', '#ffbe0b', '#ff006e', '#3d405b'
];

let allCollections  = [];
let currentColId    = null;
let editingColId    = null;
let allItems        = [];
let selectedColor   = ACCENT_COLORS[0];
let notesSaveTimer  = null;
let dragSrcIdx      = null;

// ── DB ─────────────────────────────────────────────────────────────────────
async function getAllCollectionsFromDB() { return await getAllItemsFromDB('collections'); }
async function saveCollectionToDB(col)  { return await saveItemToDB('collections', col); }
async function deleteCollectionFromDB(id) { return await deleteItemFromDB('collections', id); }

// ── INIT ───────────────────────────────────────────────────────────────────
async function initCollections() {
    allCollections = await getAllCollectionsFromDB();

    const albums = await getAllAlbumsFromDB();
    const movies = await getAllItemsFromDB('movies');
    const series = await getAllItemsFromDB('series');

    allItems = [
        ...albums.map(a => ({ ...a, _type: 'album',  _typeLabel: 'Álbum' })),
        ...movies.map(m => ({ ...m, _type: 'movie',  _typeLabel: 'Película' })),
        ...series.map(s => ({ ...s, _type: 'series', _typeLabel: 'Serie' })),
    ];

    renderCollectionsList();
    initModals();
    initBannerUpload();
}

// ── RENDER LISTA ───────────────────────────────────────────────────────────
function renderCollectionsList() {
    const grid = document.getElementById('collections-grid');
    grid.innerHTML = '';

    if (allCollections.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; color:var(--text-muted); font-size:0.9rem; font-style:italic; padding:20px 0;">
            Aún no tienes colecciones. ¡Crea tu primera!
        </div>`;
        return;
    }

    // Favoritas primero
    const sorted = [...allCollections].sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));

    sorted.forEach((col, i) => {
        const card = document.createElement('div');
        card.className = 'collection-card';
        card.style.animationDelay = `${i * 0.04}s`;
        card.addEventListener('click', () => openCollection(col.id));

        const accent = col.color || ACCENT_COLORS[0];
        const covers  = (col.items || [])
            .map(ref => allItems.find(a => a.id === ref.id && a._type === ref.type)?.coverBase64)
            .filter(Boolean);

        const collageHtml = buildCollageHtml(covers, accent);
        const itemCount   = (col.items || []).length;

        card.innerHTML = `
            <div class="collection-card-actions">
                <button class="action-btn btn-edit"   onclick="event.stopPropagation(); editCollection(${col.id})" title="Editar">✎</button>
                <button class="action-btn btn-delete" onclick="event.stopPropagation(); deleteCollection(${col.id})" title="Borrar">✖</button>
            </div>
            ${collageHtml}
            <div class="collection-card-info">
                <div class="collection-card-name">${col.favorite ? '★ ' : ''}${col.name}</div>
                ${col.quote ? `<div class="collection-card-quote">"${col.quote}"</div>` : ''}
                <div class="collection-card-footer">
                    <span class="collection-card-count">${itemCount} elemento${itemCount !== 1 ? 's' : ''}</span>
                    <button class="collection-fav-star" onclick="event.stopPropagation(); toggleFavorite(${col.id})" title="${col.favorite ? 'Quitar de destacadas' : 'Destacar'}">
                        ${col.favorite ? '★' : '☆'}
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// ── COLLAGE ────────────────────────────────────────────────────────────────
function buildCollageHtml(covers, accent) {
    const bg = accent + '22'; // color con opacidad baja de fondo

    if (covers.length === 0) {
        return `<div class="collection-collage-empty" style="background:${bg};">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${accent}" stroke-width="1.5" style="width:40px;height:40px;opacity:0.4;"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
        </div>`;
    }

    // Layouts dinámicos según número de portadas
    const n = Math.min(covers.length, 5);

    if (n === 1) {
        return `<div class="collection-collage" style="background:${bg};">
            <img class="collage-img" src="${covers[0]}" style="width:70%; height:90%; top:5%; left:15%;">
        </div>`;
    }
    if (n === 2) {
        return `<div class="collection-collage" style="background:${bg};">
            <img class="collage-img" src="${covers[0]}" style="width:55%; height:85%; top:8%; left:4%;">
            <img class="collage-img" src="${covers[1]}" style="width:48%; height:75%; top:12%; right:4%;">
        </div>`;
    }
    if (n === 3) {
        return `<div class="collection-collage" style="background:${bg};">
            <img class="collage-img" src="${covers[0]}" style="width:52%; height:88%; top:6%; left:3%;">
            <img class="collage-img" src="${covers[1]}" style="width:44%; height:50%; top:4%; right:3%;">
            <img class="collage-img" src="${covers[2]}" style="width:44%; height:42%; bottom:4%; right:3%;">
        </div>`;
    }
    if (n === 4) {
        return `<div class="collection-collage" style="background:${bg};">
            <img class="collage-img" src="${covers[0]}" style="width:50%; height:88%; top:6%; left:3%;">
            <img class="collage-img" src="${covers[1]}" style="width:43%; height:40%; top:4%; right:3%;">
            <img class="collage-img" src="${covers[2]}" style="width:30%; height:44%; bottom:4%; right:16%;">
            <img class="collage-img" src="${covers[3]}" style="width:30%; height:35%; bottom:10%; right:50%;">
        </div>`;
    }
    // 5+
    return `<div class="collection-collage" style="background:${bg};">
        <img class="collage-img" src="${covers[0]}" style="width:48%; height:85%; top:8%; left:2%;">
        <img class="collage-img" src="${covers[1]}" style="width:38%; height:46%; top:4%; left:53%;">
        <img class="collage-img" src="${covers[2]}" style="width:26%; height:40%; bottom:4%; right:2%;">
        <img class="collage-img" src="${covers[3]}" style="width:32%; height:42%; bottom:4%; left:53%;">
        <img class="collage-img" src="${covers[4]}" style="width:22%; height:32%; bottom:12%; left:30%;">
    </div>`;
}

// ── DETALLE ────────────────────────────────────────────────────────────────
function openCollection(id) {
    currentColId = id;
    const col    = allCollections.find(c => c.id === id);
    if (!col) return;

    document.getElementById('view-list').style.display   = 'none';
    document.getElementById('view-detail').style.display = 'block';
    document.getElementById('detail-name').textContent   = col.name;
    document.getElementById('detail-quote-display').textContent = col.quote ? `"${col.quote}"` : '';

    // Banner
    const banner = document.getElementById('detail-banner');
    const accent = col.color || ACCENT_COLORS[0];
    if (col.banner) {
        banner.style.background = `url(${col.banner}) center/cover no-repeat`;
    } else {
        banner.style.backgroundImage = 'none';
        banner.style.background = `linear-gradient(135deg, ${accent}dd 0%, ${accent}66 100%)`;
    }

    renderDetailGrid(col);
}

function backToList() {
    currentColId = null;
    document.getElementById('view-list').style.display   = 'block';
    document.getElementById('view-detail').style.display = 'none';
    allCollections = [];
    initCollections();
}

// Sizes cycle: large, small, small, medium, large, small...
const SIZE_PATTERN = ['large', 'small', 'small', 'medium', 'large', 'small', 'medium', 'small'];

function renderDetailGrid(col) {
    const grid = document.getElementById('detail-grid');
    grid.innerHTML = '';

    const items = (col.items || []).map(ref =>
        allItems.find(a => a.id === ref.id && a._type === ref.type)
    ).filter(Boolean);

    if (items.length === 0) {
        grid.style.display = 'block';
        grid.innerHTML = `<p style="color:var(--text-muted); font-style:italic;">
            Colección vacía. Pulsa "+ Añadir" para agregar contenido.
        </p>`;
        return;
    }

    items.forEach((item, index) => {
        const size       = SIZE_PATTERN[index % SIZE_PATTERN.length];
        const isVertical = item._type !== 'album';
        const badgeColor = getColorByRating(item.rating);
        const href       = item._type === 'album'
            ? `album.html?id=${item.id}`
            : `media-detail.html?type=${item._type === 'movie' ? 'movies' : 'series'}&id=${item.id}`;

        const card = document.createElement('div');
        card.className = `collection-masonry-item size-${size}`;
        card.addEventListener('click', () => window.location.href = href);

        const meta = [item.artist || item.director || item.creator, item.year].filter(Boolean).join(' · ');

        card.innerHTML = `
            <div class="card-actions">
                <button class="action-btn btn-delete" onclick="event.stopPropagation(); removeFromCollection(${item.id}, '${item._type}')" title="Quitar">✖</button>
            </div>
            <img src="${item.coverBase64}" alt="${item.title}">
            <div class="collection-masonry-item-info">
                <div class="collection-masonry-item-title">${item.title}</div>
                <div class="collection-masonry-item-meta">${meta}</div>
                <span class="collection-masonry-item-badge" style="background:${badgeColor}">${formatRating(item.rating)}</span>
            </div>
        `;
        grid.appendChild(card);
    });
}

window.removeFromCollection = async function(itemId, itemType) {
    const col = allCollections.find(c => c.id === currentColId);
    if (!col) return;
    col.items = (col.items || []).filter(i => !(i.id === itemId && i.type === itemType));
    await saveCollectionToDB(col);
    allCollections = await getAllCollectionsFromDB();
    renderDetailGrid(col);
}

// ── FAVORITOS ──────────────────────────────────────────────────────────────
window.toggleFavorite = async function(id) {
    const col = allCollections.find(c => c.id === id);
    if (!col) return;
    col.favorite = !col.favorite;
    await saveCollectionToDB(col);
    allCollections = await getAllCollectionsFromDB();
    renderCollectionsList();
}



// ── BANNER ─────────────────────────────────────────────────────────────────
function initBannerUpload() {
    const btn   = document.getElementById('btn-change-banner');
    const input = document.getElementById('input-banner');
    if (!btn || !input) return;

    btn.addEventListener('click', (e) => { e.stopPropagation(); input.click(); });
    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const col = allCollections.find(c => c.id === currentColId);
            if (!col) return;
            col.banner = ev.target.result;
            await saveCollectionToDB(col);
            allCollections = await getAllCollectionsFromDB();
            const banner = document.getElementById('detail-banner');
            banner.style.background = `url(${col.banner}) center/cover no-repeat`;
        };
        reader.readAsDataURL(file);
        input.value = '';
    });
}

// ── AÑADIR ITEMS ───────────────────────────────────────────────────────────
function openAddItemModal() {
    const input = document.getElementById('collection-search-input');
    input.value = '';
    renderSearchResults('');
    document.getElementById('modal-add-item').classList.remove('hidden');
    setTimeout(() => input.focus(), 100);
}

function renderSearchResults(query) {
    const results  = document.getElementById('collection-search-results');
    const col      = allCollections.find(c => c.id === currentColId);
    const addedIds = new Set((col?.items || []).map(i => `${i.type}_${i.id}`));

    let filtered = allItems;
    if (query.trim()) {
        const q = query.toLowerCase();
        filtered = allItems.filter(item =>
            (item.title    && item.title.toLowerCase().includes(q)) ||
            (item.artist   && item.artist.toLowerCase().includes(q)) ||
            (item.director && item.director.toLowerCase().includes(q))
        );
    }

    results.innerHTML = filtered.slice(0, 40).map(item => {
        const key     = `${item._type}_${item.id}`;
        const isAdded = addedIds.has(key);
        const meta    = [item.artist || item.director || item.creator, item.year].filter(Boolean).join(' · ');
        return `
            <div class="collection-search-item${isAdded ? ' added' : ''}"
                onclick="addToCollection(${item.id}, '${item._type}')">
                <img src="${item.coverBase64}" alt="${item.title}">
                <div class="collection-search-item-info">
                    <div class="collection-search-item-title">${item.title}</div>
                    <div class="collection-search-item-meta">${meta}</div>
                </div>
                <span class="collection-search-item-type">${item._typeLabel}</span>
                ${isAdded ? '<span style="font-size:0.7rem; color:var(--accent-red); font-weight:700; flex-shrink:0;">✓</span>' : ''}
            </div>`;
    }).join('');
}

window.addToCollection = async function(itemId, itemType) {
    const col = allCollections.find(c => c.id === currentColId);
    if (!col) return;
    if (!col.items) col.items = [];
    if (col.items.find(i => i.id === itemId && i.type === itemType)) return;
    col.items.push({ id: itemId, type: itemType });
    await saveCollectionToDB(col);
    allCollections = await getAllCollectionsFromDB();
    renderSearchResults(document.getElementById('collection-search-input')?.value || '');
    renderDetailGrid(col);
}

// ── COLOR PICKER ───────────────────────────────────────────────────────────
function renderColorPicker(currentColor) {
    const picker = document.getElementById('color-picker');
    picker.innerHTML = ACCENT_COLORS.map(color => `
        <div class="color-dot${color === currentColor ? ' selected' : ''}"
            style="background:${color};"
            data-color="${color}"
            onclick="selectColor('${color}')">
        </div>`).join('');
    selectedColor = currentColor || ACCENT_COLORS[0];
}

window.selectColor = function(color) {
    selectedColor = color;
    document.querySelectorAll('.color-dot').forEach(d => {
        d.classList.toggle('selected', d.dataset.color === color);
    });
}

// ── CRUD ───────────────────────────────────────────────────────────────────
function initModals() {
    document.getElementById('btn-new-collection').addEventListener('click', () => {
        editingColId = null;
        document.getElementById('collection-modal-title').textContent = 'Nueva colección';
        document.getElementById('collection-name').value  = '';
        document.getElementById('collection-quote').value = '';
        renderColorPicker(ACCENT_COLORS[0]);
        document.getElementById('modal-collection').classList.remove('hidden');
        setTimeout(() => document.getElementById('collection-name').focus(), 100);
    });

    document.getElementById('btn-cancel-collection').addEventListener('click', () => {
        document.getElementById('modal-collection').classList.add('hidden');
    });

    document.getElementById('collection-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name  = document.getElementById('collection-name').value.trim();
        const quote = document.getElementById('collection-quote').value.trim();
        if (!name) return;

        if (editingColId) {
            const col = allCollections.find(c => c.id === editingColId);
            if (col) { col.name = name; col.quote = quote; col.color = selectedColor; await saveCollectionToDB(col); }
        } else {
            await saveCollectionToDB({ id: Date.now(), name, quote, color: selectedColor, items: [], notes: '', favorite: false });
        }

        allCollections = await getAllCollectionsFromDB();
        document.getElementById('modal-collection').classList.add('hidden');

        if (editingColId && currentColId === editingColId) {
            const col = allCollections.find(c => c.id === editingColId);
            document.getElementById('detail-name').textContent = col?.name || '';
            document.getElementById('detail-quote-display').textContent = col?.quote ? `"${col.quote}"` : '';
        }

        editingColId = null;
        renderCollectionsList();
    });

    document.getElementById('btn-add-to-collection').addEventListener('click', openAddItemModal);
    document.getElementById('btn-cancel-add-item').addEventListener('click', () => {
        document.getElementById('modal-add-item').classList.add('hidden');
    });
    document.getElementById('collection-search-input').addEventListener('input', (e) => {
        renderSearchResults(e.target.value);
    });

    document.getElementById('btn-edit-collection').addEventListener('click', () => {
        if (currentColId) editCollection(currentColId);
    });
}

window.editCollection = function(id) {
    const col = allCollections.find(c => c.id === id);
    if (!col) return;
    editingColId = id;
    document.getElementById('collection-modal-title').textContent = 'Editar colección';
    document.getElementById('collection-name').value  = col.name;
    document.getElementById('collection-quote').value = col.quote || '';
    renderColorPicker(col.color || ACCENT_COLORS[0]);
    document.getElementById('modal-collection').classList.remove('hidden');
}

window.deleteCollection = async function(id) {
    if (await brConfirm('Se borrará la colección. Los álbumes y películas no se eliminarán.', '¿Borrar colección?')) {
        await deleteCollectionFromDB(id);
        allCollections = await getAllCollectionsFromDB();
        renderCollectionsList();
    }
}

// ── DESDE CARD CON ?add= ───────────────────────────────────────────────────
async function checkAddParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const addParam  = urlParams.get('add');
    if (!addParam) return;

    const [type, idStr] = addParam.split('_');
    const itemId = parseInt(idStr);

    if (allCollections.length === 0) {
        await brAlert('Primero crea una colección.', 'Sin colecciones');
        history.replaceState({}, '', 'collections.html');
        return;
    }

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:9998;';
    const box = document.createElement('div');
    box.style.cssText = 'background:white;border-radius:20px;padding:32px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.2);font-family:Inter,sans-serif;';
    box.innerHTML = `
        <h2 style="font-size:1.3rem;font-weight:900;margin-bottom:20px;letter-spacing:-0.5px;">¿A qué colección?</h2>
        <div style="display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto;">
            ${allCollections.map(col => `
                <button data-id="${col.id}" style="text-align:left;padding:12px 16px;border-radius:10px;border:1px solid var(--border-color);background:var(--bg-secondary);cursor:pointer;font-family:inherit;font-size:0.9rem;font-weight:700;color:var(--text-main);transition:all 0.15s;"
                    onmouseover="this.style.background='${col.color || ACCENT_COLORS[0]}';this.style.color='white';this.style.borderColor='transparent'"
                    onmouseout="this.style.background='var(--bg-secondary)';this.style.color='var(--text-main)';this.style.borderColor='var(--border-color)'">
                    ${col.name}
                </button>`).join('')}
        </div>
        <div style="margin-top:20px;display:flex;justify-content:flex-end;">
            <button id="btn-close-picker" style="background:var(--bg-secondary);border:1px solid var(--border-color);padding:10px 20px;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;">Cancelar</button>
        </div>`;
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    box.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const colId = parseInt(btn.dataset.id);
            const col   = allCollections.find(c => c.id === colId);
            if (!col) return;
            if (!col.items) col.items = [];
            if (!col.items.find(i => i.id === itemId && i.type === type)) {
                col.items.push({ id: itemId, type });
                await saveCollectionToDB(col);
                allCollections = await getAllCollectionsFromDB();
            }
            document.body.removeChild(overlay);
            history.replaceState({}, '', 'collections.html');
            renderCollectionsList();
        });
    });

    box.querySelector('#btn-close-picker').addEventListener('click', () => {
        document.body.removeChild(overlay);
        history.replaceState({}, '', 'collections.html');
    });
}

initCollections().then(() => checkAddParam());
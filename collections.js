// collections.js - Lógica de Colecciones

let allCollections = [];
let currentCollectionId = null;
let editingCollectionId = null;
let allItems = []; // todos los álbumes, pelis y series

// ── DB HELPERS ────────────────────────────────────────────────────────────
async function getAllCollectionsFromDB() {
    return await getAllItemsFromDB('collections');
}

async function saveCollectionToDB(collection) {
    return await saveItemToDB('collections', collection);
}

async function deleteCollectionFromDB(id) {
    return await deleteItemFromDB('collections', id);
}

// ── INIT ──────────────────────────────────────────────────────────────────
async function initCollections() {
    allCollections = await getAllCollectionsFromDB();

    // Cargar todos los items para el buscador
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
}

// ── RENDER LISTA ──────────────────────────────────────────────────────────
function renderCollectionsList() {
    const grid = document.getElementById('collections-grid');
    grid.innerHTML = '';

    if (allCollections.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; color:var(--text-muted); font-size:0.9rem; font-style:italic; padding:20px 0;">
            Aún no tienes colecciones. ¡Crea tu primera!
        </div>`;
        return;
    }

    allCollections.forEach((col, i) => {
        const card = document.createElement('div');
        card.className = 'collection-card';
        card.style.position = 'relative';
        card.style.animationDelay = `${i * 0.05}s`;
        card.addEventListener('click', () => openCollection(col.id));

        // Portadas del mosaico (máx 4)
        const covers = (col.items || [])
            .slice(0, 4)
            .map(item => {
                const found = allItems.find(a => a.id === item.id && a._type === item.type);
                return found?.coverBase64 || null;
            })
            .filter(Boolean);

        let coversHtml = '';
        if (covers.length === 0) {
            coversHtml = `
                <div class="collection-covers-empty">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                </div>`;
        } else if (covers.length < 4) {
            coversHtml = `<div class="collection-covers" style="grid-template-columns:1fr; grid-template-rows:1fr;">
                <img src="${covers[0]}" alt="">
            </div>`;
        } else {
            coversHtml = `<div class="collection-covers">
                ${covers.map(c => `<img src="${c}" alt="">`).join('')}
            </div>`;
        }

        const itemCount = (col.items || []).length;

        card.innerHTML = `
            <div class="collection-card-actions">
                <button class="action-btn btn-edit" onclick="event.stopPropagation(); editCollection(${col.id})" title="Editar">✎</button>
                <button class="action-btn btn-delete" onclick="event.stopPropagation(); deleteCollection(${col.id})" title="Borrar">✖</button>
            </div>
            ${coversHtml}
            <div class="collection-info">
                <div class="collection-name">${col.name}</div>
                ${col.desc ? `<div class="collection-desc">${col.desc}</div>` : ''}
                <div class="collection-count">${itemCount} elemento${itemCount !== 1 ? 's' : ''}</div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// ── DETALLE DE COLECCIÓN ──────────────────────────────────────────────────
function openCollection(id) {
    currentCollectionId = id;
    const col = allCollections.find(c => c.id === id);
    if (!col) return;

    document.getElementById('view-list').style.display   = 'none';
    document.getElementById('view-detail').style.display = 'block';
    document.getElementById('detail-title').textContent  = col.name;
    document.getElementById('detail-desc').textContent   = col.desc || '';

    renderDetailGrid(col);
}

function backToList() {
    currentCollectionId = null;
    document.getElementById('view-list').style.display   = 'block';
    document.getElementById('view-detail').style.display = 'none';
    renderCollectionsList();
}

function renderDetailGrid(col) {
    const grid = document.getElementById('detail-grid');
    grid.innerHTML = '';

    const items = (col.items || []).map(ref => {
        return allItems.find(a => a.id === ref.id && a._type === ref.type);
    }).filter(Boolean);

    if (items.length === 0) {
        grid.innerHTML = `<p style="color:var(--text-muted); font-style:italic; grid-column:1/-1;">
            Colección vacía. Pulsa "+ Añadir" para agregar contenido.
        </p>`;
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'album-card';
        card.style.cursor = 'pointer';

        const isVertical = item._type !== 'album';
        const badgeColor = getColorByRating(item.rating);
        const href = item._type === 'album'
            ? `album.html?id=${item.id}`
            : `media-detail.html?type=${item._type === 'movie' ? 'movies' : 'series'}&id=${item.id}`;

        card.addEventListener('click', () => window.location.href = href);

        card.innerHTML = `
            <div class="card-actions">
                <button class="action-btn btn-delete" onclick="event.stopPropagation(); removeFromCollection(${item.id}, '${item._type}')" title="Quitar de la colección">✖</button>
            </div>
            <div class="cover-container${isVertical ? ' vertical' : ''}">
                <img src="${item.coverBase64}" alt="${item.title}">
            </div>
            <div class="album-info">
                <div class="title-row">
                    <h3>${item.title}</h3>
                    <span class="rating-badge" style="background-color:${badgeColor};">${formatRating(item.rating)}</span>
                </div>
                <p>${item.artist || item.director || item.creator || ''} ${item.year ? '· ' + item.year : ''}</p>
                <p style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">${item._typeLabel}</p>
            </div>
        `;
        grid.appendChild(card);
    });
}

window.removeFromCollection = async function(itemId, itemType) {
    const col = allCollections.find(c => c.id === currentCollectionId);
    if (!col) return;
    col.items = (col.items || []).filter(i => !(i.id === itemId && i.type === itemType));
    await saveCollectionToDB(col);
    allCollections = await getAllCollectionsFromDB();
    renderDetailGrid(col);
}

// ── AÑADIR ITEMS ──────────────────────────────────────────────────────────
function openAddItemModal() {
    const modal = document.getElementById('modal-add-item');
    const input = document.getElementById('collection-search-input');
    input.value = '';
    renderSearchResults('');
    modal.classList.remove('hidden');
    setTimeout(() => input.focus(), 100);
}

function renderSearchResults(query) {
    const results = document.getElementById('collection-search-results');
    const col     = allCollections.find(c => c.id === currentCollectionId);
    const addedIds = new Set((col?.items || []).map(i => `${i.type}_${i.id}`));

    let filtered = allItems;
    if (query.trim()) {
        const q = query.toLowerCase();
        filtered = allItems.filter(item =>
            (item.title  && item.title.toLowerCase().includes(q)) ||
            (item.artist && item.artist.toLowerCase().includes(q)) ||
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
                ${isAdded ? '<span style="font-size:0.7rem; color:var(--accent-red); font-weight:700;">✓</span>' : ''}
            </div>`;
    }).join('');
}

window.addToCollection = async function(itemId, itemType) {
    const col = allCollections.find(c => c.id === currentCollectionId);
    if (!col) return;
    if (!col.items) col.items = [];

    const exists = col.items.find(i => i.id === itemId && i.type === itemType);
    if (exists) return;

    col.items.push({ id: itemId, type: itemType });
    await saveCollectionToDB(col);
    allCollections = await getAllCollectionsFromDB();

    // Re-render search to mark as added
    renderSearchResults(document.getElementById('collection-search-input')?.value || '');
    renderDetailGrid(col);
}

// ── CRUD COLECCIONES ──────────────────────────────────────────────────────
function initModals() {
    // Nueva colección
    document.getElementById('btn-new-collection').addEventListener('click', () => {
        editingCollectionId = null;
        document.getElementById('collection-modal-title').textContent = 'Nueva colección';
        document.getElementById('collection-name').value = '';
        document.getElementById('collection-desc').value = '';
        document.getElementById('modal-collection').classList.remove('hidden');
        setTimeout(() => document.getElementById('collection-name').focus(), 100);
    });

    document.getElementById('btn-cancel-collection').addEventListener('click', () => {
        document.getElementById('modal-collection').classList.add('hidden');
    });

    document.getElementById('collection-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('collection-name').value.trim();
        const desc = document.getElementById('collection-desc').value.trim();
        if (!name) return;

        if (editingCollectionId) {
            const col = allCollections.find(c => c.id === editingCollectionId);
            if (col) { col.name = name; col.desc = desc; await saveCollectionToDB(col); }
        } else {
            await saveCollectionToDB({ id: Date.now(), name, desc, items: [] });
        }

        allCollections = await getAllCollectionsFromDB();
        document.getElementById('modal-collection').classList.add('hidden');

        if (editingCollectionId && currentCollectionId === editingCollectionId) {
            const col = allCollections.find(c => c.id === editingCollectionId);
            document.getElementById('detail-title').textContent = col?.name || '';
            document.getElementById('detail-desc').textContent  = col?.desc || '';
        }

        editingCollectionId = null;
        renderCollectionsList();
    });

    // Añadir item
    document.getElementById('btn-add-to-collection').addEventListener('click', openAddItemModal);
    document.getElementById('btn-cancel-add-item').addEventListener('click', () => {
        document.getElementById('modal-add-item').classList.add('hidden');
    });
    document.getElementById('collection-search-input').addEventListener('input', (e) => {
        renderSearchResults(e.target.value);
    });

    // Editar colección desde detalle
    document.getElementById('btn-edit-collection').addEventListener('click', () => {
        if (!currentCollectionId) return;
        editCollection(currentCollectionId);
    });
}

window.editCollection = function(id) {
    const col = allCollections.find(c => c.id === id);
    if (!col) return;
    editingCollectionId = id;
    document.getElementById('collection-modal-title').textContent = 'Editar colección';
    document.getElementById('collection-name').value = col.name;
    document.getElementById('collection-desc').value = col.desc || '';
    document.getElementById('modal-collection').classList.remove('hidden');
}

window.deleteCollection = async function(id) {
    if (await brConfirm('Se borrará la colección y todo su contenido. Los álbumes y películas no se eliminarán.', '¿Borrar colección?')) {
        await deleteCollectionFromDB(id);
        allCollections = await getAllCollectionsFromDB();
        renderCollectionsList();
    }
}

initCollections().then(() => {
    // Si venimos con ?add=type_id, abrir selector de colección
    const urlParams = new URLSearchParams(window.location.search);
    const addParam  = urlParams.get('add');
    if (addParam) {
        const [type, idStr] = addParam.split('_');
        const itemId = parseInt(idStr);
        showAddToCollectionPicker(itemId, type);
    }
});

async function showAddToCollectionPicker(itemId, itemType) {
    if (allCollections.length === 0) {
        await brAlert('Primero crea una colección.', 'Sin colecciones');
        return;
    }
    // Show collection picker modal
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:9998;';
    const box = document.createElement('div');
    box.style.cssText = 'background:white;border-radius:20px;padding:32px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.2);font-family:Inter,sans-serif;';
    box.innerHTML = `
        <h2 style="font-size:1.3rem;font-weight:900;margin-bottom:20px;letter-spacing:-0.5px;">¿A qué colección?</h2>
        <div style="display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto;">
            ${allCollections.map(col => `
                <button data-id="${col.id}" style="text-align:left;padding:12px 16px;border-radius:10px;border:1px solid var(--border-color);background:var(--bg-secondary);cursor:pointer;font-family:inherit;font-size:0.9rem;font-weight:700;color:var(--text-main);transition:all 0.15s;"
                    onmouseover="this.style.background='var(--accent-red)';this.style.color='white';this.style.borderColor='var(--accent-red)'"
                    onmouseout="this.style.background='var(--bg-secondary)';this.style.color='var(--text-main)';this.style.borderColor='var(--border-color)'">
                    ${col.name} <span style="font-weight:500;font-size:0.78rem;opacity:0.7;">(${(col.items||[]).length} elementos)</span>
                </button>`).join('')}
        </div>
        <div style="margin-top:20px;display:flex;justify-content:flex-end;">
            <button id="btn-close-picker" style="background:var(--bg-secondary);border:1px solid var(--border-color);padding:10px 20px;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;">Cancelar</button>
        </div>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    box.querySelectorAll('button[data-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const colId = parseInt(btn.dataset.id);
            const col   = allCollections.find(c => c.id === colId);
            if (!col) return;
            if (!col.items) col.items = [];
            if (!col.items.find(i => i.id === itemId && i.type === itemType)) {
                col.items.push({ id: itemId, type: itemType });
                await saveCollectionToDB(col);
                allCollections = await getAllCollectionsFromDB();
            }
            document.body.removeChild(overlay);
            // Clean URL
            history.replaceState({}, '', 'collections.html');
            renderCollectionsList();
        });
    });

    box.querySelector('#btn-close-picker').addEventListener('click', () => {
        document.body.removeChild(overlay);
        history.replaceState({}, '', 'collections.html');
    });
}
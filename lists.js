// lists.js - Rankings y listas personalizadas con drag & drop

let allLists   = [];
let allItems   = []; // álbumes, pelis, series
let currentListId = null;
let dragSrcIdx    = null;

// ── DB ────────────────────────────────────────────────────────────────────
async function getAllListsFromDB()       { return await getAllItemsFromDB('lists'); }
async function saveListToDB(list)       { return await saveItemToDB('lists', list); }
async function deleteListFromDB(id)     { return await deleteItemFromDB('lists', id); }

// ── INIT ──────────────────────────────────────────────────────────────────
async function initLists() {
    allLists = await getAllListsFromDB();

    const albums = await getAllAlbumsFromDB();
    const movies = await getAllItemsFromDB('movies');
    const series = await getAllItemsFromDB('series');
    allItems = [
        ...albums.map(a => ({ ...a, _type: 'album',  _label: 'Álbum' })),
        ...movies.map(m => ({ ...m, _type: 'movie',  _label: 'Película' })),
        ...series.map(s => ({ ...s, _type: 'series', _label: 'Serie' })),
    ];

    renderListsSidebar();
    if (allLists.length > 0) openList(allLists[0].id);
    else renderEmptyState();

    document.getElementById('btn-new-list').addEventListener('click', () => openListModal(null));
    document.getElementById('list-modal-cancel').addEventListener('click', closeListModal);
    document.getElementById('list-modal-form').addEventListener('submit', saveListMeta);
    document.getElementById('add-item-search').addEventListener('input', renderAddItemResults);
    document.getElementById('add-item-cancel').addEventListener('click', closeAddItemModal);
}

// ── SIDEBAR ───────────────────────────────────────────────────────────────
function renderListsSidebar() {
    const container = document.getElementById('lists-sidebar');
    if (allLists.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem; padding:12px 0;">No hay listas aún.</p>`;
        return;
    }
    container.innerHTML = allLists.map(list => `
        <div class="list-sidebar-item${list.id === currentListId ? ' active' : ''}" data-id="${list.id}">
            <span class="list-sidebar-name">${list.name}</span>
            <span class="list-sidebar-count">${(list.items || []).length}</span>
        </div>`).join('');

    container.querySelectorAll('.list-sidebar-item').forEach(el => {
        el.addEventListener('click', () => openList(parseInt(el.dataset.id)));
    });
}

// ── ABRIR LISTA ───────────────────────────────────────────────────────────
function openList(id) {
    currentListId = id;
    const list = allLists.find(l => l.id === id);
    if (!list) return;
    renderListsSidebar();
    renderListDetail(list);
}

function renderEmptyState() {
    document.getElementById('list-detail').innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:300px; color:var(--text-muted); gap:12px;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px;opacity:0.3;"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            <p style="font-size:0.95rem;">Crea tu primera lista con el botón "Nueva lista"</p>
        </div>`;
}

function renderListDetail(list) {
    const detail = document.getElementById('list-detail');
    const items  = (list.items || []).map(ref => allItems.find(i => i.id === ref.id && i._type === ref.type)).filter(Boolean);

    const itemsHtml = items.length === 0
        ? `<p style="color:var(--text-muted); font-size:0.9rem; padding:20px 0;">Esta lista está vacía. Añade elementos con el botón "+".</p>`
        : items.map((item, idx) => {
            const cover = item.coverBase64 || '';
            const badgeColor = getColorByRating(item.rating);
            const rating = formatRating(item.rating);
            return `
                <div class="list-row" draggable="true" data-idx="${idx}">
                    <span class="list-row-pos">${idx + 1}</span>
                    <img class="list-row-cover" src="${cover}" alt="${item.title}" loading="lazy" onerror="this.style.visibility='hidden'">
                    <div class="list-row-info">
                        <div class="list-row-title">${item.title}</div>
                        <div class="list-row-meta">${item.artist || item.director || ''} · ${item.year || ''} · <span style="font-size:0.75rem; opacity:0.7;">${item._label}</span></div>
                    </div>
                    <span class="rating-badge" style="background:${badgeColor}; font-size:0.85rem;">${rating || '–'}</span>
                    <button class="list-row-remove" data-idx="${idx}" title="Quitar de la lista">✖</button>
                </div>`;
        }).join('');

    detail.innerHTML = `
        <div class="list-detail-header">
            <div>
                <h2 class="list-detail-title">${list.name}</h2>
                ${list.description ? `<p class="list-detail-desc">${list.description}</p>` : ''}
            </div>
            <div style="display:flex; gap:8px;">
                <button class="save-btn" id="btn-add-item">+ Añadir</button>
                <button class="action-btn btn-edit" id="btn-edit-list" title="Editar lista">✎</button>
                <button class="action-btn btn-delete" id="btn-delete-list" title="Borrar lista">✖</button>
            </div>
        </div>
        <div id="list-items-container">${itemsHtml}</div>`;

    // Eventos
    detail.querySelector('#btn-add-item').addEventListener('click', () => openAddItemModal());
    detail.querySelector('#btn-edit-list').addEventListener('click', () => openListModal(list));
    detail.querySelector('#btn-delete-list').addEventListener('click', () => deleteCurrentList());
    detail.querySelectorAll('.list-row-remove').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.idx);
            list.items.splice(idx, 1);
            await saveListToDB(list);
            allLists = await getAllListsFromDB();
            renderListDetail(list);
            renderListsSidebar();
        });
    });
    initDragDrop(list);
}

// ── DRAG & DROP ───────────────────────────────────────────────────────────
function initDragDrop(list) {
    const rows = document.querySelectorAll('.list-row');
    rows.forEach(row => {
        row.addEventListener('dragstart', (e) => {
            dragSrcIdx = parseInt(row.dataset.idx);
            row.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        row.addEventListener('dragend', () => {
            row.classList.remove('dragging');
            document.querySelectorAll('.list-row').forEach(r => r.classList.remove('drag-over'));
        });
        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            document.querySelectorAll('.list-row').forEach(r => r.classList.remove('drag-over'));
            row.classList.add('drag-over');
        });
        row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
        row.addEventListener('drop', async (e) => {
            e.preventDefault();
            row.classList.remove('drag-over');
            const targetIdx = parseInt(row.dataset.idx);
            if (dragSrcIdx === null || dragSrcIdx === targetIdx) return;
            const moved = list.items.splice(dragSrcIdx, 1)[0];
            list.items.splice(targetIdx, 0, moved);
            dragSrcIdx = null;
            await saveListToDB(list);
            allLists = await getAllListsFromDB();
            renderListDetail(list);
        });
    });
}

// ── MODAL NUEVA / EDITAR LISTA ────────────────────────────────────────────
function openListModal(list) {
    const modal = document.getElementById('list-modal');
    document.getElementById('list-modal-title').textContent = list ? 'Editar lista' : 'Nueva lista';
    document.getElementById('list-modal-name').value = list?.name || '';
    document.getElementById('list-modal-desc').value = list?.description || '';
    modal.dataset.editId = list?.id || '';
    modal.classList.remove('hidden');
}

function closeListModal() {
    document.getElementById('list-modal').classList.add('hidden');
}

async function saveListMeta(e) {
    e.preventDefault();
    const name = document.getElementById('list-modal-name').value.trim();
    const desc = document.getElementById('list-modal-desc').value.trim();
    const editId = parseInt(document.getElementById('list-modal').dataset.editId);
    if (!name) return;

    if (editId) {
        const list = allLists.find(l => l.id === editId);
        if (list) { list.name = name; list.description = desc; await saveListToDB(list); }
    } else {
        const newList = { id: Date.now(), name, description: desc, createdAt: new Date().toISOString(), items: [] };
        await saveListToDB(newList);
        currentListId = newList.id;
    }

    allLists = await getAllListsFromDB();
    closeListModal();
    renderListsSidebar();
    const current = allLists.find(l => l.id === (editId || currentListId));
    if (current) renderListDetail(current);
}

// ── BORRAR LISTA ──────────────────────────────────────────────────────────
async function deleteCurrentList() {
    const list = allLists.find(l => l.id === currentListId);
    if (!list) return;
    const ok = await brConfirm(`Esto borrará la lista "${list.name}" permanentemente.`, '¿Borrar lista?');
    if (!ok) return;
    await deleteListFromDB(currentListId);
    allLists = await getAllListsFromDB();
    currentListId = allLists.length > 0 ? allLists[0].id : null;
    renderListsSidebar();
    if (currentListId) openList(currentListId);
    else renderEmptyState();
}

// ── MODAL AÑADIR ELEMENTO ─────────────────────────────────────────────────
function openAddItemModal() {
    document.getElementById('add-item-modal').classList.remove('hidden');
    document.getElementById('add-item-search').value = '';
    renderAddItemResults();
}

function closeAddItemModal() {
    document.getElementById('add-item-modal').classList.add('hidden');
}

function renderAddItemResults() {
    const query   = document.getElementById('add-item-search').value.toLowerCase().trim();
    const list    = allLists.find(l => l.id === currentListId);
    const inList  = new Set((list?.items || []).map(r => `${r.type}_${r.id}`));

    let results = allItems.filter(item => {
        if (inList.has(`${item._type}_${item.id}`)) return false;
        if (!query) return true;
        return (item.title || '').toLowerCase().includes(query)
            || (item.artist || '').toLowerCase().includes(query)
            || (item.director || '').toLowerCase().includes(query);
    }).slice(0, 30);

    const container = document.getElementById('add-item-results');
    if (results.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:20px;">Sin resultados</p>`;
        return;
    }

    container.innerHTML = results.map(item => {
        const cover = item.coverBase64 || '';
        return `
            <div class="add-item-row" data-id="${item.id}" data-type="${item._type}">
                <img class="list-row-cover" src="${cover}" alt="${item.title}" loading="lazy" onerror="this.style.visibility='hidden'">
                <div class="list-row-info">
                    <div class="list-row-title">${item.title}</div>
                    <div class="list-row-meta">${item.artist || item.director || ''} · ${item.year || ''} · <span style="opacity:0.7;">${item._label}</span></div>
                </div>
                <button class="save-btn" style="font-size:0.8rem; padding:6px 14px;">+ Añadir</button>
            </div>`;
    }).join('');

    container.querySelectorAll('.add-item-row').forEach(row => {
        row.querySelector('button').addEventListener('click', async () => {
            const id   = parseInt(row.dataset.id);
            const type = row.dataset.type;
            const list = allLists.find(l => l.id === currentListId);
            if (!list) return;
            if (!list.items.find(r => r.id === id && r.type === type)) {
                list.items.push({ id, type });
                await saveListToDB(list);
                allLists = await getAllListsFromDB();
                renderListsSidebar();
            }
            row.querySelector('button').textContent = '✔ Añadido';
            row.querySelector('button').disabled = true;
        });
    });
}

initLists();

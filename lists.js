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

    // Poblar datalist de géneros
    const genreSet = new Set();
    albums.forEach(a => { if (a.genres) a.genres.forEach(g => genreSet.add(g)); });
    const datalist = document.getElementById('genre-datalist');
    if (datalist) datalist.innerHTML = [...genreSet].sort().map(g => `<option value="${g}">`).join('');

    renderListsSidebar();
    if (allLists.length > 0) openList(allLists[0].id);
    else renderEmptyState();

    document.getElementById('btn-new-list').addEventListener('click', () => openListModal(null));
    document.getElementById('list-modal-cancel').addEventListener('click', closeListModal);
    document.getElementById('list-modal-form').addEventListener('submit', saveListMeta);
    document.getElementById('add-item-search').addEventListener('input', renderAddItemResults);
    document.getElementById('add-item-type').addEventListener('change', renderAddItemResults);
    document.getElementById('add-item-sort').addEventListener('change', renderAddItemResults);
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
            <span class="list-sidebar-name">${list.isTop ? '▲ ' : ''}${list.name}</span>
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
    const detail   = document.getElementById('list-detail');
    const isTrack  = list.itemType === 'track';
    const topBadge = list.isTop
        ? `<span style="display:inline-block; margin-left:8px; padding:2px 8px; border-radius:20px; background:var(--accent-red); color:white; font-size:0.7rem; font-weight:800; letter-spacing:0.5px; vertical-align:middle;">TOP</span>`
        : '';
    const typePill = `<span style="display:inline-block; margin-top:6px; padding:2px 9px; border-radius:20px; background:var(--bg-secondary); border:1px solid var(--border-color); font-size:0.72rem; font-weight:700; color:var(--text-muted);">${isTrack ? '🎵 Canciones' : '💿 Álbumes'}</span>`;

    let itemsHtml;
    if (isTrack) {
        // Lista de canciones
        const trackRefs = list.items || [];
        itemsHtml = trackRefs.length === 0
            ? `<p style="color:var(--text-muted); font-size:0.9rem; padding:20px 0;">Esta lista está vacía. Añade canciones con el botón "+".</p>`
            : trackRefs.map((ref, idx) => {
                // Buscar el álbum y la canción
                const album = allItems.find(i => i.id === ref.albumId && i._type === 'album');
                const badgeColor = getColorByRating(ref.trackRating);
                const cover = album?.coverBase64 || '';
                return `
                    <div class="list-row" draggable="true" data-idx="${idx}">
                        <span class="list-row-pos">${idx + 1}</span>
                        <img class="list-row-cover" src="${cover}" alt="${ref.trackTitle}" loading="lazy" onerror="this.style.visibility='hidden'">
                        <div class="list-row-info">
                            <div class="list-row-title">${ref.trackTitle}</div>
                            <div class="list-row-meta">${album?.artist || ''} · ${album?.title || ''}</div>
                        </div>
                        <span class="rating-badge" style="background:${badgeColor}; font-size:0.85rem;">${formatRating(ref.trackRating) || '–'}</span>
                        <button class="list-row-remove" data-idx="${idx}" title="Quitar de la lista">✖</button>
                    </div>`;
            }).join('');
    } else {
        // Lista de álbumes (comportamiento original)
        const items = (list.items || []).map(ref => allItems.find(i => i.id === ref.id && i._type === ref.type)).filter(Boolean);
        itemsHtml = items.length === 0
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
    }

    detail.innerHTML = `
        <div class="list-detail-header">
            <div>
                <h2 class="list-detail-title">${list.name}${topBadge}</h2>
                ${list.description ? `<p class="list-detail-desc">${list.description}</p>` : ''}
                <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:6px;">
                    ${typePill}
                    ${list.genre ? `<a href="genre.html?g=${encodeURIComponent(list.genre)}" style="display:inline-block; padding:2px 9px; border-radius:20px; background:var(--bg-secondary); border:1px solid var(--border-color); font-size:0.72rem; font-weight:700; color:var(--text-muted); text-decoration:none; transition:all 0.2s;" onmouseover="this.style.color='var(--accent-red)';this.style.borderColor='var(--accent-red)';" onmouseout="this.style.color='var(--text-muted)';this.style.borderColor='var(--border-color)';">${list.genre}</a>` : ''}
                </div>
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
    document.getElementById('list-modal-name').value  = list?.name || '';
    document.getElementById('list-modal-desc').value  = list?.description || '';
    document.getElementById('list-modal-genre').value = list?.genre || '';
    document.getElementById('list-modal-istop').checked = list?.isTop || false;
    const itemType = list?.itemType || 'album';
    document.getElementById('list-type-albums').checked = itemType === 'album';
    document.getElementById('list-type-tracks').checked = itemType === 'track';
    // Si la lista ya tiene elementos, bloquear cambio de tipo
    const hasItems = (list?.items || []).length > 0;
    document.getElementById('list-type-albums').disabled = hasItems;
    document.getElementById('list-type-tracks').disabled = hasItems;
    modal.dataset.editId = list?.id || '';
    modal.classList.remove('hidden');
}

function closeListModal() {
    document.getElementById('list-modal').classList.add('hidden');
}

async function saveListMeta(e) {
    e.preventDefault();
    const name     = document.getElementById('list-modal-name').value.trim();
    const desc     = document.getElementById('list-modal-desc').value.trim();
    const genre    = document.getElementById('list-modal-genre').value.trim();
    const isTop    = document.getElementById('list-modal-istop').checked;
    const itemType = document.querySelector('input[name="list-item-type"]:checked')?.value || 'album';
    const editId   = parseInt(document.getElementById('list-modal').dataset.editId);
    if (!name) return;

    if (editId) {
        const list = allLists.find(l => l.id === editId);
        if (list) {
            list.name = name; list.description = desc;
            list.genre = genre || null; list.isTop = isTop;
            // itemType solo se cambia si no tiene elementos
            if ((list.items || []).length === 0) list.itemType = itemType;
            await saveListToDB(list);
        }
    } else {
        const newList = { id: Date.now(), name, description: desc, genre: genre || null, isTop, itemType, createdAt: new Date().toISOString(), items: [] };
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
    const list = allLists.find(l => l.id === currentListId);
    const isTrack = list?.itemType === 'track';

    document.getElementById('add-item-modal').classList.remove('hidden');
    document.getElementById('add-item-search').value = '';
    document.getElementById('add-item-sort').value = 'default';

    // Mostrar/ocultar filtro de tipo (no tiene sentido en listas de canciones)
    const typeFilter = document.getElementById('add-item-type');
    typeFilter.style.display = isTrack ? 'none' : '';
    typeFilter.value = '';

    // Cambiar placeholder según tipo
    document.getElementById('add-item-search').placeholder = isTrack
        ? 'Buscar canción, artista o álbum…'
        : 'Buscar álbum, película o serie…';

    renderAddItemResults();
}

function closeAddItemModal() {
    document.getElementById('add-item-modal').classList.add('hidden');
}

function renderAddItemResults() {
    const query      = document.getElementById('add-item-search').value.toLowerCase().trim();
    const typeFilter = document.getElementById('add-item-type').value;
    const sort       = document.getElementById('add-item-sort').value;
    const list       = allLists.find(l => l.id === currentListId);
    const isTrack    = list?.itemType === 'track';
    const container  = document.getElementById('add-item-results');

    if (isTrack) {
        // ── MODO CANCIONES ──────────────────────────────────────────────
        const inList = new Set((list?.items || []).map(r => `${r.albumId}__${r.trackTitle}`));
        let tracks = [];
        allItems.filter(i => i._type === 'album').forEach(album => {
            (album.tracks || []).forEach(t => {
                if (t.isInterlude || !parseFloat(t.rating)) return;
                const key = `${album.id}__${t.title}`;
                if (inList.has(key)) return;
                if (query && !(t.title || '').toLowerCase().includes(query)
                          && !(album.artist || '').toLowerCase().includes(query)
                          && !(album.title || '').toLowerCase().includes(query)) return;
                tracks.push({ albumId: album.id, albumTitle: album.title, albumCover: album.coverBase64, artist: album.artist, trackTitle: t.title, trackRating: parseFloat(t.rating) });
            });
        });
        if (sort === 'rating-desc') tracks.sort((a, b) => b.trackRating - a.trackRating);
        else if (sort === 'rating-asc') tracks.sort((a, b) => a.trackRating - b.trackRating);
        else if (sort === 'title-asc') tracks.sort((a, b) => a.trackTitle.localeCompare(b.trackTitle));
        else if (sort === 'artist-asc') tracks.sort((a, b) => a.artist.localeCompare(b.artist));
        tracks = tracks.slice(0, 40);

        if (tracks.length === 0) { container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:20px;">Sin resultados</p>`; return; }
        container.innerHTML = tracks.map((t, i) => `
            <div class="add-item-row" data-tidx="${i}">
                <img class="list-row-cover" src="${t.albumCover || ''}" alt="${t.trackTitle}" loading="lazy" onerror="this.style.visibility='hidden'">
                <div class="list-row-info">
                    <div class="list-row-title">${t.trackTitle}</div>
                    <div class="list-row-meta">${t.artist || ''} · ${t.albumTitle}</div>
                </div>
                <span class="rating-badge" style="background:${getColorByRating(t.trackRating)}; font-size:0.8rem; margin-right:8px;">${formatRating(t.trackRating)}</span>
                <button class="save-btn" style="font-size:0.8rem; padding:6px 14px;">+ Añadir</button>
            </div>`).join('');

        container.querySelectorAll('.add-item-row').forEach((row, i) => {
            row.querySelector('button').addEventListener('click', async () => {
                const t    = tracks[i];
                const list = allLists.find(l => l.id === currentListId);
                if (!list) return;
                const key = `${t.albumId}__${t.trackTitle}`;
                if (!list.items.find(r => `${r.albumId}__${r.trackTitle}` === key)) {
                    list.items.push({ type: 'track', albumId: t.albumId, trackTitle: t.trackTitle, trackRating: t.trackRating });
                    await saveListToDB(list);
                    allLists = await getAllListsFromDB();
                    renderListsSidebar();
                }
                row.querySelector('button').textContent = '✔ Añadido';
                row.querySelector('button').disabled = true;
            });
        });
        return;
    }

    // ── MODO ÁLBUMES/PELÍCULAS/SERIES ────────────────────────────────────
    const inList  = new Set((list?.items || []).map(r => `${r.type}_${r.id}`));
    let results = allItems.filter(item => {
        if (inList.has(`${item._type}_${item.id}`)) return false;
        if (typeFilter && item._type !== typeFilter) return false;
        if (!query) return true;
        return (item.title || '').toLowerCase().includes(query)
            || (item.artist || '').toLowerCase().includes(query)
            || (item.director || '').toLowerCase().includes(query);
    });

    if (sort === 'rating-desc') results.sort((a, b) => parseFloat(b.rating || 0) - parseFloat(a.rating || 0));
    else if (sort === 'rating-asc') results.sort((a, b) => parseFloat(a.rating || 0) - parseFloat(b.rating || 0));
    else if (sort === 'year-desc') results.sort((a, b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0));
    else if (sort === 'year-asc')  results.sort((a, b) => (parseInt(a.year) || 0) - (parseInt(b.year) || 0));
    else if (sort === 'title-asc') results.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    else if (sort === 'artist-asc') results.sort((a, b) => (a.artist || a.director || '').localeCompare(b.artist || b.director || ''));
    results = results.slice(0, 40);

    if (results.length === 0) { container.innerHTML = `<p style="color:var(--text-muted); text-align:center; padding:20px;">Sin resultados</p>`; return; }
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

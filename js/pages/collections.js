// collections.js - Colecciones con formatos por elemento y artistas

const ACCENT_COLORS = ['#e63946','#3a86ff','#8338ec','#fb5607','#06d6a0','#ffbe0b','#ff006e','#3d405b'];
const FORMATS = ['cover', 'title', 'full', 'horizontal']; // formatos disponibles

let allCollections = [];
let currentColId   = null;
let editingColId   = null;
let allItems       = []; // álbumes, pelis, series
let allArtists     = []; // artistas únicos
let selectedColor  = ACCENT_COLORS[0];
let currentTab     = 'all';

// ── DB ─────────────────────────────────────────────────────────────────────
async function getAllCollectionsFromDB() { return await getAllItemsFromDB('collections'); }
async function saveCollectionToDB(col)   { return await saveItemToDB('collections', col); }
async function deleteCollectionFromDB(id){ return await deleteItemFromDB('collections', id); }

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

    // Recopilar artistas únicos
    const artistNames = new Set();
    albums.forEach(a => {
        if (a.artist) artistNames.add(a.artist);
        if (a.featuredArtists) a.featuredArtists.forEach(f => artistNames.add(f));
        if (a.tracks) a.tracks.forEach(t => {
            if (t.artist) t.artist.split(',').map(x => x.trim()).forEach(n => { if (n) artistNames.add(n); });
        });
    });

    allArtists = await Promise.all([...artistNames].sort().map(async name => {
        const data = await getArtistFromDB(name);
        return { name, photo: data?.photo || null, _type: 'artist', _typeLabel: 'Artista' };
    }));

    renderCollectionsList();
    initModals();
    initBannerUpload();
}

// ── COLLAGE ────────────────────────────────────────────────────────────────
function buildCollageHtml(covers, accent) {
    const bg = accent + '22';
    if (covers.length === 0) {
        return `<div class="collection-collage-empty" style="background:${bg};">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${accent}" stroke-width="1.5" style="width:40px;height:40px;opacity:0.4;"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
        </div>`;
    }
    const n = Math.min(covers.length, 5);
    const layouts = [
        [[{w:'70%',h:'90%',t:'5%',l:'15%'}]],
        [[{w:'55%',h:'85%',t:'8%',l:'4%'},{w:'48%',h:'75%',t:'12%',r:'4%'}]],
        [[{w:'52%',h:'88%',t:'6%',l:'3%'},{w:'44%',h:'50%',t:'4%',r:'3%'},{w:'44%',h:'42%',b:'4%',r:'3%'}]],
        [[{w:'50%',h:'88%',t:'6%',l:'3%'},{w:'43%',h:'40%',t:'4%',r:'3%'},{w:'30%',h:'44%',b:'4%',r:'16%'},{w:'30%',h:'35%',b:'10%',r:'50%'}]],
        [[{w:'48%',h:'85%',t:'8%',l:'2%'},{w:'38%',h:'46%',t:'4%',l:'53%'},{w:'26%',h:'40%',b:'4%',r:'2%'},{w:'32%',h:'42%',b:'4%',l:'53%'},{w:'22%',h:'32%',b:'12%',l:'30%'}]]
    ];
    const positions = layouts[n - 1][0];
    const imgs = positions.map((pos, i) => {
        const style = Object.entries(pos).map(([k, v]) => {
            const map = { w: 'width', h: 'height', t: 'top', l: 'left', r: 'right', b: 'bottom' };
            return `${map[k]}:${v}`;
        }).join(';');
        return `<img class="collage-img" src="${covers[i]}" style="${style};">`;
    }).join('');
    return `<div class="collection-collage" style="background:${bg};">${imgs}</div>`;
}

// ── RENDER LISTA ───────────────────────────────────────────────────────────
function renderCollectionsList() {
    const grid = document.getElementById('collections-grid');
    grid.innerHTML = '';

    if (allCollections.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;color:var(--text-muted);font-size:0.9rem;font-style:italic;padding:20px 0;">Aún no tienes colecciones.</div>`;
        return;
    }

    const sorted = [...allCollections].sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));

    sorted.forEach((col, i) => {
        const card  = document.createElement('div');
        card.className = 'collection-card';
        card.style.animationDelay = `${i * 0.04}s`;
        card.addEventListener('click', () => openCollection(col.id));

        const accent = col.color || ACCENT_COLORS[0];
        const covers = (col.items || [])
            .filter(ref => ref.type !== 'artist')
            .map(ref => allItems.find(a => a.id === ref.id && a._type === ref.type)?.coverBase64)
            .filter(Boolean);

        // Also add artist photos if no covers
        if (covers.length === 0) {
            (col.items || []).filter(ref => ref.type === 'artist').forEach(ref => {
                const artist = allArtists.find(a => a.name === ref.id);
                if (artist?.photo) covers.push(artist.photo);
            });
        }

        const itemCount = (col.items || []).length;

        card.innerHTML = `
            <div class="collection-card-actions">
                <button class="action-btn btn-edit" onclick="event.stopPropagation();editCollection(${col.id})" title="Editar">✎</button>
                <button class="action-btn btn-delete" onclick="event.stopPropagation();deleteCollection(${col.id})" title="Borrar">✖</button>
            </div>
            ${buildCollageHtml(covers, accent)}
            <div class="collection-card-info">
                <div class="collection-card-name">${col.favorite ? '★ ' : ''}${esc(col.name)}</div>
                ${col.quote ? `<div class="collection-card-quote">"${esc(col.quote)}"</div>` : ''}
                <div class="collection-card-footer">
                    <span class="collection-card-count">${itemCount} elemento${itemCount !== 1 ? 's' : ''}</span>
                    <button class="collection-fav-star" onclick="event.stopPropagation();toggleFavorite(${col.id})">${col.favorite ? '★' : '☆'}</button>
                </div>
            </div>`;
        grid.appendChild(card);
    });
}

// ── DETALLE ────────────────────────────────────────────────────────────────
function openCollection(id) {
    currentColId = id;
    const col = allCollections.find(c => c.id === id);
    if (!col) return;

    document.getElementById('view-list').style.display   = 'none';
    document.getElementById('view-detail').style.display = 'block';
    document.getElementById('detail-name').textContent   = col.name;
    document.getElementById('detail-quote-display').textContent = col.quote ? `"${col.quote}"` : '';

    const banner = document.getElementById('detail-banner');
    const accent = col.color || ACCENT_COLORS[0];
    banner.style.background = col.banner
        ? `url(${col.banner}) center/cover no-repeat`
        : `linear-gradient(135deg, ${accent}dd 0%, ${accent}66 100%)`;

    renderDetailGrid(col);
}

function backToList() {
    currentColId = null;
    document.getElementById('view-list').style.display   = 'block';
    document.getElementById('view-detail').style.display = 'none';
    initCollections();
}

// ── RENDER GRID CON FORMATOS ───────────────────────────────────────────────
function renderDetailGrid(col) {
    const grid = document.getElementById('detail-grid');
    grid.innerHTML = '';

    const refs = col.items || [];
    if (refs.length === 0) {
        grid.innerHTML = `<p style="color:var(--text-muted);font-style:italic;">Colección vacía. Pulsa "+ Añadir" para agregar contenido.</p>`;
        return;
    }

    refs.forEach((ref, index) => {
        const fmt = ref.format || 'full';

        if (ref.type === 'artist') {
            renderArtistItem(ref, index, fmt, grid, col);
        } else {
            const item = allItems.find(a => a.id === ref.id && a._type === ref.type);
            if (!item) return;
            renderMediaItem(item, ref, index, fmt, grid, col);
        }
    });
}

function renderMediaItem(item, ref, index, fmt, grid, col) {
    const badgeColor = getColorByRating(item.rating);
    const href = item._type === 'album'
        ? `album.html?id=${item.id}`
        : `media-detail.html?type=${item._type === 'movie' ? 'movies' : 'series'}&id=${item.id}`;

    const card = document.createElement('div');
    card.className = `col-item fmt-${fmt}`;

    const meta = item.artist || item.director || item.creator || '';

    card.innerHTML = `
        <button class="col-item-menu-btn" title="Opciones">⋯</button>
        <div class="col-item-dropdown">
            ${mediaFormatOptions(fmt)}
            <div class="fmt-option-divider"></div>
            <button class="fmt-option fmt-option-remove">✖ Quitar de la colección</button>
        </div>
        <img src="${item.coverBase64}" alt="${esc(item.title)}">
        <div class="col-item-info">
            <div class="col-item-title">${esc(item.title)}</div>
            <div class="col-item-artist">${esc(meta)}${item.year ? ' · ' + item.year : ''}</div>
            <span class="col-item-badge" style="background:${badgeColor}">${formatRating(item.rating)}</span>
        </div>`;

    // Menu button
    const menuBtn  = card.querySelector('.col-item-menu-btn');
    const dropdown = card.querySelector('.col-item-dropdown');
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close all other dropdowns
        document.querySelectorAll('.col-item-dropdown.open').forEach(d => { if (d !== dropdown) d.classList.remove('open'); });
        dropdown.classList.toggle('open');
    });

    // Format options
    dropdown.querySelectorAll('.fmt-option[data-fmt]').forEach(opt => {
        opt.addEventListener('click', async (e) => {
            e.stopPropagation();
            dropdown.classList.remove('open');
            await setItemFormat(index, opt.dataset.fmt, col);
        });
    });

    // Remove
    dropdown.querySelector('.fmt-option-remove').addEventListener('click', async (e) => {
        e.stopPropagation();
        dropdown.classList.remove('open');
        await removeFromCollection(item.id, item._type);
    });

    card.addEventListener('click', () => window.location.href = href);
    grid.appendChild(card);
}

function renderArtistItem(ref, index, fmt, grid, col) {
    const artist = allArtists.find(a => a.name === ref.id);
    if (!artist) return;

    // Artist format: avatar, avatar-name, banner, banner-avatar
    const artistFmt = ref.format && ref.format.startsWith('artist-') ? ref.format : 'artist-avatar-name';

    const card = document.createElement('div');
    card.className = 'col-item';
    card.style.overflow = 'hidden';

    const avatarHtml = artist.photo
        ? `<img src="${artist.photo}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;margin:0 auto;display:block;" alt="${esc(artist.name)}">`
        : `<div style="width:80px;height:80px;border-radius:50%;background:var(--accent-red);display:flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:900;color:white;margin:0 auto;">${artist.name.charAt(0).toUpperCase()}</div>`;

    let innerHtml = '';
    if (artistFmt === 'artist-avatar') {
        innerHtml = `<div style="padding:20px 16px;text-align:center;">${avatarHtml}</div>`;
    } else if (artistFmt === 'artist-avatar-name') {
        innerHtml = `<div style="padding:20px 16px;text-align:center;">${avatarHtml}<div style="margin-top:10px;font-size:0.88rem;font-weight:700;">${esc(artist.name)}</div></div>`;
    } else if (artistFmt === 'artist-banner') {
        const bannerStyle = artist.banner
            ? `background:url(${artist.banner}) center/cover no-repeat;`
            : `background:linear-gradient(135deg,var(--accent-red)cc,var(--accent-red)66);`;
        innerHtml = `<div style="${bannerStyle}height:100px;border-radius:8px;margin:8px;"></div>
            <div style="padding:4px 12px 12px;font-size:0.88rem;font-weight:700;">${esc(artist.name)}</div>`;
    } else if (artistFmt === 'artist-banner-avatar') {
        const bannerStyle = artist.banner
            ? `background:url(${artist.banner}) center/cover no-repeat;`
            : `background:linear-gradient(135deg,var(--accent-red)cc,var(--accent-red)44);`;
        innerHtml = `
            <div style="position:relative;">
                <div style="${bannerStyle}height:90px;"></div>
                <div style="position:absolute;bottom:-24px;left:50%;transform:translateX(-50%);">
                    ${artist.photo
                        ? `<img src="${artist.photo}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:3px solid var(--bg-card);" alt="${esc(artist.name)}">`
                        : `<div style="width:48px;height:48px;border-radius:50%;background:var(--accent-red);display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:900;color:white;border:3px solid var(--bg-card);">${artist.name.charAt(0).toUpperCase()}</div>`}
                </div>
            </div>
            <div style="padding:28px 12px 12px;text-align:center;font-size:0.88rem;font-weight:700;">${esc(artist.name)}</div>`;
    }

    card.innerHTML = `
        <button class="col-item-menu-btn" title="Opciones">⋯</button>
        <div class="col-item-dropdown">
            ${artistFormatOptions(artistFmt)}
            <div class="fmt-option-divider"></div>
            <button class="fmt-option fmt-option-remove">✖ Quitar de la colección</button>
        </div>
        ${innerHtml}`;

    const menuBtn  = card.querySelector('.col-item-menu-btn');
    const dropdown = card.querySelector('.col-item-dropdown');
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.col-item-dropdown.open').forEach(d => { if (d !== dropdown) d.classList.remove('open'); });
        dropdown.classList.toggle('open');
    });

    dropdown.querySelectorAll('.fmt-option[data-fmt]').forEach(opt => {
        opt.addEventListener('click', async (e) => {
            e.stopPropagation();
            dropdown.classList.remove('open');
            await setItemFormat(index, opt.dataset.fmt, col);
        });
    });

    dropdown.querySelector('.fmt-option-remove').addEventListener('click', async (e) => {
        e.stopPropagation();
        dropdown.classList.remove('open');
        await removeFromCollection(ref.id, 'artist');
    });

    card.addEventListener('click', () => window.location.href = `artist.html?name=${encodeURIComponent(artist.name)}`);
    grid.appendChild(card);
}

function mediaFormatOptions(currentFmt) {
    const fmts = [
        { key: 'cover',      label: 'Solo portada' },
        { key: 'title',      label: 'Portada + título' },
        { key: 'full',       label: 'Portada + título + artista' },
        { key: 'horizontal', label: 'Horizontal' },
    ];
    return fmts.map(f => `
        <button class="fmt-option${f.key === currentFmt ? ' active' : ''}" data-fmt="${f.key}">
            ${f.key === currentFmt ? '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px;height:12px;flex-shrink:0;"><polyline points="2 8 6 12 14 4"/></svg>' : '<span style="width:12px;height:12px;flex-shrink:0;display:inline-block;"></span>'}
            ${f.label}
        </button>`).join('');
}

function artistFormatOptions(currentFmt) {
    const fmts = [
        { key: 'artist-avatar',        label: 'Solo avatar' },
        { key: 'artist-avatar-name',   label: 'Avatar + nombre' },
        { key: 'artist-banner',        label: 'Banner + nombre' },
        { key: 'artist-banner-avatar', label: 'Banner + avatar' },
    ];
    return fmts.map(f => `
        <button class="fmt-option${f.key === currentFmt ? ' active' : ''}" data-fmt="${f.key}">
            ${f.key === currentFmt ? '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px;height:12px;flex-shrink:0;"><polyline points="2 8 6 12 14 4"/></svg>' : '<span style="width:12px;height:12px;flex-shrink:0;display:inline-block;"></span>'}
            ${f.label}
        </button>`).join('');
}

async function setItemFormat(index, newFmt, col) {
    col.items[index].format = newFmt;
    await saveCollectionToDB(col);
    allCollections = await getAllCollectionsFromDB();
    const updatedCol = allCollections.find(c => c.id === currentColId);
    renderDetailGrid(updatedCol);
}

// ── REMOVE ─────────────────────────────────────────────────────────────────
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
        input.value = '';
        const col = allCollections.find(c => c.id === currentColId);
        if (!col) return;
        col.banner = await resizeImageToDataURL(file, IMAGE_SIZES.banner, 0.82);
        await saveCollectionToDB(col);
        allCollections = await getAllCollectionsFromDB();
        document.getElementById('detail-banner').style.background = `url(${col.banner}) center/cover no-repeat`;
    });
}

// ── AÑADIR ─────────────────────────────────────────────────────────────────
function openAddItemModal() {
    currentTab = 'all';
    document.querySelectorAll('.search-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'all'));
    document.getElementById('collection-search-input').value = '';
    renderSearchResults('');
    document.getElementById('modal-add-item').classList.remove('hidden');
    setTimeout(() => document.getElementById('collection-search-input').focus(), 100);
}

function renderSearchResults(query) {
    const results  = document.getElementById('collection-search-results');
    const col      = allCollections.find(c => c.id === currentColId);
    const addedIds = new Set((col?.items || []).map(i => `${i.type}_${i.id}`));

    const q = query.toLowerCase().trim();

    // Combinar todos según tab
    let pool = [];
    if (currentTab === 'all' || currentTab === 'album' || currentTab === 'movie' || currentTab === 'series') {
        const types = currentTab === 'all' ? ['album','movie','series'] : [currentTab];
        pool = allItems.filter(i => types.includes(i._type));
    }
    if (currentTab === 'all' || currentTab === 'artist') {
        pool = [...pool, ...allArtists];
    }

    if (q) {
        pool = pool.filter(item =>
            (item.title  && item.title.toLowerCase().includes(q)) ||
            (item.name   && item.name.toLowerCase().includes(q)) ||
            (item.artist && item.artist.toLowerCase().includes(q)) ||
            (item.director && item.director.toLowerCase().includes(q))
        );
    }

    results.innerHTML = pool.slice(0, 50).map(item => {
        const isArtist = item._type === 'artist';
        const key      = isArtist ? `artist_${item.name}` : `${item._type}_${item.id}`;
        const isAdded  = addedIds.has(key);
        const label    = isArtist ? item.name : item.title;
        const meta     = isArtist ? 'Artista' : [item.artist || item.director || item.creator, item.year].filter(Boolean).join(' · ');
        const imgHtml  = isArtist
            ? (item.photo
                ? `<img src="${item.photo}" style="border-radius:50%;" alt="${esc(item.name)}">`
                : `<div class="collection-search-item-initials" style="background:var(--accent-red);">${item.name.charAt(0).toUpperCase()}</div>`)
            : `<img src="${item.coverBase64}" alt="${label}">`;

        const onclickFn = isArtist
            ? `addToCollection('${item.name}','artist')`
            : `addToCollection(${item.id},'${item._type}')`;

        return `
            <div class="collection-search-item${isAdded ? ' added' : ''}" onclick="${onclickFn}">
                ${imgHtml}
                <div class="collection-search-item-info">
                    <div class="collection-search-item-title">${label}</div>
                    <div class="collection-search-item-meta">${esc(meta)}</div>
                </div>
                <span class="collection-search-item-type">${item._typeLabel || 'Artista'}</span>
                ${isAdded ? '<span style="font-size:0.7rem;color:var(--accent-red);font-weight:700;flex-shrink:0;">✓</span>' : ''}
            </div>`;
    }).join('');
}

window.addToCollection = async function(itemId, itemType) {
    const col = allCollections.find(c => c.id === currentColId);
    if (!col) return;
    if (!col.items) col.items = [];

    const key = itemType === 'artist' ? `artist_${itemId}` : `${itemType}_${itemId}`;
    if (col.items.find(i => {
        const k = i.type === 'artist' ? `artist_${i.id}` : `${i.type}_${i.id}`;
        return k === key;
    })) return;

    col.items.push({ id: itemId, type: itemType, format: itemType === 'artist' ? 'artist' : 'full' });
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
            style="background:${color};" data-color="${color}"
            onclick="selectColor('${color}')"></div>`).join('');
    selectedColor = currentColor || ACCENT_COLORS[0];
}

window.selectColor = function(color) {
    selectedColor = color;
    document.querySelectorAll('.color-dot').forEach(d => d.classList.toggle('selected', d.dataset.color === color));
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
            await saveCollectionToDB({ id: Date.now(), name, quote, color: selectedColor, items: [], favorite: false });
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

    // Tabs
    document.querySelectorAll('.search-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            currentTab = tab.dataset.tab;
            document.querySelectorAll('.search-tab').forEach(t => t.classList.toggle('active', t === tab));
            renderSearchResults(document.getElementById('collection-search-input').value);
        });
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
    if (await brConfirm('Se borrará la colección. El contenido no se eliminará.', '¿Borrar colección?')) {
        await deleteCollectionFromDB(id);
        allCollections = await getAllCollectionsFromDB();
        renderCollectionsList();
    }
}

// ── DESDE ?add= ────────────────────────────────────────────────────────────
async function checkAddParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const addParam  = urlParams.get('add');
    if (!addParam) return;

    const [type, ...rest] = addParam.split('_');
    const itemId = type === 'artist' ? rest.join('_') : parseInt(rest[0]);

    if (allCollections.length === 0) {
        await brAlert('Primero crea una colección.', 'Sin colecciones');
        history.replaceState({}, '', 'collections.html');
        return;
    }

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:9998;';
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--bg-card);border-radius:20px;padding:32px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,0.2);font-family:Inter,sans-serif;';
    box.innerHTML = `
        <h2 style="font-size:1.3rem;font-weight:900;margin-bottom:20px;letter-spacing:-0.5px;">¿A qué colección?</h2>
        <div style="display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto;">
            ${allCollections.map(col => `
                <button data-id="${col.id}" style="text-align:left;padding:12px 16px;border-radius:10px;border:1px solid var(--border-color);background:var(--bg-secondary);cursor:pointer;font-family:inherit;font-size:0.9rem;font-weight:700;color:var(--text-main);transition:all 0.15s;"
                    onmouseover="this.style.background='${col.color || ACCENT_COLORS[0]}';this.style.color='white';this.style.borderColor='transparent'"
                    onmouseout="this.style.background='var(--bg-secondary)';this.style.color='var(--text-main)';this.style.borderColor='var(--border-color)'">
                    ${esc(col.name)}
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
                col.items.push({ id: itemId, type, format: 'full' });
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

// Close dropdowns on outside click
document.addEventListener('click', () => {
    document.querySelectorAll('.col-item-dropdown.open').forEach(d => d.classList.remove('open'));
});

initCollections().then(() => checkAddParam());
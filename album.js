// album.js - Gestión detallada del álbum, canciones, reviews y créditos

let currentAlbum = null;
let editingTrackIndex = null;
let reviewBlocks  = [];
let reviewTarget  = null;
let creditsTarget = null;
let creditsEditMode = false; // false = vista lectura, true = edición
let trackSortMode = 'default'; // 'default' | 'desc' | 'asc'

function getDisplayTracks() {
    const indexed = (currentAlbum.tracks || []).map((track, realIndex) => ({ track, realIndex }));
    if (trackSortMode === 'desc') {
        return [...indexed].sort((a, b) => {
            if (a.track.isInterlude && b.track.isInterlude) return 0;
            if (a.track.isInterlude) return 1;
            if (b.track.isInterlude) return -1;
            return parseFloat(b.track.rating || 0) - parseFloat(a.track.rating || 0);
        });
    }
    if (trackSortMode === 'asc') {
        return [...indexed].sort((a, b) => {
            if (a.track.isInterlude && b.track.isInterlude) return 0;
            if (a.track.isInterlude) return 1;
            if (b.track.isInterlude) return -1;
            return parseFloat(a.track.rating || 0) - parseFloat(b.track.rating || 0);
        });
    }
    return indexed;
}

async function loadAlbumDetails() {
    const params  = new URLSearchParams(window.location.search);
    const albumId = params.get('id');
    if (!albumId) return;

    currentAlbum = await getAlbumByIdFromDB(albumId);
    if (!currentAlbum) return;
    if (!currentAlbum.tracks) currentAlbum.tracks = [];

    renderAlbumContent();
    initReviewModal();
    initCreditsModal();
}

// ── MEDIA ─────────────────────────────────────────────────────────────────
function recalculateAlbumRating(recordHistory = false, trackChange = null) {
    const prevRating = parseFloat(currentAlbum.rating) || 0;
    if (!currentAlbum?.tracks?.length) { currentAlbum.rating = 0; return; }
    let total = 0, count = 0;
    currentAlbum.tracks.forEach(t => {
        if (!t.isInterlude && !isNaN(parseFloat(t.rating))) { total += parseFloat(t.rating); count++; }
    });
    const newRating = count === 0 ? 0 : parseFloat((total / count).toFixed(1));
    const ratingActuallyChanged = prevRating > 0 && count > 0 && newRating !== prevRating;
    if (recordHistory && (trackChange || ratingActuallyChanged)) {
        if (!currentAlbum.ratingHistory) currentAlbum.ratingHistory = [];
        currentAlbum.ratingHistory.push({
            date: new Date().toISOString(),
            from: prevRating,
            to: newRating,
            trackChange  // { title, fromRating, toRating } o null
        });
    }
    currentAlbum.rating = count === 0 ? 0 : (total / count).toFixed(1);
}

// ── FAVORITOS ─────────────────────────────────────────────────────────────
window.toggleAlbumFavorite = async function() {
    currentAlbum.favorite = !currentAlbum.favorite;
    await saveAlbumToDB(currentAlbum);
    const btn = document.getElementById('btn-album-favorite');
    if (btn) btn.classList.toggle('active', currentAlbum.favorite);
}

// ── BORRAR / EDITAR TRACK ─────────────────────────────────────────────────
window.deleteTrack = async function(index) {
    if (await brConfirm("Esta acción no se puede deshacer.", "¿Borrar canción?")) {
        currentAlbum.tracks.splice(index, 1);
        recalculateAlbumRating();
        try {
            await saveAlbumToDB(currentAlbum);
            renderAlbumContent();
        } catch (err) {
            console.error('Error al borrar canción:', err);
            await brAlert(`No se pudo guardar: ${err.message || err}`, "Error al guardar");
        }
    }
}

window.editTrack = function(index) {
    editingTrackIndex = index;
    const track = currentAlbum.tracks[index];
    const ratingInput = document.getElementById('track-rating');
    document.getElementById('track-title').value   = track.title || "";
    document.getElementById('track-artist').value  = track.artist || "";
    document.getElementById('track-interlude').checked = !!track.isInterlude;
    // rating: usar String() explícito para no perder el "0"
    ratingInput.value = (track.rating != null && track.rating !== '') ? String(track.rating) : "";
    const isInt = !!track.isInterlude;
    document.getElementById('rating-container').style.display = isInt ? 'none' : 'block';
    if (isInt) ratingInput.removeAttribute('required');
    else       ratingInput.setAttribute('required', 'true');
    const modalTitle = document.querySelector('#modal-track h2');
    if (modalTitle) modalTitle.textContent = "Editar Canción";
    document.getElementById('modal-track').classList.remove('hidden');
}

// ── DRAG & DROP ───────────────────────────────────────────────────────────
let dragSrcIndex = null;

function addDragListeners(item, index) {
    item.setAttribute('draggable', 'true');
    item.addEventListener('dragstart', (e) => { dragSrcIndex = index; item.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    item.addEventListener('dragend',   () => { item.classList.remove('dragging'); document.querySelectorAll('.track-item').forEach(el => el.classList.remove('drag-over')); });
    item.addEventListener('dragover',  (e) => { e.preventDefault(); document.querySelectorAll('.track-item').forEach(el => el.classList.remove('drag-over')); item.classList.add('drag-over'); });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', async (e) => {
        e.preventDefault(); item.classList.remove('drag-over');
        if (dragSrcIndex === null || dragSrcIndex === index) return;
        const moved = currentAlbum.tracks.splice(dragSrcIndex, 1)[0];
        currentAlbum.tracks.splice(index, 0, moved);
        dragSrcIndex = null;
        try {
            await saveAlbumToDB(currentAlbum);
            renderAlbumContent();
        } catch (err) {
            console.error('Error al reordenar canciones:', err);
            await brAlert(`No se pudo guardar: ${err.message || err}`, "Error al guardar");
        }
    });
}

// ── SVG HELPERS ───────────────────────────────────────────────────────────
function heartSVG() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
}

function reviewPenSVG(active) {
    const color = active ? 'var(--accent-red)' : 'currentColor';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
}

function creditsSVG(active) {
    const color = active ? 'var(--accent-red)' : 'currentColor';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/></svg>`;
}

function buildTrackArtistDisplay(track) {
    const artistLink = (name) =>
        `<a href="artist.html?name=${encodeURIComponent(name)}" style="color:var(--text-muted);text-decoration:none;font-weight:500;transition:color 0.2s;" onmouseover="this.style.color='var(--accent-red)'" onmouseout="this.style.color='var(--text-muted)'">${name}</a>`;

    if (!track.artist || track.artist.trim() === '') return artistLink(currentAlbum.artist);

    const guests = track.artist.split(',').map(a => a.trim())
        .filter(a => a !== '' && a.toLowerCase() !== currentAlbum.artist.toLowerCase());

    if (guests.length === 0) return artistLink(currentAlbum.artist);

    return `${artistLink(currentAlbum.artist)} ft. ${guests.map(artistLink).join(', ')}`;
}

// ── RENDER PRINCIPAL ──────────────────────────────────────────────────────
function renderAlbumContent() {
    const container  = document.getElementById('album-detail-container');
    const badgeColor = getColorByRating(currentAlbum.rating);
    const typeText   = currentAlbum.type || 'Álbum';
    const isFav      = currentAlbum.favorite || false;
    const albumHasReview  = currentAlbum.review  && currentAlbum.review.length > 0;
    const albumHasCredits = currentAlbum.credits && (currentAlbum.credits.produced || currentAlbum.credits.written);

    const isSorted = trackSortMode !== 'default';
    let tracksHtml = '';
    getDisplayTracks().forEach(({ track, realIndex }) => {
        const trackColor     = track.isInterlude ? '#4D4D4D' : getColorByRating(track.rating);
        const displayRating  = track.isInterlude ? 'INTERLUDE' : formatRating(track.rating);
        const badgeClass     = track.isInterlude ? 'rating-badge album-tag' : 'rating-badge';
        const trackHasReview = track.review && track.review.length > 0;
        const artistDisplay  = buildTrackArtistDisplay(track);
        const dragHandle     = isSorted
            ? `<span class="drag-handle" style="opacity:0.2;cursor:default;" title="Desactiva el orden por nota para reordenar">⠿</span>`
            : `<span class="drag-handle" title="Arrastra para reordenar">⠿</span>`;

        tracksHtml += `
            <div class="track-item" data-index="${realIndex}">
                ${dragHandle}
                <div class="track-info">
                    <h4>${track.title}</h4>
                    <p>${artistDisplay}</p>
                </div>
                <div class="track-actions">
                    <button class="track-review-btn${trackHasReview ? ' has-review' : ''}" onclick="openReview('track', ${realIndex})" title="${trackHasReview ? 'Ver review' : 'Escribir review'}">${reviewPenSVG(trackHasReview)}</button>
                    <button class="track-credits-btn track-review-btn" onclick="openCredits('track', ${realIndex})" title="Créditos">${creditsSVG(false)}</button>
                    <button class="track-btn edit"   onclick="editTrack(${realIndex})"   title="Editar">✎</button>
                    <button class="track-btn delete" onclick="deleteTrack(${realIndex})" title="Borrar">✖</button>
                </div>
                <span class="${badgeClass}" style="background-color: ${trackColor}; font-size: ${track.isInterlude ? '0.7rem' : '1rem'}">${displayRating}</span>
            </div>
        `;
    });

    let displayAlbumRating = "-";
    if (currentAlbum.tracks.length > 0) displayAlbumRating = formatRating(currentAlbum.rating);

    container.innerHTML = `
        <div class="album-header-banner">
            <img src="${currentAlbum.coverBase64}" alt="${currentAlbum.title}" class="detail-cover" onclick="openCoverZoom()" style="cursor:zoom-in;" title="Ver portada">
            <div class="detail-info">
                <span class="detail-type">${typeText} • ${currentAlbum.year}</span>
                <h1 class="detail-title">${currentAlbum.title}</h1>
                <h2 class="detail-artist">
                    <a href="artist.html?name=${encodeURIComponent(currentAlbum.artist)}"
                       style="color:inherit; text-decoration:none; transition:color 0.2s;"
                       onmouseover="this.style.color='var(--accent-red)'"
                       onmouseout="this.style.color='inherit'">${currentAlbum.artist}</a>
                </h2>
                <div style="display:flex; align-items:center; gap:12px; margin-top:auto; flex-wrap:wrap;">
                    <div class="rating-big" style="background-color: ${badgeColor};">${displayAlbumRating}</div>
                    <button id="btn-album-favorite" class="album-fav-btn${isFav ? ' active' : ''}" onclick="toggleAlbumFavorite()">${heartSVG()}</button>
                    <button class="album-review-btn${albumHasReview ? ' has-review' : ''}" onclick="openReview('album')">
                        ${reviewPenSVG(albumHasReview)} ${albumHasReview ? 'Ver review' : 'Escribir review'}
                    </button>
                    <button class="album-review-btn${albumHasCredits ? ' has-review' : ''}" onclick="openCredits('album')">
                        ${creditsSVG(albumHasCredits)} ${albumHasCredits ? 'Créditos' : 'Créditos'}
                    </button>
                </div>
            </div>
        </div>
        <div class="tracklist-section">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; gap:10px;">
                <h2>Canciones</h2>
                <div style="display:flex; gap:8px; align-items:center;">
                    <button id="btn-sort-tracks" style="
                        background:none; border:1px solid var(--border-color); border-radius:8px;
                        padding:5px 12px; font-family:'Inter',sans-serif; font-size:0.78rem; font-weight:700;
                        color:${isSorted ? 'var(--accent-red)' : 'var(--text-muted)'}; cursor:pointer;
                        border-color:${isSorted ? 'var(--accent-red)' : 'var(--border-color)'};
                        transition:all 0.15s; white-space:nowrap;
                    ">${trackSortMode === 'default' ? 'Ordenar por nota' : trackSortMode === 'desc' ? 'Nota: alta a baja' : 'Nota: baja a alta'}</button>
                    <button class="btn" style="background-color:var(--text-main); color:var(--bg-primary);" id="btn-add-track">+ Añadir Canción</button>
                </div>
            </div>
            <div id="tracks-list">${tracksHtml}</div>
        </div>
        ${buildRatingHistoryHtml()}
    `;

    if (!isSorted) {
        document.querySelectorAll('.track-item').forEach((el, index) => addDragListeners(el, index));
    }
    document.getElementById('btn-add-track').addEventListener('click', () => {
        editingTrackIndex = null;
        const modalTitle = document.querySelector('#modal-track h2');
        if (modalTitle) modalTitle.textContent = "Añadir Canción";
        document.getElementById('track-form').reset();
        document.getElementById('rating-container').style.display = 'block';
        document.getElementById('modal-track').classList.remove('hidden');
    });
    document.getElementById('btn-sort-tracks').addEventListener('click', () => {
        if (trackSortMode === 'default') trackSortMode = 'desc';
        else if (trackSortMode === 'desc') trackSortMode = 'asc';
        else trackSortMode = 'default';
        renderAlbumContent();
    });
}

// ── CREDITS MODAL ─────────────────────────────────────────────────────────

function renderCreditsModal(target, editMode) {
    const modal   = document.getElementById('modal-credits');
    const titleEl = document.getElementById('credits-modal-title');
    const body    = document.getElementById('credits-modal-body');

    let credits = {};
    if (target.type === 'album') {
        titleEl.textContent = currentAlbum.title;
        credits = currentAlbum.credits || {};
    } else {
        const track = currentAlbum.tracks[target.index];
        titleEl.textContent = track.title;
        credits = track.credits || {};
    }

    const hasCredits = credits.produced || credits.written;

    if (!editMode && hasCredits) {
        // VISTA DE SOLO LECTURA
        body.innerHTML = `
            <div class="credits-view">
                <button class="credits-edit-trigger" id="btn-credits-edit" title="Editar créditos">✎</button>
                <div class="credits-view-row">
                    ${credits.produced ? `
                        <div class="credits-view-item">
                            <span class="credits-view-label">Producido por</span>
                            <span class="credits-view-value">${credits.produced}</span>
                        </div>` : ''}
                    ${credits.written ? `
                        <div class="credits-view-item">
                            <span class="credits-view-label">Escrito por</span>
                            <span class="credits-view-value">${credits.written}</span>
                        </div>` : ''}
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" id="btn-cancel-credits">Cerrar</button>
            </div>
        `;
        document.getElementById('btn-credits-edit').addEventListener('click', () => {
            renderCreditsModal(target, true);
        });
        document.getElementById('btn-cancel-credits').addEventListener('click', () => {
            modal.classList.add('hidden');
        });
    } else {
        // MODO EDICIÓN
        body.innerHTML = `
            <form id="credits-form">
                <label for="credits-produced">Producido por:</label>
                <input type="text" id="credits-produced" placeholder="Ej: Metro Boomin, Pharrell" value="${credits.produced || ''}">
                <label for="credits-written">Escrito por:</label>
                <input type="text" id="credits-written" placeholder="Ej: Drake, 40" value="${credits.written || ''}">
                <div class="modal-actions">
                    <button type="button" id="btn-cancel-credits">${hasCredits ? 'Cancelar' : 'Cancelar'}</button>
                    <button type="submit" class="save-btn">Guardar Créditos</button>
                </div>
            </form>
        `;
        document.getElementById('btn-cancel-credits').addEventListener('click', () => {
            if (hasCredits) {
                renderCreditsModal(target, false); // volver a vista lectura
            } else {
                modal.classList.add('hidden');
            }
        });
        document.getElementById('credits-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const newCredits = {
                produced: document.getElementById('credits-produced').value.trim(),
                written:  document.getElementById('credits-written').value.trim()
            };
            if (target.type === 'album') {
                currentAlbum.credits = newCredits;
            } else {
                currentAlbum.tracks[target.index].credits = newCredits;
            }
            await saveAlbumToDB(currentAlbum);
            modal.classList.add('hidden');
            renderAlbumContent();
        });
    }

    modal.classList.remove('hidden');
}

window.openCredits = function(type, index) {
    creditsTarget  = type === 'album' ? { type: 'album' } : { type: 'track', index };
    creditsEditMode = false;
    const target   = creditsTarget;
    const credits  = type === 'album' ? (currentAlbum.credits || {}) : (currentAlbum.tracks[index]?.credits || {});
    const hasCredits = credits.produced || credits.written;
    renderCreditsModal(target, !hasCredits); // si no hay créditos, abrir en modo edición directamente
}

function initCreditsModal() {
    // El modal se gestiona dinámicamente desde renderCreditsModal
}

// ── REVIEW MODAL ──────────────────────────────────────────────────────────
window.openReview = function(type, index) {
    if (type === 'album') {
        reviewTarget = { type: 'album' };
        reviewBlocks = currentAlbum.review ? JSON.parse(JSON.stringify(currentAlbum.review)) : [];
        document.getElementById('review-modal-title').textContent = `Review: ${currentAlbum.title}`;
    } else {
        reviewTarget = { type: 'track', index };
        const track  = currentAlbum.tracks[index];
        reviewBlocks = track.review ? JSON.parse(JSON.stringify(track.review)) : [];
        document.getElementById('review-modal-title').textContent = `Review: ${track.title}`;
    }
    if (reviewBlocks.length === 0) reviewBlocks = [{ type: 'text', content: '' }];
    renderReviewEditor();
    document.getElementById('modal-review').classList.remove('hidden');
}

function renderReviewEditor() {
    const editor = document.getElementById('review-editor');
    editor.innerHTML = '';
    reviewBlocks.forEach((block, i) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'review-block-wrapper';
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'review-block-delete';
        deleteBtn.innerHTML = '✖';
        deleteBtn.addEventListener('click', () => {
            if (reviewBlocks.length === 1) { reviewBlocks[0].content = ''; renderReviewEditor(); return; }
            reviewBlocks.splice(i, 1);
            renderReviewEditor();
        });
        const textarea = document.createElement('textarea');
        textarea.className = `review-block review-block-${block.type}`;
        textarea.placeholder = block.type === 'lyrics' ? 'Pega aquí los lyrics…' : 'Escribe tu análisis…';
        textarea.value = block.content;
        textarea.addEventListener('input', () => {
            reviewBlocks[i].content = textarea.value;
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        });
        setTimeout(() => { textarea.style.height = 'auto'; textarea.style.height = textarea.scrollHeight + 'px'; }, 0);
        wrapper.appendChild(deleteBtn);
        wrapper.appendChild(textarea);
        editor.appendChild(wrapper);
        const insertBar = document.createElement('div');
        insertBar.className = 'review-insert-bar';
        insertBar.innerHTML = `
            <button class="review-insert-btn" data-type="text" data-after="${i}">+ Texto</button>
            <button class="review-insert-btn lyrics" data-type="lyrics" data-after="${i}">♪ Lyrics</button>
        `;
        insertBar.querySelectorAll('.review-insert-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                reviewBlocks.splice(parseInt(btn.dataset.after) + 1, 0, { type: btn.dataset.type, content: '' });
                renderReviewEditor();
                setTimeout(() => { const tas = document.querySelectorAll('.review-block'); if (tas[parseInt(btn.dataset.after) + 1]) tas[parseInt(btn.dataset.after) + 1].focus(); }, 50);
            });
        });
        editor.appendChild(insertBar);
    });
}

function initReviewModal() {
    document.getElementById('btn-close-review').addEventListener('click', () => {
        document.getElementById('modal-review').classList.add('hidden');
    });
    document.getElementById('btn-save-review').addEventListener('click', async () => {
        const cleaned = reviewBlocks.filter((b, i) => b.content.trim() !== '' || i === 0).map(b => ({ ...b, content: b.content.trim() }));
        if (reviewTarget.type === 'album') {
            currentAlbum.review = cleaned;
        } else {
            currentAlbum.tracks[reviewTarget.index].review = cleaned;
        }
        await saveAlbumToDB(currentAlbum);
        document.getElementById('modal-review').classList.add('hidden');
        renderAlbumContent();
    });
}

// ── EVENTOS MODAL CANCIÓN ─────────────────────────────────────────────────
document.getElementById('track-interlude').addEventListener('change', (e) => {
    document.getElementById('rating-container').style.display = e.target.checked ? 'none' : 'block';
    if (e.target.checked) document.getElementById('track-rating').removeAttribute('required');
    else document.getElementById('track-rating').setAttribute('required', 'true');
});

document.getElementById('btn-cancel-track').addEventListener('click', () => {
    document.getElementById('modal-track').classList.add('hidden');
});

document.getElementById('track-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const title       = document.getElementById('track-title').value.trim();
    const artist      = document.getElementById('track-artist').value.trim();
    const isInterlude = document.getElementById('track-interlude').checked;
    let rating = "";
    if (!isInterlude) {
        rating = document.getElementById('track-rating').value.replace(',', '.').trim();
        if (rating === "" || isNaN(parseFloat(rating)) || parseFloat(rating) < 0 || parseFloat(rating) > 10) {
            await brAlert("Introduce una nota válida entre 0 y 10.", "Nota inválida");
            return;
        }
        rating = parseFloat(rating).toFixed(1);
    }
    if (!title) {
        await brAlert("El título no puede estar vacío.", "Título requerido");
        return;
    }
    const newTrack = { title, artist, isInterlude, rating };
    const isEditing = editingTrackIndex !== null;
    let trackChange = null;
    if (isEditing) {
        const oldTrack = currentAlbum.tracks[editingTrackIndex];
        // Solo registrar cambio si el track YA tenía una nota válida previa
        if (!isNaN(parseFloat(oldTrack.rating)) && parseFloat(oldTrack.rating) !== parseFloat(newTrack.rating)) {
            trackChange = { title: oldTrack.title, fromRating: parseFloat(oldTrack.rating), toRating: parseFloat(newTrack.rating) };
        }
        newTrack.review   = oldTrack.review;
        newTrack.favorite = oldTrack.favorite;
        newTrack.credits  = oldTrack.credits;
        currentAlbum.tracks[editingTrackIndex] = newTrack;
    } else {
        currentAlbum.tracks.push(newTrack);
    }
    recalculateAlbumRating(isEditing, trackChange);
    try {
        await saveAlbumToDB(currentAlbum);
        document.getElementById('modal-track').classList.add('hidden');
        renderAlbumContent();
    } catch (err) {
        console.error('Error al guardar canción:', err);
        await brAlert(`No se pudo guardar: ${err.message || err}`, "Error al guardar");
    }
});

// ── HISTORIAL DE NOTAS ────────────────────────────────────────────────────
function buildRatingHistoryHtml() {
    const history = currentAlbum.ratingHistory;
    if (!history || history.length === 0) return '';

    const rows = [...history].reverse().map((entry, idx) => {
        const date      = new Date(entry.date);
        const dateStr   = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
        const fromColor = getColorByRating(entry.from);
        const toColor   = getColorByRating(entry.to);
        const diff      = parseFloat((parseFloat(entry.to) - parseFloat(entry.from)).toFixed(1));
        const diffSign  = diff > 0 ? '+' : '';
        const diffColor = diff > 0 ? '#66CC33' : (diff < 0 ? '#FF3333' : 'var(--text-muted)');
        const diffHtml  = diff === 0
            ? `<span style="font-size:0.78rem; color:var(--text-muted); font-style:italic;">sin cambio en nota del álbum</span>`
            : `<span style="font-size:0.8rem; font-weight:700; color:${diffColor};">${diffSign}${formatRating(diff)}</span>`;

        let detailsBtn = '';
        if (entry.trackChange) {
            const tc = entry.trackChange;
            const tcFrom = getColorByRating(tc.fromRating);
            const tcTo   = getColorByRating(tc.toRating);
            detailsBtn = `
                <div style="position:relative; margin-left:auto;">
                    <button class="history-dots-btn" data-idx="${idx}"
                        style="background:none; border:1px solid var(--border-color); border-radius:8px; padding:3px 9px; cursor:pointer; font-size:0.85rem; font-weight:900; color:var(--text-muted); font-family:'Inter',sans-serif; line-height:1; transition:all 0.15s;"
                        onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='none'">···</button>
                    <div class="history-popover hidden" id="popover-${idx}"
                        style="position:absolute; right:0; top:calc(100% + 6px); background:white; border:1px solid var(--border-color); border-radius:12px; padding:14px 16px; box-shadow:0 8px 24px rgba(0,0,0,0.1); z-index:100; min-width:220px; white-space:nowrap;">
                        <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted); margin-bottom:10px;">Canción modificada</div>
                        <div style="font-size:0.88rem; font-weight:700; margin-bottom:10px; white-space:normal; word-break:break-word;">${tc.title}</div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span class="rating-badge" style="background:${tcFrom}; font-size:0.8rem; padding:2px 8px;">${formatRating(tc.fromRating)}</span>
                            <span style="color:var(--text-muted); font-size:0.9rem;">→</span>
                            <span class="rating-badge" style="background:${tcTo}; font-size:0.8rem; padding:2px 8px;">${formatRating(tc.toRating)}</span>
                            <span style="font-size:0.8rem; font-weight:700; color:${tc.toRating > tc.fromRating ? '#66CC33' : '#FF3333'};">${tc.toRating > tc.fromRating ? '+' : ''}${formatRating(tc.toRating - tc.fromRating)}</span>
                        </div>
                    </div>
                </div>`;
        }

        return `
            <div style="display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--border-color);">
                <span style="color:var(--text-muted); font-size:0.8rem; min-width:100px;">${dateStr}</span>
                <span class="rating-badge" style="background:${fromColor}; font-size:0.8rem; padding:2px 8px;">${formatRating(entry.from)}</span>
                <span style="color:var(--text-muted);">→</span>
                <span class="rating-badge" style="background:${toColor}; font-size:0.8rem; padding:2px 8px;">${formatRating(entry.to)}</span>
                ${diffHtml}
                ${detailsBtn}
            </div>`;
    }).join('');

    return `
        <div class="tracklist-section" style="margin-top:32px;">
            <h2 style="margin-bottom:20px;">Historial de notas</h2>
            <div id="history-rows">${rows}</div>
        </div>`;
}

// Delegación de clicks para los popovers del historial
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.history-dots-btn');
    if (btn) {
        e.stopPropagation();
        const idx     = btn.dataset.idx;
        const popover = document.getElementById(`popover-${idx}`);
        // Cierra todos los demás
        document.querySelectorAll('.history-popover').forEach(p => {
            if (p !== popover) p.classList.add('hidden');
        });
        popover?.classList.toggle('hidden');
        return;
    }
    // Click fuera → cierra todos
    document.querySelectorAll('.history-popover').forEach(p => p.classList.add('hidden'));
});

// ── ZOOM DE PORTADA ───────────────────────────────────────────────────────
function openCoverZoom() {
    if (!currentAlbum?.coverBase64) return;

    // Crear overlay si no existe
    let overlay = document.getElementById('cover-zoom-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'cover-zoom-overlay';
        overlay.style.cssText = `
            position:fixed; inset:0; z-index:9999;
            display:flex; align-items:center; justify-content:center;
            cursor:zoom-out; opacity:0; transition:opacity 0.25s;
            background:rgba(0,0,0,0.35);
            backdrop-filter:blur(18px);
            -webkit-backdrop-filter:blur(18px);
        `;

        // Elemento vacío para mantener estructura (ya no se usa como fondo)
        const bg = document.createElement('div');
        bg.id = 'cover-zoom-bg';
        bg.style.cssText = `display:none;`;

        const img = document.createElement('img');
        img.id = 'cover-zoom-img';
        img.style.cssText = `
            position:relative; z-index:1;
            width:min(80vmin, 680px); height:min(80vmin, 680px);
            object-fit:cover;
            border-radius:16px;
            box-shadow:0 32px 80px rgba(0,0,0,0.7);
            transform:scale(0.88); transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s;
            opacity:0;
        `;

        overlay.appendChild(bg);
        overlay.appendChild(img);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', closeCoverZoom);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCoverZoom(); });
    }

    const bg  = document.getElementById('cover-zoom-bg');
    const img = document.getElementById('cover-zoom-img');
    bg.style.backgroundImage  = `url(${currentAlbum.coverBase64})`;
    img.src = currentAlbum.coverBase64;
    img.alt = currentAlbum.title;

    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        img.style.opacity     = '1';
        img.style.transform   = 'scale(1)';
    });

    document.body.style.overflow = 'hidden';
}

function closeCoverZoom() {
    const overlay = document.getElementById('cover-zoom-overlay');
    const img     = document.getElementById('cover-zoom-img');
    if (!overlay) return;
    overlay.style.opacity = '0';
    if (img) { img.style.opacity = '0'; img.style.transform = 'scale(0.88)'; }
    setTimeout(() => { overlay.style.display = 'none'; }, 250);
    document.body.style.overflow = '';
}

loadAlbumDetails();
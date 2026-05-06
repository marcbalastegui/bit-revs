// album.js - Gestión detallada del álbum, canciones, reviews y créditos

let currentAlbum = null;
let editingTrackIndex = null;
let reviewBlocks  = [];
let reviewTarget  = null;
let creditsTarget = null; // { type: 'album' } | { type: 'track', index: N }

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
function recalculateAlbumRating() {
    if (!currentAlbum?.tracks?.length) { currentAlbum.rating = 0; return; }
    let total = 0, count = 0;
    currentAlbum.tracks.forEach(t => {
        if (!t.isInterlude && !isNaN(parseFloat(t.rating))) { total += parseFloat(t.rating); count++; }
    });
    currentAlbum.rating = count === 0 ? 0 : (total / count).toFixed(1);
}

// ── FAVORITOS ─────────────────────────────────────────────────────────────
window.toggleAlbumFavorite = async function() {
    currentAlbum.favorite = !currentAlbum.favorite;
    await saveAlbumToDB(currentAlbum);
    const btn = document.getElementById('btn-album-favorite');
    if (btn) { btn.classList.toggle('active', currentAlbum.favorite); }
}

// ── BORRAR / EDITAR TRACK ─────────────────────────────────────────────────
window.deleteTrack = async function(index) {
    if (await brConfirm("¿Borrar esta canción?", "Borrar canción")) {
        currentAlbum.tracks.splice(index, 1);
        recalculateAlbumRating();
        await saveAlbumToDB(currentAlbum);
        renderAlbumContent();
    }
}

window.editTrack = function(index) {
    editingTrackIndex = index;
    const track = currentAlbum.tracks[index];
    document.getElementById('track-title').value  = track.title;
    document.getElementById('track-artist').value = track.artist || "";
    document.getElementById('track-interlude').checked = track.isInterlude;
    document.getElementById('track-rating').value = track.rating || "";
    document.getElementById('rating-container').style.display = track.isInterlude ? 'none' : 'block';
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
        await saveAlbumToDB(currentAlbum);
        renderAlbumContent();
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
    if (!track.artist || track.artist.trim() === '') return currentAlbum.artist;
    const guests = track.artist.split(',').map(a => a.trim())
        .filter(a => a !== '' && a.toLowerCase() !== currentAlbum.artist.toLowerCase());
    if (guests.length === 0) return currentAlbum.artist;
    return `${currentAlbum.artist} ft. ${guests.join(', ')}`;
}

// ── RENDER PRINCIPAL ──────────────────────────────────────────────────────
function renderAlbumContent() {
    const container  = document.getElementById('album-detail-container');
    const badgeColor = getColorByRating(currentAlbum.rating);
    const typeText   = currentAlbum.type || 'Álbum';
    const isFav      = currentAlbum.favorite || false;
    const albumHasReview   = currentAlbum.review   && currentAlbum.review.length > 0;
    const albumHasCredits  = currentAlbum.credits   && (currentAlbum.credits.produced || currentAlbum.credits.written);

    let tracksHtml = '';
    currentAlbum.tracks.forEach((track, index) => {
        const trackColor      = track.isInterlude ? '#4D4D4D' : getColorByRating(track.rating);
        const displayRating   = track.isInterlude ? 'INTERLUDE' : formatRating(track.rating);
        const badgeClass      = track.isInterlude ? 'rating-badge album-tag' : 'rating-badge';
        const trackHasReview  = track.review  && track.review.length > 0;
        const trackHasCredits = track.credits && (track.credits.produced || track.credits.written);
        const artistDisplay   = buildTrackArtistDisplay(track);

        tracksHtml += `
            <div class="track-item" data-index="${index}">
                <span class="drag-handle" title="Arrastra para reordenar">⠿</span>
                <div class="track-info">
                    <h4>${track.title}</h4>
                    <p>${artistDisplay}</p>
                </div>
                <div class="track-actions">
                    <button class="track-review-btn${trackHasReview ? ' has-review' : ''}" onclick="openReview('track', ${index})" title="${trackHasReview ? 'Ver review' : 'Escribir review'}">${reviewPenSVG(trackHasReview)}</button>
                    <button class="track-review-btn${trackHasCredits ? ' has-review' : ''}" onclick="openCredits('track', ${index})" title="${trackHasCredits ? 'Ver créditos' : 'Añadir créditos'}">${creditsSVG(trackHasCredits)}</button>
                    <button class="track-btn edit"   onclick="editTrack(${index})"   title="Editar">✎</button>
                    <button class="track-btn delete" onclick="deleteTrack(${index})" title="Borrar">✖</button>
                </div>
                <span class="${badgeClass}" style="background-color: ${trackColor}; font-size: ${track.isInterlude ? '0.7rem' : '1rem'}">${displayRating}</span>
            </div>
        `;
    });

    let displayAlbumRating = "-";
    if (currentAlbum.tracks.length > 0) displayAlbumRating = formatRating(currentAlbum.rating);

    // Créditos del álbum si existen
    let albumCreditsHtml = '';
    if (albumHasCredits) {
        albumCreditsHtml = `<div style="margin-top:8px; font-size:0.78rem; color:var(--text-muted);">`;
        if (currentAlbum.credits.produced) albumCreditsHtml += `<span>Prod. ${currentAlbum.credits.produced}</span>`;
        if (currentAlbum.credits.produced && currentAlbum.credits.written) albumCreditsHtml += ` · `;
        if (currentAlbum.credits.written) albumCreditsHtml += `<span>Escrito por ${currentAlbum.credits.written}</span>`;
        albumCreditsHtml += `</div>`;
    }

    container.innerHTML = `
        <div class="album-header-banner">
            <img src="${currentAlbum.coverBase64}" alt="${currentAlbum.title}" class="detail-cover">
            <div class="detail-info">
                <span class="detail-type">${typeText} • ${currentAlbum.year}</span>
                <h1 class="detail-title">${currentAlbum.title}</h1>
                <h2 class="detail-artist">${currentAlbum.artist}</h2>
                ${albumCreditsHtml}
                <div style="display:flex; align-items:center; gap:12px; margin-top:auto; flex-wrap:wrap;">
                    <div class="rating-big" style="background-color: ${badgeColor};">${displayAlbumRating}</div>
                    <button id="btn-album-favorite" class="album-fav-btn${isFav ? ' active' : ''}" onclick="toggleAlbumFavorite()">${heartSVG()}</button>
                    <button class="album-review-btn${albumHasReview ? ' has-review' : ''}" onclick="openReview('album')">
                        ${reviewPenSVG(albumHasReview)} ${albumHasReview ? 'Ver review' : 'Escribir review'}
                    </button>
                    <button class="album-review-btn${albumHasCredits ? ' has-review' : ''}" onclick="openCredits('album')">
                        ${creditsSVG(albumHasCredits)} ${albumHasCredits ? 'Ver créditos' : 'Créditos'}
                    </button>
                </div>
            </div>
        </div>
        <div class="tracklist-section">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2>Canciones</h2>
                <button class="btn" style="background-color:var(--text-main); color:var(--bg-primary);" id="btn-add-track">+ Añadir Canción</button>
            </div>
            <div id="tracks-list">${tracksHtml}</div>
        </div>
    `;

    document.querySelectorAll('.track-item').forEach((el, index) => addDragListeners(el, index));
    document.getElementById('btn-add-track').addEventListener('click', () => {
        editingTrackIndex = null;
        const modalTitle = document.querySelector('#modal-track h2');
        if (modalTitle) modalTitle.textContent = "Añadir Canción";
        document.getElementById('track-form').reset();
        document.getElementById('rating-container').style.display = 'block';
        document.getElementById('modal-track').classList.remove('hidden');
    });
}

// ── CREDITS MODAL ─────────────────────────────────────────────────────────
window.openCredits = function(type, index) {
    if (type === 'album') {
        creditsTarget = { type: 'album' };
        const c = currentAlbum.credits || {};
        document.getElementById('credits-modal-title').textContent = `Créditos: ${currentAlbum.title}`;
        document.getElementById('credits-produced').value = c.produced || '';
        document.getElementById('credits-written').value  = c.written  || '';
    } else {
        creditsTarget = { type: 'track', index };
        const track = currentAlbum.tracks[index];
        const c = track.credits || {};
        document.getElementById('credits-modal-title').textContent = `Créditos: ${track.title}`;
        document.getElementById('credits-produced').value = c.produced || '';
        document.getElementById('credits-written').value  = c.written  || '';
    }
    document.getElementById('modal-credits').classList.remove('hidden');
}

function initCreditsModal() {
    document.getElementById('btn-cancel-credits')?.addEventListener('click', () => {
        document.getElementById('modal-credits').classList.add('hidden');
    });

    document.getElementById('credits-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const credits = {
            produced: document.getElementById('credits-produced').value.trim(),
            written:  document.getElementById('credits-written').value.trim()
        };

        if (creditsTarget.type === 'album') {
            currentAlbum.credits = credits;
        } else {
            currentAlbum.tracks[creditsTarget.index].credits = credits;
        }

        await saveAlbumToDB(currentAlbum);
        document.getElementById('modal-credits').classList.add('hidden');
        renderAlbumContent();
    });
}

// ── REVIEW MODAL ──────────────────────────────────────────────────────────
window.openReview = function(type, index) {
    if (type === 'album') {
        reviewTarget = { type: 'album' };
        reviewBlocks = currentAlbum.review ? JSON.parse(JSON.stringify(currentAlbum.review)) : [];
        document.getElementById('review-modal-title').textContent = `Review: ${currentAlbum.title}`;
    } else {
        reviewTarget = { type: 'track', index };
        const track = currentAlbum.tracks[index];
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
        const wrapper  = document.createElement('div');
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
    const title       = document.getElementById('track-title').value;
    const artist      = document.getElementById('track-artist').value;
    const isInterlude = document.getElementById('track-interlude').checked;
    let rating = "";
    if (!isInterlude) {
        rating = document.getElementById('track-rating').value.replace(',', '.');
        if (isNaN(rating) || rating < 0 || rating > 10 || rating.trim() === "") { await brAlert("Introduce una nota válida entre 0 y 10.", "Nota inválida"); return; }
        rating = parseFloat(rating).toFixed(1);
    }
    const newTrack = { title, artist, isInterlude, rating };
    if (editingTrackIndex !== null) {
        newTrack.review   = currentAlbum.tracks[editingTrackIndex].review;
        newTrack.favorite = currentAlbum.tracks[editingTrackIndex].favorite;
        newTrack.credits  = currentAlbum.tracks[editingTrackIndex].credits;
        currentAlbum.tracks[editingTrackIndex] = newTrack;
    } else {
        currentAlbum.tracks.push(newTrack);
    }
    recalculateAlbumRating();
    await saveAlbumToDB(currentAlbum);
    document.getElementById('modal-track').classList.add('hidden');
    renderAlbumContent();
});

loadAlbumDetails();
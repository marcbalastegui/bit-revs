// media-detail.js - Página de detalle de película o serie con Escenas

const params   = new URLSearchParams(window.location.search);
const storeType = params.get('type') || 'movies'; // 'movies' | 'series'
const itemId    = parseInt(params.get('id'));

let currentItem   = null;
let currentSceneType = 'quote';
let selectedFont     = 'Playfair Display';
let editingSceneIndex = null;
let frameImageData    = null; // base64 de la imagen del fotograma

// ── INIT ──────────────────────────────────────────────────────────────────
async function loadDetail() {
    if (!itemId) return;

    currentItem = await getItemByIdFromDB(storeType, itemId);
    if (!currentItem) return;

    if (!currentItem.scenes) currentItem.scenes = [];

    // Actualizar título de la pestaña
    document.title = `BitRevs — ${currentItem.title}`;

    renderDetail();
    initSceneModal();
}

// ── RENDER PRINCIPAL ──────────────────────────────────────────────────────
function renderDetail() {
    const container = document.getElementById('media-detail-container');
    const isMovie   = storeType === 'movies';
    const badgeColor = getColorByRating(currentItem.rating);

    // Info extra
    const extraRows = [];
    if (isMovie) {
        if (currentItem.director)  extraRows.push(`<div class="media-detail-extra-row"><strong>Director</strong> · ${currentItem.director}</div>`);
        if (currentItem.genre)     extraRows.push(`<div class="media-detail-extra-row"><strong>Género</strong> · ${currentItem.genre}</div>`);
        if (currentItem.duration)  extraRows.push(`<div class="media-detail-extra-row"><strong>Duración</strong> · ${currentItem.duration} min</div>`);
        if (currentItem.country)   extraRows.push(`<div class="media-detail-extra-row"><strong>País</strong> · ${currentItem.country}</div>`);
        if (currentItem.actors)    extraRows.push(`<div class="media-detail-extra-row"><strong>Actores</strong> · ${currentItem.actors}</div>`);
        if (currentItem.watchDate) extraRows.push(`<div class="media-detail-extra-row"><strong>Vista el</strong> · ${formatDate(currentItem.watchDate)}</div>`);
    } else {
        if (currentItem.creator)   extraRows.push(`<div class="media-detail-extra-row"><strong>Creador</strong> · ${currentItem.creator}</div>`);
        if (currentItem.genre)     extraRows.push(`<div class="media-detail-extra-row"><strong>Género</strong> · ${currentItem.genre}</div>`);
        if (currentItem.duration)  extraRows.push(`<div class="media-detail-extra-row"><strong>Episodio</strong> · ${currentItem.duration} min</div>`);
        if (currentItem.seasons)   extraRows.push(`<div class="media-detail-extra-row"><strong>Temporadas</strong> · ${currentItem.seasons}</div>`);
        if (currentItem.favSeason) extraRows.push(`<div class="media-detail-extra-row"><strong>Temporada favorita</strong> · ${currentItem.favSeason}</div>`);
        if (currentItem.startDate) extraRows.push(`<div class="media-detail-extra-row"><strong>Empezada</strong> · ${formatDate(currentItem.startDate)}</div>`);
        if (currentItem.endDate)   extraRows.push(`<div class="media-detail-extra-row"><strong>Terminada</strong> · ${formatDate(currentItem.endDate)}</div>`);
    }

    // Review
    const reviewHtml = currentItem.review
        ? `<blockquote style="margin-top:16px; padding:14px 18px; border-left:3px solid var(--accent-red); background:var(--bg-secondary); border-radius:0 10px 10px 0; font-size:0.9rem; color:var(--text-muted); line-height:1.6;">${currentItem.review}</blockquote>`
        : '';

    // Frase memorable (series)
    const quoteHtml = currentItem.quote
        ? `<div style="margin-top:16px; font-style:italic; font-size:1rem; color:var(--text-muted);">"${currentItem.quote}"</div>`
        : '';

    // Escenas
    const scenesHtml = renderScenes();

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; max-width:1100px; margin:0 auto 24px;">
            <button class="album-review-btn" onclick="goBack()">← Volver</button>
            <div class="scenes-grid-selector" style="display:flex; gap:8px; align-items:center;">
                <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted);">Columnas</span>
                <button class="grid-size-btn active" data-cols="3" onclick="setGridCols(3)" title="3 columnas">▣▣▣</button>
                <button class="grid-size-btn" data-cols="2" onclick="setGridCols(2)" title="2 columnas">▣▣</button>
                <button class="grid-size-btn" data-cols="1" onclick="setGridCols(1)" title="1 columna">▣</button>
            </div>
        </div>
        <div class="media-header-banner">
            <img src="${currentItem.coverBase64}" alt="${currentItem.title}" class="media-detail-cover"
                style="height:${isMovie ? '330px' : '280px'};">
            <div class="media-detail-info">
                <div class="media-detail-type">${isMovie ? 'Película' : 'Serie'} · ${currentItem.year}</div>
                <h1 class="media-detail-title">${currentItem.title}</h1>
                <div class="media-detail-extra">${extraRows.join('')}</div>
                ${reviewHtml}
                ${quoteHtml}
                <div class="media-detail-actions">
                    <span class="rating-big" style="background:${badgeColor};">${formatRating(currentItem.rating)}</span>
                </div>
            </div>
        </div>

        <!-- ESCENAS -->
        <div class="scenes-section">
            <div class="scenes-header">
                <h2>Escenas</h2>
                <button class="save-btn" id="btn-add-scene">+ Añadir escena</button>
            </div>
            <div class="scenes-grid" id="scenes-grid">
                ${scenesHtml}
            </div>
        </div>
    `;

    document.getElementById('btn-add-scene').addEventListener('click', () => openSceneModal());
}

function renderScenes() {
    if (!currentItem.scenes || currentItem.scenes.length === 0) {
        return `<div style="color:var(--text-muted); font-size:0.9rem; font-style:italic; grid-column:1/-1;">
            Aún no hay escenas. Pulsa "+ Añadir escena" para empezar.
        </div>`;
    }

    return currentItem.scenes.map((scene, index) => {
        if (scene.type === 'quote') {
            return `
                <div class="scene-card">
                    <div class="scene-card-actions">
                        <button class="action-btn btn-edit" onclick="event.stopPropagation(); editScene(${index})" title="Editar">✎</button>
                        <button class="action-btn btn-delete" onclick="event.stopPropagation(); deleteScene(${index})" title="Borrar">✖</button>
                    </div>
                    <div class="scene-quote" style="background:white;">
                        <div class="scene-quote-text" style="font-family:'${scene.font || 'Playfair Display'}', serif;">${scene.text}</div>
                        ${scene.sub ? `<div class="scene-quote-sub">${scene.sub}</div>` : ''}
                    </div>
                </div>`;
        } else {
            return `
                <div class="scene-card">
                    <div class="scene-card-actions" style="opacity:1;">
                        <button class="action-btn btn-edit" onclick="event.stopPropagation(); editScene(${index})" title="Editar">✎</button>
                        <button class="action-btn btn-delete" onclick="event.stopPropagation(); deleteScene(${index})" title="Borrar">✖</button>
                    </div>
                    <div class="scene-frame">
                        <img src="${scene.image}" alt="Escena">
                        ${scene.subtitle ? `<div class="scene-frame-subtitle">${scene.subtitle}</div>` : ''}
                    </div>
                </div>`;
        }
    }).join('');
}

// ── SCENE MODAL ───────────────────────────────────────────────────────────
function initSceneModal() {
    document.getElementById('btn-cancel-scene').addEventListener('click', () => {
        document.getElementById('modal-scene').classList.add('hidden');
    });

    document.getElementById('btn-save-scene').addEventListener('click', saveScene);

    // Font selector
    document.querySelectorAll('.scene-font-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.scene-font-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedFont = btn.dataset.font;
            updateQuotePreview();
        });
    });

    // Live preview para cita
    document.getElementById('scene-quote-text').addEventListener('input', updateQuotePreview);
    document.getElementById('scene-quote-sub').addEventListener('input', updateQuotePreview);

    // Live preview para fotograma
    document.getElementById('scene-frame-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            frameImageData = ev.target.result;
            updateFramePreview();
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('scene-frame-subtitle').addEventListener('input', updateFramePreview);
}

window.setSceneType = function(type) {
    currentSceneType = type;
    document.getElementById('btn-type-quote').classList.toggle('active', type === 'quote');
    document.getElementById('btn-type-frame').classList.toggle('active', type === 'frame');
    document.getElementById('scene-quote-section').style.display = type === 'quote' ? 'block' : 'none';
    document.getElementById('scene-frame-section').style.display = type === 'frame' ? 'block' : 'none';
};

function updateQuotePreview() {
    const text = document.getElementById('scene-quote-text').value || 'La cita aparecerá aquí…';
    const sub  = document.getElementById('scene-quote-sub').value;
    const previewText = document.getElementById('quote-preview-text');
    const previewSub  = document.getElementById('quote-preview-sub');
    previewText.textContent  = text;
    previewText.style.fontFamily = `'${selectedFont}', serif`;
    previewSub.textContent   = sub;
}

function updateFramePreview() {
    const preview   = document.getElementById('frame-preview');
    const subtitle  = document.getElementById('scene-frame-subtitle').value;
    if (frameImageData) {
        preview.innerHTML = `
            <img src="${frameImageData}" alt="preview">
            ${subtitle ? `<div class="frame-preview-subtitle">${subtitle}</div>` : ''}
        `;
    }
}

function openSceneModal(index = null) {
    editingSceneIndex = index;
    frameImageData    = null;

    // Reset
    document.getElementById('scene-quote-text').value    = '';
    document.getElementById('scene-quote-sub').value     = '';
    document.getElementById('scene-frame-subtitle').value = '';
    document.getElementById('scene-frame-file').value    = '';
    document.getElementById('frame-preview').innerHTML   = `<div class="frame-upload-placeholder">Selecciona una imagen para previsualizarla</div>`;
    document.querySelectorAll('.scene-font-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.scene-font-btn[data-font="Playfair Display"]').classList.add('active');
    selectedFont = 'Playfair Display';
    setSceneType('quote');
    updateQuotePreview();

    if (index !== null) {
        // Editar escena existente
        const scene = currentItem.scenes[index];
        document.getElementById('scene-modal-title').textContent = 'Editar Escena';
        if (scene.type === 'quote') {
            setSceneType('quote');
            document.getElementById('scene-quote-text').value = scene.text || '';
            document.getElementById('scene-quote-sub').value  = scene.sub  || '';
            selectedFont = scene.font || 'Playfair Display';
            document.querySelectorAll('.scene-font-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.font === selectedFont);
            });
            updateQuotePreview();
        } else {
            setSceneType('frame');
            frameImageData = scene.image || null;
            document.getElementById('scene-frame-subtitle').value = scene.subtitle || '';
            updateFramePreview();
        }
    } else {
        document.getElementById('scene-modal-title').textContent = 'Nueva Escena';
    }

    document.getElementById('modal-scene').classList.remove('hidden');
}

async function saveScene() {
    let scene = null;

    if (currentSceneType === 'quote') {
        const text = document.getElementById('scene-quote-text').value.trim();
        if (!text) { await brAlert('Escribe el texto de la cita.', 'Campo requerido'); return; }
        scene = { type: 'quote', text, sub: document.getElementById('scene-quote-sub').value.trim(), font: selectedFont };
    } else {
        if (!frameImageData) { await brAlert('Selecciona una imagen.', 'Campo requerido'); return; }
        scene = { type: 'frame', image: frameImageData, subtitle: document.getElementById('scene-frame-subtitle').value.trim() };
    }

    if (editingSceneIndex !== null) {
        currentItem.scenes[editingSceneIndex] = scene;
    } else {
        currentItem.scenes.push(scene);
    }

    await saveItemToDB(storeType, currentItem);
    document.getElementById('modal-scene').classList.add('hidden');
    renderDetail();
}

window.editScene = function(index) { openSceneModal(index); };

window.deleteScene = async function(index) {
    if (await brConfirm('Esta acción no se puede deshacer.', '¿Borrar escena?')) {
        currentItem.scenes.splice(index, 1);
        await saveItemToDB(storeType, currentItem);
        renderDetail();
    }
};

// ── UTILS ─────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${parseInt(parts[2])} ${months[parseInt(parts[1])-1]} ${parts[0]}`;
}

function goBack() { history.back(); }

loadDetail();


// ── GRID SIZE ─────────────────────────────────────────────────────────────
let currentCols = 3;

window.setGridCols = function(cols) {
    currentCols = cols;
    const grid = document.getElementById('scenes-grid');
    if (!grid) return;

    const colMap = { 1: '1fr', 2: '1fr 1fr', 3: 'repeat(auto-fill, minmax(300px, 1fr))' };
    grid.style.gridTemplateColumns = colMap[cols] || colMap[3];

    document.querySelectorAll('.grid-size-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.cols) === cols);
    });
};
// media.js - Script universal para Películas y Series con Buscador y Filtros

const storeType = document.body.dataset.store;
const mediaGrid = document.getElementById('media-grid');
const modalAdd = document.getElementById('modal-add');
const mediaForm = document.getElementById('media-form');
const filterInput = document.getElementById('filter-input');
const sortSelect = document.getElementById('sort-select');
let editingId = null;

// Borrar
window.deleteMedia = async function(event, id) {
    event.stopPropagation();
    if(confirm("¿Borrar definitivamente?")) {
        await deleteItemFromDB(storeType, id);
        processAndRenderMedia();
    }
}

// Editar
window.editMedia = async function(event, id) {
    event.stopPropagation();
    const item = await getItemByIdFromDB(storeType, id);
    editingId = item.id;
    document.getElementById('title').value = item.title;
    document.getElementById('year').value = item.year;
    document.getElementById('rating').value = item.rating;
    document.getElementById('cover').removeAttribute('required');
    document.querySelector('.modal-content h2').textContent = `Editar Reseña`;
    modalAdd.classList.remove('hidden');
}

// Mostrar Modal Nuevo (CON COMPROBACIÓN PARA EVITAR EL ERROR DE TU CAPTURA)
const addMediaBtn = document.getElementById('btn-add-media');
if (addMediaBtn) {
    addMediaBtn.addEventListener('click', () => {
        editingId = null;
        mediaForm.reset();
        document.getElementById('cover').setAttribute('required', 'true');
        const mTitle = document.querySelector('.modal-content h2');
        if (mTitle) mTitle.textContent = `Nueva Reseña`;
        modalAdd.classList.remove('hidden');
    });
}

// Lo mismo para el botón de cancelar
document.getElementById('btn-cancel')?.addEventListener('click', () => modalAdd.classList.add('hidden'));

// Guardar
mediaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('title').value;
    const year = document.getElementById('year').value;
    let rating = document.getElementById('rating').value.replace(',', '.');

    let itemToSave = editingId ? await getItemByIdFromDB(storeType, editingId) : { id: Date.now() };
    itemToSave.title = title; itemToSave.year = year; itemToSave.rating = parseFloat(rating).toFixed(1);

    const file = document.getElementById('cover').files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async (ev) => {
            itemToSave.coverBase64 = ev.target.result;
            await saveItemToDB(storeType, itemToSave);
            modalAdd.classList.add('hidden');
            processAndRenderMedia();
        };
        reader.readAsDataURL(file);
    } else {
        await saveItemToDB(storeType, itemToSave);
        modalAdd.classList.add('hidden');
        processAndRenderMedia();
    }
});

// Función de Filtrado y Renderizado
async function processAndRenderMedia() {
    let items = await getAllItemsFromDB(storeType);

    // 1. Filtrar
    if (filterInput && filterInput.value) {
        const query = filterInput.value.toLowerCase().trim();
        items = items.filter(item =>
            item.title.toLowerCase().includes(query) ||
            item.year.toString().includes(query)
        );
    }

    // 2. Ordenar
    if (sortSelect && sortSelect.value !== 'default') {
        const val = sortSelect.value;
        items.sort((a, b) => {
            if (val === 'rating-desc') return b.rating - a.rating;
            if (val === 'rating-asc') return a.rating - b.rating;
            if (val === 'year-desc') return b.year - a.year;
            if (val === 'year-asc') return a.year - b.year;
            if (val === 'title-asc') return a.title.localeCompare(b.title);
            return 0;
        });
    }

    renderMediaGrid(items);
}

function renderMediaGrid(items) {
    mediaGrid.innerHTML = items.length ? '' : '<p style="color:var(--text-muted)">No hay reseñas todavía.</p>';

    items.forEach(item => {
        const card = document.createElement('div');
        card.classList.add('album-card');
        const badgeColor = getColorByRating(item.rating);

        card.innerHTML = `
            <div class="card-actions">
                <button class="action-btn btn-edit" onclick="editMedia(event, ${item.id})">✎</button>
                <button class="action-btn btn-delete" onclick="deleteMedia(event, ${item.id})">✖</button>
            </div>
            <div class="cover-container vertical"><img src="${item.coverBase64}"></div>
            <div class="album-info">
                <div class="title-row">
                    <h3>${item.title}</h3>
                    <span class="rating-badge" style="background-color: ${badgeColor};">${formatRating(item.rating)}</span>
                </div>
                <p>${item.year}</p>
            </div>
        `;
        mediaGrid.appendChild(card);
    });
}

// Eventos de filtros
filterInput?.addEventListener('input', processAndRenderMedia);
sortSelect?.addEventListener('change', processAndRenderMedia);

processAndRenderMedia();
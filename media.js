// media.js - Script universal para Películas y Series

const storeType = document.body.dataset.store;
const mediaGrid = document.getElementById('media-grid');
const modalAdd = document.getElementById('modal-add');
const mediaForm = document.getElementById('media-form');
let editingId = null;

// Borrar
window.deleteMedia = async function(event, id) {
    event.stopPropagation();
    if(confirm("¿Borrar definitivamente?")) {
        await deleteItemFromDB(storeType, id);
        renderMediaGrid();
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

    // CORRECCIÓN AQUÍ: Buscamos dentro de .modal-content
    document.querySelector('.modal-content h2').textContent = `Editar Reseña`;

    modalAdd.classList.remove('hidden');
}

// Mostrar Modal Nuevo
document.getElementById('btn-add-media').addEventListener('click', () => {
    editingId = null;
    mediaForm.reset();
    document.getElementById('cover').setAttribute('required', 'true');

    // CORRECCIÓN AQUÍ: Buscamos dentro de .modal-content
    document.querySelector('.modal-content h2').textContent = `Nueva Reseña`;

    modalAdd.classList.remove('hidden');
});

document.getElementById('btn-cancel').addEventListener('click', () => modalAdd.classList.add('hidden'));

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
            renderMediaGrid();
        };
        reader.readAsDataURL(file);
    } else {
        await saveItemToDB(storeType, itemToSave);
        modalAdd.classList.add('hidden');
        renderMediaGrid();
    }
});

async function renderMediaGrid() {
    const items = await getAllItemsFromDB(storeType);
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
                    <span class="rating-badge" style="background-color: ${badgeColor};">${item.rating}</span>
                </div>
                <p>${item.year}</p>
            </div>
        `;
        mediaGrid.appendChild(card);
    });
}

renderMediaGrid();
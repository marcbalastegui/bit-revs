// db.js - Gestión de Base de Datos y Utilidades

const DB_NAME = 'BitRevsAlbumDB';
const DB_VERSION = 1;
const STORE_NAME = 'albums';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

function getAllAlbumsFromDB() {
    return new Promise(async (resolve, reject) => {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function saveAlbumToDB(newAlbum) {
    return new Promise(async (resolve, reject) => {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(newAlbum);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

// NUEVA FUNCIÓN: Buscar un álbum por su ID
function getAlbumByIdFromDB(id) {
    return new Promise(async (resolve, reject) => {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(Number(id)); // Convertimos a número por seguridad
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Los colores ahora viven aquí para que todas las páginas los usen
function getColorByRating(rating) {
    const r = parseFloat(rating);
    if (isNaN(r)) return '#4D4D4D';
    if (r === 10) return '#FF66CC';
    if (r >= 9) return '#B533FF';
    if (r >= 8) return '#3366FF';
    if (r >= 7) return '#66CC33';
    if (r >= 6) return '#FFD11A';
    if (r >= 5) return '#FF8533';
    if (r >= 4) return '#FF3333';
    if (r >= 2) return '#996600';
    return '#4D4D4D';
}
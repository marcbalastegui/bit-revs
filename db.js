// db.js - Gestión de Base de Datos para Álbumes, Películas, Series y Perfil

const DB_NAME = 'BitRevsDB';
const DB_VERSION = 3; // VERSIÓN 3: Añadidas películas y series
const STORE_ALBUMS = 'albums';
const STORE_MOVIES = 'movies';
const STORE_SERIES = 'series';
const STORE_PROFILE = 'userProfile';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_ALBUMS)) db.createObjectStore(STORE_ALBUMS, { keyPath: 'id' });
            if (!db.objectStoreNames.contains(STORE_MOVIES)) db.createObjectStore(STORE_MOVIES, { keyPath: 'id' });
            if (!db.objectStoreNames.contains(STORE_SERIES)) db.createObjectStore(STORE_SERIES, { keyPath: 'id' });
            if (!db.objectStoreNames.contains(STORE_PROFILE)) db.createObjectStore(STORE_PROFILE, { keyPath: 'key' });
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

// --- FUNCIONES GENÉRICAS PARA CUALQUIER CATEGORÍA (Álbumes, Pelis, Series) ---
async function saveItemToDB(storeName, item) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(item);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function getAllItemsFromDB(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function getItemByIdFromDB(storeName, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(Number(id));
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function deleteItemFromDB(storeName, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(Number(id));
        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e.target.error);
    });
}

// --- FUNCIONES ANTIGUAS (Mantenidas por compatibilidad) ---
const saveAlbumToDB = (album) => saveItemToDB(STORE_ALBUMS, album);
const getAllAlbumsFromDB = () => getAllItemsFromDB(STORE_ALBUMS);
const getAlbumByIdFromDB = (id) => getItemByIdFromDB(STORE_ALBUMS, id);
const deleteAlbumFromDB = (id) => deleteItemFromDB(STORE_ALBUMS, id);

// --- PERFIL DE USUARIO ---
async function getUserProfileFromDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_PROFILE, 'readonly');
        const request = transaction.objectStore(STORE_PROFILE).get('config');
        request.onsuccess = () => resolve(request.result || { key: 'config', userName: 'Usuario BitRevs', avatarData: null, bannerData: null });
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveUserProfileToDB(profileData) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_PROFILE, 'readwrite');
        const request = transaction.objectStore(STORE_PROFILE).put(profileData);
        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e.target.error);
    });
}

// --- COLORES ---
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
// db.js - Gestión centralizada de IndexedDB y utilidades para BitRevs

const DB_NAME = 'BitRevsDB';
// AQUÍ ESTÁ LA MAGIA: Subimos a la versión 2 para forzar al navegador a actualizar
const DB_VERSION = 2;
const STORE_ALBUMS = 'albums';
const STORE_PROFILE = 'userProfile';

// 1. Iniciar/Actualizar la Base de Datos
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        // Esto se ejecutará ahora obligatoriamente al cambiar a versión 2
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_ALBUMS)) {
                db.createObjectStore(STORE_ALBUMS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_PROFILE)) {
                db.createObjectStore(STORE_PROFILE, { keyPath: 'key' });
            }
        };

        request.onsuccess = (event) => resolve(event.target.result);

        request.onerror = (event) => {
            console.error("Error crítico al abrir IndexedDB:", event.target.error);
            reject(event.target.error);
        };
    });
}

// 2. Funciones para ÁLBUMES
async function saveAlbumToDB(newAlbum) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_ALBUMS, 'readwrite');
        const store = transaction.objectStore(STORE_ALBUMS);
        const request = store.put(newAlbum);

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function getAllAlbumsFromDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_ALBUMS, 'readonly');
        const store = transaction.objectStore(STORE_ALBUMS);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function getAlbumByIdFromDB(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_ALBUMS, 'readonly');
        const store = transaction.objectStore(STORE_ALBUMS);
        const request = store.get(Number(id));

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

async function deleteAlbumFromDB(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_ALBUMS, 'readwrite');
        const store = transaction.objectStore(STORE_ALBUMS);
        const request = store.delete(Number(id));

        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e.target.error);
    });
}

// 3. Funciones para PERFIL DE USUARIO
async function getUserProfileFromDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_PROFILE, 'readonly');
        const store = transaction.objectStore(STORE_PROFILE);
        const request = store.get('config');

        request.onsuccess = () => {
            const data = request.result;
            if (data) resolve(data);
            else {
                resolve({
                    key: 'config',
                    userName: 'Usuario BitRevs',
                    avatarData: null,
                    bannerData: null
                });
            }
        };
        request.onerror = (e) => reject(e.target.error);
    });
}

async function saveUserProfileToDB(profileData) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_PROFILE, 'readwrite');
        const store = transaction.objectStore(STORE_PROFILE);
        const request = store.put(profileData);

        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e.target.error);
    });
}

// 4. Utilidades Globales (Colores de Notas)
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
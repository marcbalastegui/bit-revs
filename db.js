// db.js - Gestión centralizada de IndexedDB y utilidades para BitRevs

const DB_NAME = 'BitRevsDB';
const DB_VERSION = 1;
const STORE_ALBUMS = 'albums';
const STORE_PROFILE = 'userProfile';

// 1. Iniciar/Actualizar la Base de Datos
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

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
            console.error("Error al abrir IndexedDB:", event.target.error);
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

// NECESARIO PARA ALBUM.HTML
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

// NECESARIO PARA BORRAR EN INDEX.HTML
async function deleteAlbumFromDB(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_ALBUMS, 'readwrite');
        const store = transaction.objectStore(STORE_ALBUMS);
        const request = store.delete(Number(
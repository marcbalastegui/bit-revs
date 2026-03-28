// db.js - Gestión centralizada de IndexedDB para BitRevs

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
            // Almacén para álbumes (clave única: id)
            if (!db.objectStoreNames.contains(STORE_ALBUMS)) {
                db.createObjectStore(STORE_ALBUMS, { keyPath: 'id' });
            }
            // Almacén para datos del perfil (una sola entrada con clave 'config')
            if (!db.objectStoreNames.contains(STORE_PROFILE)) {
                db.createObjectStore(STORE_PROFILE, { keyPath: 'key' });
            }
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => {
            console.error("Error al abrir IndexedDB:", event.target.error);
            alert("No se pudo iniciar la base de datos local.");
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
        const request = store.put(newAlbum); // 'put' actualiza si existe el ID

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

// 3. Funciones para PERFIL DE USUARIO

// Recuperar datos (o devolver por defecto si no hay nada guardado)
async function getUserProfileFromDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_PROFILE, 'readonly');
        const store = transaction.objectStore(STORE_PROFILE);
        const request = store.get('config');

        request.onsuccess = () => {
            const data = request.result;
            if (data) {
                resolve(data);
            } else {
                // Datos por defecto iniciales
                resolve({
                    key: 'config',
                    userName: 'Usuario BitRevs',
                    avatarData: null, // Guardaremos DataURL de la imagen
                    bannerData: null  // Guardaremos DataURL de la imagen
                });
            }
        };
        request.onerror = (e) => reject(e.target.error);
    });
}

// Guardar datos actualizados
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
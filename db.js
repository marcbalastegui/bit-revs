// db.js - Base de datos con Firebase Firestore

// ── AUTH HELPER ───────────────────────────────────────────────────────────
function waitForAuth() {
    return new Promise((resolve, reject) => {
        if (brAuth.currentUser) { resolve(brAuth.currentUser); return; }
        const unsub = brAuth.onAuthStateChanged(user => {
            unsub();
            if (user) resolve(user);
            else reject(new Error('No autenticado'));
        }, reject);
    });
}

function userCol(storeName) {
    const uid = brAuth.currentUser?.uid;
    if (!uid) throw new Error('No autenticado');
    return brDB.collection('users').doc(uid).collection(storeName);
}

async function getNextId(storeName) {
    const uid = brAuth.currentUser?.uid;
    if (!uid) throw new Error('No autenticado');
    const counterRef = brDB.collection('users').doc(uid).collection('_meta').doc('counters');
    return brDB.runTransaction(async tx => {
        const snap = await tx.get(counterRef);
        const prev = snap.exists ? (snap.data()[storeName] || 0) : 0;
        const next = prev + 1;
        tx.set(counterRef, { [storeName]: next }, { merge: true });
        return next;
    });
}

function artistDocId(name) {
    return (name || 'unknown').replace(/\//g, '|').substring(0, 200);
}

// ── FUNCIONES GENÉRICAS ───────────────────────────────────────────────────
async function saveItemToDB(storeName, item) {
    await waitForAuth();
    let docId;
    if (storeName === 'userProfile') {
        docId = item.key || 'config';
    } else if (storeName === 'artists') {
        docId = artistDocId(item.name);
    } else {
        if (!item.id) {
            item.id = await getNextId(storeName);
        }
        docId = String(item.id);
    }
    await userCol(storeName).doc(docId).set(item);
    return item.id;
}

async function getAllItemsFromDB(storeName) {
    try {
        await waitForAuth();
        const snap = await userCol(storeName).get();
        return snap.docs.map(d => d.data());
    } catch { return []; }
}

async function getItemByIdFromDB(storeName, id) {
    try {
        await waitForAuth();
        let docId;
        if (storeName === 'artists')     docId = artistDocId(String(id));
        else if (storeName === 'userProfile') docId = String(id) || 'config';
        else                             docId = String(id);
        const doc = await userCol(storeName).doc(docId).get();
        return doc.exists ? doc.data() : null;
    } catch { return null; }
}

async function deleteItemFromDB(storeName, id) {
    try {
        await waitForAuth();
        await userCol(storeName).doc(String(id)).delete();
        return true;
    } catch { return false; }
}

// ── ÁLBUMES ───────────────────────────────────────────────────────────────
const STORE_ALBUMS = 'albums';
const saveAlbumToDB      = album => saveItemToDB(STORE_ALBUMS, album);
const getAllAlbumsFromDB  = ()    => getAllItemsFromDB(STORE_ALBUMS);
const getAlbumByIdFromDB = id    => getItemByIdFromDB(STORE_ALBUMS, id);
const deleteAlbumFromDB  = id    => deleteItemFromDB(STORE_ALBUMS, id);

// ── PERFIL ────────────────────────────────────────────────────────────────
async function getUserProfileFromDB() {
    try {
        await waitForAuth();
        const doc = await userCol('userProfile').doc('config').get();
        if (doc.exists) return doc.data();
        const user = brAuth.currentUser;
        return { key: 'config', userName: user?.email?.split('@')[0] || 'Usuario', avatarData: null, bannerData: null };
    } catch {
        return { key: 'config', userName: 'Usuario BitRevs', avatarData: null, bannerData: null };
    }
}

async function saveUserProfileToDB(profileData) {
    await waitForAuth();
    await userCol('userProfile').doc('config').set(profileData);
    return true;
}

// ── ARTISTAS ──────────────────────────────────────────────────────────────
async function getArtistFromDB(name) {
    try {
        await waitForAuth();
        const doc = await userCol('artists').doc(artistDocId(name)).get();
        return doc.exists ? doc.data() : null;
    } catch { return null; }
}

async function saveArtistToDB(artistData) {
    await waitForAuth();
    await userCol('artists').doc(artistDocId(artistData.name)).set(artistData);
    return true;
}

// ── TOP BOOST ─────────────────────────────────────────────────────────────
async function computeTopBoost() {
    try {
        const allLists = await getAllItemsFromDB('lists');
        const topLists = allLists.filter(l => l.isTop);
        const albumBoost = {}, trackBoost = {};
        topLists.forEach(list => {
            (list.items || []).forEach(item => {
                if (item.type === 'track') {
                    const key = `${item.albumId}__${(item.trackTitle || '').toLowerCase().trim()}`;
                    trackBoost[key] = (trackBoost[key] || 0) + 1;
                } else {
                    const id = item.id ?? item.albumId;
                    if (id != null) albumBoost[id] = (albumBoost[id] || 0) + 1;
                }
            });
        });
        return { albumBoost, trackBoost };
    } catch { return { albumBoost: {}, trackBoost: {} }; }
}

function getTrackBoostScore(albumId, trackTitle, albumBoost, trackBoost) {
    const key = `${albumId}__${(trackTitle || '').toLowerCase().trim()}`;
    return (albumBoost[albumId] || 0) + (trackBoost[key] || 0);
}

// ── UTILIDADES ────────────────────────────────────────────────────────────
function formatRating(rating) {
    const r = parseFloat(rating);
    if (isNaN(r)) return "";
    return Number.isInteger(r) ? r.toString() : r.toFixed(1);
}

function getColorByRating(rating) {
    const r = parseFloat(rating);
    if (isNaN(r) || r === 0) return '#4D4D4D';
    if (r === 10) return '#FF66CC';
    if (r >= 9)   return '#B533FF';
    if (r >= 8)   return '#3366FF';
    if (r >= 7)   return '#66CC33';
    if (r >= 6)   return '#FFD11A';
    if (r >= 5)   return '#FF8533';
    if (r >= 4)   return '#FF3333';
    if (r >= 2)   return '#996600';
    return '#4D4D4D';
}

// ── AVATAR EN CABECERA ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const headerAvatar = document.getElementById('global-header-avatar');
    if (!headerAvatar) return;
    try {
        await waitForAuth();
        const profile = await getUserProfileFromDB();
        if (profile.avatarData) {
            headerAvatar.style.backgroundImage = `url(${profile.avatarData})`;
            headerAvatar.textContent = '';
        } else {
            headerAvatar.textContent = (profile.userName || 'U').charAt(0).toUpperCase();
        }
    } catch (e) { console.error("Error cargando avatar global", e); }
});

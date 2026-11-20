// db.js - Base de datos con Firebase Firestore

// Lee un ajuste de js/core/settings.js; si no está cargado, devuelve el valor por defecto.
function setting(path, fallback) {
    if (window.brSettings) {
        const v = window.brSettings.get(path);
        if (v !== undefined) return v;
    }
    return fallback;
}

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

// ── UTILIDAD: elimina undefined recursivamente (Firestore los rechaza) ────
function stripUndefined(obj) {
    if (Array.isArray(obj)) return obj.map(stripUndefined);
    if (obj !== null && typeof obj === 'object') {
        const clean = {};
        for (const [k, v] of Object.entries(obj)) {
            if (v !== undefined) clean[k] = stripUndefined(v);
        }
        return clean;
    }
    return obj;
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
    await userCol(storeName).doc(docId).set(stripUndefined(item));
    return item.id;
}

async function getAllItemsFromDB(storeName) {
    try {
        await waitForAuth();
        const snap = await userCol(storeName).get();
        return snap.docs.map(d => d.data());
    } catch (err) {
        console.error(`getAllItemsFromDB(${storeName}) falló:`, err);
        return [];
    }
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
    await userCol('userProfile').doc('config').set(stripUndefined(profileData));
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

// ── DEDUPLICACIÓN DE CANCIONES ────────────────────────────────────────────
// Elimina canciones duplicadas entre álbumes (ej: álbum normal + deluxe).
// Clave: título + artista principal. Se queda con la primera aparición.
// Los objetos de track deben tener _mainArtist o albumArtist con el artista del álbum.
// Elimina canciones repetidas (misma canción en varios álbumes: deluxe, recopilatorios...).
// Se queda con la primera aparición, pero si cualquier copia tiene estrella, la conserva.
function deduplicateTracks(tracks) {
    const byKey  = new Map();
    const result = [];
    tracks.forEach(t => {
        const artist = (t._mainArtist || t.albumArtist || '').toLowerCase().trim();
        const key    = `${(t.title || '').toLowerCase().trim()}__${artist}`;
        const first  = byKey.get(key);
        if (first) {
            if (t.favorite && !first.favorite) first.favorite = true;
            return;
        }
        byKey.set(key, t);
        result.push(t);
    });
    return result;
}

// Orden común de canciones en todos los rankings (Top 100, Wrapped, artista, género):
//   1. nota
//   2. estrella (solo en "mejores"; se puede desactivar en Ajustes)
//   3. veces que aparece en listas marcadas como Top (boost = await computeTopBoost(); desactivable)
//   4. desempate de Ajustes: nota del álbum, A-Z o fecha en que se añadió el álbum
// opts.tiebreaker / opts.dir permiten que el Top 100 use su propio selector.
function compareTrackRanking(a, b, boost, mode = 'best', opts = {}) {
    const best = mode !== 'worst';
    const ra = parseFloat(a.rating) || 0;
    const rb = parseFloat(b.rating) || 0;
    if (ra !== rb) return best ? rb - ra : ra - rb;

    if (best && setting('ranking.starFirst', true)) {
        const favDiff = (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
        if (favDiff !== 0) return favDiff;
    }

    if (boost && setting('ranking.useTopLists', true)) {
        const ba = getTrackBoostScore(a.albumId, a.title, boost.albumBoost, boost.trackBoost);
        const bb = getTrackBoostScore(b.albumId, b.title, boost.albumBoost, boost.trackBoost);
        // Estar en listas Top es positivo: sube en "mejores" y baja en "peores"
        if (ba !== bb) return best ? bb - ba : ba - bb;
    }

    const tiebreaker = opts.tiebreaker || setting('ranking.trackTiebreaker', 'album-rating');
    const dir        = opts.dir        || setting('ranking.trackTiebreakerDir', 'asc');
    if (tiebreaker === 'album-rating') {
        const aa = parseFloat(a.albumRating) || 0, ab = parseFloat(b.albumRating) || 0;
        return best ? ab - aa : aa - ab;
    }
    if (tiebreaker === 'alphabetical') {
        const cmp = (a.title || '').localeCompare(b.title || '');
        return dir === 'asc' ? cmp : -cmp;
    }
    if (tiebreaker === 'added') {
        const cmp = (Number(a.albumId) || 0) - (Number(b.albumId) || 0);
        return dir === 'asc' ? cmp : -cmp;
    }
    return 0;
}

// Desempate de películas y series con la misma nota (Ajustes → Puntuaciones y orden)
function compareMediaTiebreak(a, b, tiebreaker = setting('ranking.mediaTiebreaker', 'alphabetical')) {
    if (tiebreaker === 'year-desc') return (parseInt(b.year) || 0) - (parseInt(a.year) || 0);
    if (tiebreaker === 'year-asc')  return (parseInt(a.year) || 0) - (parseInt(b.year) || 0);
    if (tiebreaker === 'added')     return (a.id || 0) - (b.id || 0);
    if (tiebreaker === 'manual') {
        const ra = a.manualRank != null ? a.manualRank : Infinity;
        const rb = b.manualRank != null ? b.manualRank : Infinity;
        if (ra !== rb) return ra - rb;
    }
    return (a.title || '').localeCompare(b.title || '');
}

// ¿Cuenta este lanzamiento en Top 100 y Wrapped? (Ajustes: incluir singles / EPs)
function releaseCountsInRankings(album) {
    if (album.type === 'Single') return setting('ranking.includeSingles', true);
    if (album.type === 'EP')     return setting('ranking.includeEPs', true);
    return true;
}

// ── NOTA DEL ÁLBUM ────────────────────────────────────────────────────────
// Base = canciones (media, mediana o media sin la peor, según Ajustes).
// Factores personalizados (Ajustes → Factores): cada uno pesa un % sobre la nota final.
//   final = base · (100 − Σ%) / 100 + Σ (valor · %) / 100
// Solo cuentan los factores que tienen valor en ese álbum. Un factor "solo algunos álbumes"
// se activa desde la página del álbum.
function albumRatingDetails(album) {
    const ratings = (album.tracks || [])
        .filter(t => !t.isInterlude && !isNaN(parseFloat(t.rating)))
        .map(t => parseFloat(t.rating));
    const method = setting('albumRating.method', 'mean');

    let base = 0;
    if (ratings.length > 0) {
        const sorted = [...ratings].sort((a, b) => a - b);
        if (method === 'median') {
            const mid = Math.floor(sorted.length / 2);
            base = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        } else if (method === 'trimmed' && sorted.length >= 3) {
            const rest = sorted.slice(1);
            base = rest.reduce((s, r) => s + r, 0) / rest.length;
        } else {
            base = ratings.reduce((s, r) => s + r, 0) / ratings.length;
        }
    }

    const values  = album.factors || {};
    const applied = [];
    (setting('albumRating.factors', []) || []).forEach(f => {
        const v = values[f.id];
        const hasValue = v !== undefined && v !== null && v !== '' && !isNaN(parseFloat(v));
        const weight = Math.max(0, Math.min(100, parseFloat(f.weight) || 0));
        if (hasValue && weight > 0) applied.push({ id: f.id, name: f.name, weight, value: parseFloat(v) });
    });

    let final = base;
    if (ratings.length > 0 && applied.length > 0) {
        const totalWeight = Math.min(100, applied.reduce((s, f) => s + f.weight, 0));
        const scale = totalWeight > 0 ? Math.min(1, 100 / applied.reduce((s, f) => s + f.weight, 0)) : 1;
        final = base * (100 - totalWeight) / 100
              + applied.reduce((s, f) => s + f.value * f.weight * scale, 0) / 100;
    }
    return {
        base:     parseFloat(base.toFixed(2)),
        count:    ratings.length,
        factors:  applied,
        final:    ratings.length > 0 ? parseFloat(final.toFixed(1)) : 0,
    };
}

function computeAlbumRating(album) {
    return albumRatingDetails(album).final;
}

// Estrella dorada para canciones favoritas (10/10 marcadas con estrella en el álbum)
function favStarHtml(isFavorite) {
    if (!isFavorite) return '';
    return `<span class="fav-star" title="Canción favorita"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>`;
}

// ── IMÁGENES ──────────────────────────────────────────────────────────────
// Las imágenes se guardan en base64 dentro del propio documento de Firestore, que
// tiene un límite de 1 MB. Se reducen al subirlas para que siempre quepan y para
// que las páginas que cargan todas las portadas (Inicio, Top, Wrapped...) vayan rápido.
const IMAGE_SIZES = { cover: 600, photo: 500, avatar: 400, frame: 1280, banner: 1600 };

// source: File, Blob o data URL. Devuelve un data URL JPEG con el lado mayor <= maxSize.
// Si la imagen ya es pequeña y el resultado ocupa más que el original, devuelve el original.
function resizeImageToDataURL(source, maxSize = IMAGE_SIZES.cover, quality = 0.85) {
    return new Promise((resolve, reject) => {
        const isString = typeof source === 'string';
        const src = isString ? source : URL.createObjectURL(source);
        const img = new Image();
        img.onload = () => {
            if (!isString) URL.revokeObjectURL(src);
            const scale  = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
            const width  = Math.max(1, Math.round(img.naturalWidth  * scale));
            const height = Math.max(1, Math.round(img.naturalHeight * scale));
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';            // JPEG no tiene transparencia
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            const result = canvas.toDataURL('image/jpeg', quality);
            if (isString && scale === 1 && result.length >= source.length) resolve(source);
            else resolve(result);
        };
        img.onerror = () => {
            if (!isString) URL.revokeObjectURL(src);
            reject(new Error('No se pudo leer la imagen'));
        };
        img.src = src;
    });
}

// ── UTILIDADES ────────────────────────────────────────────────────────────
// Escapa texto para meterlo dentro de HTML (contenido o atributos entre comillas).
// Sin esto, un título con < o " rompía la tarjeta, y un título de Spotify con HTML
// se habría interpretado como código.
function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Como encodeURIComponent, pero también codifica el apóstrofo. Necesario cuando la URL
// va dentro de un onclick="...'url'..." (ej. "D'Angelo" rompía el enlace).
function encodeParam(value) {
    return encodeURIComponent(value ?? '').replace(/'/g, '%27');
}

// Fecha de hoy en hora local (YYYY-MM-DD). toISOString() usa UTC y entre las 00:00
// y las 02:00 en España devolvía el día anterior.
function localDateStr(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatRating(rating) {
    const r = parseFloat(rating);
    if (isNaN(r)) return "";
    if (setting('display.decimals', 'auto') === 'always') return r.toFixed(1);
    return Number.isInteger(r) ? r.toString() : r.toFixed(1);
}

// Paletas de color de las notas (Ajustes → Vista). Orden de cada lista:
// 10 · 9-9.9 · 8 · 7 · 6 · 5 · 4 · 2-3.9 · 0-1.9
const RATING_PALETTES = {
    classic:  { name: 'Clásica',  colors: ['#FF66CC', '#B533FF', '#3366FF', '#66CC33', '#FFD11A', '#FF8533', '#FF3333', '#996600', '#4D4D4D'] },
    traffic:  { name: 'Semáforo', colors: ['#047857', '#059669', '#16A34A', '#65A30D', '#CA8A04', '#EA580C', '#DC2626', '#B91C1C', '#7F1D1D'] },
    cool:     { name: 'Fríos',    colors: ['#7C3AED', '#6D28D9', '#4338CA', '#1D4ED8', '#0369A1', '#0E7490', '#0F766E', '#475569', '#334155'] },
    sunset:   { name: 'Atardecer', colors: ['#BE185D', '#DB2777', '#E11D48', '#EA580C', '#D97706', '#CA8A04', '#A16207', '#78350F', '#44403C'] },
    mono:     { name: 'Monocromo', colors: ['#000000', '#1F1F1F', '#333333', '#474747', '#595959', '#6B6B6B', '#7A7A7A', '#8A8A8A', '#9A9A9A'] },
};

function getColorByRating(rating, paletteId = setting('display.palette', 'classic')) {
    const c = (RATING_PALETTES[paletteId] || RATING_PALETTES.classic).colors;
    const r = parseFloat(rating);
    if (isNaN(r) || r === 0) return c[8];
    if (r === 10) return c[0];
    if (r >= 9)   return c[1];
    if (r >= 8)   return c[2];
    if (r >= 7)   return c[3];
    if (r >= 6)   return c[4];
    if (r >= 5)   return c[5];
    if (r >= 4)   return c[6];
    if (r >= 2)   return c[7];
    return c[8];
}

// ── AJUSTES: traer los de la nube en segundo plano ───────────────────────
// Si cambiaron desde otro dispositivo, se aplican del todo en la siguiente carga.
document.addEventListener('DOMContentLoaded', () => {
    if (window.brSettings) window.brSettings.syncFromCloud().catch(() => {});
});

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

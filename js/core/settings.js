// settings.js - Ajustes de BitRevs (página Ajustes).
//
// Se guardan en tu cuenta (Firestore: users/<uid>/userProfile/settings) para que el móvil
// y el PC usen los mismos, y se cachean en localStorage para poder leerlos al instante.
// Se carga en el <head> de cada página (sin defer) para aplicar el tema antes de pintar.
//
// Uso en las páginas:
//   brSettings.get('ranking.minArtistTracks')        → valor (o el de por defecto)
//   await brSettings.set('display.theme', 'dark')    → guarda en caché + nube
//   await brSettings.syncFromCloud()                 → trae los de la nube (lo hace db.js solo)
(function () {
    const CACHE_KEY = 'bitrevs_settings';

    // Preferencias que antes se guardaban sueltas en este navegador: se usan como valor
    // inicial la primera vez, para no perder lo que ya tenías elegido.
    const legacy = key => { try { return localStorage.getItem(key); } catch { return null; } };

    const HOME_SECTIONS = [
        ['recent',       'Últimas añadidas'],
        ['best',         'Mis mejores reviews'],
        ['timeline',     'Línea de tiempo'],
        ['revisit',      'Revisita reviews antiguas'],
        ['artists',      'Artistas mejor valorados'],
        ['directors',    'Directores mejor valorados'],
        ['music-genres', 'Géneros musicales'],
        ['movie-genres', 'Géneros cinematográficos'],
        ['countries',    'Países'],
    ];

    const DEFAULTS = {
        ranking: {
            trackTiebreaker:    'album-rating',   // album-rating | alphabetical | added
            trackTiebreakerDir: 'asc',            // para alphabetical / added
            starFirst:          true,             // canciones con estrella primero entre notas iguales
            useTopLists:        true,             // las listas marcadas como Top suben canciones/álbumes
            mediaTiebreaker:    legacy('bitrevs_media_tiebreaker') || 'alphabetical', // películas y series
            includeSingles:     true,             // singles en Top 100 y Wrapped
            includeEPs:         true,             // EPs en Top 100 y Wrapped
            minArtistTracks:    3,
            minDirectorMovies:  2,
        },
        albumRating: {
            method:  'mean',                      // mean | median | trimmed (sin la peor canción)
            factors: [],                          // [{ id, name, weight (0-100), scope: 'all' | 'selected' }]
        },
        display: {
            theme:    'light',                    // light | dark | auto
            palette:  'classic',                  // ver RATING_PALETTES en db.js
            decimals: 'auto',                     // auto (8) | always (8.0)
            rowsMax:  50,                         // elementos máximos en las filas deslizables
        },
        defaults: {
            startPage:  'home.html',
            musicSort:  'default',
            musicType:  'album',                  // album | Single | EP | '' (todos)
            moviesSort: legacy('bitrevs_movies_default_sort') || 'default',
            seriesSort: legacy('bitrevs_series_default_sort') || 'default',
            musicView:  legacy('bitrevs_music_view')  || 'normal',
            moviesView: legacy('bitrevs_movies_view') || 'normal',
            seriesView: legacy('bitrevs_series_view') || 'normal',
        },
        home: {
            sections: HOME_SECTIONS.map(([id]) => ({ id, visible: true })),
        },
        backup: {
            lastBackupAt: null,                   // ISO de la última exportación
            reminderDays: 14,                     // 0 = sin aviso
        },
    };

    const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
    function merge(base, over) {
        if (!isObj(over)) return structuredClone(base);
        const out = {};
        for (const k of Object.keys(base)) {
            if (isObj(base[k])) out[k] = merge(base[k], over[k]);
            else out[k] = over[k] !== undefined ? over[k] : base[k];
        }
        return out;
    }

    // Inicio: conservar el orden guardado y añadir secciones nuevas al final
    function normalizeHome(s) {
        const known = HOME_SECTIONS.map(([id]) => id);
        const saved = (s.home.sections || []).filter(x => x && known.includes(x.id));
        known.forEach(id => { if (!saved.some(x => x.id === id)) saved.push({ id, visible: true }); });
        s.home.sections = saved;
        return s;
    }

    function readCache() {
        try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
    }
    function writeCache(s) {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(s)); } catch {}
    }

    let current = normalizeHome(merge(DEFAULTS, readCache()));

    // ── Tema (claro / oscuro / automático) ──────────────────────────────
    const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    function applyTheme() {
        const pref = current.display.theme;
        const dark = pref === 'dark' || (pref === 'auto' && darkQuery && darkQuery.matches);
        document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    }
    applyTheme();
    if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', applyTheme);

    function getPath(obj, path) {
        return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
    }
    function setPath(obj, path, value) {
        const keys = path.split('.');
        let o = obj;
        keys.slice(0, -1).forEach(k => { if (!isObj(o[k])) o[k] = {}; o = o[k]; });
        o[keys[keys.length - 1]] = value;
    }

    async function saveToCloud() {
        if (typeof saveItemToDB !== 'function') return;
        try { await saveItemToDB('userProfile', { key: 'settings', ...current }); }
        catch (err) { console.error('No se pudieron guardar los ajustes en la nube:', err); }
    }

    window.brSettings = {
        DEFAULTS,
        HOME_SECTIONS,

        get(path) {
            const v = getPath(current, path);
            return v !== undefined ? v : getPath(DEFAULTS, path);
        },

        all() { return structuredClone(current); },

        // Página que se abre al entrar (index.html y después de iniciar sesión)
        START_PAGES: [
            ['home.html', 'Inicio'], ['music.html', 'Música'], ['movies.html', 'Películas'],
            ['series.html', 'Series'], ['top.html', 'Top'], ['wrapped.html', 'Wrapped'],
            ['lists.html', 'Listas'], ['collections.html', 'Colecciones'],
        ],
        startPage() {
            const p = this.get('defaults.startPage');
            return this.START_PAGES.some(([href]) => href === p) ? p : 'home.html';
        },

        async set(path, value) {
            setPath(current, path, value);
            writeCache(current);
            if (path.startsWith('display.theme')) applyTheme();
            document.dispatchEvent(new CustomEvent('br-settings-changed', { detail: { path } }));
            await saveToCloud();
        },

        // Cambia varios a la vez: { 'ranking.starFirst': false, ... }
        async setMany(patch) {
            Object.entries(patch).forEach(([p, v]) => setPath(current, p, v));
            writeCache(current);
            applyTheme();
            document.dispatchEvent(new CustomEvent('br-settings-changed', { detail: { paths: Object.keys(patch) } }));
            await saveToCloud();
        },

        async reset() {
            current = normalizeHome(merge(DEFAULTS, null));
            writeCache(current);
            applyTheme();
            await saveToCloud();
        },

        // Trae los ajustes de la nube. Devuelve true si algo cambió respecto a la caché.
        async syncFromCloud() {
            if (typeof waitForAuth !== 'function' || typeof userCol !== 'function') return false;
            let cloud;
            try {
                await waitForAuth();
                const doc = await userCol('userProfile').doc('settings').get();
                cloud = doc.exists ? doc.data() : null;
            } catch (err) {
                // Sin conexión o sin sesión: seguir con la caché y NO sobrescribir la nube
                console.warn('Ajustes: no se pudieron leer de la nube', err);
                return false;
            }
            if (!cloud) {               // primera vez: subir lo que haya en este navegador
                await saveToCloud();
                return false;
            }
            delete cloud.key;
            const next = normalizeHome(merge(DEFAULTS, cloud));
            const changed = JSON.stringify(next) !== JSON.stringify(current);
            current = next;
            writeCache(current);
            applyTheme();
            if (changed) document.dispatchEvent(new CustomEvent('br-settings-changed', { detail: { fromCloud: true } }));
            return changed;
        },
    };
})();

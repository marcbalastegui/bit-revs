// settings.js (página) - Ajustes de BitRevs
// Los valores se guardan con brSettings (js/core/settings.js): en tu cuenta + caché local.

// ── UTILIDADES DE LA PÁGINA ───────────────────────────────────────────────
let toastTimer = null;
function toast(text = 'Guardado') {
    const el = document.getElementById('settings-toast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
}

function showMessage(id, text, type = 'success') {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'settings-message ' + type;
}

async function saveSetting(path, value) {
    await brSettings.set(path, value);
    toast();
}

// Fila genérica: { label, desc, control: HTMLElement }
function row({ label, desc, control }) {
    const el = document.createElement('div');
    el.className = 'settings-row';
    el.innerHTML = `
        <div class="settings-row-text">
            <div class="settings-row-label">${esc(label)}</div>
            ${desc ? `<div class="settings-row-desc">${esc(desc)}</div>` : ''}
        </div>
        <div class="settings-row-control"></div>`;
    el.querySelector('.settings-row-control').appendChild(control);
    return el;
}

function selectControl(path, options, onChange) {
    const sel = document.createElement('select');
    sel.className = 'settings-select';
    sel.innerHTML = options.map(([v, label]) => `<option value="${esc(v)}">${esc(label)}</option>`).join('');
    sel.value = String(brSettings.get(path));
    sel.addEventListener('change', async () => {
        const raw = sel.value;
        const value = typeof getDefault(path) === 'number' ? Number(raw) : raw;
        await saveSetting(path, value);
        if (onChange) onChange(value);
    });
    return sel;
}

function toggleControl(path, onChange) {
    const label = document.createElement('label');
    label.className = 'switch';
    label.innerHTML = `<input type="checkbox"><span class="switch-slider"></span>`;
    const input = label.querySelector('input');
    input.checked = !!brSettings.get(path);
    input.addEventListener('change', async () => {
        await saveSetting(path, input.checked);
        if (onChange) onChange(input.checked);
    });
    return label;
}

function numberControl(path, min, max) {
    const input = document.createElement('input');
    input.type = 'number'; input.min = min; input.max = max; input.step = 1;
    input.className = 'settings-number';
    input.value = brSettings.get(path);
    input.addEventListener('change', async () => {
        const v = Math.max(min, Math.min(max, parseInt(input.value) || min));
        input.value = v;
        await saveSetting(path, v);
    });
    return input;
}

function segmentedControl(path, options, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'segmented';
    const render = () => {
        const current = String(brSettings.get(path));
        wrap.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.value === current));
    };
    wrap.innerHTML = options.map(([v, label]) => `<button type="button" data-value="${esc(v)}">${esc(label)}</button>`).join('');
    wrap.querySelectorAll('button').forEach(b => b.addEventListener('click', async () => {
        const value = typeof getDefault(path) === 'number' ? Number(b.dataset.value) : b.dataset.value;
        await saveSetting(path, value);
        render();
        if (onChange) onChange(value);
    }));
    render();
    return wrap;
}

function getDefault(path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), brSettings.DEFAULTS);
}

// ── PUNTUACIONES Y ORDEN ──────────────────────────────────────────────────
function renderRanking() {
    const box = document.getElementById('rows-ranking');
    box.innerHTML = '';

    const dirSelect = selectControl('ranking.trackTiebreakerDir', [['asc', 'A→Z · antiguo primero'], ['desc', 'Z→A · reciente primero']]);
    const updateDir = v => { dirSelect.disabled = (v || brSettings.get('ranking.trackTiebreaker')) === 'album-rating'; };

    const tiebreak = document.createElement('div');
    tiebreak.className = 'settings-inline';
    tiebreak.append(
        selectControl('ranking.trackTiebreaker', [
            ['album-rating', 'Nota del álbum'],
            ['alphabetical', 'Alfabético'],
            ['added', 'Fecha en que añadiste el álbum'],
        ], updateDir),
        dirSelect);
    updateDir();

    box.append(
        row({ label: 'Desempate de canciones', desc: 'Último criterio cuando dos canciones tienen la misma nota. El Top 100 lo usa al abrirse (allí puedes cambiarlo un momento).', control: tiebreak }),
        row({ label: 'Canciones con estrella primero', desc: 'Entre dos canciones con la misma nota, primero la que tiene estrella.', control: toggleControl('ranking.starFirst') }),
        row({ label: 'Contar listas Top', desc: 'Las canciones y álbumes que están en tus listas marcadas como Top suben en caso de empate.', control: toggleControl('ranking.useTopLists') }),
        row({ label: 'Desempate de películas y series', desc: 'Top 100, Perfil y Wrapped.', control: selectControl('ranking.mediaTiebreaker', [
            ['alphabetical', 'Alfabético'],
            ['year-desc', 'Año (más reciente primero)'],
            ['year-asc', 'Año (más antiguo primero)'],
            ['added', 'Fecha en que la añadiste'],
            ['manual', 'Orden manual (el que arrastras en Películas)'],
        ]) }),
        row({ label: 'Incluir singles', desc: 'En el Top 100 de canciones y en Wrapped.', control: toggleControl('ranking.includeSingles') }),
        row({ label: 'Incluir EPs', desc: 'En el Top 100 de canciones y en Wrapped.', control: toggleControl('ranking.includeEPs') }),
        row({ label: 'Canciones mínimas por artista', desc: 'Para aparecer en los rankings de artistas (Top, Wrapped, Inicio).', control: numberControl('ranking.minArtistTracks', 1, 30) }),
        row({ label: 'Películas mínimas por director', desc: 'Para aparecer en "Directores mejor valorados" de Inicio.', control: numberControl('ranking.minDirectorMovies', 1, 20) }),
    );
}

// ── NOTA DEL ÁLBUM Y FACTORES ─────────────────────────────────────────────
function markRecalcNeeded() {
    document.getElementById('recalc-box')?.classList.add('needed');
}

function renderAlbumRating() {
    const box = document.getElementById('rows-album');
    box.innerHTML = '';
    box.append(row({
        label: 'Cómo se calcula',
        desc: 'Con las canciones puntuadas (sin interludios). "Sin la peor" solo se aplica con 3 o más canciones.',
        control: selectControl('albumRating.method', [
            ['mean', 'Media'],
            ['median', 'Mediana'],
            ['trimmed', 'Media sin la peor canción'],
        ], markRecalcNeeded),
    }));
    renderFactors();
}

function newFactorId() {
    return 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function renderFactors() {
    const list    = document.getElementById('factor-list');
    const factors = brSettings.get('albumRating.factors') || [];
    const total   = factors.reduce((s, f) => s + (parseFloat(f.weight) || 0), 0);

    const totalEl = document.getElementById('factor-total');
    if (totalEl) {
        totalEl.textContent = factors.length === 0
            ? 'Sin factores: la nota es solo la de las canciones.'
            : `Factores: ${total}% · Canciones: ${Math.max(0, 100 - total)}%` + (total > 90 ? ' (las canciones casi no cuentan)' : '');
        totalEl.classList.toggle('warn', total > 90);
    }

    if (factors.length === 0) {
        list.innerHTML = `<p class="settings-help factor-empty">Todavía no tienes factores. Ejemplo: "Concepto" al 15% en todos los álbumes, o "Producción" al 10% solo en los que tú elijas.</p>`;
        return;
    }

    list.innerHTML = factors.map((f, i) => `
        <div class="factor-row" data-index="${i}">
            <input type="text" class="factor-name" value="${esc(f.name)}" placeholder="Nombre (ej. Concepto)" maxlength="30">
            <label class="factor-weight"><input type="number" min="1" max="90" step="1" value="${esc(f.weight)}"> %</label>
            <select class="factor-scope settings-select">
                <option value="all"${f.scope !== 'selected' ? ' selected' : ''}>Todos los álbumes</option>
                <option value="selected"${f.scope === 'selected' ? ' selected' : ''}>Solo algunos álbumes</option>
            </select>
            <button type="button" class="factor-delete" title="Borrar factor" aria-label="Borrar factor">✕</button>
        </div>`).join('');

    const update = async (i, patch) => {
        const next = (brSettings.get('albumRating.factors') || []).map((f, j) => j === i ? { ...f, ...patch } : f);
        await saveSetting('albumRating.factors', next);
        markRecalcNeeded();
        renderFactors();
    };

    list.querySelectorAll('.factor-row').forEach(rowEl => {
        const i = parseInt(rowEl.dataset.index);
        rowEl.querySelector('.factor-name').addEventListener('change', e => update(i, { name: e.target.value.trim() || 'Factor' }));
        rowEl.querySelector('.factor-weight input').addEventListener('change', e => {
            update(i, { weight: Math.max(1, Math.min(90, parseInt(e.target.value) || 1)) });
        });
        rowEl.querySelector('.factor-scope').addEventListener('change', e => update(i, { scope: e.target.value }));
        rowEl.querySelector('.factor-delete').addEventListener('click', async () => {
            const f = (brSettings.get('albumRating.factors') || [])[i];
            const ok = await brConfirm(`"${f.name}" dejará de contar en la nota de todos los álbumes. Después, recalcula las notas.`, 'Borrar factor');
            if (!ok) return;
            const next = (brSettings.get('albumRating.factors') || []).filter((_, j) => j !== i);
            await saveSetting('albumRating.factors', next);
            markRecalcNeeded();
            renderFactors();
        });
    });
}

async function addFactor() {
    const factors = brSettings.get('albumRating.factors') || [];
    const next = [...factors, { id: newFactorId(), name: 'Concepto', weight: 15, scope: 'all' }];
    await saveSetting('albumRating.factors', next);
    renderFactors();
    const inputs = document.querySelectorAll('.factor-name');
    const last = inputs[inputs.length - 1];
    if (last) { last.focus(); last.select(); }
}

async function recalcAllAlbums() {
    const btn = document.getElementById('btn-recalc');
    btn.disabled = true;
    try {
        const albums = await getAllAlbumsFromDB();
        let changed = 0;
        for (let i = 0; i < albums.length; i++) {
            const album = albums[i];
            const next = computeAlbumRating(album);
            if (parseFloat(album.rating || 0) !== next) {
                album.rating = next;
                await saveAlbumToDB(album);
                changed++;
            }
            if (i % 10 === 0) showMessage('album-message', `Recalculando… ${i + 1}/${albums.length}`);
        }
        showMessage('album-message', `Listo: ${changed} de ${albums.length} álbumes cambiaron de nota.`);
        document.getElementById('recalc-box')?.classList.remove('needed');
    } catch (err) {
        console.error(err);
        showMessage('album-message', 'Error al recalcular: ' + (err.message || err), 'error');
    } finally {
        btn.disabled = false;
    }
}

// ── ORDEN POR DEFECTO ─────────────────────────────────────────────────────
function renderDefaults() {
    const box = document.getElementById('rows-defaults');
    box.innerHTML = '';
    const VIEW = [['normal', 'Normal'], ['mini', 'Mini']];
    const inline = (...els) => { const d = document.createElement('div'); d.className = 'settings-inline'; d.append(...els); return d; };

    box.append(
        row({ label: 'Música', desc: 'Orden, pestaña y vista al entrar.', control: inline(
            selectControl('defaults.musicSort', [
                ['default', 'Más recientes primero'], ['rating-desc', 'Nota (mayor a menor)'], ['rating-asc', 'Nota (menor a mayor)'],
                ['year-desc', 'Año (más reciente)'], ['year-asc', 'Año (más antiguo)'], ['title-asc', 'Título (A-Z)'], ['artist-asc', 'Artista (A-Z)'],
            ]),
            selectControl('defaults.musicType', [['album', 'Álbumes'], ['Single', 'Singles'], ['EP', 'EPs'], ['', 'Todo']]),
            segmentedControl('defaults.musicView', VIEW),
        ) }),
        row({ label: 'Películas', control: inline(
            selectControl('defaults.moviesSort', [
                ['default', 'Más recientes primero'], ['rating-desc', 'Nota (mayor a menor)'], ['rating-asc', 'Nota (menor a mayor)'],
                ['year-desc', 'Año (más reciente)'], ['year-asc', 'Año (más antiguo)'], ['title-asc', 'Título (A-Z)'], ['title-desc', 'Título (Z-A)'],
            ]),
            segmentedControl('defaults.moviesView', VIEW),
        ) }),
        row({ label: 'Series', control: inline(
            selectControl('defaults.seriesSort', [
                ['default', 'Más recientes primero'], ['rating-desc', 'Nota (mayor a menor)'], ['rating-asc', 'Nota (menor a mayor)'],
                ['year-desc', 'Año (más reciente)'], ['year-asc', 'Año (más antiguo)'], ['title-asc', 'Título (A-Z)'],
            ]),
            segmentedControl('defaults.seriesView', VIEW),
        ) }),
    );
}

// ── VISTA ─────────────────────────────────────────────────────────────────
function renderDisplay() {
    const box = document.getElementById('rows-display');
    box.innerHTML = '';
    box.append(
        row({ label: 'Tema', desc: 'Automático sigue el modo claro/oscuro de tu dispositivo.', control: segmentedControl('display.theme', [['light', 'Claro'], ['dark', 'Oscuro'], ['auto', 'Automático']]) }),
        row({ label: 'Formato de las notas', desc: 'Cómo se escriben las notas enteras.', control: segmentedControl('display.decimals', [['auto', '8 · 8.5'], ['always', '8.0 · 8.5']], renderPalettes) }),
        row({ label: 'Elementos en las filas deslizables', desc: 'Cuántos se pueden ver al deslizar las filas de Inicio y Perfil.', control: segmentedControl('display.rowsMax', [['25', '25'], ['50', '50']]) }),
    );
    renderPalettes();
}

function renderPalettes() {
    const grid    = document.getElementById('palette-grid');
    const current = brSettings.get('display.palette');
    const samples = [10, 9.5, 8.5, 7.5, 6.5, 5.5, 4.5, 3, 1];
    grid.innerHTML = Object.entries(RATING_PALETTES).map(([id, p]) => `
        <button type="button" class="palette-card${id === current ? ' active' : ''}" data-palette="${id}">
            <span class="palette-name">${esc(p.name)}</span>
            <span class="palette-chips">${samples.map(r =>
                `<span class="palette-chip" style="background:${getColorByRating(r, id)}">${formatRating(r)}</span>`).join('')}</span>
        </button>`).join('');
    grid.querySelectorAll('.palette-card').forEach(btn => btn.addEventListener('click', async () => {
        await saveSetting('display.palette', btn.dataset.palette);
        renderPalettes();
    }));
}

// ── INICIO ────────────────────────────────────────────────────────────────
function renderHome() {
    const box = document.getElementById('rows-home');
    box.innerHTML = '';
    box.append(row({
        label: 'Página al entrar',
        desc: 'La que se abre al ir a la web o al iniciar sesión.',
        control: selectControl('defaults.startPage', brSettings.START_PAGES),
    }));
    renderHomeSections();
}

function renderHomeSections() {
    const list     = document.getElementById('home-sections');
    const sections = brSettings.get('home.sections');
    const names    = Object.fromEntries(brSettings.HOME_SECTIONS);

    list.innerHTML = sections.map((s, i) => `
        <div class="home-section-item${s.visible ? '' : ' hidden-section'}" data-index="${i}">
            <label class="home-section-check">
                <input type="checkbox"${s.visible ? ' checked' : ''}>
                <span>${esc(names[s.id] || s.id)}</span>
            </label>
            <div class="home-section-move">
                <button type="button" data-move="-1" title="Subir" aria-label="Subir"${i === 0 ? ' disabled' : ''}>↑</button>
                <button type="button" data-move="1" title="Bajar" aria-label="Bajar"${i === sections.length - 1 ? ' disabled' : ''}>↓</button>
            </div>
        </div>`).join('');

    list.querySelectorAll('.home-section-item').forEach(item => {
        const i = parseInt(item.dataset.index);
        item.querySelector('input').addEventListener('change', async e => {
            const next = brSettings.get('home.sections').map((s, j) => j === i ? { ...s, visible: e.target.checked } : s);
            await saveSetting('home.sections', next);
            renderHomeSections();
        });
        item.querySelectorAll('[data-move]').forEach(btn => btn.addEventListener('click', async () => {
            const to = i + parseInt(btn.dataset.move);
            const next = [...brSettings.get('home.sections')];
            [next[i], next[to]] = [next[to], next[i]];
            await saveSetting('home.sections', next);
            renderHomeSections();
        }));
    });
}

// ── DATOS: BACKUP ─────────────────────────────────────────────────────────
function renderLastBackup() {
    const el   = document.getElementById('last-backup-text');
    const last = brSettings.get('backup.lastBackupAt');
    if (!el) return;
    if (!last) { el.textContent = 'Exporta todos tus datos en un archivo .json. Todavía no has hecho ningún backup desde Ajustes.'; return; }
    const days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
    el.textContent = `Último backup: ${new Date(last).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}` +
        (days === 0 ? ' (hoy).' : ` (hace ${days} día${days !== 1 ? 's' : ''}).`);
}

function renderDataRows() {
    const box = document.getElementById('rows-data');
    box.innerHTML = '';
    box.append(row({
        label: 'Recordatorio de backup',
        desc: 'Aviso en Inicio cuando haga más de estos días desde el último backup.',
        control: selectControl('backup.reminderDays', [['0', 'Sin aviso'], ['7', 'Cada 7 días'], ['14', 'Cada 14 días'], ['30', 'Cada 30 días']]),
    }));
}

async function exportData() {
    try {
        showMessage('data-message', 'Preparando backup…');
        const [albums, movies, series, profile, artists, directors, collections, lists] = await Promise.all([
            getAllAlbumsFromDB(), getAllItemsFromDB('movies'), getAllItemsFromDB('series'), getUserProfileFromDB(),
            getAllItemsFromDB('artists'), getAllItemsFromDB('directors'), getAllItemsFromDB('collections'), getAllItemsFromDB('lists'),
        ]);
        const backup = {
            _version:    4,
            _exportedAt: new Date().toISOString(),
            albums, movies, series, profile, artists, directors, collections, lists,
            settings: brSettings.all(),
        };
        downloadFile(`bitrevs_backup_${localDateStr()}.json`, JSON.stringify(backup, null, 2), 'application/json');
        await brSettings.set('backup.lastBackupAt', new Date().toISOString());
        renderLastBackup();
        showMessage('data-message', 'Backup exportado correctamente.');
    } catch (err) {
        console.error(err);
        showMessage('data-message', 'Error al exportar los datos.', 'error');
    }
}

async function importData(file) {
    const input = document.getElementById('input-import');
    if (!file) return;
    const confirmed = await brConfirm(
        'Importar un backup sobrescribirá los elementos con el mismo id. Esta acción no se puede deshacer.',
        'Importar backup');
    if (!confirmed) { input.value = ''; return; }

    try {
        const backup = JSON.parse(await file.text());
        if (!backup.albums || !backup.movies || !backup.series) throw new Error('Archivo no válido.');
        showMessage('data-message', 'Importando…');
        for (const album of backup.albums) await saveAlbumToDB(album);
        for (const movie of backup.movies) await saveItemToDB('movies', movie);
        for (const serie of backup.series) await saveItemToDB('series', serie);
        if (backup.profile) await saveUserProfileToDB(backup.profile);
        for (const a of backup.artists     || []) await saveItemToDB('artists', a);
        for (const d of backup.directors   || []) await saveItemToDB('directors', d);
        for (const c of backup.collections || []) await saveItemToDB('collections', c);
        for (const l of backup.lists       || []) await saveItemToDB('lists', l);
        if (backup.settings) {
            const patch = {};
            ['ranking', 'albumRating', 'display', 'defaults', 'home'].forEach(k => { if (backup.settings[k]) patch[k] = backup.settings[k]; });
            await brSettings.setMany(patch);
        }
        showMessage('data-message', 'Backup importado correctamente. Recargando…');
        setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
        showMessage('data-message', 'Error: ' + err.message, 'error');
    }
    input.value = '';
}

function downloadFile(name, content, type) {
    const blob = new Blob([content], { type });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── DATOS: OPTIMIZAR IMÁGENES YA GUARDADAS ───────────────────────────────
// Reduce las imágenes guardadas antes de que existiera resizeImageToDataURL().
// Solo reescribe los documentos en los que alguna imagen ha quedado más pequeña.
async function optimizeStoredImages() {
    const ok = await brConfirm(
        'Se reducirán las portadas, fotos y banners que ya tienes guardados. Se recomienda exportar un backup antes. Puede tardar un poco.',
        'Optimizar imágenes');
    if (!ok) return;

    const btn = document.getElementById('btn-optimize-images');
    if (btn) btn.disabled = true;

    const plan = [
        ['albums',      [['coverBase64', IMAGE_SIZES.cover]]],
        ['movies',      [['coverBase64', IMAGE_SIZES.cover]]],
        ['series',      [['coverBase64', IMAGE_SIZES.cover]]],
        ['artists',     [['photo', IMAGE_SIZES.photo], ['banner', IMAGE_SIZES.banner, 0.82]]],
        ['directors',   [['photo', IMAGE_SIZES.photo]]],
        ['collections', [['banner', IMAGE_SIZES.banner, 0.82]]],
        ['userProfile', [['avatarData', IMAGE_SIZES.avatar], ['bannerData', IMAGE_SIZES.banner, 0.82]]],
    ];

    let before = 0, after = 0, updated = 0, failed = 0;
    try {
        for (const [store, fields] of plan) {
            const items = await getAllItemsFromDB(store);
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                let changed = false;
                const shrink = async (value, size, quality) => {
                    if (typeof value !== 'string' || !value.startsWith('data:image')) return value;
                    try {
                        const smaller = await resizeImageToDataURL(value, size, quality);
                        before += value.length; after += smaller.length;
                        if (smaller.length < value.length) { changed = true; return smaller; }
                    } catch { failed++; }
                    return value;
                };
                for (const [field, size, quality] of fields) item[field] = await shrink(item[field], size, quality);
                if (Array.isArray(item.scenes)) {
                    for (const scene of item.scenes) {
                        if (scene && scene.image) scene.image = await shrink(scene.image, IMAGE_SIZES.frame);
                    }
                }
                if (changed) { await saveItemToDB(store, item); updated++; }
                showMessage('data-message', `Optimizando ${store}… ${i + 1}/${items.length}`);
            }
        }
        const mb = n => (n * 0.75 / 1024 / 1024).toFixed(1);
        showMessage('data-message',
            `Listo: ${updated} elemento${updated !== 1 ? 's' : ''} actualizado${updated !== 1 ? 's' : ''}. ` +
            `Imágenes: ${mb(before)} MB → ${mb(after)} MB.` + (failed ? ` ${failed} no se pudieron leer.` : ''));
    } catch (err) {
        console.error('optimizeStoredImages:', err);
        showMessage('data-message', 'Error al optimizar: ' + (err.message || err), 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

// ── DATOS: EXPORTAR A CSV ─────────────────────────────────────────────────
// Separador ";" y coma decimal (Excel en español). BOM para que respete las tildes.
function csvCell(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return String(v).replace('.', ',');
    const s = String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvRating(v) {
    const n = parseFloat(v);
    return isNaN(n) ? '' : n;
}
function toCsv(header, rows) {
    return '﻿' + [header, ...rows].map(r => r.map(csvCell).join(';')).join('\r\n');
}

async function exportCsv(kind) {
    try {
        let header, rows;
        if (kind === 'albums' || kind === 'tracks') {
            const albums = await getAllAlbumsFromDB();
            if (kind === 'albums') {
                const factors = brSettings.get('albumRating.factors') || [];
                header = ['Título', 'Artista', 'Colaboradores', 'Año', 'Tipo', 'Géneros', 'Nota', 'Canciones puntuadas',
                          ...factors.map(f => f.name), 'Fecha review', 'Favorito'];
                rows = albums.map(a => [
                    a.title, a.artist, (a.featuredArtists || []).join(', '), parseInt(a.year) || '', a.type || 'Álbum',
                    (a.genres || []).join(', '), csvRating(a.rating),
                    (a.tracks || []).filter(t => !t.isInterlude && !isNaN(parseFloat(t.rating))).length,
                    ...factors.map(f => csvRating((a.factors || {})[f.id])),
                    a.reviewDate || '', a.favorite ? 'Sí' : '',
                ]);
            } else {
                header = ['Álbum', 'Artista del álbum', 'Nº', 'Canción', 'Artistas de la canción', 'Nota', 'Estrella', 'Interludio'];
                rows = [];
                albums.forEach(a => (a.tracks || []).forEach((t, i) => rows.push([
                    a.title, a.artist, i + 1, t.title, t.artist || '', t.isInterlude ? '' : csvRating(t.rating),
                    t.favorite ? 'Sí' : '', t.isInterlude ? 'Sí' : '',
                ])));
            }
        } else if (kind === 'movies') {
            const movies = await getAllItemsFromDB('movies');
            header = ['Título', 'Director', 'Año', 'Nota', 'Género', 'País', 'Duración', 'Fecha vista'];
            rows = movies.map(m => [m.title, m.director || '', parseInt(m.year) || '', csvRating(m.rating), m.genre || '',
                                    m.country || '', m.duration || '', m.watchDate || '']);
        } else {
            const series = await getAllItemsFromDB('series');
            header = ['Título', 'Creador', 'Año', 'Nota', 'Género', 'Duración', 'Empezada', 'Terminada'];
            rows = series.map(s => [s.title, s.creator || '', parseInt(s.year) || '', csvRating(s.rating), s.genre || '',
                                    s.duration || '', s.startDate || '', s.endDate || '']);
        }
        const names = { albums: 'albumes', tracks: 'canciones', movies: 'peliculas', series: 'series' };
        downloadFile(`bitrevs_${names[kind]}_${localDateStr()}.csv`, toCsv(header, rows), 'text/csv;charset=utf-8');
        showMessage('data-message', `CSV de ${names[kind]} descargado (${rows.length} filas).`);
    } catch (err) {
        console.error(err);
        showMessage('data-message', 'Error al exportar el CSV.', 'error');
    }
}

// ── DATOS: LIMPIAR / RESTABLECER ──────────────────────────────────────────
async function clearLocalData() {
    const ok = await brConfirm('Se borrarán las preferencias y cachés de este navegador. Tus reviews y los ajustes de tu cuenta no se tocan.', 'Limpiar datos del navegador');
    if (!ok) return;
    try {
        Object.keys(localStorage)
            .filter(k => k.startsWith('bitrevs_') && k !== 'bitrevs_settings')
            .forEach(k => localStorage.removeItem(k));
        sessionStorage.clear();
    } catch {}
    showMessage('data-message', 'Datos del navegador borrados.');
}

async function resetSettings() {
    const ok = await brConfirm('Todos los ajustes volverán a como venían y se borrarán los factores personalizados.', 'Restablecer ajustes');
    if (!ok) return;
    await brSettings.reset();
    renderAll();
    markRecalcNeeded();
    showMessage('data-message', 'Ajustes restablecidos. Recalcula las notas si usabas factores.');
}

// ── CUENTA ────────────────────────────────────────────────────────────────
function renderAccount() {
    waitForAuth().then(user => {
        const el = document.getElementById('account-email');
        if (el) el.textContent = user?.email ? `Has iniciado sesión como ${user.email}` : 'Sesión iniciada';
    }).catch(() => {});

    const connected = typeof isSpotifyConnected === 'function' && isSpotifyConnected();
    document.getElementById('spotify-status').textContent = connected
        ? 'Conectado. Las sugerencias aparecen al añadir un álbum en Música.'
        : 'No conectado. Al conectarlo, verás tus álbumes guardados y recientes al añadir un álbum.';
    const btn = document.getElementById('btn-spotify');
    btn.textContent = connected ? 'Desconectar' : 'Conectar';
    btn.className = connected ? 'secondary-btn' : 'save-btn';
}

async function toggleSpotify() {
    const connected = typeof isSpotifyConnected === 'function' && isSpotifyConnected();
    if (connected) {
        if (!await brConfirm('Se cerrará la conexión con Spotify en este navegador.', 'Desconectar Spotify')) return;
        spotifyLogout();
        renderAccount();
        toast('Spotify desconectado');
    } else {
        // El Redirect URI de Spotify es music.html: el login tiene que empezar allí
        window.location.href = 'music.html?spotify=connect';
    }
}

async function logout() {
    if (!await brConfirm('¿Quieres cerrar la sesión en este dispositivo?', 'Cerrar sesión')) return;
    await brAuth.signOut();
    window.location.href = 'auth.html';
}

// ── INICIO DE LA PÁGINA ───────────────────────────────────────────────────
function renderAll() {
    renderRanking();
    renderAlbumRating();
    renderDefaults();
    renderDisplay();
    renderHome();
    renderDataRows();
    renderLastBackup();
    renderAccount();
}

// Resaltar en el menú lateral la sección visible
function initSectionNav() {
    const links = [...document.querySelectorAll('.settings-nav a')];
    const sections = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const onScroll = () => {
        let current = sections[0];
        sections.forEach(sec => { if (sec.getBoundingClientRect().top < 140) current = sec; });
        links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + current.id));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

document.getElementById('btn-add-factor').addEventListener('click', addFactor);
document.getElementById('btn-recalc').addEventListener('click', recalcAllAlbums);
document.getElementById('btn-export').addEventListener('click', exportData);
document.getElementById('btn-import').addEventListener('click', () => document.getElementById('input-import').click());
document.getElementById('input-import').addEventListener('change', e => importData(e.target.files[0]));
document.getElementById('btn-optimize-images').addEventListener('click', optimizeStoredImages);
document.querySelectorAll('[data-csv]').forEach(b => b.addEventListener('click', () => exportCsv(b.dataset.csv)));
document.getElementById('btn-clear-local').addEventListener('click', clearLocalData);
document.getElementById('btn-reset-settings').addEventListener('click', resetSettings);
document.getElementById('btn-logout').addEventListener('click', logout);
document.getElementById('btn-spotify').addEventListener('click', toggleSpotify);

renderAll();
initSectionNav();

// Si los ajustes de la nube eran distintos a los de este navegador, repintar con ellos
document.addEventListener('br-settings-changed', e => { if (e.detail && e.detail.fromCloud) renderAll(); });

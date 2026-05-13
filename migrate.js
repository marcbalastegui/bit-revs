// migrate.js - Migración de IndexedDB a Firestore

const IDB_NAME    = 'BitRevsDB';
const ALL_STORES  = ['albums', 'movies', 'series', 'artists', 'lists', 'collections', 'userProfile'];

// ── LEER DE INDEXEDDB ─────────────────────────────────────────────────────
function readStoreFromIDB(storeName) {
    return new Promise((resolve) => {
        const req = indexedDB.open(IDB_NAME);
        req.onsuccess = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(storeName)) { resolve([]); return; }
            const tx  = db.transaction(storeName, 'readonly');
            const req2 = tx.objectStore(storeName).getAll();
            req2.onsuccess = () => resolve(req2.result || []);
            req2.onerror   = () => resolve([]);
        };
        req.onerror = () => resolve([]);
    });
}

// ── LOG ───────────────────────────────────────────────────────────────────
const logEl      = document.getElementById('migrate-log');
const progressEl = document.getElementById('migrate-progress');

function log(msg, type = 'info') {
    logEl.style.display = 'block';
    const el = document.createElement('div');
    const colors = { info: '#888', success: '#66CC33', error: '#ff6b74', title: '#f0f0f0' };
    el.style.cssText = `color:${colors[type] || '#888'}; margin-bottom:5px;`;
    el.textContent = msg;
    logEl.appendChild(el);
    logEl.scrollTop = logEl.scrollHeight;
}

// ── MIGRACIÓN ─────────────────────────────────────────────────────────────
async function runMigration() {
    const btn = document.getElementById('btn-migrate');
    btn.disabled = true;

    const user = brAuth.currentUser;
    if (!user) {
        log('⚠ Debes iniciar sesión primero. Redirigiendo...', 'error');
        setTimeout(() => window.location.href = 'auth.html', 2000);
        return;
    }

    log(`▶ Iniciando migración para: ${user.email}`, 'title');
    log('');

    let total = 0, done = 0, errors = 0;

    for (const storeName of ALL_STORES) {
        log(`📦 Leyendo "${storeName}"…`);
        const items = await readStoreFromIDB(storeName);

        if (items.length === 0) {
            log(`   → vacío, se omite.`);
            continue;
        }

        log(`   → ${items.length} elemento(s) encontrado(s)`);
        total += items.length;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            try {
                // Para userProfile, asegurar que tiene key
                if (storeName === 'userProfile' && !item.key) item.key = 'config';
                await saveItemToDB(storeName, item);
                done++;
                progressEl.textContent = `Subiendo… ${done} elemento(s) de ${total}`;
            } catch (err) {
                errors++;
                log(`   ✗ Error en item ${item.id || item.name || i}: ${err.message}`, 'error');
            }
        }
        log(`   ✓ "${storeName}" completado`, 'success');
        log('');
    }

    log('─'.repeat(40), 'info');
    if (errors === 0) {
        log(`✅ Migración completada: ${done} elementos subidos sin errores.`, 'success');
    } else {
        log(`⚠ Migración completada con ${errors} error(es). ${done} elementos subidos.`, 'error');
    }

    progressEl.textContent = `✓ ${done} elementos migrados a la nube`;
    document.getElementById('btn-go-home').style.display = 'block';
}

// ── INIT ──────────────────────────────────────────────────────────────────
brAuth.onAuthStateChanged(user => {
    const userInfo = document.getElementById('user-info');
    if (user) {
        userInfo.innerHTML = `Sesión activa: <strong>${user.email}</strong>`;
    } else {
        userInfo.innerHTML = `<span style="color:#ff6b74;">No hay sesión activa. <a href="auth.html" style="color:#e63946;">Inicia sesión primero.</a></span>`;
        document.getElementById('btn-migrate').disabled = true;
    }
});

document.getElementById('btn-migrate').addEventListener('click', runMigration);

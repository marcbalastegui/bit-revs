// spotify-auth.js - Autenticación con Spotify (OAuth 2.0 + PKCE, sin backend)
//
// Cómo configurarlo:
//   1. Ve a https://developer.spotify.com/dashboard, crea una app.
//   2. En "Redirect URIs" añade EXACTAMENTE la URL de esta página, por ejemplo:
//        http://127.0.0.1:5500/music.html          (desarrollo local)
//        https://tu-usuario.github.io/bit-revs/music.html   (GitHub Pages)
//   3. Copia el Client ID de tu app y pégalo abajo, en SPOTIFY_CLIENT_ID.

// ============================================================
// RELLENA AQUÍ TU CLIENT ID DE SPOTIFY (Dashboard > tu app > Settings)
// ============================================================
const SPOTIFY_CLIENT_ID = '1360202c6e034a718948c968769baaac';

// Funciona tanto en local como en GitHub Pages: usa el origen + la ruta actual.
const SPOTIFY_REDIRECT_URI = window.location.origin + window.location.pathname;

const SPOTIFY_SCOPES = [
    'user-top-read',
    'user-read-recently-played',
    'user-library-read'
].join(' ');

const SPOTIFY_AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';

const SPOTIFY_STORAGE_KEYS = {
    verifier: 'spotify_code_verifier',
    state: 'spotify_auth_state',
    accessToken: 'spotify_access_token',
    refreshToken: 'spotify_refresh_token',
    expiresAt: 'spotify_expires_at'
};

// ── Helpers PKCE ─────────────────────────────────────────────────────────

function spotifyGenerateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomValues = crypto.getRandomValues(new Uint8Array(length));
    let text = '';
    randomValues.forEach(val => { text += possible[val % possible.length]; });
    return text;
}

async function spotifySha256(plain) {
    const encoder = new TextEncoder();
    return crypto.subtle.digest('SHA-256', encoder.encode(plain));
}

function spotifyBase64UrlEncode(arrayBuffer) {
    let str = '';
    const bytes = new Uint8Array(arrayBuffer);
    for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
    return btoa(str)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

async function spotifyGenerateCodeChallenge(verifier) {
    const hashed = await spotifySha256(verifier);
    return spotifyBase64UrlEncode(hashed);
}

function spotifyStoreTokens(data) {
    localStorage.setItem(SPOTIFY_STORAGE_KEYS.accessToken, data.access_token);
    if (data.refresh_token) {
        localStorage.setItem(SPOTIFY_STORAGE_KEYS.refreshToken, data.refresh_token);
    }
    const expiresAt = Date.now() + (data.expires_in * 1000);
    localStorage.setItem(SPOTIFY_STORAGE_KEYS.expiresAt, String(expiresAt));
}

function spotifyCleanUpUrl() {
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    url.searchParams.delete('error');
    window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
}

// ── API pública ──────────────────────────────────────────────────────────

// Inicia el flujo de login: redirige al usuario a Spotify.
async function spotifyLogin() {
    if (!SPOTIFY_CLIENT_ID) {
        console.error('spotify-auth: falta configurar SPOTIFY_CLIENT_ID en spotify-auth.js');
        if (typeof brAlert === 'function') {
            await brAlert('Falta configurar el Client ID de Spotify en spotify-auth.js.', 'Spotify no configurado');
        } else {
            alert('Falta configurar el Client ID de Spotify en spotify-auth.js.');
        }
        return;
    }

    const verifier = spotifyGenerateRandomString(64);
    const challenge = await spotifyGenerateCodeChallenge(verifier);
    const state = spotifyGenerateRandomString(16);

    localStorage.setItem(SPOTIFY_STORAGE_KEYS.verifier, verifier);
    localStorage.setItem(SPOTIFY_STORAGE_KEYS.state, state);

    const params = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        response_type: 'code',
        redirect_uri: SPOTIFY_REDIRECT_URI,
        scope: SPOTIFY_SCOPES,
        code_challenge_method: 'S256',
        code_challenge: challenge,
        state: state
    });

    window.location.href = `${SPOTIFY_AUTH_ENDPOINT}?${params.toString()}`;
}

// Debe llamarse al cargar la página. Si la URL trae ?code=..., intercambia
// el código por un token. Devuelve true si se ha conectado, false si no había nada que hacer.
async function handleSpotifyCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
        console.error('spotify-auth: Spotify devolvió un error en el callback:', error);
        spotifyCleanUpUrl();
        return false;
    }

    if (!code) return false;

    const savedState = localStorage.getItem(SPOTIFY_STORAGE_KEYS.state);
    if (!savedState || savedState !== state) {
        console.error('spotify-auth: el "state" no coincide, se descarta el callback por seguridad');
        spotifyCleanUpUrl();
        return false;
    }

    const verifier = localStorage.getItem(SPOTIFY_STORAGE_KEYS.verifier);
    if (!verifier) {
        console.error('spotify-auth: no hay code_verifier guardado, no se puede completar el login');
        spotifyCleanUpUrl();
        return false;
    }

    try {
        const body = new URLSearchParams({
            client_id: SPOTIFY_CLIENT_ID,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: SPOTIFY_REDIRECT_URI,
            code_verifier: verifier
        });

        const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        });

        if (!response.ok) throw new Error('No se pudo intercambiar el código por un token de Spotify');

        const data = await response.json();
        spotifyStoreTokens(data);

        localStorage.removeItem(SPOTIFY_STORAGE_KEYS.verifier);
        localStorage.removeItem(SPOTIFY_STORAGE_KEYS.state);
        spotifyCleanUpUrl();
        return true;
    } catch (err) {
        console.error('spotify-auth: error al obtener el token de Spotify:', err);
        spotifyCleanUpUrl();
        return false;
    }
}

// Devuelve un access token válido (refrescándolo si hace falta) o null si no hay conexión.
async function getSpotifyToken() {
    const accessToken = localStorage.getItem(SPOTIFY_STORAGE_KEYS.accessToken);
    if (!accessToken) return null;

    const expiresAt = parseInt(localStorage.getItem(SPOTIFY_STORAGE_KEYS.expiresAt) || '0', 10);

    // Margen de 60s antes de que expire para evitar carreras.
    if (Date.now() > expiresAt - 60000) {
        return await refreshSpotifyToken();
    }

    return accessToken;
}

// Usa el refresh_token guardado para obtener un access_token nuevo.
async function refreshSpotifyToken() {
    const refreshToken = localStorage.getItem(SPOTIFY_STORAGE_KEYS.refreshToken);
    if (!refreshToken) return null;

    try {
        const body = new URLSearchParams({
            client_id: SPOTIFY_CLIENT_ID,
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        });

        const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        });

        if (!response.ok) throw new Error('No se pudo refrescar el token de Spotify');

        const data = await response.json();
        spotifyStoreTokens(data);
        return data.access_token;
    } catch (err) {
        console.error('spotify-auth: error al refrescar el token de Spotify:', err);
        spotifyLogout();
        return null;
    }
}

// true si hay una sesión de Spotify guardada (con o sin token todavía vigente).
function isSpotifyConnected() {
    return !!localStorage.getItem(SPOTIFY_STORAGE_KEYS.refreshToken) ||
           !!localStorage.getItem(SPOTIFY_STORAGE_KEYS.accessToken);
}

// Borra todos los datos de sesión de Spotify guardados localmente.
function spotifyLogout() {
    Object.values(SPOTIFY_STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
}

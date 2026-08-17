// spotify-api.js - Wrapper sobre la Web API de Spotify
// Depende de spotify-auth.js (usa getSpotifyToken() y spotifyLogout()).

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

async function spotifyFetch(endpoint) {
    const token = await getSpotifyToken();
    if (!token) throw new Error('No hay una conexión activa con Spotify');

    const response = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 401) {
        // El token ya no es válido: se cierra la sesión local para forzar reconexión.
        spotifyLogout();
        throw new Error('La sesión de Spotify ha caducado, vuelve a conectar tu cuenta');
    }

    if (!response.ok) {
        throw new Error(`Error de la API de Spotify (${response.status})`);
    }

    return response.json();
}

function spotifyExtractYear(releaseDate) {
    if (!releaseDate) return null;
    const year = parseInt(releaseDate.slice(0, 4), 10);
    return Number.isNaN(year) ? null : year;
}

function spotifyMapTrackToAlbum(track) {
    const album = track.album || {};
    return {
        spotifyId: album.id,
        title: album.name,
        artist: (album.artists || []).map(a => a.name).join(', '),
        year: spotifyExtractYear(album.release_date),
        coverUrl: (album.images && album.images[0]) ? album.images[0].url : '',
        tracks: [{ title: track.name, duration_ms: track.duration_ms }]
    };
}

function spotifyMapAlbumObject(album) {
    return {
        spotifyId: album.id,
        title: album.name,
        artist: (album.artists || []).map(a => a.name).join(', '),
        year: spotifyExtractYear(album.release_date),
        coverUrl: (album.images && album.images[0]) ? album.images[0].url : '',
        tracks: []
    };
}

// Álbumes más escuchados, calculados a partir de las canciones más escuchadas
// del usuario (Spotify no da "top albums" directamente).
async function getTopAlbums(limit = 20) {
    const data = await spotifyFetch('/me/top/tracks?limit=50&time_range=medium_term');
    const items = data.items || [];

    const albumsById = new Map();

    items.forEach(track => {
        if (!track.album) return;
        const id = track.album.id;
        if (!albumsById.has(id)) {
            const mapped = spotifyMapTrackToAlbum(track);
            mapped._count = 1;
            albumsById.set(id, mapped);
        } else {
            const existing = albumsById.get(id);
            existing._count += 1;
            existing.tracks.push({ title: track.name, duration_ms: track.duration_ms });
        }
    });

    return Array.from(albumsById.values())
        .sort((a, b) => b._count - a._count)
        .slice(0, limit)
        .map(({ _count, ...album }) => album);
}

// Álbumes de las canciones reproducidas recientemente, deduplicados.
async function getRecentAlbums(limit = 10) {
    const data = await spotifyFetch('/me/player/recently-played?limit=50');
    const items = data.items || [];

    const albumsById = new Map();

    items.forEach(item => {
        const track = item.track;
        if (!track || !track.album) return;
        const id = track.album.id;
        if (!albumsById.has(id)) {
            albumsById.set(id, spotifyMapTrackToAlbum(track));
        } else {
            albumsById.get(id).tracks.push({ title: track.name, duration_ms: track.duration_ms });
        }
    });

    return Array.from(albumsById.values()).slice(0, limit);
}

// Búsqueda de álbumes por texto libre.
async function searchSpotifyAlbum(query) {
    if (!query || query.trim() === '') return [];

    const params = new URLSearchParams({ q: query, type: 'album', limit: '12' });
    const data = await spotifyFetch(`/search?${params.toString()}`);
    const items = (data.albums && data.albums.items) ? data.albums.items : [];
    return items.map(spotifyMapAlbumObject);
}

// Liked Songs + Playlists + Listening History
// Everything here is stored in localStorage, so it works with or without login.

const LIKED_KEY = "liked-songs";
const PLAYLISTS_KEY = "playlists";
const HISTORY_KEY = "history";

const read = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
};

const write = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { }
};

// ---------------- Liked Songs ----------------

export const getLikedSongs = () => read(LIKED_KEY, []);

export const isLiked = (id) => getLikedSongs().some((s) => s.id === id);

export const toggleLiked = (song) => {
    const liked = getLikedSongs();
    const exists = liked.some((s) => s.id === song.id);
    const updated = exists ? liked.filter((s) => s.id !== song.id) : [song, ...liked];
    write(LIKED_KEY, updated);
    return !exists;
};

// ---------------- Playlists ----------------

export const getPlaylists = () => read(PLAYLISTS_KEY, []);

export const createPlaylist = (name) => {
    const playlists = getPlaylists();
    const playlist = { id: `pl_${Date.now()}`, name, songs: [] };
    write(PLAYLISTS_KEY, [playlist, ...playlists]);
    return playlist;
};

export const deletePlaylist = (id) => {
    write(PLAYLISTS_KEY, getPlaylists().filter((p) => p.id !== id));
};

export const addToPlaylist = (playlistId, song) => {
    const playlists = getPlaylists().map((p) => {
        if (p.id !== playlistId) return p;
        if (p.songs.some((s) => s.id === song.id)) return p;
        return { ...p, songs: [song, ...p.songs] };
    });
    write(PLAYLISTS_KEY, playlists);
};

export const removeFromPlaylist = (playlistId, songId) => {
    const playlists = getPlaylists().map((p) => {
        if (p.id !== playlistId) return p;
        return { ...p, songs: p.songs.filter((s) => s.id !== songId) };
    });
    write(PLAYLISTS_KEY, playlists);
};

// ---------------- Listening History (for Continue Listening / Made For You) ----------------

export const getHistory = () => read(HISTORY_KEY, []);

export const addToHistory = (song) => {
    const history = getHistory().filter((s) => s.id !== song.id);
    const updated = [{ ...song, playedAt: Date.now() }, ...history].slice(0, 20);
    write(HISTORY_KEY, updated);
};

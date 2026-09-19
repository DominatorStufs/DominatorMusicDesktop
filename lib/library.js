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

// ---------------- Collaborative Playlists (link-based) ----------------
// There's no shared backend/database here, so "collaborative" works via a
// shareable link that encodes the playlist's songs. Whoever opens the link
// can import it into their own local library and keep adding to their copy,
// then re-share an updated link. It's not live/real-time sync, but it's a
// genuinely useful way to build a playlist together without needing accounts.

export const encodePlaylistForShare = (playlist) => {
    const payload = { name: playlist.name, songs: playlist.songs };
    return typeof window !== "undefined" ? window.btoa(encodeURIComponent(JSON.stringify(payload))) : "";
};

export const decodeSharedPlaylist = (encoded) => {
    try {
        return JSON.parse(decodeURIComponent(window.atob(encoded)));
    } catch (e) {
        return null;
    }
};

export const importPlaylist = (name, songs) => {
    const playlists = getPlaylists();
    // If a playlist with the same name already exists, merge new songs into it
    const existing = playlists.find((p) => p.name === name);
    if (existing) {
        const merged = [...existing.songs];
        songs.forEach((s) => {
            if (!merged.some((m) => m.id === s.id)) merged.push(s);
        });
        write(PLAYLISTS_KEY, playlists.map((p) => (p.id === existing.id ? { ...p, songs: merged } : p)));
        return existing;
    }
    const playlist = { id: `pl_${Date.now()}`, name, songs };
    write(PLAYLISTS_KEY, [playlist, ...playlists]);
    return playlist;
};

// ---------------- Listening History (for Continue Listening / Made For You) ----------------

export const getHistory = () => read(HISTORY_KEY, []);

export const addToHistory = (song) => {
    const history = getHistory().filter((s) => s.id !== song.id);
    const updated = [{ ...song, playedAt: Date.now() }, ...history].slice(0, 20);
    write(HISTORY_KEY, updated);
};

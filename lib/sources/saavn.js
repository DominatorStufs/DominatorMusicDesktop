// ---------------------------------------------------------------------------
// JioSaavn adapter - internally this just uses your existing lib/fetch.js.
// Nothing new is happening here; it only reshapes the response into the same
// normalized format that innertube.js and piped.js return, so all three
// sources look identical to the rest of the app.
//
// lib/fetch.js itself was NOT modified.
// ---------------------------------------------------------------------------

import {
    getSongsByQuery,
    getSongsById,
    getSongsSuggestions,
    searchAlbumByQuery,
    getAlbumById,
} from "@/lib/fetch";

// JioSaavn returns HTML-escaped text, so titles showed up literally as
// `Kesariya (From &quot;Brahmastra&quot;)` in the UI. Decode it once here.
const decodeEntities = (str) => {
    if (typeof str !== "string") return str;
    return str
        .replace(/&quot;/g, '"')
        .replace(/&#0?39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
        .trim();
};

const pickImage = (img) =>
    img?.[2]?.url || img?.[1]?.url || img?.[0]?.url || "";

const pickAudio = (urls) =>
    urls?.[4]?.url || urls?.[3]?.url || urls?.[2]?.url || urls?.[1]?.url || urls?.[0]?.url || "";

const normalize = (song) => {
    if (!song?.id) return null;
    return {
        id: song.id,
        name: decodeEntities(song.name),
        artist: decodeEntities(song.artists?.primary?.[0]?.name || song.primaryArtists || "unknown"),
        album: decodeEntities(song.album?.name || ""),
        image: pickImage(song.image),
        duration: Number(song.duration) || 0,
    };
};

export const searchSongs = async (query, { limit = 20 } = {}) => {
    try {
        const res = await getSongsByQuery(query);
        if (!res?.ok) return [];
        const data = await res.json();
        return (data?.data?.results || []).map(normalize).filter(Boolean).slice(0, limit);
    } catch {
        return [];
    }
};

export const getSongInfo = async (id) => {
    try {
        const res = await getSongsById(id);
        if (!res?.ok) return null;
        const data = await res.json();
        return normalize(data?.data?.[0]);
    } catch {
        return null;
    }
};

export const getStreamUrl = async (id) => {
    try {
        const res = await getSongsById(id);
        if (!res?.ok) return { url: null, error: "saavn fetch failed", source: "saavn" };
        const data = await res.json();
        const song = data?.data?.[0];
        const url = pickAudio(song?.downloadUrl);
        if (!url) return { url: null, error: "no downloadUrl", source: "saavn" };
        return { url, bitrate: 320000, mimeType: "audio/mp4", client: "saavn", source: "saavn" };
    } catch (e) {
        return { url: null, error: e.message, source: "saavn" };
    }
};

export const getRelated = async (id, { limit = 20 } = {}) => {
    try {
        const res = await getSongsSuggestions(id);
        if (!res?.ok) return [];
        const data = await res.json();
        return (data?.data || []).map(normalize).filter(Boolean).slice(0, limit);
    } catch {
        return [];
    }
};

// Only JioSaavn provides albums - re-exported as-is
export { searchAlbumByQuery, getAlbumById };

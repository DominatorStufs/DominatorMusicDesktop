// ---------------------------------------------------------------------------
// Audius adapter.
//
// Audius is a decentralised, genuinely open music network. Unlike every other
// source in this app it is not a scrape of a commercial service: artists upload
// their own work and the API is public and documented.
//
// That makes it the only source here that hands back a FULL, unrestricted,
// 320kbps MP3 with no key, no cookie, no rate limit and no IP blocking:
//
//   GET https://api.audius.co/v1/tracks/{id}/stream?app_name=...
//     -> 302 to a content node -> 206 audio/mpeg, 320kbps
//
// Verified from this server, which is the same environment where YouTube
// answers LOGIN_REQUIRED and Spotify refuses to stream at all.
//
// The catalogue is electronic/hip-hop/indie heavy rather than Bollywood, so it
// complements JioSaavn instead of competing with it.
// ---------------------------------------------------------------------------

const APP_NAME = "DominatorMusic";

// The host list is served by api.audius.co itself. It is cached briefly so a
// burst of requests does not re-resolve it every time.
const DISCOVERY_ROOT = "https://api.audius.co";
let hostCache = { hosts: [], at: 0 };
const HOST_TTL = 10 * 60 * 1000;

const getHosts = async () => {
    if (hostCache.hosts.length && Date.now() - hostCache.at < HOST_TTL) {
        return hostCache.hosts;
    }
    try {
        const res = await fetch(DISCOVERY_ROOT, { next: { revalidate: 600 } });
        const json = await res.json();
        const hosts = Array.isArray(json?.data) ? json.data.filter(Boolean) : [];
        if (hosts.length) hostCache = { hosts, at: Date.now() };
        return hosts.length ? hosts : [DISCOVERY_ROOT];
    } catch {
        return [DISCOVERY_ROOT];
    }
};

/** Call an Audius endpoint, trying each discovery node in turn. */
const call = async (path, { timeout = 12000 } = {}) => {
    const hosts = await getHosts();
    let lastError = null;

    for (const host of hosts.slice(0, 3)) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeout);
        try {
            const sep = path.includes("?") ? "&" : "?";
            const res = await fetch(`${host}/${path}${sep}app_name=${APP_NAME}`, {
                signal: ctrl.signal,
                headers: { Accept: "application/json" },
            });
            clearTimeout(timer);
            if (!res.ok) {
                lastError = new Error(`HTTP ${res.status}`);
                continue;
            }
            return await res.json();
        } catch (e) {
            clearTimeout(timer);
            lastError = e;
        }
    }
    if (lastError) throw lastError;
    return null;
};

const artworkOf = (t) =>
    t?.artwork?.["1000x1000"] ||
    t?.artwork?.["480x480"] ||
    t?.artwork?.["150x150"] ||
    "";

/** Map an Audius track into the shape the rest of the app expects. */
const normalize = (t) => {
    if (!t?.id) return null;
    return {
        id: String(t.id),
        name: t.title || "Unknown",
        artist: t.user?.name || t.user?.handle || "unknown",
        album: t.album_backlink?.playlist_name || "",
        image: artworkOf(t),
        duration: Number(t.duration) || 0,
        // Only tracks that are streamable and not gated can actually play.
        playable: Boolean(t.is_streamable) && !t.is_stream_gated,
        permalink: t.permalink || "",
        genre: t.genre || "",
        playCount: Number(t.play_count) || 0,
    };
};

/* --------------------------------- search --------------------------------- */

export const searchSongs = async (query, { limit = 15 } = {}) => {
    if (!query?.trim()) return [];
    const data = await call(
        `v1/tracks/search?query=${encodeURIComponent(query)}&limit=${limit}`
    );
    return (data?.data || [])
        .map(normalize)
        .filter((t) => t && t.playable)
        .slice(0, limit);
};

/* --------------------------------- stream --------------------------------- */

/**
 * Audius returns a 302 to a content node. The URL is handed to the browser
 * directly - it is CORS-friendly and needs no proxy, unlike googlevideo.
 */
export const getStreamUrl = async (id) => {
    if (!id) return { url: null };

    // Confirm the track is actually playable before handing out a URL, so a
    // gated track fails here rather than as a silent 404 in the <audio> tag.
    const info = await getSongInfo(id).catch(() => null);
    if (info && info.playable === false) {
        return { url: null, error: "track is gated or not streamable" };
    }

    const hosts = await getHosts();
    const host = hosts[0] || DISCOVERY_ROOT;
    return {
        url: `${host}/v1/tracks/${encodeURIComponent(id)}/stream?app_name=${APP_NAME}`,
        bitrate: "320kbps",
        // A real, complete file - no preview, no truncation.
        quality: "full",
    };
};

/* ---------------------------------- info ---------------------------------- */

export const getSongInfo = async (id) => {
    if (!id) return null;
    const data = await call(`v1/tracks/${encodeURIComponent(id)}`);
    return normalize(data?.data);
};

/* -------------------------------- related --------------------------------- */

export const getRelated = async (id, { limit = 20 } = {}) => {
    if (!id) return [];
    // Audius has no "related tracks" endpoint, so the artist's other work is
    // the closest honest equivalent.
    const info = await getSongInfo(id).catch(() => null);
    if (!info?.artist) return [];
    const found = await searchSongs(info.artist, { limit: limit + 4 });
    return found.filter((t) => t.id !== String(id)).slice(0, limit);
};

/* ------------------------------ discovery rows ----------------------------- */

/** Trending tracks, optionally within a genre. Good for a home-screen row. */
export const getTrending = async ({ genre = "", limit = 20 } = {}) => {
    const q = genre ? `&genre=${encodeURIComponent(genre)}` : "";
    const data = await call(`v1/tracks/trending?limit=${limit}${q}`);
    return (data?.data || [])
        .map(normalize)
        .filter((t) => t && t.playable)
        .slice(0, limit);
};

/** Tracks trending this week among listeners. */
export const getUnderground = async ({ limit = 20 } = {}) => {
    const data = await call(`v1/tracks/trending/underground?limit=${limit}`);
    return (data?.data || [])
        .map(normalize)
        .filter((t) => t && t.playable)
        .slice(0, limit);
};

export const searchPlaylists = async (query, { limit = 12 } = {}) => {
    if (!query?.trim()) return [];
    const data = await call(
        `v1/playlists/search?query=${encodeURIComponent(query)}&limit=${limit}`
    );
    return (data?.data || [])
        .filter((p) => p?.id)
        .map((p) => ({
            id: String(p.id),
            name: p.playlist_name || "Untitled",
            creator: p.user?.name || "",
            image: artworkOf(p),
            tracks: Number(p.track_count) || 0,
        }));
};

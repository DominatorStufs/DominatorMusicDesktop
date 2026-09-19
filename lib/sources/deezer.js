// ---------------------------------------------------------------------------
// Deezer adapter - public API, no login, no key.
//
// api.deezer.com is genuinely open: search, charts, albums, playlists, artist
// top tracks and ISRC lookup all answer to an anonymous request. What it will
// NOT hand out is a full-length stream - every track carries a 30-second
// `preview` MP3 on cdnt-preview.dzcdn.net and nothing more. Full streams need
// an account's ARL cookie plus Blowfish decryption, which is out of scope here.
//
// So Deezer earns its place for two things:
//
//   1. SEARCH - a large international catalogue that complements JioSaavn's
//      Indian focus, with clean metadata and good artwork.
//   2. ISRC MATCHING - `track/isrc:<ISRC>` is the bridge that lets a track from
//      one service be identified on another. This is exactly the trick the
//      Spotui Android app uses to move a Spotify track onto another provider.
//
// Playback still comes from JioSaavn via the resolver in index.js; the preview
// is available as an instant-start fallback.
//
// Verified working 18 Sept 2026 from a datacenter IP.
// ---------------------------------------------------------------------------

const API = "https://api.deezer.com";
const TIMEOUT = 12000;

const getJson = async (path) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
        const res = await fetch(`${API}/${path}`, {
            headers: { Accept: "application/json" },
            signal: ctrl.signal,
            cache: "no-store",
        });
        if (!res.ok) return null;
        const json = await res.json();
        // Deezer reports failures in the body with HTTP 200.
        if (json?.error && Object.keys(json.error).length) return null;
        return json;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
};

const pickCover = (obj) =>
    obj?.cover_big || obj?.cover_medium || obj?.cover || obj?.picture_big || obj?.picture_medium || "";

const normalize = (t) => {
    if (!t?.id) return null;
    return {
        id: String(t.id),
        name: String(t.title_short || t.title || "").trim(),
        artist: t.artist?.name || "unknown",
        album: t.album?.title || "",
        image: pickCover(t.album) || pickCover(t.artist),
        // Deezer reports duration in seconds already.
        duration: Number(t.duration) || 0,
        // 30-second MP3, free for anyone.
        preview: t.preview || "",
        isrc: t.isrc || "",
        explicit: Boolean(t.explicit_lyrics),
    };
};

/* ------------------------------- searching ------------------------------- */

export const searchSongs = async (query, { limit = 20 } = {}) => {
    if (!query?.trim()) return [];
    const data = await getJson(`search?q=${encodeURIComponent(query)}&limit=${limit}`);
    return (data?.data || []).map(normalize).filter(Boolean);
};

export const searchArtists = async (query, { limit = 10 } = {}) => {
    if (!query?.trim()) return [];
    const data = await getJson(`search/artist?q=${encodeURIComponent(query)}&limit=${limit}`);
    return (data?.data || [])
        .filter((a) => a?.id)
        .map((a) => ({
            id: String(a.id),
            name: a.name,
            image: a.picture_big || a.picture_medium || "",
            fans: Number(a.nb_fan) || 0,
        }));
};

/* -------------------------------- lookups -------------------------------- */

export const getSongInfo = async (id) => normalize(await getJson(`track/${encodeURIComponent(id)}`));

/**
 * Find a track by its ISRC - the recording identifier every service shares.
 * This is what makes a track from Spotify (or anywhere else) findable here.
 */
export const getByIsrc = async (isrc) => {
    if (!isrc?.trim()) return null;
    return normalize(await getJson(`track/isrc:${encodeURIComponent(isrc.trim())}`));
};

/** Deezer never serves a full track anonymously - only the 30-second preview. */
export const getStreamUrl = async (id) => {
    const info = await getSongInfo(id);
    if (!info?.preview) return { url: null, error: "no preview available" };
    return {
        url: info.preview,
        preview: true,
        previewDuration: 30,
        quality: "128kbps",
        note: "Deezer serves a 30-second preview without an account; full playback comes from a matched source.",
    };
};

/** Related tracks: the artist's most popular songs, minus the track itself. */
export const getRelated = async (id, { limit = 20 } = {}) => {
    const track = await getJson(`track/${encodeURIComponent(id)}`);
    const artistId = track?.artist?.id;
    if (!artistId) return [];

    const data = await getJson(`artist/${artistId}/top?limit=${limit + 5}`);
    const self = String(track.title_short || track.title || "").toLowerCase().trim();

    return (data?.data || [])
        .map(normalize)
        .filter(Boolean)
        .filter((t) => t.id !== String(id) && t.name.toLowerCase().trim() !== self)
        .slice(0, limit);
};

/** Artists similar to a given one - Deezer publishes this openly. */
export const getRelatedArtists = async (artistId, { limit = 10 } = {}) => {
    const data = await getJson(`artist/${encodeURIComponent(artistId)}/related?limit=${limit}`);
    return (data?.data || [])
        .filter((a) => a?.id)
        .map((a) => ({
            id: String(a.id),
            name: a.name,
            image: a.picture_big || a.picture_medium || "",
            fans: Number(a.nb_fan) || 0,
        }));
};

/** An artist's most played tracks. */
export const getArtistTop = async (artistId, { limit = 20 } = {}) => {
    const data = await getJson(`artist/${encodeURIComponent(artistId)}/top?limit=${limit}`);
    return (data?.data || []).map(normalize).filter(Boolean);
};

export const searchAlbums = async (query, { limit = 12 } = {}) => {
    if (!query?.trim()) return [];
    const data = await getJson(`search/album?q=${encodeURIComponent(query)}&limit=${limit}`);
    return (data?.data || [])
        .filter((a) => a?.id)
        .map((a) => ({
            id: String(a.id),
            name: a.title,
            artist: a.artist?.name || "",
            image: pickCover(a),
            tracks: Number(a.nb_tracks) || 0,
        }));
};

export const searchPlaylists = async (query, { limit = 12 } = {}) => {
    if (!query?.trim()) return [];
    const data = await getJson(`search/playlist?q=${encodeURIComponent(query)}&limit=${limit}`);
    return (data?.data || [])
        .filter((p) => p?.id)
        .map((p) => ({
            id: String(p.id),
            name: p.title,
            creator: p.user?.name || "",
            image: pickCover(p),
            tracks: Number(p.nb_tracks) || 0,
        }));
};

/* --------------------------- charts & collections --------------------------- */

/**
 * Deezer's genre ids, for chart rows. Fetched live rather than hardcoded so the
 * list cannot go stale.
 */
export const getGenres = async () => {
    const data = await getJson("genre");
    return (data?.data || [])
        .filter((g) => g?.id !== undefined)
        .map((g) => ({ id: String(g.id), name: g.name, image: g.picture_medium || "" }));
};

/** Top albums on the chart. */
export const getChartAlbums = async ({ genre = 0, limit = 20 } = {}) => {
    const data = await getJson(`chart/${genre}/albums?limit=${limit}`);
    return (data?.data || [])
        .filter((a) => a?.id)
        .map((a) => ({
            id: String(a.id),
            name: a.title,
            artist: a.artist?.name || "",
            image: pickCover(a),
        }));
};

/** Top artists on the chart. */
export const getChartArtists = async ({ genre = 0, limit = 20 } = {}) => {
    const data = await getJson(`chart/${genre}/artists?limit=${limit}`);
    return (data?.data || [])
        .filter((a) => a?.id)
        .map((a) => ({
            id: String(a.id),
            name: a.name,
            image: a.picture_big || a.picture_medium || "",
        }));
};


/**
 * Global or genre chart. Deezer's chart endpoint takes a genre id; 0 is "All".
 * Handy for a home-screen row that is not JioSaavn-shaped.
 */
export const getChart = async ({ genre = 0, limit = 20 } = {}) => {
    const data = await getJson(`chart/${genre}/tracks?limit=${limit}`);
    return (data?.data || []).map(normalize).filter(Boolean);
};

export const getAlbum = async (id) => {
    const a = await getJson(`album/${encodeURIComponent(id)}`);
    if (!a?.id) return null;
    return {
        id: String(a.id),
        type: "album",
        name: a.title,
        subtitle: a.artist?.name || "",
        image: pickCover(a),
        releaseDate: a.release_date || "",
        tracks: (a.tracks?.data || [])
            .map((t) => normalize({ ...t, album: { title: a.title, cover_big: pickCover(a) } }))
            .filter(Boolean),
        total: Number(a.nb_tracks) || 0,
    };
};

export const getPlaylist = async (id) => {
    const p = await getJson(`playlist/${encodeURIComponent(id)}`);
    if (!p?.id) return null;
    return {
        id: String(p.id),
        type: "playlist",
        name: p.title,
        subtitle: p.creator?.name || "",
        image: pickCover(p),
        tracks: (p.tracks?.data || []).map(normalize).filter(Boolean),
        total: Number(p.nb_tracks) || 0,
    };
};

/** Recognise a pasted Deezer link. */
export const parseDeezerUrl = (input) => {
    const m = String(input || "").match(
        /deezer\.com\/(?:[a-z]{2}\/)?(track|album|playlist|artist)\/(\d+)/i
    );
    return m ? { type: m[1].toLowerCase(), id: m[2] } : null;
};

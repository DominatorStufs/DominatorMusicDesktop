// ---------------------------------------------------------------------------
// iTunes / Apple Music adapter.
//
// Apple's Search API is genuinely public: no key, no token, no cookie, and no
// rate limit worth worrying about at this scale. It is the cleanest metadata
// source available to this app.
//
//   https://itunes.apple.com/search?term=...&entity=song&country=IN
//
// Two things make it worth having alongside Spotify and Deezer:
//
//   1. Excellent Indian coverage. `country=IN` returns the Hindi catalogue with
//      correct film credits, which Deezer is weak at.
//   2. Every track carries a real 30-second `previewUrl` that streams without
//      any auth, plus 600x600 artwork.
//
// Like Spotify and Deezer this is catalogue-only: playback matches the track
// onto a full-length source first, and falls back to the preview.
// ---------------------------------------------------------------------------

const BASE = "https://itunes.apple.com";

// Apple's catalogue is region-partitioned. India first, since this app's
// primary catalogue is Indian, with a US fallback for international titles.
const DEFAULT_COUNTRY = "IN";

const getJson = async (path, { timeout = 12000 } = {}) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
        const res = await fetch(`${BASE}/${path}`, {
            signal: ctrl.signal,
            headers: { Accept: "application/json" },
            next: { revalidate: 3600 },
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`iTunes HTTP ${res.status}`);
        // Apple sometimes serves text/javascript for this endpoint.
        const text = await res.text();
        return JSON.parse(text);
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
};

/** Upgrade Apple's small artwork URL to something usable on a card. */
const bigArt = (url) =>
    typeof url === "string" ? url.replace(/\/\d+x\d+bb\.(jpg|png)$/, "/600x600bb.$1") : "";

const normalize = (t) => {
    if (!t?.trackId) return null;
    return {
        id: String(t.trackId),
        name: t.trackName || "Unknown",
        artist: t.artistName || "unknown",
        album: t.collectionName || "",
        image: bigArt(t.artworkUrl100 || t.artworkUrl60 || ""),
        // Apple reports milliseconds.
        duration: t.trackTimeMillis ? Math.round(t.trackTimeMillis / 1000) : 0,
        // A real, auth-free 30s preview.
        preview: t.previewUrl || null,
        explicit: t.trackExplicitness === "explicit",
        releaseDate: t.releaseDate || "",
        genre: t.primaryGenreName || "",
    };
};

/* --------------------------------- search --------------------------------- */

export const searchSongs = async (query, { limit = 15, country = DEFAULT_COUNTRY } = {}) => {
    if (!query?.trim()) return [];

    const run = async (c) => {
        const data = await getJson(
            `search?term=${encodeURIComponent(query)}&entity=song&limit=${limit}&country=${c}`
        );
        return (data?.results || []).map(normalize).filter(Boolean);
    };

    let results = await run(country).catch(() => []);
    // An international title may simply not be in the Indian storefront.
    if (!results.length && country !== "US") {
        results = await run("US").catch(() => []);
    }
    return results.slice(0, limit);
};

/* ---------------------------------- info ---------------------------------- */

export const getSongInfo = async (id) => {
    if (!id) return null;
    for (const country of [DEFAULT_COUNTRY, "US"]) {
        try {
            const data = await getJson(`lookup?id=${encodeURIComponent(id)}&country=${country}`);
            const hit = (data?.results || []).find((r) => r?.trackId);
            if (hit) return normalize(hit);
        } catch {
            // try the next storefront
        }
    }
    return null;
};

/**
 * iTunes serves a real 30-second preview with no auth. It is only used when no
 * full-length match can be found on a streaming source.
 */
export const getStreamUrl = async (id) => {
    const info = await getSongInfo(id);
    if (!info?.preview) return { url: null, error: "no preview available" };
    return { url: info.preview, preview: true, previewDuration: 30 };
};

/* -------------------------------- related --------------------------------- */

export const getRelated = async (id, { limit = 20 } = {}) => {
    const info = await getSongInfo(id);
    if (!info?.artist) return [];
    const found = await searchSongs(info.artist, { limit: limit + 4 });
    return found.filter((t) => t.id !== String(id)).slice(0, limit);
};

/* ------------------------------ extra lookups ------------------------------ */

export const searchAlbums = async (query, { limit = 12, country = DEFAULT_COUNTRY } = {}) => {
    if (!query?.trim()) return [];
    const data = await getJson(
        `search?term=${encodeURIComponent(query)}&entity=album&limit=${limit}&country=${country}`
    ).catch(() => null);
    return (data?.results || [])
        .filter((a) => a?.collectionId)
        .map((a) => ({
            id: String(a.collectionId),
            name: a.collectionName,
            artist: a.artistName || "",
            image: bigArt(a.artworkUrl100 || ""),
            tracks: Number(a.trackCount) || 0,
            releaseDate: a.releaseDate || "",
        }));
};

export const searchArtists = async (query, { limit = 12, country = DEFAULT_COUNTRY } = {}) => {
    if (!query?.trim()) return [];
    const data = await getJson(
        `search?term=${encodeURIComponent(query)}&entity=musicArtist&limit=${limit}&country=${country}`
    ).catch(() => null);
    return (data?.results || [])
        .filter((a) => a?.artistId)
        .map((a) => ({
            id: String(a.artistId),
            name: a.artistName,
            genre: a.primaryGenreName || "",
            link: a.artistLinkUrl || "",
        }));
};

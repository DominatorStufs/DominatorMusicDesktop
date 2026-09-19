// ---------------------------------------------------------------------------
// Invidious - a third route to YouTube data, alongside InnerTube and Piped.
//
// Invidious runs the extraction on its own server and returns CORS-friendly
// JSON, much like Piped. It is worth having because the three fail in different
// ways: InnerTube is blocked by IP, Piped instances go down in waves, and
// Invidious instances survive somewhat independently of both.
//
// Reality check from live probing: Invidious SEARCH works reliably, but the
// `adaptiveFormats` on /videos/{id} usually come back empty from a datacenter
// IP, exactly like InnerTube. So this module is registered as a search and
// metadata provider, and its stream lookup is best-effort rather than relied on.
//
// The instance list is fetched from the official directory so it cannot rot.
// ---------------------------------------------------------------------------

const DIRECTORY = "https://api.invidious.io/instances.json?pretty=1&sort_by=type,users";

// Known-good fallbacks, used if the directory itself is unreachable.
const SEED_INSTANCES = [
    "https://invidious.f5.si",
    "https://yewtu.be",
    "https://inv.nadeko.net",
    "https://invidious.nerdvpn.de",
];

const TIMEOUT = 9000;

let instanceCache = { list: [], at: 0 };
const TTL = 15 * 60 * 1000;

/** Public https instances that have their API enabled. */
const getInstances = async () => {
    if (instanceCache.list.length && Date.now() - instanceCache.at < TTL) {
        return instanceCache.list;
    }
    try {
        const res = await fetch(DIRECTORY, {
            signal: AbortSignal.timeout(TIMEOUT),
            next: { revalidate: 900 },
        });
        if (!res.ok) throw new Error(`directory ${res.status}`);
        const rows = await res.json();
        const list = (Array.isArray(rows) ? rows : [])
            .filter(([, info]) => info?.type === "https" && info?.api)
            .map(([, info]) => info.uri?.replace(/\/$/, ""))
            .filter(Boolean);
        const merged = [...new Set([...list, ...SEED_INSTANCES])];
        if (merged.length) instanceCache = { list: merged, at: Date.now() };
        return merged;
    } catch {
        return SEED_INSTANCES;
    }
};

/** Try each instance until one answers with a usable shape. */
const race = async (path, validate) => {
    const instances = (await getInstances()).slice(0, 5);
    const attempts = instances.map(async (base) => {
        const res = await fetch(`${base}${path}`, {
            signal: AbortSignal.timeout(TIMEOUT),
            headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`${base} -> ${res.status}`);
        const json = await res.json();
        if (json?.error) throw new Error(`${base} -> ${json.error}`);
        if (!validate(json)) throw new Error(`${base} -> unusable shape`);
        return { json, base };
    });
    try {
        return await Promise.any(attempts);
    } catch {
        return null;
    }
};

const thumbOf = (v) => {
    const t = v?.videoThumbnails;
    if (Array.isArray(t) && t.length) {
        const best = t.find((x) => x.quality === "maxresdefault") || t[0];
        return best?.url || "";
    }
    return v?.videoId ? `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg` : "";
};

const normalize = (v) => {
    if (!v?.videoId) return null;
    return {
        id: v.videoId,
        name: v.title || "Unknown",
        artist: v.author || "unknown",
        album: "",
        image: thumbOf(v),
        duration: Number(v.lengthSeconds) || 0,
    };
};

/* --------------------------------- search --------------------------------- */

export const searchSongs = async (query, { limit = 15 } = {}) => {
    if (!query?.trim()) return [];
    const hit = await race(
        `/api/v1/search?q=${encodeURIComponent(query)}&type=video&sort_by=relevance`,
        (j) => Array.isArray(j)
    );
    if (!hit) return [];
    return hit.json
        .filter((v) => v?.type === "video" || v?.videoId)
        .map(normalize)
        .filter(Boolean)
        .slice(0, limit);
};

/* ---------------------------------- info ---------------------------------- */

export const getSongInfo = async (id) => {
    if (!id) return null;
    const hit = await race(`/api/v1/videos/${encodeURIComponent(id)}`, (j) => j?.videoId);
    return hit ? normalize(hit.json) : null;
};

/* --------------------------------- stream --------------------------------- */

/**
 * Best-effort only. From a datacenter IP `adaptiveFormats` is normally empty,
 * the same block InnerTube hits, so the caller must be ready for a null URL.
 */
export const getStreamUrl = async (id) => {
    if (!id) return { url: null };
    const hit = await race(`/api/v1/videos/${encodeURIComponent(id)}`, (j) => j?.videoId);
    if (!hit) return { url: null, error: "all invidious instances failed" };

    const formats = Array.isArray(hit.json.adaptiveFormats) ? hit.json.adaptiveFormats : [];
    const audio = formats
        .filter((f) => typeof f.type === "string" && f.type.startsWith("audio/"))
        .sort((a, b) => (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0));

    if (!audio.length) {
        return { url: null, error: "no audio formats (instance is IP-blocked by YouTube)" };
    }
    return {
        url: audio[0].url,
        bitrate: audio[0].bitrate ? `${Math.round(Number(audio[0].bitrate) / 1000)}kbps` : undefined,
        instance: hit.base,
    };
};

/* -------------------------------- related --------------------------------- */

export const getRelated = async (id, { limit = 20 } = {}) => {
    if (!id) return [];
    const hit = await race(`/api/v1/videos/${encodeURIComponent(id)}`, (j) => j?.videoId);
    const rec = hit?.json?.recommendedVideos;
    if (Array.isArray(rec) && rec.length) {
        return rec.map(normalize).filter(Boolean).slice(0, limit);
    }
    // No recommendations - fall back to the uploader's other work.
    const info = hit ? normalize(hit.json) : null;
    if (!info?.artist) return [];
    const found = await searchSongs(info.artist, { limit: limit + 4 });
    return found.filter((t) => t.id !== id).slice(0, limit);
};

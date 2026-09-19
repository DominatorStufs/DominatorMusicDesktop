// ---------------------------------------------------------------------------
// Piped - also serves YouTube data, but through a proxy server.
// Metrolist/InnerTune call InnerTube directly from inside the app; Piped does
// that same work on its own server and returns CORS-friendly JSON.
//
// We use it as an extra fallback layer for the "YouTube" source:
//   InnerTube fails -> try Piped -> that fails too -> JioSaavn
//
// Instances are often down or rate-limited, so we keep a list and race them,
// using whichever responds first (Promise.any style).
// ---------------------------------------------------------------------------

export const PIPED_INSTANCES = [
    "https://api.piped.private.coffee",
    "https://pipedapi.ducks.party",
    "https://pipedapi.adminforge.de",
    "https://pipedapi.reallyaweso.me",
    "https://pipedapi.kavin.rocks",
];

const TIMEOUT = 8000;

const tryInstance = async (base, path) => {
    const res = await fetch(`${base}${path}`, {
        signal: AbortSignal.timeout(TIMEOUT),
        headers: { Accept: "application/json" },
        next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`${base} → ${res.status}`);
    const json = await res.json();
    if (json?.error) throw new Error(`${base} → ${json.error}`);
    return json;
};

// Whichever instance returns a valid response first wins
const raceInstances = async (path, validate) => {
    const attempts = PIPED_INSTANCES.map(async (base) => {
        const json = await tryInstance(base, path);
        if (!validate(json)) throw new Error(`${base} → invalid shape`);
        return { json, base };
    });
    try {
        return await Promise.any(attempts);
    } catch {
        return null;
    }
};

const thumb = (url) => url || "";

/** Search for songs (music filter) */
export const searchSongs = async (query, { limit = 20 } = {}) => {
    const hit = await raceInstances(
        `/search?q=${encodeURIComponent(query)}&filter=music_songs`,
        (j) => Array.isArray(j?.items)
    );
    if (!hit) return [];

    return hit.json.items
        .filter((i) => i?.url?.includes("watch?v=") || i?.type === "stream")
        .map((i) => ({
            id: (i.url || "").split("watch?v=")[1]?.split("&")[0] || "",
            name: i.title || "",
            artist: (i.uploaderName || "unknown").replace(/ - Topic$/, ""),
            album: "",
            image: thumb(i.thumbnail),
            duration: i.duration || 0,
        }))
        .filter((t) => t.id && t.name)
        .slice(0, limit);
};

/** Audio stream URL - best available bitrate */
export const getStreamUrl = async (videoId) => {
    const hit = await raceInstances(
        `/streams/${videoId}`,
        (j) => Array.isArray(j?.audioStreams) && j.audioStreams.length > 0
    );
    if (!hit) return { url: null, error: "all piped instances failed", source: "piped" };

    // Prefer m4a/AAC over webm/opus — see note in innertube.js.
    // Opus is higher quality but Safari and iOS cannot play it.
    const byBitrate = (a, b) => (b.bitrate || 0) - (a.bitrate || 0);
    const streams = hit.json.audioStreams;
    const mp4 = streams.filter((s) => (s.mimeType || "").includes("mp4")).sort(byBitrate);
    const best = mp4.length ? mp4[0] : [...streams].sort(byBitrate)[0];
    return {
        url: best.url,
        bitrate: best.bitrate,
        mimeType: best.mimeType || "audio/mp4",
        client: hit.base,
        source: "piped",
    };
};

/** Basic video metadata */
export const getSongInfo = async (videoId) => {
    const hit = await raceInstances(`/streams/${videoId}`, (j) => !!j?.title);
    if (!hit) return null;
    const j = hit.json;
    return {
        id: videoId,
        name: j.title,
        artist: (j.uploader || "unknown").replace(/ - Topic$/, ""),
        image: thumb(j.thumbnailUrl),
        duration: j.duration || 0,
    };
};

/** Related songs */
export const getRelated = async (videoId, { limit = 20 } = {}) => {
    const hit = await raceInstances(`/streams/${videoId}`, (j) => Array.isArray(j?.relatedStreams));
    if (!hit) return [];
    return hit.json.relatedStreams
        .filter((i) => i?.type === "stream" && i?.url?.includes("watch?v="))
        .map((i) => ({
            id: i.url.split("watch?v=")[1]?.split("&")[0] || "",
            name: i.title || "",
            artist: (i.uploaderName || "unknown").replace(/ - Topic$/, ""),
            image: thumb(i.thumbnail),
            duration: i.duration || 0,
        }))
        .filter((t) => t.id)
        .slice(0, limit);
};

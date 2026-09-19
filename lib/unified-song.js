// ---------------------------------------------------------------------------
// Helper used by the real Player and Search pages so they can handle songs
// from ALL three sources (JioSaavn, InnerTube/YouTube Music, Piped/YouTube).
//
// Existing JioSaavn IDs keep working exactly as before - a plain id like
// "aRZbUYD7" is still treated as JioSaavn, so nothing breaks.
//
// YouTube songs use a composite id such as "innertube:BjL7AuPsmEk".
// ---------------------------------------------------------------------------

/**
 * Normalise an id coming from a URL segment.
 *
 * Composite ids contain a colon ("innertube:RTIX2qjczJM"). Depending on how the
 * user navigated, Next.js hands that colon over either raw or percent-encoded
 * as "%3A". Every check below is written against the raw form, so an encoded id
 * silently failed `isYouTubeId`, fell through to the JioSaavn code path, got a
 * 404 and left the player stuck on a blank skeleton. Decoding first fixes it.
 */
export const normalizeId = (id) => {
    if (typeof id !== "string") return id;
    let out = id;
    // Decode repeatedly - a double-encoded id ("%253A") shows up occasionally.
    for (let i = 0; i < 3 && /%[0-9a-f]{2}/i.test(out); i++) {
        try {
            const decoded = decodeURIComponent(out);
            if (decoded === out) break;
            out = decoded;
        } catch {
            break;
        }
    }
    return out;
};

/** Every id prefix the unified sources layer understands. */
const PREFIXES = ["innertube", "piped", "invidious", "saavn", "spotify", "deezer", "audius", "itunes"];

/** True if this id belongs to a YouTube-based source. */
export const isYouTubeId = (id) => {
    const v = normalizeId(id);
    return typeof v === "string" && (v.startsWith("innertube:") || v.startsWith("piped:"));
};

/**
 * True if this id must be resolved through the unified sources layer.
 *
 * Both players used to gate on `isYouTubeId`, which is only true for
 * innertube: and piped:. A Spotify or Deezer id therefore fell through to the
 * legacy JioSaavn code path, which called getSongsById("spotify:xyz") - an id
 * JioSaavn has never heard of. The track either failed outright or silently
 * became a JioSaavn song, and because the legacy path hardcodes
 * setSongSource("saavn") the player then reported JioSaavn for a song the user
 * had picked from Spotify or Deezer.
 *
 * Any prefixed id ("source:rawid") belongs to the unified layer. A bare id with
 * no colon is a legacy JioSaavn id and keeps its original path.
 */
export const isUnifiedId = (id) => {
    const v = normalizeId(id);
    return typeof v === "string" && v.includes(":") && PREFIXES.some((p) => v.startsWith(`${p}:`));
};

/**
 * Which source an id belongs to.
 *
 * Every known prefix must be listed here. Spotify and Deezer were missing, so
 * a Spotify track reported itself as JioSaavn and the player badged it wrongly.
 * A bare id with no prefix is a legacy JioSaavn id.
 */
export const sourceOf = (rawId) => {
    const id = normalizeId(rawId);
    if (typeof id !== "string") return "saavn";
    const found = PREFIXES.find((p) => id.startsWith(`${p}:`));
    return found || "saavn";
};

/**
 * Resolutions already made this session, keyed by composite id.
 *
 * Both players call loadUnifiedSong independently: the mini bar in
 * app/(root)/layout.jsx and the full-screen page in app/(player)/[id]. Without
 * this cache, expanding a track to full screen re-ran the whole resolver and
 * could land on a DIFFERENT source than the one already playing - a YouTube
 * track that streamed fine in the bar would re-resolve, hit a transient
 * LOGIN_REQUIRED, fall back to a JioSaavn match, and the full-screen view would
 * then report JioSaavn for a song the user had picked from YouTube.
 *
 * Resolving once and reusing the result keeps the two views telling the same
 * story, and skips a redundant round trip.
 */
const resolved = new Map();

/** Forget a cached resolution, so the next load genuinely retries. */
export const invalidateSong = (rawId) => {
    resolved.delete(normalizeId(rawId));
};

/**
 * Fetch a song + its playable audio URL from any source.
 *
 * Returns a shape that mimics the JioSaavn song object the existing UI already
 * understands, so the Player component needs only minimal changes:
 *
 *   { id, name, image: [{url}...], artists: { primary: [{name}] }, ... }
 */
export const loadUnifiedSong = async (rawCompositeId) => {
    const compositeId = normalizeId(rawCompositeId);
    const source = sourceOf(compositeId);

    // --- Plain JioSaavn: let the caller use its existing code path ---
    if (source === "saavn" && !compositeId.includes(":")) {
        return null;
    }

    // Reuse an earlier resolution of this exact track (see `resolved` above).
    if (resolved.has(compositeId)) {
        const hit = resolved.get(compositeId);
        // `fromCache` lets the caller skip a toast it has already shown.
        return { ...hit, fromCache: true };
    }

    const rawId = compositeId.includes(":")
        ? compositeId.slice(compositeId.indexOf(":") + 1)
        : compositeId;

    // A single cold request can fail while the server is still warming up or
    // when the network blips, which previously surfaced as a flat
    // "Could not play this track". Retry briefly before giving up.
    const fetchJson = async (url, attempts = 3) => {
        let lastError = null;
        for (let i = 0; i < attempts; i++) {
            try {
                const res = await fetch(url, { cache: "no-store" });
                if (!res.ok) {
                    lastError = new Error(`HTTP ${res.status}`);
                } else {
                    return await res.json();
                }
            } catch (e) {
                lastError = e;
            }
            // Back off a little between tries
            if (i < attempts - 1) {
                await new Promise((r) => setTimeout(r, 400 * (i + 1)));
            }
        }
        if (lastError) console.warn(`[unified-song] ${url} failed:`, lastError.message);
        return null;
    };

    // Metadata
    let info = null;
    const infoJson = await fetchJson(`/api/music/info?id=${encodeURIComponent(compositeId)}`);
    if (infoJson?.success) info = infoJson.song;

    // Stream URL (with the full fallback chain server-side)
    let stream = null;
    const params = new URLSearchParams({ id: compositeId });
    if (info?.name) params.set("name", info.name);
    if (info?.artist) params.set("artist", info.artist);
    if (info?.duration) params.set("duration", String(info.duration));
    const streamJson = await fetchJson(`/api/music/stream?${params}`);
    if (streamJson?.success) stream = streamJson;

    // Last resort: if the unified stream lookup failed but we know the title,
    // search JioSaavn directly so a known song still plays.
    if (!stream?.url && info?.name) {
        const q = `${info.name} ${info.artist && info.artist !== "unknown" ? info.artist : ""}`.trim();
        const alt = await fetchJson(
            `/api/music/search?q=${encodeURIComponent(q)}&limit=5&sources=saavn`,
            2
        );
        const hit = (alt?.results || []).find((r) => r?.id?.startsWith("saavn:"));
        if (hit) {
            const direct = await fetchJson(
                `/api/music/stream?id=${encodeURIComponent(hit.id)}`,
                2
            );
            if (direct?.success && direct.url) {
                stream = {
                    ...direct,
                    resolvedFrom: "saavn-match",
                    // A different recording to the one requested - flag it so
                    // the player can say so instead of pretending otherwise.
                    substituted: true,
                    approximate: true,
                    matchedTo: { id: hit.id, name: hit.name, artist: hit.artist },
                };
            }
        }
    }

    if (!info && !stream) return null;

    const image = info?.image || "";
    // Only YouTube URLs need the proxy (CORS + Referer checks + the bounded-range
    // quirk). Audius, JioSaavn and the preview CDNs all play directly.
    const needsProxy = ["innertube", "piped", "invidious"].includes(stream?.resolvedFrom);
    const audioUrl = stream?.url
        ? needsProxy
            ? `/api/music/proxy?url=${encodeURIComponent(stream.url)}`
            : stream.url
        : "";

    const result = {
        // JioSaavn-compatible shape so existing UI code keeps working
        id: compositeId,
        name: info?.name || "Unknown",
        image: [{ url: image }, { url: image }, { url: image }],
        artists: { primary: [{ name: info?.artist || "unknown" }] },
        album: { name: info?.album || "" },
        duration: info?.duration || 0,

        // extras used by the multi-source UI
        audioUrl,

        // The source the user actually picked. This never changes because of a
        // fallback, so the UI can keep showing "YouTube Music" for a track
        // chosen from YouTube Music even when the bytes came from elsewhere.
        requestedSource: source,
        // Where the audio physically came from.
        playbackSource: stream?.resolvedFrom || source,
        source: stream?.resolvedFrom || source,
        bitrate: stream?.bitrate,
        matchedTo: stream?.matchedTo || null,
        // True when the audio is a DIFFERENT recording to the one requested,
        // because the chosen source could not serve it.
        // Spotify / Deezer are catalogue-only by design, so a match there is
        // expected rather than a failure of the chosen source.
        metadataOnly: Boolean(stream?.metadataOnly),
        substituted: Boolean(stream?.substituted),
        substitutedFrom: stream?.substitutedFrom || null,
        approximate: Boolean(stream?.approximate),
        // True when only the first ~60s of the YouTube stream is reachable.
        truncated: Boolean(stream?.truncated),
        preview: Boolean(stream?.preview),
        rawId,
    };

    // Only cache a usable result - a failed lookup should be retried.
    if (result.audioUrl) resolved.set(compositeId, result);

    return result;
};

// ---------------------------------------------------------------------------
// Spotify adapter - metadata only, no login required.
//
// Spotify's own APIs are closed: `open.spotify.com/api/token` now answers
// "Unauthorized request" without an `sp_dc` session cookie, and there is no
// public way to stream a full track. What DOES still answer to anyone is the
// oEmbed + embed pages that power the little "listen on Spotify" widgets:
//
//   https://open.spotify.com/embed/track/<id>
//   https://open.spotify.com/embed/album/<id>
//   https://open.spotify.com/embed/playlist/<id>
//
// Each returns a normal HTML page with a `__NEXT_DATA__` script tag holding a
// clean JSON entity: title, artists, duration, cover art, and - for albums and
// playlists - the complete track list. Every track also carries a 30-second
// `audioPreview` MP3 hosted on p.scdn.co.
//
// So this source gives the app Spotify's catalogue and artwork for free. Full
// playback comes from the existing sources: lib/sources/index.js matches the
// Spotify track to JioSaavn and plays that instead, exactly the way the Spotui
// Android app matches Spotify metadata onto a different audio provider.
//
// Verified working 18 Sept 2026 from a datacenter IP.
// ---------------------------------------------------------------------------

const EMBED_BASE = "https://open.spotify.com/embed";

// The embed pages are served to browsers; a desktop UA keeps the markup stable.
const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const TIMEOUT = 12000;

const fetchText = async (url) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
        const res = await fetch(url, {
            headers: { "User-Agent": UA, Accept: "text/html,application/json" },
            signal: ctrl.signal,
            cache: "no-store",
        });
        if (!res.ok) return null;
        return await res.text();
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
};

/** Pull the `__NEXT_DATA__` payload out of an embed page. */
const parseEmbed = (html) => {
    if (!html) return null;
    const m = html.match(
        /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
    );
    if (!m) return null;
    try {
        const data = JSON.parse(m[1]);
        return data?.props?.pageProps?.state?.data?.entity || null;
    } catch {
        return null;
    }
};

const fetchEntity = async (type, id) => {
    if (!id) return null;
    return parseEmbed(await fetchText(`${EMBED_BASE}/${type}/${encodeURIComponent(id)}`));
};

/* ----------------------------- normalizing ----------------------------- */

const pickLargest = (list) => {
    if (!Array.isArray(list) || !list.length) return "";
    // Entries are ordered small -> large; prefer the biggest one that declares
    // a size, otherwise take the last (playlists often report null dimensions).
    const sized = list.filter((s) => s?.width);
    const pick = sized.length ? sized[sized.length - 1] : list[list.length - 1];
    return pick?.url || "";
};

/**
 * Artwork lives in two different places depending on the entity: albums and
 * playlists expose `coverArt.sources`, while a single track only carries it
 * under `visualIdentity.image`.
 */
const bestCover = (entity) =>
    pickLargest(entity?.coverArt?.sources) || pickLargest(entity?.visualIdentity?.image);

/** Spotify joins artists with a non-breaking space; normalise to plain commas. */
const cleanArtists = (subtitle) =>
    String(subtitle || "")
        .replace(/\u00a0/g, " ")
        .replace(/\s*,\s*/g, ", ")
        .trim();

const idFromUri = (uri) => String(uri || "").split(":").pop() || "";

/** Shape a track from a `trackList` entry into the app's common format. */
const normalizeTrackListItem = (t, cover) => {
    const id = idFromUri(t?.uri);
    if (!id) return null;
    return {
        id,
        name: String(t?.title || "").trim(),
        artist: cleanArtists(t?.subtitle) || "unknown",
        album: "",
        image: cover || "",
        duration: Math.round(Number(t?.duration || 0) / 1000),
        // 30-second MP3 Spotify serves to anyone. Useful as an instant preview
        // while the full track is being matched on another source.
        preview: t?.audioPreview?.url || "",
        explicit: Boolean(t?.isExplicit),
    };
};

/** Shape a track entity (from /embed/track) into the app's common format. */
const normalizeTrackEntity = (e) => {
    if (!e) return null;
    const id = e.id || idFromUri(e.uri);
    if (!id) return null;
    return {
        id,
        name: String(e.name || e.title || "").trim(),
        artist:
            (Array.isArray(e.artists) && e.artists.map((a) => a?.name).filter(Boolean).join(", ")) ||
            cleanArtists(e.subtitle) ||
            "unknown",
        album: "",
        image: bestCover(e),
        duration: Math.round(Number(e.duration || 0) / 1000),
        preview: e.audioPreview?.url || "",
        explicit: Boolean(e.isExplicit),
        releaseDate: e.releaseDate?.isoString || "",
    };
};

/* -------------------------------- links -------------------------------- */

/**
 * Recognise any Spotify reference a user might paste:
 *   https://open.spotify.com/track/ID        (with or without /intl-xx/)
 *   https://open.spotify.com/playlist/ID?si=...
 *   spotify:album:ID
 */
export const parseSpotifyUrl = (input) => {
    const raw = String(input || "").trim();
    if (!raw) return null;

    const uri = raw.match(/^spotify:(track|album|playlist|artist):([A-Za-z0-9]+)/i);
    if (uri) return { type: uri[1].toLowerCase(), id: uri[2] };

    const url = raw.match(
        /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|artist)\/([A-Za-z0-9]+)/i
    );
    if (url) return { type: url[1].toLowerCase(), id: url[2] };

    return null;
};

export const isSpotifyUrl = (input) => Boolean(parseSpotifyUrl(input));

/* ------------------------------- lookups ------------------------------- */

/** A single track's metadata. */
export const getSongInfo = async (id) => normalizeTrackEntity(await fetchEntity("track", id));

/**
 * Spotify has no open search endpoint, so this source contributes catalogue
 * data rather than search results. Returning an empty list keeps it safely
 * pluggable into searchAll() alongside the sources that can search.
 */
export const searchSongs = async () => [];

/**
 * Spotify never hands out a full-length stream, only the 30-second preview.
 * The resolver in lib/sources/index.js is responsible for matching the track
 * onto a source that can actually play it; the preview is returned here so a
 * caller can start something immediately if it wants to.
 */
export const getStreamUrl = async (id) => {
    const info = await getSongInfo(id);
    if (!info?.preview) return { url: null, error: "no preview available" };
    return {
        url: info.preview,
        preview: true,
        previewDuration: 30,
        quality: "96kbps",
        note: "Spotify only serves a 30-second preview; full playback comes from a matched source.",
    };
};

/** Spotify's embed data carries no recommendations. */
export const getRelated = async () => [];

/* --------------------------- albums & playlists --------------------------- */

/** Fetch an album or playlist with its full track list. */
export const getCollection = async (type, id) => {
    if (type !== "album" && type !== "playlist") return null;

    const e = await fetchEntity(type, id);
    if (!e) return null;

    const cover = bestCover(e);
    const tracks = (Array.isArray(e.trackList) ? e.trackList : [])
        .map((t) => normalizeTrackListItem(t, cover))
        .filter(Boolean);

    return {
        id: e.id || id,
        type,
        name: String(e.name || e.title || "").trim(),
        subtitle: cleanArtists(e.subtitle),
        image: cover,
        releaseDate: e.releaseDate?.isoString || "",
        tracks,
        total: tracks.length,
    };
};

export const getAlbum = (id) => getCollection("album", id);
export const getPlaylist = (id) => getCollection("playlist", id);

/** Resolve any pasted Spotify link to either a track or a collection. */
export const resolveLink = async (input) => {
    const parsed = parseSpotifyUrl(input);
    if (!parsed) return null;

    if (parsed.type === "track") {
        const track = await getSongInfo(parsed.id);
        return track ? { type: "track", track } : null;
    }
    if (parsed.type === "album" || parsed.type === "playlist") {
        const collection = await getCollection(parsed.type, parsed.id);
        return collection ? { type: parsed.type, collection } : null;
    }
    // Artist pages have no embed entity worth importing.
    return null;
};

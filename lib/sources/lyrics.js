// ---------------------------------------------------------------------------
// Synced lyrics - LRCLIB.
//
// Every open-source music player that shows scrolling lyrics (Navidrome,
// Feishin, Metrolist, Spotui) eventually lands on the same problem: Spotify's
// lyrics come from Musixmatch and need an `sp_dc` account cookie, Musixmatch's
// own API needs a rotating token, and Genius has no timing data.
//
// LRCLIB (https://lrclib.net) solves it: a community lyrics database, fully
// open, no key, no login, no rate-limit token - and it returns real LRC timing
// data, so lyrics can scroll in time with the track.
//
// Matching is by artist + title, optionally narrowed by album and duration.
// Passing the duration matters: it is what separates the original recording
// from a remix or a live take of the same name.
//
// Verified working 18 Sept 2026.
// ---------------------------------------------------------------------------

const API = "https://lrclib.net/api";
const TIMEOUT = 10000;

// LRCLIB asks clients to identify themselves.
const UA = "DominatorMusic (https://github.com/dominator-music)";

const getJson = async (path) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
        const res = await fetch(`${API}/${path}`, {
            headers: { Accept: "application/json", "User-Agent": UA },
            signal: ctrl.signal,
            cache: "no-store",
        });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
};

/**
 * Turn an LRC string into timed lines the UI can scroll through.
 *
 *   "[00:11.20] Hum tere bin ab reh nahi sakte"
 *     -> { time: 11.2, text: "Hum tere bin ab reh nahi sakte" }
 */
export const parseLrc = (lrc) => {
    if (!lrc) return [];

    const lines = [];
    for (const raw of String(lrc).split(/\r?\n/)) {
        // A line can carry several timestamps for a repeated chorus.
        const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
        if (!stamps.length) continue;

        const text = raw.replace(/\[[^\]]*\]/g, "").trim();
        for (const m of stamps) {
            const min = Number(m[1]) || 0;
            const sec = Number(m[2]) || 0;
            // Fractions can be 2 or 3 digits; normalise both to seconds.
            const frac = m[3] ? Number(m[3]) / 10 ** m[3].length : 0;
            lines.push({ time: min * 60 + sec + frac, text });
        }
    }

    // Blank lines are kept: they are the instrumental gaps, and dropping them
    // makes the highlight jump ahead of the music.
    return lines.sort((a, b) => a.time - b.time);
};

const shape = (row) => {
    if (!row?.id) return null;
    const synced = row.syncedLyrics || "";
    return {
        id: String(row.id),
        name: row.trackName || row.name || "",
        artist: row.artistName || "",
        album: row.albumName || "",
        duration: Math.round(Number(row.duration) || 0),
        instrumental: Boolean(row.instrumental),
        plain: row.plainLyrics || "",
        synced,
        lines: parseLrc(synced),
        hasSynced: Boolean(synced),
        provider: "LRCLIB",
    };
};

/**
 * Exact lookup. Supplying `duration` makes LRCLIB return the take that actually
 * matches the recording rather than any song with the same name.
 */
export const getLyrics = async ({ artist, track, album, duration } = {}) => {
    if (!artist?.trim() || !track?.trim()) return null;

    const params = new URLSearchParams({
        artist_name: artist.trim(),
        track_name: track.trim(),
    });
    if (album?.trim()) params.set("album_name", album.trim());
    if (duration) params.set("duration", String(Math.round(duration)));

    const exact = shape(await getJson(`get?${params}`));
    if (exact) return exact;

    // The exact endpoint is strict - if the album or duration is slightly off it
    // returns nothing at all. Fall back to a search and pick the best row.
    return searchBest({ artist, track, duration });
};

/** Free-text search, returning every candidate LRCLIB knows about. */
export const searchLyrics = async ({ artist, track, q } = {}) => {
    const params = new URLSearchParams();
    if (q?.trim()) params.set("q", q.trim());
    else {
        if (track?.trim()) params.set("track_name", track.trim());
        if (artist?.trim()) params.set("artist_name", artist.trim());
    }
    if (![...params].length) return [];

    const rows = await getJson(`search?${params}`);
    return Array.isArray(rows) ? rows.map(shape).filter(Boolean) : [];
};

/**
 * Search, then pick the best candidate: prefer a synced result whose runtime
 * matches the track being played.
 */
export const searchBest = async ({ artist, track, duration } = {}) => {
    let rows = await searchLyrics({ artist, track });
    if (!rows.length && track) rows = await searchLyrics({ q: `${track} ${artist || ""}`.trim() });
    if (!rows.length) return null;

    const want = Number(duration) || 0;
    const score = (r) => {
        let pts = 0;
        if (r.hasSynced) pts += 50; // timed lyrics are the whole point
        if (want && r.duration) {
            const diff = Math.abs(r.duration - want);
            if (diff <= 2) pts += 60;
            else if (diff <= 6) pts += 30;
            else if (diff > 30) pts -= 40;
        }
        if (artist && r.artist) {
            const a = r.artist.toLowerCase();
            const b = artist.toLowerCase();
            if (a === b) pts += 30;
            else if (a.includes(b) || b.includes(a)) pts += 15;
        }
        if (r.instrumental) pts -= 20;
        return pts;
    };

    return rows.slice().sort((x, y) => score(y) - score(x))[0] || null;
};

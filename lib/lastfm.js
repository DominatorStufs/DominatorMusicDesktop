// ---------------------------------------------------------------------------
// Last.fm scrobbling - client-side helpers.
//
// Each user brings their OWN Last.fm API key and shared secret, entered in
// Settings and kept in this browser's localStorage. Nothing is stored on the
// server.
//
// The secret is still never used to build a signature in the browser: the
// signature has to be md5'd and the Last.fm write endpoints do not send CORS
// headers, so every signed call is proxied through /api/lastfm/*. Those routes
// sign the request with the credentials passed in and immediately forget them -
// they are never written to disk or logged.
//
// Docs: https://www.last.fm/api/scrobbling
// ---------------------------------------------------------------------------

const SESSION_KEY = "lastfm-session";
const CREDS_KEY = "lastfm-creds";

/* --------------------------- credentials --------------------------- */

export const getCreds = () => {
    try {
        const raw = localStorage.getItem(CREDS_KEY);
        const c = raw ? JSON.parse(raw) : null;
        return c?.apiKey && c?.apiSecret ? c : null;
    } catch (e) {
        return null;
    }
};

export const saveCreds = ({ apiKey, apiSecret }) => {
    try {
        localStorage.setItem(
            CREDS_KEY,
            JSON.stringify({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim() })
        );
        return true;
    } catch (e) {
        return false;
    }
};

export const clearCreds = () => {
    try {
        localStorage.removeItem(CREDS_KEY);
    } catch (e) { }
};

export const hasCreds = () => Boolean(getCreds());

/* ------------------------------ session ------------------------------ */

export const getSession = () => {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
};

export const saveSession = (session) => {
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) { }
};

export const clearSession = () => {
    try {
        localStorage.removeItem(SESSION_KEY);
    } catch (e) { }
};

export const isConnected = () => Boolean(getSession()?.key);

/* --------------------------- title cleaning --------------------------- */

/**
 * JioSaavn titles carry film/album qualifiers that Last.fm does not use:
 *
 *   'Kesariya (From "Brahmastra")'  ->  'Kesariya'
 *   'Tum Hi Ho - Aashiqui 2'        ->  'Tum Hi Ho'
 *   'Naatu Naatu (Lyrical Video)'   ->  'Naatu Naatu'
 *
 * Scrobbling the raw title produces entries that never match the real track,
 * so the user's Last.fm profile fills up with junk. Strip the qualifiers, but
 * keep anything that is genuinely part of the name (a remix, a live version)
 * because those ARE separate tracks on Last.fm.
 */
// "version" is deliberately NOT here. JioSaavn tags re-masters as
// "- New Version", which is the same recording and must be stripped, while
// genuine variants ("Acoustic Version", "Unplugged Version") are still caught
// by their own keyword.
const KEEP = /\b(remix|mix|live|acoustic|unplugged|instrumental|cover|reprise)\b/i;

export const cleanTitle = (raw) => {
    let t = String(raw || "").trim();
    if (!t) return "";

    // Drop bracketed qualifiers unless they name a real alternate version.
    t = t.replace(/\s*[([]([^)\]]*)[)\]]/g, (match, inner) =>
        KEEP.test(inner) ? match : ""
    );

    // Drop a trailing " - Something" unless it names a real alternate version.
    t = t.replace(/\s+-\s+(.+)$/, (match, tail) => (KEEP.test(tail) ? match : ""));

    return t.replace(/\s{2,}/g, " ").trim() || String(raw || "").trim();
};

/**
 * Artist fields often hold several names ("Pritam, Arijit Singh"). Last.fm
 * matches best against the first credited artist.
 */
export const cleanArtist = (raw) => {
    const first = String(raw || "")
        .split(/\s*[,&;]\s*|\s+feat\.?\s+|\s+ft\.?\s+/i)
        .map((s) => s.trim())
        .filter(Boolean)[0];
    return first || "";
};

/* ------------------------------ requests ------------------------------ */

const post = async (path, body) => {
    const creds = getCreds();
    const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ...body,
            // Sent per request; the server keeps no copy.
            apiKey: creds?.apiKey,
            apiSecret: creds?.apiSecret,
        }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.error) {
        const err = new Error(json?.message || `Last.fm request failed (${res.status})`);
        err.status = res.status;
        err.code = json?.code;
        throw err;
    }
    return json;
};

/** Exchange the one-time auth token for a permanent session key. */
export const exchangeToken = async (token) => {
    const creds = getCreds();
    if (!creds) throw new Error("Add your Last.fm API key first.");
    const json = await post("/api/lastfm/session", { token });
    if (!json?.key) throw new Error("Last.fm did not return a session key.");
    saveSession({ key: json.key, name: json.name });
    return json;
};

/** Tell Last.fm what is playing right now (shows the "scrobbling now" badge). */
export const updateNowPlaying = async (song) => {
    if (!getCreds() || !getSession()?.key || !song?.name) return;

    const artist = cleanArtist(song.artist);
    if (!artist) return;

    try {
        await post("/api/lastfm/now-playing", {
            sessionKey: getSession().key,
            artist,
            track: cleanTitle(song.name),
            album: song.album ? cleanTitle(song.album) : undefined,
            duration: song.duration || undefined,
        });
    } catch (e) {
        // Now-playing is cosmetic; never surface an error for it.
    }
};

/**
 * Submit a completed play.
 *
 * Last.fm's rules: a track counts once it has been played for at least half
 * its length, or 4 minutes, whichever comes first, and it must be longer than
 * 30 seconds. Enforcing this here keeps the profile honest and avoids the API
 * rejecting the request.
 */
export const shouldScrobble = (seconds, duration) => {
    if (!seconds || seconds < 30) return false;
    if (!duration || duration <= 30) return false;
    return seconds >= Math.min(duration / 2, 240);
};

export const scrobble = async (song, seconds) => {
    if (!getCreds() || !getSession()?.key || !song?.name) return false;
    if (!shouldScrobble(seconds, song.duration)) return false;

    const artist = cleanArtist(song.artist);
    if (!artist) return false;

    try {
        await post("/api/lastfm/scrobble", {
            sessionKey: getSession().key,
            artist,
            track: cleanTitle(song.name),
            album: song.album ? cleanTitle(song.album) : undefined,
            // Last.fm wants the time the track STARTED, in seconds.
            timestamp: Math.floor((Date.now() - seconds * 1000) / 1000),
            duration: song.duration || undefined,
        });
        return true;
    } catch (e) {
        // Queue it so a failed scrobble is not simply lost.
        queueFailed(song, seconds);
        return false;
    }
};

/* --------------------------- offline queue --------------------------- */

const QUEUE_KEY = "lastfm-queue";

const readQueue = () => {
    try {
        return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    } catch (e) {
        return [];
    }
};

const writeQueue = (q) => {
    try {
        // Last.fm accepts backdated scrobbles, but keep the queue bounded.
        localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-50)));
    } catch (e) { }
};

const queueFailed = (song, seconds) => {
    const q = readQueue();
    q.push({
        artist: cleanArtist(song.artist),
        track: cleanTitle(song.name),
        album: song.album ? cleanTitle(song.album) : undefined,
        timestamp: Math.floor((Date.now() - seconds * 1000) / 1000),
        duration: song.duration || undefined,
    });
    writeQueue(q);
};

/** Retry anything that failed while offline. Safe to call repeatedly. */
export const flushQueue = async () => {
    const session = getSession();
    const q = readQueue();
    if (!getCreds() || !session?.key || !q.length) return 0;

    const remaining = [];
    let sent = 0;
    for (const item of q) {
        try {
            await post("/api/lastfm/scrobble", { sessionKey: session.key, ...item });
            sent += 1;
        } catch (e) {
            remaining.push(item);
        }
    }
    writeQueue(remaining);
    return sent;
};

export const queueSize = () => readQueue().length;

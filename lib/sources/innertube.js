// ---------------------------------------------------------------------------
// InnerTube client - the same approach Metrolist / InnerTune / OuterTune use.
//
// This is YouTube's private internal API (youtubei/v1). No API key needs to be
// registered - we simply identify ourselves as an official "YouTube Music app"
// client by sending the right client name, version and user-agent.
//
// Reference: z-huang/InnerTune -> innertube/models/YouTubeClient.kt
//            MetrolistGroup/innertubex
//
// IMPORTANT: this file runs on the SERVER only (via the app/api/music routes).
// It cannot be called directly from the browser because YouTube sends no CORS
// headers.
// ---------------------------------------------------------------------------

const BASE = "https://music.youtube.com/youtubei/v1";
const YT_BASE = "https://www.youtube.com/youtubei/v1";

// Clients - same idea as InnerTune/Metrolist, but with versions updated for 2026.
//
// LESSON LEARNED: sending an outdated clientVersion makes YouTube reply with
// "400 Precondition check failed". Keeping these current is essential.
// The IOS client is currently the most reliable one for streaming
// (verified 17 Sept 2026).
export const CLIENTS = {
    // Works best for streaming
    IOS: {
        host: "www.youtube.com",
        userAgent: "com.google.ios.youtube/20.03.02 (iPhone16,2; U; CPU iOS 18_2_1 like Mac OS X;)",
        context: {
            client: {
                clientName: "IOS",
                clientVersion: "20.03.02",
                deviceMake: "Apple",
                deviceModel: "iPhone16,2",
                osName: "iPhone",
                osVersion: "18.2.1.22C161",
            },
        },
    },
    ANDROID_MUSIC: {
        host: "music.youtube.com",
        userAgent:
            "com.google.android.apps.youtube.music/8.12.53 (Linux; U; Android 14; IN; Pixel 8) gzip",
        context: {
            client: {
                clientName: "ANDROID_MUSIC",
                clientVersion: "8.12.53",
                androidSdkVersion: 34,
                osName: "Android",
                osVersion: "14",
            },
        },
    },
    // Best for search - returns the richest metadata
    WEB_REMIX: {
        host: "music.youtube.com",
        userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        referer: "https://music.youtube.com/",
        context: {
            client: {
                clientName: "WEB_REMIX",
                clientVersion: "1.20241209.01.00",
            },
        },
    },
    TVHTML5: {
        host: "www.youtube.com",
        userAgent: "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version",
        context: {
            client: {
                clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
                clientVersion: "2.0",
            },
        },
    },
};

const buildBody = (clientName, locale, extra = {}) => {
    const c = CLIENTS[clientName];
    return {
        context: {
            client: {
                ...c.context.client,
                hl: locale?.hl || "en",
                gl: locale?.gl || "IN",
                // Real devices always report these; their absence is a tell.
                timeZone: "Asia/Kolkata",
                utcOffsetMinutes: 330,
                visitorData: DEVICE_SESSION.visitorId,
            },
            user: { lockedSafetyMode: false },
            request: { useSsl: true, internalExperimentFlags: [], consistencyTokenJars: [] },
        },
        ...extra,
    };
};

// YouTube identifies clients by a numeric id, not just by name. Sending the
// wrong number (everything was hardcoded to "1" = WEB) contradicts the
// user-agent and context we send, which is an obvious bot signal. These are the
// official values used by the real apps.
const CLIENT_IDS = {
    IOS: "5",
    ANDROID_MUSIC: "21",
    WEB_REMIX: "67",
    TVHTML5: "85",
};

// A stable per-process "device" so repeated calls look like one phone rather
// than a fresh anonymous client every single time.
const DEVICE_SESSION = (() => {
    const hex = (n) =>
        Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    return {
        visitorId: `Cgt${hex(11)}`,
        sessionId: hex(16),
        // Content playback nonce - the real apps send one per playback request.
        cpn: () => {
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
            return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * 64)]).join("");
        },
    };
})();

const call = async (endpoint, clientName, extra, { locale } = {}) => {
    const c = CLIENTS[clientName];
    const host = c.host || "www.youtube.com";
    const clientId = CLIENT_IDS[clientName] || "1";
    // NOTE: we no longer send the `key` query param - modern InnerTube does not
    // need it, and sending an old hardcoded key is exactly what triggered the
    // "Precondition check failed" error.
    const res = await fetch(`https://${host}/youtubei/v1/${endpoint}?prettyPrint=false`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "User-Agent": c.userAgent,
            // Identity headers must agree with the context we send below.
            "X-YouTube-Client-Name": clientId,
            "X-YouTube-Client-Version": c.context.client.clientVersion,
            "X-Goog-Visitor-Id": DEVICE_SESSION.visitorId,
            "X-Goog-Api-Format-Version": "2",
            "Accept-Language": `${locale?.hl || "en"}-${locale?.gl || "IN"},${locale?.hl || "en"};q=0.9`,
            "Accept-Encoding": "gzip, deflate",
            Accept: "*/*",
            Origin: `https://${host}`,
            ...(c.referer ? { Referer: c.referer } : {}),
        },
        body: JSON.stringify(buildBody(clientName, locale, extra)),
        // Next.js cache - avoid hitting YouTube repeatedly for the same query
        next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`InnerTube ${endpoint} → HTTP ${res.status}`);
    return res.json();
};

export { DEVICE_SESSION };

// --------------------------- Response parsing ------------------------------
// InnerTube responses are deeply nested. This helper recursively collects every
// value stored under a given key, which keeps parsing resilient when YouTube
// tweaks its response structure (which it does often).
const findAll = (obj, key, out = []) => {
    if (!obj || typeof obj !== "object") return out;
    if (Array.isArray(obj)) {
        for (const item of obj) findAll(item, key, out);
        return out;
    }
    for (const [k, v] of Object.entries(obj)) {
        if (k === key) out.push(v);
        else findAll(v, key, out);
    }
    return out;
};

const runsToText = (runs) =>
    Array.isArray(runs) ? runs.map((r) => r?.text || "").join("") : "";

const pickThumb = (thumbnails) => {
    if (!Array.isArray(thumbnails) || !thumbnails.length) return "";
    const sorted = [...thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0));
    // Trick to upscale YouTube thumbnails - rewrite w60-h60 to w544-h544
    return (sorted[0]?.url || "").replace(/w\d+-h\d+/, "w544-h544");
};

// musicResponsiveListItemRenderer → normalized track
const parseListItem = (item) => {
    try {
        const videoId =
            findAll(item, "videoId")[0] ||
            findAll(item, "playlistItemData")[0]?.videoId;
        if (!videoId) return null;

        const flex = item.flexColumns || [];
        const title = runsToText(
            flex[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
        );
        if (!title) return null;

        const subRuns =
            flex[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
        const subText = runsToText(subRuns);
        // Usually looks like "Artist - Album - 3:45"
        const parts = subText.split(" • ").map((s) => s.trim()).filter(Boolean);
        const durationStr = parts.find((p) => /^\d+:\d{2}$/.test(p)) || "";
        const artist =
            subRuns.find((r) => r?.navigationEndpoint?.browseEndpoint?.browseId?.startsWith("UC"))
                ?.text || parts[0] || "unknown";

        const toSec = (s) => {
            const p = s.split(":").map(Number);
            return p.length === 2 ? p[0] * 60 + p[1] : p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : 0;
        };

        return {
            id: videoId,
            name: title,
            artist,
            album: parts.length > 2 ? parts[1] : "",
            image: pickThumb(findAll(item, "thumbnails")[0]),
            duration: toSec(durationStr),
        };
    } catch {
        return null;
    }
};

// Pick a format the browser can actually play.
// Order of preference:
//   1. audio/mp4 (AAC)  — universally supported (Chrome, Safari, Firefox, iOS)
//   2. audio/webm (Opus) — great quality but unsupported on Safari/iOS
// Within each group we still take the highest bitrate.
const pickPlayableFormat = (formats) => {
    const byBitrate = (a, b) => (b.bitrate || 0) - (a.bitrate || 0);
    const mp4 = formats.filter((f) => f.mimeType?.includes("mp4")).sort(byBitrate);
    if (mp4.length) return mp4[0];
    return [...formats].sort(byBitrate)[0];
};

// ------------------------------ Public API ---------------------------------

/** Search songs using YouTube Music's "Songs" filter */
export const searchSongs = async (query, { limit = 20, locale } = {}) => {
    // this params value is the "Songs" tab filter
    const data = await call(
        "search",
        "WEB_REMIX",
        { query, params: "EgWKAQIIAWoKEAoQCRADEAQQBQ%3D%3D" },
        { locale }
    );
    const items = findAll(data, "musicResponsiveListItemRenderer");
    const seen = new Set();
    const out = [];
    for (const it of items) {
        const t = parseListItem(it);
        if (t && !seen.has(t.id)) {
            seen.add(t.id);
            out.push(t);
            if (out.length >= limit) break;
        }
    }
    return out;
};

/** Metadata for a single video */
/**
 * Public oEmbed metadata.
 *
 * This is the important one for server deployments. The `player` endpoint is
 * behind YouTube's bot check and returns LOGIN_REQUIRED from a datacenter IP,
 * but oEmbed is a plain public endpoint with no such check - it answers 200
 * from Vercel just as happily as from a phone. Without it a hosted instance
 * cannot learn a track's title, so it can never look the song up on JioSaavn
 * either, and playback fails for every YouTube result.
 */
const getOEmbedInfo = async (videoId) => {
    try {
        const res = await fetch(
            `https://www.youtube.com/oembed?url=${encodeURIComponent(
                `https://www.youtube.com/watch?v=${videoId}`
            )}&format=json`,
            {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                    Accept: "application/json",
                },
                next: { revalidate: 3600 },
            }
        );
        if (!res.ok) return null;
        const d = await res.json();
        if (!d?.title) return null;
        return {
            id: videoId,
            name: d.title,
            artist: (d.author_name || "unknown").replace(/ - Topic$/, ""),
            image: d.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
            // oEmbed carries no duration; callers treat 0 as "unknown".
            duration: 0,
            playabilityStatus: null,
            via: "oembed",
        };
    } catch {
        return null;
    }
};

export const getSongInfo = async (videoId, { locale } = {}) => {
    for (const client of ["IOS", "ANDROID_MUSIC", "WEB_REMIX"]) {
        try {
            const data = await call("player", client, { videoId, contentCheckOk: true, racyCheckOk: true }, { locale });
            const vd = data?.videoDetails;
            if (!vd) continue;
            return {
                id: vd.videoId,
                name: vd.title,
                artist: vd.author?.replace(/ - Topic$/, "") || "unknown",
                image: pickThumb(vd.thumbnail?.thumbnails),
                duration: Number(vd.lengthSeconds) || 0,
                playabilityStatus: data?.playabilityStatus?.status || null,
            };
        } catch {
            continue;
        }
    }
    // Every player client refused (datacenter IP). Fall back to oEmbed so we
    // at least know the title and artist.
    return getOEmbedInfo(videoId);
};

export { getOEmbedInfo };

/**
 * Try to extract an audio stream URL, attempting multiple clients in order -
 * exactly how Metrolist / InnerTune do it.
 *
 * HEADS UP: this can still fail from a datacenter IP (Vercel/AWS), where
 * YouTube replies with LOGIN_REQUIRED ("Sign in to confirm you're not a bot").
 * Metrolist avoids this because it runs on the user's PHONE, on a residential
 * IP.
 *
 * That is why lib/sources/index.js falls back to JioSaavn - if no stream can be
 * resolved here, the song still plays from JioSaavn instead.
 */
export const getStreamUrl = async (videoId, { locale } = {}) => {
    const errors = [];
    for (const client of ["IOS", "ANDROID_MUSIC", "TVHTML5", "WEB_REMIX"]) {
        try {
            const data = await call(
                "player",
                client,
                {
                    videoId,
                    contentCheckOk: true,
                    racyCheckOk: true,
                    // `cpn` is the content playback nonce every real client
                    // generates per playback; omitting it is a bot signal.
                    cpn: DEVICE_SESSION.cpn(),
                    playbackContext: {
                        contentPlaybackContext: {
                            html5Preference: "HTML5_PREF_WANTS",
                            signatureTimestamp: 20123,
                            referer: "https://www.youtube.com/",
                            autoCaptionsDefaultOn: false,
                            autonavState: "STATE_OFF",
                        },
                    },
                },
                { locale }
            );

            const status = data?.playabilityStatus?.status;
            if (status && status !== "OK") {
                errors.push(`${client}:${status}`);
                continue;
            }

            const formats = [
                ...(data?.streamingData?.adaptiveFormats || []),
                ...(data?.streamingData?.formats || []),
            ].filter((f) => f?.mimeType?.startsWith("audio") && f?.url);

            if (!formats.length) {
                // No direct url means SABR / cipher protection kicked in
                errors.push(`${client}:no-direct-url`);
                continue;
            }

            // IMPORTANT: do NOT just pick the highest bitrate.
            // YouTube's top audio format is usually itag 251 (audio/webm; opus),
            // which Safari / iOS / some Android browsers cannot decode — that
            // caused "no supported source was found" in the player.
            // So we prefer audio/mp4 (AAC, itag 140) which plays everywhere,
            // and only fall back to webm if no mp4 is available.
            const best = pickPlayableFormat(formats);
            return {
                url: best.url,
                bitrate: best.bitrate,
                mimeType: best.mimeType,
                client,
                source: "innertube",
            };
        } catch (e) {
            errors.push(`${client}:${e.message}`);
        }
    }
    return { url: null, error: errors.join(" | "), source: "innertube" };
};

/** Related / next songs - used to build a radio queue */
export const getRelated = async (videoId, { locale, limit = 20 } = {}) => {
    try {
        const data = await call("next", "WEB_REMIX", { videoId, isAudioOnly: true }, { locale });
        const items = findAll(data, "playlistPanelVideoRenderer");
        const out = [];
        const seen = new Set([videoId]);
        for (const it of items) {
            const id = it?.videoId;
            if (!id || seen.has(id)) continue;
            seen.add(id);
            out.push({
                id,
                name: runsToText(it?.title?.runs),
                artist: runsToText(it?.shortBylineText?.runs) || "unknown",
                image: pickThumb(it?.thumbnail?.thumbnails),
                duration: 0,
            });
            if (out.length >= limit) break;
        }
        return out;
    } catch {
        return [];
    }
};

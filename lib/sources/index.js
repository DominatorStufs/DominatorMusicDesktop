// ---------------------------------------------------------------------------
// Unified music source layer - all three working together.
//
//   saavn     -> JioSaavn (your existing source, Indian catalogue, direct mp3)
//   innertube -> YouTube InnerTube (the Metrolist / InnerTune approach)
//   piped     -> YouTube via Piped proxy (CORS-friendly InnerTube fallback)
//   deezer    -> Deezer public API (big international catalogue, ISRC bridge)
//   spotify   -> Spotify embed data (catalogue + artwork, link import)
//
// Deezer and Spotify are METADATA sources: neither hands out a full-length
// stream to an anonymous client, only a 30-second preview. They widen what the
// app can find and display, and resolveStream() matches their tracks onto
// JioSaavn for real playback - the same approach the Spotui Android app uses.
//
// Two modes:
//   searchAll()     -> parallel search across all three, merged + deduped
//   resolveStream() -> playable URL with an automatic fallback chain
//
// Design rule: if any source fails the others keep working. Nothing throws -
// every function always returns a safe empty value.
// ---------------------------------------------------------------------------

import * as saavn from "./saavn";
import * as innertube from "./innertube";
import * as piped from "./piped";
import * as deezer from "./deezer";
import * as spotify from "./spotify";
import * as audius from "./audius";
import * as itunes from "./itunes";
import * as invidious from "./invidious";
import { resolveViaMatch, findOnSaavn } from "./match";

export const SOURCES = {
    saavn,
    innertube,
    piped,
    invidious,
    audius,
    deezer,
    spotify,
    itunes,
};

export const SOURCE_LABELS = {
    saavn: "JioSaavn",
    innertube: "YouTube Music",
    piped: "YouTube",
    invidious: "YouTube (Invidious)",
    audius: "Audius",
    deezer: "Deezer",
    spotify: "Spotify",
    itunes: "Apple Music",
};

/**
 * Sources that can return a full-length, playable stream on their own.
 *
 * Audius belongs here without caveats: it is a decentralised, open network
 * whose API hands back a complete 320kbps MP3 with no key and no IP blocking -
 * the only source in this list that is not fighting an anti-bot system.
 */
export const PLAYABLE_SOURCES = ["saavn", "innertube", "piped", "invidious", "audius"];

/**
 * Sources that only describe a track (and offer a 30s preview). A track from
 * one of these has to be matched onto a playable source before it can be heard.
 */
export const METADATA_SOURCES = ["deezer", "spotify", "itunes"];

/** The three clients that all ultimately read YouTube. */
export const YOUTUBE_SOURCES = ["innertube", "piped", "invidious"];

// Composite ID - so we always know which source a track came from.
// Format: "saavn:abc123" / "innertube:BjL7AuPsmEk"
export const makeId = (source, id) => `${source}:${id}`;

/** Decode a percent-encoded id ("innertube%3Axyz") before parsing it. */
const decodeId = (v) => {
    if (typeof v !== "string") return v;
    let out = v;
    for (let i = 0; i < 3 && /%[0-9a-f]{2}/i.test(out); i++) {
        try {
            const d = decodeURIComponent(out);
            if (d === out) break;
            out = d;
        } catch {
            break;
        }
    }
    return out;
};

export const parseId = (rawComposite) => {
    const composite = decodeId(rawComposite);
    if (typeof composite !== "string") return { source: "saavn", id: String(composite || "") };
    const idx = composite.indexOf(":");
    if (idx === -1) return { source: "saavn", id: composite }; // legacy plain IDs = saavn
    const source = composite.slice(0, idx);
    const id = composite.slice(idx + 1);
    return SOURCES[source] ? { source, id } : { source: "saavn", id: composite };
};

const settle = async (promise, fallback) => {
    try {
        return await promise;
    } catch {
        return fallback;
    }
};

/**
 * Search all three sources at once.
 * Every result carries a `source` field and a composite `id`.
 *
 * @param {string} query
 * @param {object} opts
 * @param {string[]} opts.sources  which sources to use (default: all three)
 * @param {number}   opts.limit    per-source limit
 */
export const searchAll = async (query, { sources = ["saavn", "innertube", "piped", "deezer", "audius", "itunes"], limit = 15 } = {}) => {
    if (!query?.trim()) return { results: [], bySource: {}, errors: {} };

    const picked = sources.filter((s) => SOURCES[s]);

    const settled = await Promise.all(
        picked.map(async (name) => {
            const t0 = Date.now();
            const items = await settle(SOURCES[name].searchSongs(query, { limit }), []);
            return {
                name,
                ms: Date.now() - t0,
                items: items.map((it) => ({
                    ...it,
                    source: name,
                    sourceLabel: SOURCE_LABELS[name],
                    id: makeId(name, it.id),
                    rawId: it.id,
                })),
            };
        })
    );

    const bySource = {};
    const errors = {};
    for (const s of settled) {
        bySource[s.name] = s.items;
        if (!s.items.length) errors[s.name] = "no results";
    }

    // Merge order follows how reliably a source can actually be PLAYED, so the
    // most useful results sit at the top:
    //   saavn    - direct, full length
    //   audius   - direct, full length, never blocked
    //   youtube  - full length when the IP is not blocked
    //   deezer / itunes - catalogue only, need a match before they can play
    // Duplicate tracks (same name + artist) are removed.
    const order = ["saavn", "audius", "innertube", "piped", "invidious", "deezer", "itunes"]
        .filter((s) => picked.includes(s));
    const seen = new Set();
    const results = [];
    const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 28);

    for (const name of order) {
        for (const item of bySource[name] || []) {
            const key = `${norm(item.name)}|${norm(item.artist)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            results.push(item);
        }
    }

    return { results, bySource, errors };
};

/**
 * Resolve a playable URL for a track, with a fallback chain.
 *
 * For YouTube tracks:
 *   1. Try InnerTube (the Metrolist approach)
 *   2. If that fails, try Piped
 *   3. If that fails too, search the same song on JioSaavn and play that
 *
 * Step 3 matters because YouTube often blocks datacenter IPs (Vercel/AWS).
 * Thanks to it the user never sees a dead player - something always plays.
 */
export const resolveStream = async (compositeId, meta = {}) => {
    const { source, id } = parseId(compositeId);

    // JioSaavn - direct, no fallback needed
    if (source === "saavn") {
        const r = await settle(saavn.getStreamUrl(id), { url: null });
        return { ...r, source: "saavn", resolvedFrom: "saavn" };
    }

    // Audius - direct, full length, and it is never IP-blocked, so there is
    // nothing to fall back to. If the track is gated the error is honest.
    if (source === "audius") {
        const r = await settle(audius.getStreamUrl(id), { url: null });
        return { ...r, source: "audius", resolvedFrom: "audius" };
    }

    // Spotify / Deezer / Apple Music describe the track but never serve a full
    // stream, so the same recording is looked up on JioSaavn and played from
    // there. If no confident match exists the caller gets the 30s preview.
    if (source === "spotify" || source === "deezer" || source === "itunes") {
        const info =
            (await settle(SOURCES[source].getSongInfo(id), null)) ||
            (meta.name ? { name: meta.name, artist: meta.artist, duration: meta.duration } : null);
        const result = await resolveViaMatch(info, SOURCE_LABELS[source]);
        return { ...result, source };
    }

    // ------------------------------------------------------------------
    // YouTube track.
    //
    // SOURCE FIDELITY RULE: if the user picked a YouTube result, try YouTube
    // FIRST. Silently swapping in a JioSaavn recording is wrong - it can be a
    // different take, a different mix, or a different language, and the user
    // has no idea it happened.
    //
    // Only when YouTube genuinely refuses (which is common from a datacenter
    // IP - "LOGIN_REQUIRED" / "Sign in to confirm you're not a bot") do we look
    // for the same song on JioSaavn, and the response then says so explicitly
    // via `substituted: true` so the UI can tell the user.
    //
    // Pass `preferMatch: true` to opt back into match-first behaviour.
    // ------------------------------------------------------------------

    let title = meta.name;
    let artist = meta.artist;

    const loadInfo = async () => {
        if (title) return;
        // getSongInfo falls back to the public oEmbed endpoint, which still
        // answers from a datacenter IP even when every player client is blocked.
        const info =
            (await settle(innertube.getSongInfo(id), null)) ||
            (await settle(piped.getSongInfo(id), null));
        title = info?.name;
        artist = info?.artist;
        if (!meta.duration && info?.duration) meta = { ...meta, duration: info.duration };
    };

    /** Look for the same recording on JioSaavn. Returns null when unsure. */
    const tryMatch = async ({ relaxed = false } = {}) => {
        await loadInfo();
        if (!title) return null;

        const match = await findOnSaavn(
            { title, artist, duration: meta.duration },
            { minScore: relaxed ? 25 : 40 }
        );
        if (!match) return null;
        if (!relaxed && !match.confident) return null;
        // Even a relaxed pass must not hand back a different artist's cover.
        if (relaxed && match.artistConflict) return null;

        const stream = await settle(saavn.getStreamUrl(match.song.id), { url: null });
        if (!stream?.url) return null;

        return {
            ...stream,
            resolvedFrom: "saavn-match",
            // The user asked for a YouTube track and is getting a different
            // recording. Always surface that.
            substituted: true,
            substitutedFrom: SOURCE_LABELS[source],
            approximate: relaxed,
            matchScore: match.score,
            matchedTo: {
                id: makeId("saavn", match.song.id),
                name: match.song.name,
                artist: match.song.artist,
            },
        };
    };

    // Opt-in: caller explicitly wants the best-quality full-length version
    // rather than the exact source they clicked.
    if (meta.preferMatch) {
        const matched = await tryMatch();
        if (matched) return { ...matched, tried: ["preferMatch: matched on JioSaavn first"] };
    }

    // 1. The source the user actually chose, then the other YouTube clients.
    //
    // All three read the same YouTube catalogue but fail independently:
    // InnerTube is blocked per-IP, Piped instances go down in waves, and
    // Invidious instances survive somewhat separately from both. Trying the
    // chosen one first keeps source fidelity; the others are a free retry on
    // the SAME recording, so none of this counts as a substitution.
    const chain = [source, ...YOUTUBE_SOURCES.filter((s) => s !== source)];
    const tried = [];

    for (const s of chain) {
        const r = await settle(SOURCES[s].getStreamUrl(id), { url: null, error: "threw" });
        if (r?.url) {
            return {
                ...r,
                source,
                resolvedFrom: s,
                substituted: false,
                // From a datacenter IP googlevideo often serves only the first
                // ~1MB (about a minute). On a residential IP it is the full file.
                truncated: true,
                note: "Streamed from YouTube - a server IP may only receive the first minute.",
                tried,
            };
        }
        tried.push(`${s}: ${r?.error || "no url"}`);
    }

    // 2. YouTube refused. Fall back to a confident JioSaavn match.
    const matched = await tryMatch();
    if (matched) {
        return {
            ...matched,
            source,
            tried: [...tried, "saavn-match: YouTube unavailable, played a matching recording"],
        };
    }

    // 3. Last resort - a looser match, still artist-checked.
    const relaxed = await tryMatch({ relaxed: true });
    if (relaxed) {
        return {
            ...relaxed,
            source,
            tried: [...tried, "saavn-match (relaxed): YouTube refused every client"],
        };
    }

    return {
        url: null,
        error: "all sources failed",
        tried: [...tried, "saavn-match: no match found"],
        resolvedFrom: null,
    };
};

/** Get track metadata from any source */
export const getInfo = async (compositeId) => {
    const { source, id } = parseId(compositeId);
    const info = await settle(SOURCES[source].getSongInfo(id), null);
    if (!info) return null;
    return { ...info, source, sourceLabel: SOURCE_LABELS[source], id: makeId(source, id), rawId: id };
};

/** Related / radio - from its own source, falling back to JioSaavn */
export const getRelated = async (compositeId, { limit = 20 } = {}) => {
    const { source, id } = parseId(compositeId);
    let items = await settle(SOURCES[source].getRelated(id, { limit }), []);

    // Nothing from the track's own source. Before falling back to JioSaavn,
    // try the OTHER clients of the same service - a YouTube track should stay
    // on YouTube, otherwise the queue silently drifts to a different catalogue
    // and the next song plays from somewhere the user never chose.
    if (!items.length && YOUTUBE_SOURCES.includes(source)) {
        for (const sibling of YOUTUBE_SOURCES.filter((x) => x !== source)) {
            const sib = await settle(SOURCES[sibling].getRelated(id, { limit }), []);
            if (sib.length) {
                return sib.slice(0, limit).map((it) => ({
                    ...it,
                    source: sibling,
                    sourceLabel: SOURCE_LABELS[sibling],
                    id: makeId(sibling, it.id),
                    rawId: it.id,
                }));
            }
        }

        // Still nothing - search YouTube itself by artist, so the queue keeps
        // serving YouTube tracks rather than jumping to JioSaavn.
        const info = await settle(SOURCES[source].getSongInfo(id), null);
        if (info?.artist) {
            const yt = await settle(
                SOURCES[source].searchSongs(info.artist, { limit: limit + 6 }),
                []
            );
            const self = (info.name || "").toLowerCase().trim();
            const kept = yt.filter(
                (it) => (it.name || "").toLowerCase().trim() !== self && it.id !== id
            );
            if (kept.length) {
                return kept.slice(0, limit).map((it) => ({
                    ...it,
                    source,
                    sourceLabel: SOURCE_LABELS[source],
                    id: makeId(source, it.id),
                    rawId: it.id,
                }));
            }
        }
    }

    if (!items.length && source !== "saavn") {
        const info = await settle(SOURCES[source].getSongInfo(id), null);
        if (info?.name) {
            // Search by ARTIST first, not by title. Searching the title just
            // returns ten copies of the same song, which is not a
            // recommendation. The title is only a last resort.
            const queries = [info.artist, `${info.name} ${info.artist || ""}`.trim()].filter(Boolean);
            let found = [];
            for (const q of queries) {
                found = await settle(saavn.searchSongs(q, { limit: limit + 6 }), []);
                if (found.length) break;
            }
            // Drop anything with the same title as the track being played.
            const self = (info.name || "").toLowerCase().trim();
            const deduped = [];
            const seen = new Set();
            for (const it of found) {
                const title = (it.name || "").toLowerCase().trim();
                if (title === self) continue;
                if (seen.has(it.id)) continue;
                seen.add(it.id);
                deduped.push(it);
            }
            return (deduped.length ? deduped : found).slice(0, limit).map((it) => ({
                ...it,
                source: "saavn",
                sourceLabel: SOURCE_LABELS.saavn,
                id: makeId("saavn", it.id),
                rawId: it.id,
            }));
        }
    }

    return items.map((it) => ({
        ...it,
        source,
        sourceLabel: SOURCE_LABELS[source],
        id: makeId(source, it.id),
        rawId: it.id,
    }));
};

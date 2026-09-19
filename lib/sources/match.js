// ---------------------------------------------------------------------------
// Cross-source track matching.
//
// Spotify and Deezer describe a track but will not stream it. To actually play
// one, the same recording has to be found on a source that does serve audio -
// JioSaavn, in this app. That is the same bridge the Spotui Android app builds
// between Spotify metadata and its audio providers.
//
// Two ways to identify "the same recording":
//
//   1. ISRC - the industry's recording id. Exact, when both sides publish it.
//      Deezer exposes it (`track/isrc:<ISRC>`); JioSaavn does not, so ISRC is
//      used to hop between metadata services rather than to reach playback.
//
//   2. Scored text match - title + artist + duration. Fuzzy, but it is what
//      works against JioSaavn. The scoring below is deliberately strict: a
//      wrong song is a worse outcome than an honest "not found".
// ---------------------------------------------------------------------------

import * as saavn from "./saavn";

/* ------------------------------ normalizing ------------------------------ */

/**
 * Strip the decoration services add to titles so two spellings of the same
 * song line up: "Kesariya (From \"Brahmastra\")" and "Kesariya - Official
 * Video" both reduce to "kesariya".
 */
export const cleanTitle = (raw) =>
    String(raw || "")
        .replace(/\((?:from|feat|ft|with|official|full|lyrical|audio|video|hd|4k)[^)]*\)/gi, "")
        .replace(/\[(?:from|feat|ft|with|official|full|lyrical|audio|video|hd|4k)[^\]]*\]/gi, "")
        .replace(/\b(?:official\s+(?:music\s+)?video|lyric(?:al)?\s+video|full\s+video|audio|hd|4k)\b/gi, "")
        .replace(/\|.*$/, "")
        .replace(/\s*-\s*(?:official|full|lyrical|audio|video|from)\b.*$/i, "")
        .replace(/\s+/g, " ")
        .trim();

/** Keep only the first credited artist - the one services agree on. */
export const cleanArtist = (raw) =>
    String(raw || "")
        .replace(/\u00a0/g, " ")
        .split(/\s*[,&;]\s*|\s+feat\.?\s+|\s+ft\.?\s+|\s+with\s+/i)
        .map((s) => s.trim())
        .filter(Boolean)[0]
        ?.replace(/\s*-\s*topic$/i, "")
        .replace(/\bvevo\b/gi, "")
        .trim() || "";

/**
 * Every name credited on a track, normalised. Services disagree about both the
 * order and who counts as "the" artist - JioSaavn frequently credits the
 * composer ("Mithoon") where Spotify credits the singer ("Arijit Singh") - so
 * comparisons are done against the whole set rather than one leading name.
 */
export const allArtists = (raw) =>
    String(raw || "")
        .replace(/\u00a0/g, " ")
        .split(/\s*[,&;\/]\s*|\s+feat\.?\s+|\s+ft\.?\s+|\s+with\s+|\s+x\s+/i)
        .map((s) =>
            s
                .replace(/\s*-\s*topic$/i, "")
                .replace(/\bvevo\b/gi, "")
                .trim()
        )
        .filter(Boolean);

const norm = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** True if any credited name is shared between the two tracks. */
const sharesAnyArtist = (aRaw, bRaw) => {
    const a = allArtists(aRaw).map(norm).filter(Boolean);
    const b = allArtists(bRaw).map(norm).filter(Boolean);
    if (!a.length || !b.length) return false;
    return a.some((x) => b.some((y) => x === y || (x.length > 3 && (x.includes(y) || y.includes(x)))));
};

const words = (v) =>
    String(v || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean);

/* -------------------------------- scoring -------------------------------- */

/**
 * Score how likely `candidate` is the same recording as the track described by
 * `want`. Tuned so that a confident match clears 40 and a coincidence does not.
 */
export const scoreMatch = (candidate, want) => {
    const n = norm(candidate?.name);
    const a = norm(candidate?.artist);
    const wantedTitle = norm(want?.title);
    const wantedArtist = norm(want?.artist);
    const wantedDuration = Number(want?.duration) || 0;

    if (!n || !wantedTitle) return -1000;

    let pts = 0;

    // Title agreement
    if (n === wantedTitle) pts += 100;
    else if (n.startsWith(wantedTitle) || wantedTitle.startsWith(n)) pts += 40;
    else if (n.includes(wantedTitle) || wantedTitle.includes(n)) pts += 15;
    else {
        // No substring relation - fall back to shared words so that reordered
        // titles still register, but weakly.
        const cw = new Set(words(candidate?.name));
        const ww = words(want?.title);
        const shared = ww.filter((w) => cw.has(w)).length;
        if (ww.length && shared / ww.length >= 0.6) pts += 12;
        else return -1000; // genuinely unrelated
    }

    // Artist agreement matters most for short, common titles. Compare the full
    // credit lists so a reordered "Pritam, Arijit Singh" still counts.
    if (wantedArtist && a) {
        if (a === wantedArtist) pts += 60;
        else if (sharesAnyArtist(candidate?.artist, want?.artist)) pts += 45;
        else if (a.includes(wantedArtist) || wantedArtist.includes(a)) pts += 35;
        // A different artist on the same title is usually a cover or karaoke
        // version, which is emphatically not the requested recording.
        else pts -= 55;
    }

    // Padding on the candidate's title is a sign of a different edit
    pts -= Math.max(0, n.length - wantedTitle.length) * 0.5;

    // Two recordings of the same length are very likely the same take
    if (wantedDuration && candidate?.duration) {
        const diff = Math.abs(candidate.duration - wantedDuration);
        if (diff <= 3) pts += 45;
        else if (diff <= 10) pts += 20;
        else if (diff > 60) pts -= 30;
    }

    return pts;
};

/**
 * True when both sides name an artist and the names have nothing in common.
 * Title-only matches across different artists are covers, karaoke tracks or
 * unrelated songs that happen to share a name, so this acts as a hard gate on
 * top of the score rather than just another penalty.
 */
export const artistsConflict = (candidate, want) => {
    if (!candidate?.artist || !want?.artist) return false; // nothing to compare

    if (sharesAnyArtist(candidate.artist, want.artist)) return false;

    // Word overlap catches "Arijit Singh" vs "Singh, Arijit" and similar.
    const wa = new Set(words(candidate.artist));
    if (words(want.artist).some((w) => w.length > 2 && wa.has(w))) return false;

    // Deliberately NO duration escape hatch here: a cover or karaoke take is
    // usually cut to the same length as the original, so matching runtimes are
    // not evidence of the same performers. Services that credit the composer
    // instead of the singer (common on JioSaavn) are handled above, because
    // the other side almost always lists the composer somewhere too.
    return true;
};

/* -------------------------------- matching -------------------------------- */

const settle = async (p, fallback) => {
    try {
        return await p;
    } catch {
        return fallback;
    }
};

/**
 * Find a track on JioSaavn from another service's metadata.
 *
 * @param {object} want           { title, artist, duration }
 * @param {object} opts
 * @param {number} opts.minScore  confidence required (default 40)
 * @returns {Promise<{song: object, score: number, confident: boolean}|null>}
 */
export const findOnSaavn = async (want, { minScore = 40 } = {}) => {
    const title = cleanTitle(want?.title);
    const artist = cleanArtist(want?.artist);
    if (!title) return null;

    const queries = [
        `${title} ${artist}`.trim(),
        title,
        artist ? `${artist} ${title}` : "",
    ].filter((q, i, arr) => q && arr.indexOf(q) === i);

    const candidates = [];
    for (const q of queries) {
        const found = await settle(saavn.searchSongs(q, { limit: 8 }), []);
        for (const f of found) {
            if (!candidates.some((c) => c.id === f.id)) candidates.push(f);
        }
        if (candidates.length >= 8) break;
    }
    if (!candidates.length) return null;

    const target = { title, artist, duration: want?.duration };
    const ranked = candidates
        .map((c) => ({ song: c, score: scoreMatch(c, target) }))
        .sort((x, y) => y.score - x.score);

    const top = ranked[0];
    if (!top || top.score <= -1000) return null;

    // A near-identical runtime is strong evidence on its own, so the bar drops
    // when the durations line up.
    const durationAgrees =
        want?.duration && top.song.duration && Math.abs(top.song.duration - want.duration) <= 3;

    // Never call it confident when the artists disagree outright - playing a
    // stranger's cover of the right title is worse than admitting no match.
    const conflict = artistsConflict(top.song, target);
    const confident = !conflict && (top.score >= minScore || (durationAgrees && top.score >= 20));

    return { song: top.song, score: top.score, confident, artistConflict: conflict };
};

/**
 * Resolve a metadata-only track (Spotify / Deezer) to something playable.
 * Returns a JioSaavn stream when a confident match exists, otherwise falls back
 * to the 30-second preview so the user hears something rather than nothing.
 *
 * @param {object} info     normalized track from a metadata source
 * @param {string} sourceLabel  "Spotify" / "Deezer", for the user-facing note
 */
export const resolveViaMatch = async (info, sourceLabel) => {
    if (!info) return { url: null, error: "track not found" };

    const match = await findOnSaavn({
        title: info.name,
        artist: info.artist,
        duration: info.duration,
    });

    if (match?.confident) {
        const stream = await settle(saavn.getStreamUrl(match.song.id), { url: null });
        if (stream?.url) {
            return {
                ...stream,
                resolvedFrom: "saavn-match",
                // Expected here: these sources never serve full audio, so a
                // substitution is the whole point rather than a surprise.
                substituted: true,
                substitutedFrom: sourceLabel,
                // Distinguishes "this source is catalogue-only by design" from
                // "the chosen source failed". Spotify and Deezer never stream
                // full tracks, so telling the user Spotify "could not stream
                // this track" reads like a fault when it is normal behaviour.
                metadataOnly: true,
                matchedTo: {
                    id: `saavn:${match.song.id}`,
                    name: match.song.name,
                    artist: match.song.artist,
                },
                matchScore: match.score,
                tried: [`${sourceLabel}: metadata only, matched on JioSaavn`],
            };
        }
    }

    // No confident match - the 30-second preview is better than a dead player,
    // as long as the caller is told that is what it is getting.
    if (info.preview) {
        return {
            url: info.preview,
            preview: true,
            previewDuration: 30,
            // Slugified, because a label like "Apple Music" would otherwise
            // produce "apple music-preview" and miss every badge lookup.
            resolvedFrom: `${sourceLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-preview`,
            note: `No full-length match found - playing ${sourceLabel}'s 30-second preview.`,
            tried: [`${sourceLabel}: no confident JioSaavn match`],
        };
    }

    return {
        url: null,
        error: "no playable source found",
        tried: [`${sourceLabel}: no match, no preview`],
        resolvedFrom: null,
    };
};

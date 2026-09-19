// Diagnostics - a live check of which sources currently work.
// Open /api/music/health after deploying.
//
// This instantly tells you whether InnerTube works from your Vercel IP or is
// being blocked with LOGIN_REQUIRED.

import * as saavn from "@/lib/sources/saavn";
import * as innertube from "@/lib/sources/innertube";
import * as piped from "@/lib/sources/piped";
import * as deezer from "@/lib/sources/deezer";
import * as spotify from "@/lib/sources/spotify";
import * as lyrics from "@/lib/sources/lyrics";
import * as audius from "@/lib/sources/audius";
import * as itunes from "@/lib/sources/itunes";
import * as invidious from "@/lib/sources/invidious";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEST_QUERY = "tum hi ho";

const check = async (name, fn) => {
    const t0 = Date.now();
    try {
        const value = await fn();
        return { source: name, ok: true, ms: Date.now() - t0, ...value };
    } catch (e) {
        return { source: name, ok: false, ms: Date.now() - t0, error: e.message };
    }
};

export async function GET() {
    const [saavnSearch, itSearch, pipedSearch, deezerSearch] = await Promise.all([
        check("saavn", async () => {
            const r = await saavn.searchSongs(TEST_QUERY, { limit: 3 });
            return { results: r.length, sample: r[0]?.name || null };
        }),
        check("innertube", async () => {
            const r = await innertube.searchSongs(TEST_QUERY, { limit: 3 });
            return { results: r.length, sample: r[0]?.name || null };
        }),
        check("piped", async () => {
            const r = await piped.searchSongs(TEST_QUERY, { limit: 3 });
            return { results: r.length, sample: r[0]?.name || null };
        }),
        check("deezer", async () => {
            const r = await deezer.searchSongs(TEST_QUERY, { limit: 3 });
            return { results: r.length, sample: r[0]?.name || null };
        }),
    ]);

    // Spotify has no search endpoint; reading a known track proves the embed
    // data (which is what the app actually uses) is reachable.
    const spotifyRead = await check("spotify", async () => {
        const t = await spotify.getSongInfo("0V3wPSX9ygBnCm8psDIegu");
        return { results: t ? 1 : 0, sample: t?.name || null, hasPreview: Boolean(t?.preview) };
    });

    // Also test streaming - this is the real question
    const streamTests = [];

    if (saavnSearch.ok && saavnSearch.results > 0) {
        const first = (await saavn.searchSongs(TEST_QUERY, { limit: 1 }))[0];
        if (first) {
            streamTests.push(
                await check("saavn-stream", async () => {
                    const s = await saavn.getStreamUrl(first.id);
                    return { gotUrl: !!s.url, bitrate: s.bitrate, error: s.error };
                })
            );
        }
    }

    const ytId = itSearch.ok && itSearch.results > 0
        ? (await innertube.searchSongs(TEST_QUERY, { limit: 1 }))[0]?.id
        : "BjL7AuPsmEk";

    if (ytId) {
        streamTests.push(
            await check("innertube-stream", async () => {
                const s = await innertube.getStreamUrl(ytId);
                return { gotUrl: !!s.url, bitrate: s.bitrate, client: s.client, error: s.error };
            })
        );
        streamTests.push(
            await check("piped-stream", async () => {
                const s = await piped.getStreamUrl(ytId);
                return { gotUrl: !!s.url, bitrate: s.bitrate, instance: s.client, error: s.error };
            })
        );
    }

    // Metadata-only sources: confirm the 30-second preview they advertise
    // actually resolves, since that is their fallback when no match is found.
    const previewTests = [
        await check("deezer-preview", async () => {
            const r = await deezer.searchSongs(TEST_QUERY, { limit: 1 });
            const s = r[0] ? await deezer.getStreamUrl(r[0].id) : { url: null };
            return { gotUrl: !!s.url, preview: true, error: s.error };
        }),
        await check("spotify-preview", async () => {
            const s = await spotify.getStreamUrl("0V3wPSX9ygBnCm8psDIegu");
            return { gotUrl: !!s.url, preview: true, error: s.error };
        }),
    ];

    // Audius is the only source that serves a full track with no key and no
    // IP blocking, so its stream is probed, not just its search.
    const audiusSearch = await check("audius", async () => {
        const r = await audius.getTrending({ limit: 3 });
        return { results: r.length, sample: r[0]?.name };
    });
    const audiusStream = await check("audius-stream", async () => {
        const r = await audius.getTrending({ limit: 1 });
        if (!r.length) throw new Error("no trending tracks");
        const s = await audius.getStreamUrl(r[0].id);
        if (!s?.url) throw new Error(s?.error || "no url");
        return { gotUrl: true, bitrate: s.bitrate };
    });
    const itunesSearch = await check("itunes", async () => {
        const r = await itunes.searchSongs("tum hi ho", { limit: 3 });
        return { results: r.length, sample: r[0]?.name, previews: r.filter((x) => x.preview).length };
    });
    const invidiousSearch = await check("invidious", async () => {
        const r = await invidious.searchSongs("tum hi ho", { limit: 3 });
        return { results: r.length, sample: r[0]?.name };
    });

    // Lyrics come from LRCLIB, which is open and key-free.
    const lyricsCheck = await check("lrclib", async () => {
        const l = await lyrics.getLyrics({ artist: "Arijit Singh", track: "Tum Hi Ho", duration: 261 });
        return { results: l ? 1 : 0, synced: Boolean(l?.hasSynced), lines: l?.lines?.length || 0 };
    });

    const searchOk = [saavnSearch, itSearch, pipedSearch, deezerSearch, spotifyRead, audiusSearch, itunesSearch, invidiousSearch]
        .filter((s) => s.ok && s.results > 0);
    streamTests.push(audiusStream);
    const streamOk = streamTests.filter((s) => s.gotUrl || s.url);

    return Response.json({
        checkedAt: new Date().toISOString(),
        summary: {
            searchWorking: searchOk.map((s) => s.source),
            streamWorking: streamOk.map((s) => s.source),
            note:
                streamOk.length === 1 && streamOk[0].source === "saavn-stream"
                    ? "Only JioSaavn is streaming - YouTube is blocking your server IP (common on Vercel). The fallback chain is active, so songs will still play."
                    : `${streamOk.length} sources are streaming successfully.`,
        },
        search: {
            saavn: saavnSearch,
            innertube: itSearch,
            piped: pipedSearch,
            deezer: deezerSearch,
            spotify: spotifyRead,
            audius: audiusSearch,
            itunes: itunesSearch,
            invidious: invidiousSearch,
        },
        lyrics: lyricsCheck,
        streams: streamTests,
        // Spotify and Deezer never stream a full track anonymously - these are
        // their 30-second previews, used only when no match can be found.
        previews: previewTests,
    });
}

// Home-screen rows that do not come from JioSaavn.
//
//   GET /api/music/discover?feed=deezer-chart&limit=20
//   GET /api/music/discover?feed=deezer-genre&genre=116&limit=20
//   GET /api/music/discover?feed=spotify-playlist&id=37i9dQZF1DX0XUfTFmNBRM
//   GET /api/music/discover?feed=audius-trending&genre=Electronic&limit=20
//   GET /api/music/discover?feed=audius-underground&limit=20
//
// Everything here is anonymous - no key, no login. Deezer publishes real charts;
// Spotify has no open chart endpoint, so its rows are read from the embed data
// of well-known editorial playlists.

import * as audius from "@/lib/sources/audius";
import * as deezer from "@/lib/sources/deezer";
import * as spotify from "@/lib/sources/spotify";
import { makeId, SOURCE_LABELS } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tag = (track, source) => ({
    ...track,
    source,
    sourceLabel: SOURCE_LABELS[source],
    id: makeId(source, track.id),
    rawId: track.id,
});

/**
 * Spotify's editorial playlists, used as home-screen rows. These ids are stable
 * and public; if one is ever retired the row simply comes back empty rather
 * than breaking the page.
 */
export const SPOTIFY_ROWS = {
    "hot-hits-hindi": { id: "37i9dQZF1DX0XUfTFmNBRM", title: "Hot Hits Hindi" },
    "top-50-india": { id: "37i9dQZEVXbLZ52XmnySJg", title: "Top 50 India" },
    "top-50-global": { id: "37i9dQZEVXbMDoHDwVN2tF", title: "Top 50 Global" },
    "bollywood-butter": { id: "37i9dQZF1DWZd79rJ6a7lp", title: "Bollywood Butter" },
};

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const feed = searchParams.get("feed") || "deezer-chart";
    const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);

    try {
        // ---- Deezer global / genre chart ----
        if (feed === "deezer-chart" || feed === "deezer-genre") {
            const genre = Number(searchParams.get("genre")) || 0;
            const tracks = await deezer.getChart({ genre, limit });
            return Response.json(
                {
                    success: true,
                    feed,
                    source: "deezer",
                    count: tracks.length,
                    results: tracks.map((t) => tag(t, "deezer")),
                },
                { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=7200" } }
            );
        }

        // ---- Audius: open network, real full-length streams ----
        //
        // Worth its own row because nothing here is a fallback: these tracks
        // play at 320kbps from the source the user sees on the card.
        if (feed === "audius-trending" || feed === "audius-underground") {
            const genre = searchParams.get("genre") || "";
            const tracks =
                feed === "audius-underground"
                    ? await audius.getUnderground({ limit })
                    : await audius.getTrending({ genre, limit });
            return Response.json(
                {
                    success: true,
                    feed,
                    source: "audius",
                    title: feed === "audius-underground" ? "Underground on Audius" : "Trending on Audius",
                    count: tracks.length,
                    results: tracks.map((t) => tag(t, "audius")),
                },
                { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=7200" } }
            );
        }

        // ---- Spotify editorial playlist ----
        if (feed === "spotify-playlist") {
            const key = searchParams.get("row");
            const explicitId = searchParams.get("id");
            const row = key ? SPOTIFY_ROWS[key] : null;
            const id = explicitId || row?.id;

            if (!id) {
                return Response.json(
                    { success: false, error: "Unknown Spotify row.", rows: Object.keys(SPOTIFY_ROWS) },
                    { status: 400 }
                );
            }

            const collection = await spotify.getPlaylist(id);
            if (!collection) {
                return Response.json({ success: false, error: "Playlist unavailable." }, { status: 404 });
            }

            return Response.json(
                {
                    success: true,
                    feed,
                    source: "spotify",
                    title: collection.name || row?.title || "",
                    image: collection.image,
                    count: collection.tracks.length,
                    results: collection.tracks.slice(0, limit).map((t) => tag(t, "spotify")),
                },
                { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=7200" } }
            );
        }

        return Response.json(
            {
                success: false,
                error: "Unknown feed.",
                feeds: ["deezer-chart", "deezer-genre", "spotify-playlist"],
            },
            { status: 400 }
        );
    } catch (e) {
        return Response.json({ success: false, error: e.message, results: [] }, { status: 500 });
    }
}

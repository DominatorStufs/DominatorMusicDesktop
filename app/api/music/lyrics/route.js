// Time-synced lyrics for the player, from LRCLIB.
//
//   GET /api/music/lyrics?artist=Arijit+Singh&track=Tum+Hi+Ho&duration=261
//   GET /api/music/lyrics?id=saavn:abc123          (metadata looked up first)
//
// LRCLIB is open and key-free, which is why it is used instead of Spotify's
// lyrics (account cookie required) or Musixmatch (rotating token required).

import { getLyrics } from "@/lib/sources/lyrics";
import { getInfo } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
    const { searchParams } = new URL(req.url);

    let artist = searchParams.get("artist") || "";
    let track = searchParams.get("track") || searchParams.get("name") || "";
    let album = searchParams.get("album") || "";
    let duration = Number(searchParams.get("duration")) || 0;
    const id = searchParams.get("id");

    try {
        // Callers that only have a track id get the metadata resolved here.
        if (id && (!artist || !track)) {
            const info = await getInfo(id);
            if (info) {
                artist = artist || info.artist || "";
                track = track || info.name || "";
                album = album || info.album || "";
                duration = duration || info.duration || 0;
            }
        }

        if (!artist || !track) {
            return Response.json(
                { success: false, error: "artist and track are required" },
                { status: 400 }
            );
        }

        const lyrics = await getLyrics({ artist, track, album, duration });

        if (!lyrics) {
            return Response.json(
                { success: false, error: "No lyrics found for this track.", found: false },
                {
                    status: 404,
                    // Cache the miss briefly so a track without lyrics does not
                    // hammer LRCLIB every time it is played.
                    headers: { "Cache-Control": "public, s-maxage=600" },
                }
            );
        }

        return Response.json(
            { success: true, found: true, lyrics },
            { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } }
        );
    } catch (e) {
        return Response.json({ success: false, error: e.message }, { status: 500 });
    }
}

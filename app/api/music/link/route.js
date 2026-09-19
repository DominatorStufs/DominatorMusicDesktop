// Resolve a pasted Spotify or Deezer link into tracks this app can play.
//
//   GET /api/music/link?url=https://open.spotify.com/playlist/37i9dQZF1DX0XUfTFmNBRM
//   GET /api/music/link?url=https://open.spotify.com/track/0V3wPSX9ygBnCm8psDIegu
//   GET /api/music/link?url=https://www.deezer.com/album/302127
//
// Neither service streams a full track to an anonymous client, so the tracks
// come back as metadata with composite ids ("spotify:<id>"). Playback is
// resolved later by /api/music/stream, which matches each one onto JioSaavn.

import * as spotify from "@/lib/sources/spotify";
import * as deezer from "@/lib/sources/deezer";
import { makeId, SOURCE_LABELS } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tag a normalized track with its source so the player knows where it came from. */
const tag = (track, source) => ({
    ...track,
    source,
    sourceLabel: SOURCE_LABELS[source],
    id: makeId(source, track.id),
    rawId: track.id,
});

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const url = (searchParams.get("url") || "").trim();

    if (!url) {
        return Response.json({ success: false, error: "url missing" }, { status: 400 });
    }

    // Work out which service the link belongs to.
    const spotifyRef = spotify.parseSpotifyUrl(url);
    const deezerRef = deezer.parseDeezerUrl(url);

    if (!spotifyRef && !deezerRef) {
        return Response.json(
            {
                success: false,
                error: "That does not look like a Spotify or Deezer link.",
            },
            { status: 400 }
        );
    }

    const source = spotifyRef ? "spotify" : "deezer";
    const ref = spotifyRef || deezerRef;

    try {
        // ---- single track ----
        if (ref.type === "track") {
            const track =
                source === "spotify"
                    ? await spotify.getSongInfo(ref.id)
                    : await deezer.getSongInfo(ref.id);

            if (!track) {
                return Response.json(
                    { success: false, error: "Track not found or unavailable in this region." },
                    { status: 404 }
                );
            }

            return Response.json(
                { success: true, source, type: "track", track: tag(track, source) },
                { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
            );
        }

        // ---- album or playlist ----
        if (ref.type === "album" || ref.type === "playlist") {
            const collection =
                source === "spotify"
                    ? await spotify.getCollection(ref.type, ref.id)
                    : ref.type === "album"
                        ? await deezer.getAlbum(ref.id)
                        : await deezer.getPlaylist(ref.id);

            if (!collection?.tracks?.length) {
                return Response.json(
                    { success: false, error: "Nothing could be read from that link." },
                    { status: 404 }
                );
            }

            return Response.json(
                {
                    success: true,
                    source,
                    type: ref.type,
                    collection: {
                        ...collection,
                        tracks: collection.tracks.map((t) => tag(t, source)),
                    },
                },
                { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400" } }
            );
        }

        return Response.json(
            { success: false, error: "Artist links cannot be imported - use a track, album or playlist." },
            { status: 400 }
        );
    } catch (e) {
        return Response.json({ success: false, error: e.message }, { status: 500 });
    }
}

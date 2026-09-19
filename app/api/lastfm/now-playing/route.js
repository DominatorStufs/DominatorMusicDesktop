// Updates the "scrobbling now" status on the user's Last.fm profile. Purely
// cosmetic - failures here are not worth surfacing to the user.

import { callSigned, credsFrom, errorResponse } from "@/lib/lastfm-server";

export const dynamic = "force-dynamic";

export async function POST(req) {
    let body;
    try {
        body = await req.json();
    } catch (e) {
        return Response.json({ error: true, message: "Invalid request body." }, { status: 400 });
    }

    const creds = credsFrom(body);
    const { sessionKey, artist, track, album, duration } = body || {};
    if (!sessionKey || !artist || !track) {
        return Response.json(
            { error: true, message: "sessionKey, artist and track are required." },
            { status: 400 }
        );
    }

    try {
        await callSigned(
            "track.updateNowPlaying",
            {
                sk: sessionKey,
                artist,
                track,
                album,
                duration: duration ? String(Math.round(duration)) : undefined,
            },
            creds
        );
        return Response.json({ success: true });
    } catch (e) {
        return errorResponse(e);
    }
}

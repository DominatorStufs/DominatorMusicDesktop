// Submits a completed play to Last.fm, signed with the user's own credentials.

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
    const { sessionKey, artist, track, album, timestamp, duration } = body || {};
    if (!sessionKey || !artist || !track) {
        return Response.json(
            { error: true, message: "sessionKey, artist and track are required." },
            { status: 400 }
        );
    }

    try {
        const json = await callSigned(
            "track.scrobble",
            {
                sk: sessionKey,
                artist,
                track,
                album,
                // Last.fm rejects timestamps in the future or absurdly far in the past.
                timestamp: String(timestamp || Math.floor(Date.now() / 1000)),
                duration: duration ? String(Math.round(duration)) : undefined,
            },
            creds
        );

        const accepted = Number(json?.scrobbles?.["@attr"]?.accepted ?? 0);
        const ignored = Number(json?.scrobbles?.["@attr"]?.ignored ?? 0);
        return Response.json({ success: true, accepted, ignored });
    } catch (e) {
        return errorResponse(e);
    }
}

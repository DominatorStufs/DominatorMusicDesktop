// Stream URL resolver, with the full fallback chain.
//
// GET /api/music/stream?id=innertube:BjL7AuPsmEk
// GET /api/music/stream?id=saavn:abc123
// GET /api/music/stream?id=spotify:0V3wPSX9ygBnCm8psDIegu
// GET /api/music/stream?id=innertube:XYZ&name=Tum+Hi+Ho&artist=Arijit+Singh
//
// name/artist are optional, but passing them makes the JioSaavn fallback much
// faster because the metadata does not have to be fetched again.

import { resolveStream } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const name = searchParams.get("name") || undefined;
    const artist = searchParams.get("artist") || undefined;
    const duration = Number(searchParams.get("duration")) || undefined;

    if (!id) {
        return Response.json({ success: false, error: "id missing" }, { status: 400 });
    }

    try {
        const result = await resolveStream(id, { name, artist, duration });
        if (!result?.url) {
            return Response.json(
                { success: false, error: result?.error || "no stream found", tried: result?.tried || [] },
                { status: 404 }
            );
        }
        return Response.json({
            success: true,
            url: result.url,
            bitrate: result.bitrate,
            mimeType: result.mimeType,
            source: result.source,
            resolvedFrom: result.resolvedFrom,
            matchedTo: result.matchedTo || null,
            // True when the audio is a DIFFERENT recording to the one asked
            // for, because the chosen source could not serve it. The UI should
            // tell the user rather than pass it off as the original.
            metadataOnly: Boolean(result.metadataOnly),
            substituted: Boolean(result.substituted),
            substitutedFrom: result.substitutedFrom || null,
            approximate: Boolean(result.approximate),
            // True when the stream is the ~1 minute YouTube fragment
            truncated: Boolean(result.truncated),
            // True when only a 30-second preview could be resolved (Spotify /
            // Deezer with no confident match on a full-length source).
            preview: Boolean(result.preview),
            previewDuration: result.previewDuration || null,
            matchScore: result.matchScore ?? null,
            note: result.note || null,
            tried: result.tried || [],
        });
    } catch (e) {
        return Response.json({ success: false, error: e.message }, { status: 500 });
    }
}

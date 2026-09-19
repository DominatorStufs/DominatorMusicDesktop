// Metadata for a single track from any source.
//
// GET /api/music/info?id=innertube:BjL7AuPsmEk
// GET /api/music/info?id=saavn:abc123

import { getInfo } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
        return Response.json({ success: false, error: "id missing" }, { status: 400 });
    }

    try {
        const song = await getInfo(id);
        if (!song) {
            return Response.json({ success: false, error: "not found" }, { status: 404 });
        }
        return Response.json({ success: true, song });
    } catch (e) {
        return Response.json({ success: false, error: e.message }, { status: 500 });
    }
}

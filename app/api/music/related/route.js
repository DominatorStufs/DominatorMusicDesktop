// Related / radio tracks for any source.
//
// GET /api/music/related?id=innertube:BjL7AuPsmEk&limit=12
//
// For YouTube tracks this uses InnerTube's "next" endpoint (the same one
// Metrolist uses to build a radio queue). If that returns nothing, the unified
// layer falls back to searching JioSaavn for the same artist, so this endpoint
// practically never comes back empty.

import { getRelated } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const limit = Math.min(Number(searchParams.get("limit")) || 12, 30);

    if (!id) {
        return Response.json({ success: false, error: "id missing", results: [] }, { status: 400 });
    }

    try {
        const results = await getRelated(id, { limit });
        return Response.json({ success: true, count: results.length, results });
    } catch (e) {
        return Response.json({ success: false, error: e.message, results: [] }, { status: 500 });
    }
}

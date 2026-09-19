// Unified search - JioSaavn + InnerTube (the Metrolist approach) + Piped +
// Deezer, all at once.
//
// GET /api/music/search?q=tum+hi+ho
// GET /api/music/search?q=blinding+lights&sources=innertube,piped
// GET /api/music/search?q=weeknd&sources=deezer
//
// The Node runtime is required because InnerTube needs custom headers/UA.

import { searchAll } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || searchParams.get("query") || "";
    const limit = Math.min(Number(searchParams.get("limit")) || 15, 40);
    const sourcesParam = searchParams.get("sources");
    const sources = sourcesParam
        ? sourcesParam.split(",").map((s) => s.trim()).filter(Boolean)
        : ["saavn", "innertube", "piped", "deezer", "audius", "itunes"];

    if (!q.trim()) {
        return Response.json({ success: false, error: "query missing", results: [] }, { status: 400 });
    }

    try {
        const { results, bySource, errors } = await searchAll(q, { sources, limit });
        return Response.json(
            {
                success: true,
                query: q,
                count: results.length,
                counts: Object.fromEntries(Object.entries(bySource).map(([k, v]) => [k, v.length])),
                errors,
                results,
            },
            { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
        );
    } catch (e) {
        return Response.json({ success: false, error: e.message, results: [] }, { status: 500 });
    }
}

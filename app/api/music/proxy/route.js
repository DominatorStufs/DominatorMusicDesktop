// Audio proxy - YouTube stream URLs cannot be played directly from the browser
// (CORS + Referer checks). We pipe them through the server instead.
//
// IMPORTANT BEHAVIOUR OF googlevideo.com (discovered while debugging):
//   - A request with NO Range header returns 403.
//   - An open-ended range ("bytes=0-") returns 403.
//   - A range larger than ~1MB returns 403.
//   - Only a BOUNDED range within the chunk limit returns 206.
//
// The browser's <audio> element always starts with a plain, range-less GET, so
// a naive pass-through proxy always failed with 403 and the song never played.
//
// This proxy therefore:
//   1. always sends a bounded Range upstream,
//   2. transparently fetches the file in sequential chunks and streams them as
//      one continuous response, so the browser sees a normal audio file,
//   3. still honours real Range requests (needed for seeking).
//
// JioSaavn URLs do not need this - they play directly.
//
// GET /api/music/proxy?url=<encoded audio url>

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_HOSTS = [
    "googlevideo.com",
    "youtube.com",
    "ytimg.com",
    "piped.private.coffee",
    "ducks.party",
    "adminforge.de",
    "reallyaweso.me",
    "kavin.rocks",
];

// googlevideo rejects ranges bigger than roughly 1MB
const CHUNK = 1024 * 1024;

const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const isAllowed = (urlStr) => {
    try {
        const h = new URL(urlStr).hostname;
        return ALLOWED_HOSTS.some((a) => h === a || h.endsWith(`.${a}`));
    } catch {
        return false;
    }
};

const isGoogleVideo = (urlStr) => {
    try {
        return new URL(urlStr).hostname.endsWith("googlevideo.com");
    } catch {
        return false;
    }
};

/** Fetch one bounded chunk. Returns the Response. */
const fetchChunk = (url, start, end) =>
    fetch(url, {
        headers: {
            Range: `bytes=${start}-${end}`,
            "User-Agent": UA,
            Accept: "*/*",
        },
    });

/** Discover total size by asking for the first byte. */
const probeSize = async (url) => {
    const res = await fetchChunk(url, 0, 0);
    const cr = res.headers.get("content-range"); // "bytes 0-0/3109720"
    const total = cr ? Number(cr.split("/")[1]) : null;
    const type = res.headers.get("content-type") || "audio/mp4";
    // Drain so the socket is released
    try { await res.arrayBuffer(); } catch { /* ignore */ }
    return { total: Number.isFinite(total) ? total : null, type };
};

export async function GET(req) {
    const target = new URL(req.url).searchParams.get("url");

    if (!target) return new Response("url missing", { status: 400 });
    if (!isAllowed(target)) return new Response("host not allowed", { status: 403 });

    // Non-googlevideo hosts behave normally - simple pass-through.
    if (!isGoogleVideo(target)) {
        const range = req.headers.get("range");
        const upstream = await fetch(target, {
            headers: { "User-Agent": UA, Accept: "*/*", ...(range ? { Range: range } : {}) },
        });
        const headers = new Headers();
        for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
            const v = upstream.headers.get(h);
            if (v) headers.set(h, v);
        }
        headers.set("Access-Control-Allow-Origin", "*");
        return new Response(upstream.body, { status: upstream.status, headers });
    }

    try {
        const { total, type } = await probeSize(target);
        if (!total) return new Response("could not determine size", { status: 502 });

        // Parse the browser's Range request (if any)
        const rangeHeader = req.headers.get("range");
        let start = 0;
        let end = total - 1;
        let isPartial = false;

        if (rangeHeader) {
            const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
            if (m) {
                isPartial = true;
                if (m[1]) start = Number(m[1]);
                if (m[2]) end = Number(m[2]);
                if (end > total - 1) end = total - 1;
            }
        }

        if (start >= total || start > end) {
            return new Response("range not satisfiable", {
                status: 416,
                headers: { "content-range": `bytes */${total}` },
            });
        }

        // Stream the requested span by pulling bounded chunks sequentially.
        const stream = new ReadableStream({
            async start(controller) {
                let pos = start;
                try {
                    while (pos <= end) {
                        const chunkEnd = Math.min(pos + CHUNK - 1, end);
                        const res = await fetchChunk(target, pos, chunkEnd);
                        if (!res.ok && res.status !== 206) {
                            // googlevideo refuses byte ranges past ~1MB from a
                            // datacenter IP. Rather than blowing up the whole
                            // response, close cleanly so the browser plays
                            // whatever was already delivered.
                            controller.close();
                            return;
                        }
                        const buf = new Uint8Array(await res.arrayBuffer());
                        if (!buf.byteLength) break;
                        controller.enqueue(buf);
                        pos += buf.byteLength;
                    }
                    controller.close();
                } catch (e) {
                    try { controller.error(e); } catch { /* already closed */ }
                }
            },
        });

        const headers = new Headers({
            "content-type": type,
            "accept-ranges": "bytes",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600",
        });
        if (isPartial) {
            headers.set("content-range", `bytes ${start}-${end}/${total}`);
            headers.set("content-length", String(end - start + 1));
        }

        return new Response(stream, { status: isPartial ? 206 : 200, headers });
    } catch (e) {
        return new Response(`proxy error: ${e.message}`, { status: 502 });
    }
}

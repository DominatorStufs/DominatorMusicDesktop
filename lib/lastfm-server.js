// ---------------------------------------------------------------------------
// Last.fm - server-side signing helpers.
//
// Credentials arrive with each request (the user stores their own key and
// secret in their browser) and are used only to build the md5 signature for
// that single call. Nothing is persisted, cached or logged here.
//
// This proxy exists for two reasons:
//   1. Last.fm's write endpoints send no CORS headers, so the browser cannot
//      call them directly.
//   2. Signing needs md5, which is trivial here and awkward in the browser.
// ---------------------------------------------------------------------------

import crypto from "crypto";

export const API_ROOT = "https://ws.audioscrobbler.com/2.0/";

/**
 * Build the api_sig Last.fm expects: every parameter except `format`, sorted
 * by name, concatenated as name+value, with the shared secret appended, then
 * md5'd.
 */
export const signParams = (params, secret) => {
    const signature = Object.keys(params)
        .filter((k) => k !== "format" && params[k] !== undefined && params[k] !== "")
        .sort()
        .map((k) => `${k}${params[k]}`)
        .join("");
    return crypto.createHash("md5").update(signature + secret, "utf8").digest("hex");
};

/** POST a signed, authenticated method to Last.fm using the caller's keys. */
export const callSigned = async (method, params, { apiKey, apiSecret }) => {
    if (!apiKey || !apiSecret) {
        const err = new Error("Add your Last.fm API key and secret in Settings.");
        err.missingCreds = true;
        throw err;
    }

    const full = { ...params, method, api_key: apiKey };
    // Drop empty optional fields so they do not break the signature.
    Object.keys(full).forEach((k) => {
        if (full[k] === undefined || full[k] === null || full[k] === "") delete full[k];
    });

    full.api_sig = signParams(full, apiSecret);
    full.format = "json";

    const res = await fetch(API_ROOT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(full).toString(),
        cache: "no-store",
    });

    const json = await res.json().catch(() => ({}));
    if (json?.error) {
        // Last.fm returns HTTP 200 with an error body, so check the payload.
        const err = new Error(json.message || "Last.fm error");
        err.lastfmCode = json.error;
        throw err;
    }
    if (!res.ok) throw new Error(`Last.fm HTTP ${res.status}`);
    return json;
};

/** Pull and validate credentials out of a request body. */
export const credsFrom = (body) => ({
    apiKey: typeof body?.apiKey === "string" ? body.apiKey.trim() : "",
    apiSecret: typeof body?.apiSecret === "string" ? body.apiSecret.trim() : "",
});

/** Map a thrown Last.fm error onto a sensible HTTP response. */
export const errorResponse = (e) => {
    if (e?.missingCreds) {
        return Response.json({ error: true, message: e.message }, { status: 400 });
    }
    // 9 = invalid session key, 10 = invalid API key, 13 = invalid signature.
    const status = e?.lastfmCode === 9 || e?.lastfmCode === 10 || e?.lastfmCode === 13 ? 401 : 502;
    return Response.json(
        { error: true, message: e?.message || "Last.fm request failed.", code: e?.lastfmCode },
        { status }
    );
};

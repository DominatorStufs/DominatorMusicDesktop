// Exchanges the one-time token Last.fm hands back after the user approves the
// app for a permanent session key.
//
// The user's own API key and secret arrive in the body and are used only to
// sign this single call.

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
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token) {
        return Response.json({ error: true, message: "Missing Last.fm token." }, { status: 400 });
    }

    try {
        const json = await callSigned("auth.getSession", { token }, creds);
        const key = json?.session?.key;
        if (!key) throw new Error("Last.fm did not return a session key.");
        return Response.json({
            success: true,
            key,
            name: json?.session?.name || "your account",
        });
    } catch (e) {
        return errorResponse(e);
    }
}

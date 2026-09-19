"use client";
// Connection state for the Last.fm UI, plus the helpers the players use to
// report listening. Keeping the wiring here means the mini player, the full
// player and the settings dialog all share one implementation.

import { useCallback, useEffect, useState } from "react";
import {
    getSession,
    clearSession,
    getCreds,
    saveCreds,
    clearCreds,
    flushQueue,
    queueSize,
    updateNowPlaying,
    scrobble,
} from "@/lib/lastfm";

export function useLastfm() {
    const [session, setSession] = useState(null);
    const [creds, setCredsState] = useState(null);
    const [pending, setPending] = useState(0);
    const [ready, setReady] = useState(false);

    const refresh = useCallback(() => {
        setSession(getSession());
        setCredsState(getCreds());
        setPending(queueSize());
        setReady(true);
    }, []);

    useEffect(() => {
        refresh();

        // The auth popup writes the session from another window.
        const onStorage = (e) => {
            if (!e.key || e.key.startsWith("lastfm-")) refresh();
        };
        const onFocus = () => refresh();
        const onMessage = (e) => {
            if (e.origin === window.location.origin && e.data?.type === "lastfm-connected") {
                refresh();
            }
        };

        window.addEventListener("storage", onStorage);
        window.addEventListener("focus", onFocus);
        window.addEventListener("message", onMessage);
        return () => {
            window.removeEventListener("storage", onStorage);
            window.removeEventListener("focus", onFocus);
            window.removeEventListener("message", onMessage);
        };
    }, [refresh]);

    // Retry anything that failed while offline, once we know we are connected.
    useEffect(() => {
        if (!session?.key || !creds) return;
        flushQueue().then((sent) => {
            if (sent > 0) refresh();
        });
    }, [session?.key, creds, refresh]);

    /** Save the user's own API key + secret. */
    const setCredentials = useCallback(
        ({ apiKey, apiSecret }) => {
            const ok = saveCreds({ apiKey, apiSecret });
            refresh();
            return ok;
        },
        [refresh]
    );

    /** Remove the keys entirely (also drops the session they authorised). */
    const removeCredentials = useCallback(() => {
        clearSession();
        clearCreds();
        refresh();
    }, [refresh]);

    /** Send the user to Last.fm to approve the app. */
    const connect = useCallback(() => {
        const c = getCreds();
        if (!c) return false;

        const cb = `${window.location.origin}/lastfm/callback`;
        const url =
            `https://www.last.fm/api/auth/?api_key=${encodeURIComponent(c.apiKey)}` +
            `&cb=${encodeURIComponent(cb)}`;

        // A popup keeps the music playing; if it is blocked, navigate instead.
        const w = window.open(url, "lastfm", "width=520,height=720");
        if (!w) window.location.href = url;
        return true;
    }, []);

    /** Sign out of the account but keep the API key for next time. */
    const disconnect = useCallback(() => {
        clearSession();
        refresh();
    }, [refresh]);

    return {
        ready,
        session,
        connected: Boolean(session?.key),
        username: session?.name || null,
        hasCredentials: Boolean(creds),
        apiKey: creds?.apiKey || "",
        pending,
        setCredentials,
        removeCredentials,
        connect,
        disconnect,
        refresh,
    };
}

/**
 * Fire-and-forget reporting used by the players.
 * Exported separately so non-React code paths can call it too.
 */
export const reportNowPlaying = updateNowPlaying;
export const reportScrobble = scrobble;

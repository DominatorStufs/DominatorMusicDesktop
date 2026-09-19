"use client";
// Last.fm redirects here with ?token=... after the user approves the app.
//
// The exchange happens in the browser because the user's API key and secret
// live in this browser's localStorage - the server never has a copy. The token
// is posted to /api/lastfm/session, which signs the call and hands back a
// session key.

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { exchangeToken, hasCreds } from "@/lib/lastfm";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function Callback() {
    const params = useSearchParams();
    const router = useRouter();
    const [state, setState] = useState({ status: "working", message: "" });

    useEffect(() => {
        const token = params.get("token");

        if (!token) {
            setState({ status: "error", message: "Last.fm did not return a token." });
            return;
        }
        if (!hasCreds()) {
            setState({
                status: "error",
                message: "No API key found in this browser. Add it in Settings and try again.",
            });
            return;
        }

        let cancelled = false;
        exchangeToken(token)
            .then((res) => {
                if (cancelled) return;
                setState({ status: "ok", message: res.name });
                // If this ran in the popup, tell the opener and close.
                if (window.opener) {
                    try {
                        window.opener.postMessage({ type: "lastfm-connected" }, window.location.origin);
                    } catch (e) { }
                    setTimeout(() => window.close(), 1200);
                } else {
                    setTimeout(() => router.replace("/library"), 1400);
                }
            })
            .catch((e) => {
                if (!cancelled) {
                    setState({
                        status: "error",
                        message: e?.message || "Could not complete the connection.",
                    });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [params, router]);

    return (
        <main className="min-h-[70vh] flex items-center justify-center px-6">
            <div className="text-center max-w-sm">
                {state.status === "working" && (
                    <>
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                        <h1 className="text-lg font-semibold mt-4">Connecting to Last.fm…</h1>
                        <p className="text-sm text-muted-foreground mt-1">One moment.</p>
                    </>
                )}

                {state.status === "ok" && (
                    <>
                        <CheckCircle2 className="h-9 w-9 mx-auto text-emerald-500" />
                        <h1 className="text-lg font-semibold mt-4">Connected as {state.message}</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Your plays will now be scrobbled.
                        </p>
                    </>
                )}

                {state.status === "error" && (
                    <>
                        <XCircle className="h-9 w-9 mx-auto text-red-500" />
                        <h1 className="text-lg font-semibold mt-4">Could not connect</h1>
                        <p className="text-sm text-muted-foreground mt-1 break-words">{state.message}</p>
                        <Button className="mt-5" onClick={() => router.replace("/")}>
                            Back to the app
                        </Button>
                    </>
                )}
            </div>
        </main>
    );
}

export default function Page() {
    return (
        <Suspense fallback={null}>
            <Callback />
        </Suspense>
    );
}

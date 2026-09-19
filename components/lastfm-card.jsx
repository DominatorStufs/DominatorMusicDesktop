"use client";
// Compact Last.fm status strip for the Library page. The actual setup lives in
// the Settings dialog, so this only reports state and points the user there.

import { useLastfm } from "@/hooks/use-lastfm";
import { Radio, Check, UploadCloud, Settings } from "lucide-react";

export default function LastfmCard() {
    const { ready, connected, username, hasCredentials, pending } = useLastfm();

    if (!ready) return null;

    return (
        <div className="rounded-2xl border border-border bg-secondary/40 p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                <Radio className="h-4 w-4 text-red-500" />
            </div>

            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
                    Last.fm
                    {connected && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <Check className="h-2.5 w-2.5" /> Connected
                        </span>
                    )}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 break-words">
                    {connected ? (
                        `Scrobbling as ${username}.`
                    ) : hasCredentials ? (
                        <>
                            Key saved — finish connecting in{" "}
                            <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
                                <Settings className="h-3 w-3" /> Settings
                            </span>
                            .
                        </>
                    ) : (
                        <>
                            Add your API key in{" "}
                            <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
                                <Settings className="h-3 w-3" /> Settings
                            </span>{" "}
                            to scrobble your plays.
                        </>
                    )}
                </p>
                {connected && pending > 0 && (
                    <p className="text-[11px] text-amber-500 mt-1 flex items-center gap-1">
                        <UploadCloud className="h-3 w-3" />
                        {pending} waiting to retry
                    </p>
                )}
            </div>
        </div>
    );
}

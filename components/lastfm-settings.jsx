"use client";
// Last.fm setup, shown inside the Settings dialog.
//
// Each user supplies their own API key and shared secret, so no key has to be
// baked into the deployment. Both are kept in this browser only.

import { useState } from "react";
import { useLastfm } from "@/hooks/use-lastfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Radio,
    Check,
    LogOut,
    UploadCloud,
    ChevronLeft,
    ExternalLink,
    Eye,
    EyeOff,
    Trash2,
} from "lucide-react";
import { toast } from "sonner";

export default function LastfmSettings({ onBack }) {
    const {
        ready,
        connected,
        username,
        hasCredentials,
        apiKey,
        pending,
        setCredentials,
        removeCredentials,
        connect,
        disconnect,
    } = useLastfm();

    // Start on the form when there are no keys yet, otherwise show the status.
    const [editing, setEditing] = useState(false);
    const [keyInput, setKeyInput] = useState("");
    const [secretInput, setSecretInput] = useState("");
    const [showSecret, setShowSecret] = useState(false);

    if (!ready) return null;

    const showForm = editing || !hasCredentials;

    const handleSave = () => {
        const k = keyInput.trim();
        const s = secretInput.trim();

        if (!k || !s) {
            toast.error("Enter both the API key and the shared secret");
            return;
        }
        // Last.fm issues 32-character hex strings for both values. Catching a
        // bad paste here is far clearer than a signature error later.
        if (!/^[a-f0-9]{32}$/i.test(k) || !/^[a-f0-9]{32}$/i.test(s) ) {
            toast.error("That does not look right", {
                description: "Both values should be 32 characters of letters and numbers.",
            });
            return;
        }

        if (setCredentials({ apiKey: k, apiSecret: s })) {
            toast.success("Key saved", { description: "Now press Connect to sign in." });
            setKeyInput("");
            setSecretInput("");
            setEditing(false);
        } else {
            toast.error("Could not save — your browser blocked local storage");
        }
    };

    const handleRemove = () => {
        removeCredentials();
        setEditing(false);
        toast.success("Last.fm key removed");
    };

    return (
        <div className="grid gap-4">
            <button
                onClick={onBack}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition w-fit"
            >
                <ChevronLeft className="h-3.5 w-3.5" /> Back to settings
            </button>

            {/* ---------- status ---------- */}
            {hasCredentials && !showForm && (
                <div className="rounded-xl border border-border bg-secondary/50 p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-start gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                                <Radio className="h-4 w-4 text-red-500" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
                                    Last.fm
                                    {connected && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                            <Check className="h-2.5 w-2.5" /> Connected
                                        </span>
                                    )}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5 break-all">
                                    {connected
                                        ? `Scrobbling as ${username}.`
                                        : "Key saved. Press Connect to sign in."}
                                </p>
                                {connected && pending > 0 && (
                                    <p className="text-[11px] text-amber-500 mt-1 flex items-center gap-1">
                                        <UploadCloud className="h-3 w-3" />
                                        {pending} waiting to retry
                                    </p>
                                )}
                            </div>
                        </div>

                        {connected ? (
                            <Button size="sm" variant="ghost" className="gap-1.5" onClick={disconnect}>
                                <LogOut className="h-3.5 w-3.5" /> Sign out
                            </Button>
                        ) : (
                            <Button size="sm" className="gap-1.5" onClick={connect}>
                                <Radio className="h-3.5 w-3.5" /> Connect
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/60">
                        <code className="text-[11px] text-muted-foreground truncate flex-1">
                            {apiKey.slice(0, 8)}…{apiKey.slice(-4)}
                        </code>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(true)}>
                            Change
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive"
                            onClick={handleRemove}
                        >
                            <Trash2 className="h-3 w-3" /> Remove
                        </Button>
                    </div>
                </div>
            )}

            {/* ---------- setup form ---------- */}
            {showForm && (
                <div className="grid gap-3">
                    <div className="rounded-xl border border-border bg-secondary/40 p-4">
                        <p className="text-sm font-medium">Get your own key</p>
                        <ol className="text-xs text-muted-foreground mt-2 grid gap-1.5 list-decimal list-inside">
                            <li>Open the Last.fm API page and sign in.</li>
                            <li>Fill in any application name, leave the callback blank.</li>
                            <li>Copy the API key and the shared secret it shows you.</li>
                        </ol>
                        <a
                            href="https://www.last.fm/api/account/create"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary mt-3 hover:underline"
                        >
                            Create a Last.fm API account <ExternalLink className="h-3 w-3" />
                        </a>
                    </div>

                    <div className="grid gap-2">
                        <label className="text-xs font-medium" htmlFor="lastfm-key">
                            API key
                        </label>
                        <Input
                            id="lastfm-key"
                            value={keyInput}
                            onChange={(e) => setKeyInput(e.target.value)}
                            placeholder="32-character key"
                            autoComplete="off"
                            spellCheck={false}
                            className="font-mono text-xs"
                        />
                    </div>

                    <div className="grid gap-2">
                        <label className="text-xs font-medium" htmlFor="lastfm-secret">
                            Shared secret
                        </label>
                        <div className="relative">
                            <Input
                                id="lastfm-secret"
                                type={showSecret ? "text" : "password"}
                                value={secretInput}
                                onChange={(e) => setSecretInput(e.target.value)}
                                placeholder="32-character secret"
                                autoComplete="off"
                                spellCheck={false}
                                className="font-mono text-xs pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowSecret(!showSecret)}
                                aria-label={showSecret ? "Hide secret" : "Show secret"}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                            >
                                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button className="flex-1" onClick={handleSave}>
                            Save key
                        </Button>
                        {hasCredentials && (
                            <Button variant="secondary" onClick={() => setEditing(false)}>
                                Cancel
                            </Button>
                        )}
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Your key and secret stay in this browser. They are sent to the server only to
                        sign each Last.fm request, and are never stored there.
                    </p>
                </div>
            )}
        </div>
    );
}

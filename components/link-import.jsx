"use client";
// ---------------------------------------------------------------------------
// Paste a Spotify or Deezer link, get the tracks in your library.
//
// Neither service streams full audio to an anonymous client, so what comes back
// is metadata: title, artist, artwork and duration. Playback is resolved later
// by /api/music/stream, which finds the same recording on JioSaavn. Tracks that
// have no match still play their 30-second preview, and the UI says so rather
// than pretending otherwise.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { importPlaylist } from "@/lib/library";
import SourceBadge from "@/components/source-badge";
import {
    Link2,
    Loader2,
    ListMusic,
    Music2,
    Check,
    ClipboardPaste,
} from "lucide-react";
import { toast } from "sonner";

const fmt = (s) => {
    const n = Number(s) || 0;
    return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
};

export default function LinkImport() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [saved, setSaved] = useState(false);

    const lookup = async (value) => {
        const target = (value ?? url).trim();
        if (!target) {
            toast.error("Paste a Spotify or Deezer link first");
            return;
        }

        setLoading(true);
        setResult(null);
        setSaved(false);
        try {
            const res = await fetch(`/api/music/link?url=${encodeURIComponent(target)}`);
            const data = await res.json();
            if (!data.success) {
                toast.error(data.error || "Could not read that link");
                return;
            }
            setResult(data);
            const count = data.type === "track" ? 1 : data.collection.tracks.length;
            toast.success(
                data.type === "track" ? "Track found" : `Found ${count} tracks`
            );
        } catch (e) {
            toast.error("Could not reach that link", { description: e.message });
        } finally {
            setLoading(false);
        }
    };

    /** Read the clipboard so the user does not have to long-press the field. */
    const pasteAndLookup = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text?.trim()) {
                toast.error("Your clipboard is empty");
                return;
            }
            setUrl(text.trim());
            lookup(text.trim());
        } catch {
            toast.error("Your browser blocked clipboard access — paste it manually");
        }
    };

    const save = () => {
        if (!result) return;

        const tracks =
            result.type === "track" ? [result.track] : result.collection.tracks;
        const name =
            result.type === "track"
                ? `${result.track.name} — ${result.track.artist}`
                : result.collection.name;

        // Store the shape the rest of the library already uses.
        importPlaylist(
            name,
            tracks.map((t) => ({
                id: t.id,
                name: t.name,
                artist: t.artist,
                image: t.image,
                duration: t.duration,
                source: t.source,
            }))
        );
        setSaved(true);
        toast.success("Added to your library", {
            description: `${tracks.length} track${tracks.length === 1 ? "" : "s"} saved as "${name}".`,
        });
    };

    const tracks = result
        ? result.type === "track"
            ? [result.track]
            : result.collection.tracks
        : [];

    return (
        <div className="grid gap-4">
            {/* ---------- input ---------- */}
            <div className="rounded-2xl border border-border bg-secondary/40 p-4">
                <div className="flex items-center gap-2 mb-1">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Import from a link</p>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                    Paste any Spotify or Deezer track, album or playlist link.
                </p>

                <div className="flex gap-2">
                    <Input
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && lookup()}
                        placeholder="https://open.spotify.com/playlist/…"
                        spellCheck={false}
                        className="text-xs"
                    />
                    <Button
                        variant="secondary"
                        size="icon"
                        onClick={pasteAndLookup}
                        aria-label="Paste from clipboard"
                        className="flex-shrink-0"
                    >
                        <ClipboardPaste className="h-4 w-4" />
                    </Button>
                    <Button onClick={() => lookup()} disabled={loading} className="flex-shrink-0">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find"}
                    </Button>
                </div>
            </div>

            {/* ---------- result ---------- */}
            {result && (
                <div className="rounded-2xl border border-border bg-secondary/40 overflow-hidden">
                    <div className="flex items-start gap-3 p-4">
                        {(result.type === "track" ? result.track.image : result.collection.image) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={result.type === "track" ? result.track.image : result.collection.image}
                                alt=""
                                className="h-16 w-16 rounded-lg object-cover flex-shrink-0"
                            />
                        ) : (
                            <div className="h-16 w-16 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                                <ListMusic className="h-5 w-5 text-muted-foreground" />
                            </div>
                        )}

                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <SourceBadge source={result.source} />
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                    {result.type}
                                </span>
                            </div>
                            <p className="text-sm font-medium mt-1 truncate">
                                {result.type === "track" ? result.track.name : result.collection.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                                {result.type === "track"
                                    ? result.track.artist
                                    : `${result.collection.subtitle || ""} · ${tracks.length} tracks`}
                            </p>
                        </div>

                        <Button size="sm" onClick={save} disabled={saved} className="flex-shrink-0 gap-1.5">
                            {saved ? (
                                <>
                                    <Check className="h-3.5 w-3.5" /> Saved
                                </>
                            ) : (
                                "Add to library"
                            )}
                        </Button>
                    </div>

                    {/* track list */}
                    <div className="max-h-72 overflow-y-auto border-t border-border/60">
                        {tracks.slice(0, 60).map((t, i) => (
                            <div
                                key={t.id}
                                className="flex items-center gap-3 px-4 py-2 hover:bg-secondary/60 transition"
                            >
                                <span className="text-[11px] text-muted-foreground w-5 text-right flex-shrink-0">
                                    {i + 1}
                                </span>
                                {t.image ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={t.image} alt="" className="h-8 w-8 rounded object-cover flex-shrink-0" />
                                ) : (
                                    <div className="h-8 w-8 rounded bg-secondary flex items-center justify-center flex-shrink-0">
                                        <Music2 className="h-3.5 w-3.5 text-muted-foreground" />
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium truncate">{t.name}</p>
                                    <p className="text-[11px] text-muted-foreground truncate">{t.artist}</p>
                                </div>
                                <span className="text-[11px] text-muted-foreground flex-shrink-0">
                                    {fmt(t.duration)}
                                </span>
                            </div>
                        ))}
                        {tracks.length > 60 && (
                            <p className="text-[11px] text-muted-foreground text-center py-2">
                                and {tracks.length - 60} more
                            </p>
                        )}
                    </div>

                    <p className="text-[11px] text-muted-foreground px-4 py-3 border-t border-border/60 leading-relaxed">
                        {result.source === "spotify" ? "Spotify" : "Deezer"} does not allow apps to stream
                        full tracks, so each song is matched to a full-length version on JioSaavn when
                        you play it. Anything without a match plays a 30-second preview.
                    </p>
                </div>
            )}
        </div>
    );
}

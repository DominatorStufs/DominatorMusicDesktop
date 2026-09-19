"use client"
import { useEffect, useState } from "react";
import SongCard from "@/components/cards/song";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { getLikedSongs, getHistory } from "@/lib/library";
import { getSongsByQuery } from "@/lib/fetch";
import { decodeEntities, dedupeSongs } from "@/lib/text";
import SectionHeader from "@/components/page/section-header";

export default function MadeForYou() {
    const [songs, setSongs] = useState([]);
    const [basedOn, setBasedOn] = useState("");
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const pool = [...getLikedSongs(), ...getHistory()];
        if (!pool.length) {
            setReady(true);
            return;
        }
        // pick the most common artist from what the user has liked / played
        const counts = {};
        pool.forEach((s) => {
            if (!s.artist) return;
            counts[s.artist] = (counts[s.artist] || 0) + 1;
        });
        const topArtist = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
        if (!topArtist) {
            setReady(true);
            return;
        }
        setBasedOn(topArtist);
        getSongsByQuery(topArtist)
            .then((res) => res.json())
            .then((data) => {
                // BUG FIX: only keep tracks that actually have an id and
                // artwork, otherwise the row rendered broken empty cards.
                const results = dedupeSongs((data?.data?.results || []).filter((s) => s?.id));
                setSongs(results);
                setReady(true);
            })
            .catch(() => {
                setSongs([]);
                setReady(true);
            });
    }, []);

    if (ready && !songs.length) return null;

    return (
        <div className="mt-12">
            <SectionHeader
                title="Made For You"
                subtitle={basedOn ? `Because you like ${decodeEntities(basedOn)}` : "A mix based on your taste."}
            />
            <ScrollArea className="rounded-md">
                <div className="flex gap-4">
                    {!ready
                        ? Array.from({ length: 6 }).map((_, i) => <SongCard key={`sk-${i}`} />)
                        : songs.slice(0, 10).map((song) => (
                            <SongCard
                                key={song.id}
                                image={song.image?.[2]?.url || ""}
                                title={decodeEntities(song.name)}
                                artist={decodeEntities(song.artists?.primary?.[0]?.name) || "unknown"}
                                id={song.id}
                            />
                        ))}
                </div>
                <ScrollBar orientation="horizontal" className="hidden sm:flex" />
            </ScrollArea>
        </div>
    );
}

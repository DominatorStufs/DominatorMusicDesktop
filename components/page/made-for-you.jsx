"use client"
import { useEffect, useState } from "react";
import SongCard from "@/components/cards/song";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { getLikedSongs, getHistory } from "@/lib/library";
import { getSongsByQuery } from "@/lib/fetch";

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
                setSongs(data?.data?.results || []);
                setReady(true);
            })
            .catch(() => setReady(true));
    }, []);

    if (ready && !songs.length) return null;

    return (
        <div className="mt-14">
            <h1 className="text-base">Made For You</h1>
            <p className="text-xs text-muted-foreground">{basedOn ? `Because you like ${basedOn}` : "A mix based on your taste."}</p>
            <ScrollArea className="rounded-md mt-4">
                <div className="flex gap-4">
                    {songs.length ? songs.slice(0, 10).map((song) => (
                        <SongCard key={song.id} image={song.image?.[2]?.url || ""} title={song.name} artist={song.artists?.primary?.[0]?.name || "unknown"} id={song.id} />
                    )) : Array.from({ length: 6 }).map((_, i) => <SongCard key={i} />)}
                </div>
                <ScrollBar orientation="horizontal" className="hidden sm:flex" />
            </ScrollArea>
        </div>
    );
}

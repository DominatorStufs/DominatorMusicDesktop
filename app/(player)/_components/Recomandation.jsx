"use client"

import Next from "@/components/cards/next";
import { Skeleton } from "@/components/ui/skeleton";
import { NextContext } from "@/hooks/use-context";
import { getSongsSuggestions, getSongsById, getSongsByQuery } from "@/lib/fetch";
import { useContext, useEffect, useState } from "react";

export default function Recomandation({ id }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const next = useContext(NextContext);

    const setNext = (songs) => {
        if (!songs.length) return;
        const d = songs[Math.floor(Math.random() * songs.length)];
        if (d) {
            next.setNextData({
                id: d.id,
                name: d.name,
                artist: d.artists?.primary?.[0]?.name || "unknown",
                album: d.album?.name || "",
                image: d.image?.[1]?.url || ""
            });
        }
    };

    // Falls back to songs by the same artist whenever the suggestions
    // endpoint comes back empty (JioSaavn doesn't have suggestions for
    // every track), so this section is basically never empty.
    const getFallback = async () => {
        try {
            const songRes = await getSongsById(id);
            const songData = await songRes.json();
            const artist = songData?.data?.[0]?.artists?.primary?.[0]?.name;
            if (!artist) return [];
            const res = await getSongsByQuery(artist);
            const json = await res.json();
            const results = json?.data?.results || [];
            return results.filter((s) => s.id !== id);
        } catch (e) {
            return [];
        }
    };

    const getData = async () => {
        try {
            const res = await getSongsSuggestions(id);
            const json = await res.json();
            let songs = Array.isArray(json?.data) ? json.data : [];

            if (!songs.length) {
                songs = await getFallback();
            }

            if (songs.length) {
                setData(songs);
                setNext(songs);
            } else {
                setData(false);
            }
        } catch (e) {
            const fallback = await getFallback();
            if (fallback.length) {
                setData(fallback);
                setNext(fallback);
            } else {
                setData(false);
            }
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        setLoading(true);
        getData();
    }, [id])

    return (
        <section className="py-10 px-6 md:px-20 lg:px-32">
            <div>
                <h1 className="text-base font-medium">Recommended for you</h1>
                <p className="text-xs text-muted-foreground">You might like this</p>
            </div>
            <div className="rounded-md mt-6">
                {!loading && data && (
                    <div className="grid sm:grid-cols-2 gap-3 overflow-hidden animate-in fade-in duration-500">
                        {data.slice(0, 10).map((song) => (
                            <Next next={false} key={song.id} image={song.image?.[2]?.url || ""} name={song.name} artist={song.artists?.primary?.[0]?.name || "unknown"} id={song.id} />
                        ))}
                    </div>
                )}
                {loading && (
                    <div className="grid gap-3">
                        <div className="grid gap-2">
                            <Skeleton className="h-14 w-full" />
                        </div>
                        <div className="grid gap-2">
                            <Skeleton className="h-14 w-full" />
                        </div>
                        <div className="grid gap-2">
                            <Skeleton className="h-14 w-full" />
                        </div>
                        <div className="grid gap-2">
                            <Skeleton className="h-14 w-full" />
                        </div>
                    </div>
                )}
            </div>
            {!loading && !data && (
                <div className="flex items-center justify-center text-center h-[100px]">
                    <p className="text-sm text-muted-foreground">No recommendations for this song.</p>
                </div>
            )}
        </section>
    )
}

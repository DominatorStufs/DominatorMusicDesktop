"use client"

import Next from "@/components/cards/next";
import { Skeleton } from "@/components/ui/skeleton";
import { NextContext } from "@/hooks/use-context";
import { getSongsSuggestions, getSongsById, getSongsByQuery } from "@/lib/fetch";
import { isUnifiedId, normalizeId } from "@/lib/unified-song";
import { useContext, useEffect, useState } from "react";
import SectionHeader from "@/components/page/section-header";

export default function Recomandation({ id: routeId }) {
    const id = normalizeId(routeId);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const next = useContext(NextContext);

    // Normalise a track from any source into what this section renders.
    const normalise = (s) => {
        // Unified layer (YouTube / multi-source) shape
        if (s.artist !== undefined || s.image === undefined || typeof s.image === "string") {
            return {
                id: s.id,
                name: s.name,
                artist: s.artist || "unknown",
                album: s.album || "",
                image: typeof s.image === "string" ? s.image : "",
            };
        }
        // JioSaavn shape
        return {
            id: s.id,
            name: s.name,
            artist: s.artists?.primary?.[0]?.name || "unknown",
            album: s.album?.name || "",
            image: s.image?.[2]?.url || s.image?.[1]?.url || "",
        };
    };

    const setNext = (songs) => {
        if (!songs.length) return;
        const d = songs[Math.floor(Math.random() * songs.length)];
        if (d) next.setNextData(d);
    };

    // JioSaavn fallback: songs by the same artist, used when the suggestions
    // endpoint returns nothing (JioSaavn has no suggestions for every track).
    const getSaavnFallback = async () => {
        try {
            const songRes = await getSongsById(id);
            const songData = await songRes.json();
            const artist = songData?.data?.[0]?.artists?.primary?.[0]?.name;
            if (!artist) return [];
            const res = await getSongsByQuery(artist);
            const json = await res.json();
            const results = json?.data?.results || [];
            return results.filter((s) => s.id !== id).map(normalise);
        } catch (e) {
            return [];
        }
    };

    // ---- YouTube / multi-source tracks ----
    // BUG FIX: composite IDs like "innertube:abc" were being sent straight to
    // the JioSaavn API, which always failed, so this whole section stayed
    // empty for every YouTube song. They now go through the unified endpoint.
    const getUnifiedRelated = async () => {
        try {
            const res = await fetch(`/api/music/related?id=${encodeURIComponent(id)}&limit=12`);
            const json = await res.json();
            const items = json?.results || [];
            return items.map(normalise);
        } catch (e) {
            return [];
        }
    };

    const getData = async () => {
        try {
            let songs = [];

            if (isUnifiedId(id)) {
                songs = await getUnifiedRelated();
            } else {
                const res = await getSongsSuggestions(id);
                const json = await res.json();
                const raw = Array.isArray(json?.data) ? json.data : [];
                songs = raw.map(normalise);

                if (!songs.length) songs = await getSaavnFallback();
            }

            if (songs.length) {
                setData(songs);
                setNext(songs);
            } else {
                setData(false);
            }
        } catch (e) {
            const fallback = isUnifiedId(id) ? [] : await getSaavnFallback();
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
        setData([]);
        getData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    return (
        <section className="py-10 px-4 sm:px-6 md:px-12 lg:px-20 xl:px-28">
            <SectionHeader title="Recommended for you" subtitle="More tracks you might like." />
            <div className="rounded-md">
                {!loading && data && data.length > 0 && (
                    <div className="grid sm:grid-cols-2 gap-3 overflow-hidden animate-in fade-in duration-500">
                        {data.slice(0, 10).map((song) => (
                            <Next
                                next={false}
                                key={song.id}
                                image={song.image}
                                name={song.name}
                                artist={song.artist}
                                id={song.id}
                            />
                        ))}
                    </div>
                )}
                {loading && (
                    <div className="grid sm:grid-cols-2 gap-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} className="h-[60px] w-full rounded-xl" />
                        ))}
                    </div>
                )}
            </div>
            {!loading && (!data || data.length === 0) && (
                <div className="rounded-xl border border-dashed border-border py-10 text-center">
                    <p className="text-sm text-muted-foreground">No recommendations for this song.</p>
                </div>
            )}
        </section>
    )
}

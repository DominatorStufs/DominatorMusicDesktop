"use client"

import SongCard from "@/components/cards/song";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getAlbumById } from "@/lib/fetch";
import { useEffect, useState } from "react"
import PageShell from "@/components/page/page-shell";
import SectionHeader from "@/components/page/section-header";
import CardRow from "@/components/page/card-row";
import { decodeEntities } from "@/lib/text";
import { Disc3 } from "lucide-react";

export default function Album({ id }) {
    const [data, setData] = useState({});
    const [loading, setLoading] = useState(true);

    const getData = async () => {
        setLoading(true);
        try {
            const res = await getAlbumById(id);
            const json = await res.json();
            setData(json?.data || {});
        } catch (err) {
            setData({});
        }
        setLoading(false);
    };

    useEffect(() => {
        getData();
        // BUG FIX: the dependency array was empty, so navigating from one album
        // straight to another kept showing the first album's tracks.
    }, [id]);

    const cover = data?.image?.[2]?.url || data?.image?.[1]?.url || "";
    const artists =
        data?.artists?.primary?.map((a) => decodeEntities(a.name)).join(", ") || "unknown";
    const songs = data?.songs || [];

    if (loading) {
        return (
            <PageShell>
                <div className="md:flex gap-8">
                    <Skeleton className="w-full aspect-square md:w-[220px] md:h-[220px] rounded-2xl flex-shrink-0" />
                    <div className="mt-5 md:mt-2 w-full">
                        <Skeleton className="h-8 w-2/3 max-w-sm rounded" />
                        <Skeleton className="h-4 w-1/2 max-w-xs mt-3 rounded" />
                        <Skeleton className="h-4 w-1/3 max-w-[200px] mt-2 rounded" />
                        <Skeleton className="h-6 w-24 mt-4 rounded-full" />
                    </div>
                </div>
                <div className="mt-12">
                    <Skeleton className="h-6 w-32 rounded" />
                    <div className="mt-4">
                        <CardRow loading />
                    </div>
                </div>
            </PageShell>
        );
    }

    if (!data?.name) {
        return (
            <PageShell>
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <Disc3 className="h-10 w-10 text-muted-foreground mb-3" />
                    <h1 className="text-lg font-semibold">Album not found</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        This album could not be loaded. Try searching for it instead.
                    </p>
                </div>
            </PageShell>
        );
    }

    return (
        <PageShell>
            {/* Header: artwork sits beside the details on desktop, stacks on mobile */}
            <div className="md:flex gap-8 items-end">
                <div className="w-full md:w-[220px] flex-shrink-0">
                    <img
                        src={cover}
                        alt={decodeEntities(data.name)}
                        className="w-full aspect-square object-cover rounded-2xl shadow-lg bg-secondary/60"
                    />
                </div>
                <div className="mt-5 md:mt-0 min-w-0">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Album</p>
                    <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mt-1 break-words">
                        {decodeEntities(data.name)}
                    </h1>
                    {data.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {decodeEntities(data.description)}
                        </p>
                    )}
                    <p className="text-sm text-muted-foreground mt-2">
                        by <span className="text-foreground font-medium">{artists}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-4 flex-wrap">
                        <Badge variant="secondary">{data.songCount || songs.length} songs</Badge>
                        {data.year && <Badge variant="outline">{data.year}</Badge>}
                        {data.language && (
                            <Badge variant="outline" className="capitalize">{data.language}</Badge>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-12">
                <SectionHeader title="Tracks" subtitle={`${songs.length} in this album.`} />
                <CardRow isEmpty={!songs.length} empty="This album has no playable tracks.">
                    {songs.map((song) => (
                        <SongCard
                            key={song.id}
                            image={song.image?.[2]?.url || ""}
                            title={decodeEntities(song.name)}
                            artist={decodeEntities(song.artists?.primary?.[0]?.name) || "unknown"}
                            id={song.id}
                        />
                    ))}
                </CardRow>
            </div>
        </PageShell>
    )
}

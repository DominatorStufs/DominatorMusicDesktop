"use client"
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { decodeSharedPlaylist, importPlaylist } from "@/lib/library";
import { Button } from "@/components/ui/button";
import Next from "@/components/cards/next";
import { ListMusic, Check } from "lucide-react";
import { toast } from "sonner";

export default function ImportPlaylistPage() {
    const params = useSearchParams();
    const router = useRouter();
    const [playlist, setPlaylist] = useState(null);
    const [invalid, setInvalid] = useState(false);
    const [imported, setImported] = useState(false);

    useEffect(() => {
        const data = params.get("data");
        if (!data) {
            setInvalid(true);
            return;
        }
        const decoded = decodeSharedPlaylist(data);
        if (!decoded || !decoded.songs) {
            setInvalid(true);
            return;
        }
        setPlaylist(decoded);
    }, [params]);

    const handleImport = () => {
        importPlaylist(playlist.name, playlist.songs);
        setImported(true);
        toast.success("Added to your library!");
    };

    if (invalid) {
        return (
            <main className="px-6 py-16 text-center">
                <p className="text-sm text-muted-foreground">This playlist link looks invalid or broken.</p>
                <Button className="mt-4" onClick={() => router.push("/")}>Go home</Button>
            </main>
        );
    }

    if (!playlist) return null;

    return (
        <main className="px-6 py-10 md:px-20 lg:px-32">
            <div className="mb-8 text-center">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <ListMusic className="h-6 w-6" />
                </div>
                <h1 className="text-xl font-semibold">{playlist.name}</h1>
                <p className="text-sm text-muted-foreground">Shared with you - {playlist.songs.length} song{playlist.songs.length !== 1 ? "s" : ""}</p>
                <Button className="mt-5 gap-2" onClick={handleImport} disabled={imported}>
                    {imported ? <><Check className="h-4 w-4" /> Added to your library</> : "Add to my library"}
                </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-w-3xl mx-auto">
                {playlist.songs.map((song) => (
                    <Next key={song.id} id={song.id} name={song.name} artist={song.artist} image={song.image} next={false} />
                ))}
            </div>
        </main>
    );
}

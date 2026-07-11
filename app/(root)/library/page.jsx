"use client"
import { useEffect, useState } from "react";
import Next from "@/components/cards/next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLikedSongs, getPlaylists, createPlaylist, deletePlaylist } from "@/lib/library";
import { Heart, ListMusic, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function LibraryPage() {
    const [liked, setLiked] = useState([]);
    const [playlists, setPlaylists] = useState([]);
    const [newPlaylistName, setNewPlaylistName] = useState("");
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        setLiked(getLikedSongs());
        setPlaylists(getPlaylists());
    }, []);

    const handleCreatePlaylist = () => {
        if (!newPlaylistName.trim()) return;
        createPlaylist(newPlaylistName.trim());
        setPlaylists(getPlaylists());
        setNewPlaylistName("");
        setCreating(false);
        toast.success("Playlist created!");
    };

    const handleDeletePlaylist = (id) => {
        deletePlaylist(id);
        setPlaylists(getPlaylists());
        toast.success("Playlist deleted");
    };

    return (
        <main className="px-6 py-5 md:px-20 lg:px-32">
            <div className="mb-2">
                <h1 className="text-2xl font-semibold flex items-center gap-2"><Heart className="h-5 w-5" /> Your Library</h1>
                <p className="text-sm text-muted-foreground">Liked songs and playlists, saved on this device.</p>
            </div>

            {/* Liked Songs */}
            <div className="mt-10">
                <h2 className="text-base">Liked Songs</h2>
                <p className="text-xs text-muted-foreground mb-4">Songs you've liked, {liked.length} total.</p>
                {liked.length ? (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {liked.map((song) => (
                            <Next key={song.id} id={song.id} name={song.name} artist={song.artist} image={song.image} next={false} />
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">No liked songs yet. Tap the heart icon on any song to save it here.</p>
                )}
            </div>

            {/* Playlists */}
            <div className="mt-14">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-base flex items-center gap-2"><ListMusic className="h-4 w-4" /> Playlists</h2>
                        <p className="text-xs text-muted-foreground">Organize your favorite songs.</p>
                    </div>
                    <Button size="sm" variant="secondary" className="gap-1" onClick={() => setCreating(!creating)}>
                        <Plus className="h-4 w-4" /> New Playlist
                    </Button>
                </div>

                {creating && (
                    <div className="flex gap-2 mt-4">
                        <Input
                            autoFocus
                            placeholder="Playlist name"
                            value={newPlaylistName}
                            onChange={(e) => setNewPlaylistName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleCreatePlaylist()}
                        />
                        <Button onClick={handleCreatePlaylist}>Create</Button>
                    </div>
                )}

                {playlists.length ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-4">
                        {playlists.map((p) => (
                            <div key={p.id} className="rounded-md border border-border bg-secondary/40 p-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium">{p.name}</h3>
                                    <button onClick={() => handleDeletePlaylist(p.id)} aria-label="Delete playlist">
                                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive transition" />
                                    </button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{p.songs.length} song{p.songs.length !== 1 ? "s" : ""}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground mt-4">No playlists yet. Create one to start organizing your music.</p>
                )}
            </div>
        </main>
    );
}

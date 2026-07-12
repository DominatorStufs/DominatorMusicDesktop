"use client"
import { useEffect, useState } from "react";
import Next from "@/components/cards/next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLikedSongs, getPlaylists, createPlaylist, deletePlaylist, encodePlaylistForShare } from "@/lib/library";
import { getWeeklyStats, getMonthlyStats } from "@/lib/stats";
import { StatsSummary } from "@/components/stats-recap";
import { Heart, ListMusic, Plus, Trash2, BarChart3, Share2 } from "lucide-react";
import { toast } from "sonner";

export default function LibraryPage() {
    const [liked, setLiked] = useState([]);
    const [playlists, setPlaylists] = useState([]);
    const [newPlaylistName, setNewPlaylistName] = useState("");
    const [creating, setCreating] = useState(false);
    const [statsRange, setStatsRange] = useState("weekly");
    const [stats, setStats] = useState(null);

    useEffect(() => {
        setLiked(getLikedSongs());
        setPlaylists(getPlaylists());
    }, []);

    useEffect(() => {
        setStats(statsRange === "weekly" ? getWeeklyStats() : getMonthlyStats());
    }, [statsRange]);

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

    const handleSharePlaylist = async (playlist) => {
        if (!playlist.songs.length) {
            toast.error("Add a few songs before sharing!");
            return;
        }
        const encoded = encodePlaylistForShare(playlist);
        const link = `${window.location.origin}/playlist/import?data=${encoded}`;
        try {
            if (navigator.share) {
                await navigator.share({ title: `${playlist.name} - Playlist`, url: link });
            } else {
                await navigator.clipboard.writeText(link);
                toast.success("Playlist link copied! Send it to a friend to build it together.");
            }
        } catch (e) { }
    };

    return (
        <main className="px-6 py-5 md:px-20 lg:px-32">
            <div className="mb-2">
                <h1 className="text-2xl font-semibold flex items-center gap-2"><Heart className="h-5 w-5" /> Your Library</h1>
                <p className="text-sm text-muted-foreground">Liked songs and playlists, saved on this device.</p>
            </div>

            {/* Listening Stats */}
            <div className="mt-10">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Your Stats</h2>
                        <p className="text-xs text-muted-foreground">A recap also pops up every Sunday and on the 1st of the month.</p>
                    </div>
                    <div className="flex rounded-full border border-border overflow-hidden text-xs">
                        <button onClick={() => setStatsRange("weekly")} className={`px-3 py-1.5 transition ${statsRange === "weekly" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>Week</button>
                        <button onClick={() => setStatsRange("monthly")} className={`px-3 py-1.5 transition ${statsRange === "monthly" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>Month</button>
                    </div>
                </div>
                <StatsSummary stats={stats} />
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
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleSharePlaylist(p)} aria-label="Share playlist">
                                            <Share2 className="h-4 w-4 text-muted-foreground hover:text-foreground transition" />
                                        </button>
                                        <button onClick={() => handleDeletePlaylist(p.id)} aria-label="Delete playlist">
                                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive transition" />
                                        </button>
                                    </div>
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

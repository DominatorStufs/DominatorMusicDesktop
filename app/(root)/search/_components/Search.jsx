"use client";
import AlbumCard from "@/components/cards/album";
import ArtistCard from "@/components/cards/artist";
import SongCard from "@/components/cards/song";
import { getAlbumById, getSongsByQuery, searchAlbumByQuery } from "@/lib/fetch";
import { useEffect, useState } from "react";
import SourceBadge from "@/components/source-badge";
import PageShell from "@/components/page/page-shell";
import SectionHeader from "@/components/page/section-header";
import CardRow, { ArtistSkeleton } from "@/components/page/card-row";
import { decodeEntities, dedupeSongs } from "@/lib/text";

export default function Search({ params }) {
    const query = params.id;

    const [artists, setArtists] = useState([]);
    const [songs, setSongs] = useState([]);
    const [albums, setAlbums] = useState([]);
    // Songs coming from YouTube Music / YouTube (InnerTube + Piped)
    const [ytSongs, setYtSongs] = useState([]);
    const [dzSongs, setDzSongs] = useState([]);
    const [dzLoading, setDzLoading] = useState(false);
    const [auSongs, setAuSongs] = useState([]);
    const [auLoading, setAuLoading] = useState(false);
    const [apSongs, setApSongs] = useState([]);
    const [apLoading, setApLoading] = useState(false);
    const [ytLoading, setYtLoading] = useState(true);
    const [loading, setLoading] = useState(true);
    const [albumsLoading, setAlbumsLoading] = useState(true);

    const getSongs = async () => {
        setLoading(true);
        try {
            const get = await getSongsByQuery(query);
            const data = await get.json();
            const results = data?.data?.results || [];
            setSongs(dedupeSongs(results));
            setArtists(results);
        } catch (err) {
            setSongs([]);
            setArtists([]);
        }
        setLoading(false);
    };

    // Extra results from YouTube Music + YouTube, so songs that are missing
    // from JioSaavn (English, indie, Punjabi singles, etc.) still show up.
    const getYouTubeSongs = async () => {
        setYtLoading(true);
        try {
            const res = await fetch(
                `/api/music/search?q=${encodeURIComponent(query)}&sources=innertube,piped&limit=12`
            );
            const data = await res.json();
            setYtSongs(dedupeSongs(data?.results || []));
        } catch (err) {
            setYtSongs([]);
        }
        setYtLoading(false);
    };
    // Deezer has a large international catalogue that JioSaavn does not cover.
    // It only serves a 30-second preview itself, so playing one of these looks
    // up the same recording on JioSaavn first - see lib/sources/match.js.
    const getDeezerSongs = async () => {
        setDzLoading(true);
        try {
            const res = await fetch(
                `/api/music/search?q=${encodeURIComponent(query)}&sources=deezer&limit=12`
            );
            const data = await res.json();
            setDzSongs(dedupeSongs(data?.results || []));
        } catch (err) {
            setDzSongs([]);
        }
        setDzLoading(false);
    };

    // Audius: independent and self-published music that no major catalogue
    // carries. These play in full from Audius itself, with no matching step.
    const getAudiusSongs = async () => {
        setAuLoading(true);
        try {
            const res = await fetch(
                `/api/music/search?q=${encodeURIComponent(query)}&sources=audius&limit=12`
            );
            const data = await res.json();
            setAuSongs(dedupeSongs(data?.results || []));
        } catch (err) {
            setAuSongs([]);
        }
        setAuLoading(false);
    };

    // Apple Music via the public iTunes endpoint - the strongest metadata for
    // Indian releases. Like Deezer it only owns a 30-second preview, so play
    // matches the recording onto a full-length source first.
    const getAppleSongs = async () => {
        setApLoading(true);
        try {
            const res = await fetch(
                `/api/music/search?q=${encodeURIComponent(query)}&sources=itunes&limit=12`
            );
            const data = await res.json();
            setApSongs(dedupeSongs(data?.results || []));
        } catch (err) {
            setApSongs([]);
        }
        setApLoading(false);
    };

    const getAlbum = async () => {
        setAlbumsLoading(true);
        try {
            const get = await searchAlbumByQuery(query);
            const data = await get.json();
            setAlbums(data?.data?.results || []);
        } catch (err) {
            setAlbums([]);
        }
        setAlbumsLoading(false);
    };
    useEffect(() => {
        getSongs();
        getAlbum();
        getYouTubeSongs();
        getAudiusSongs();
        getDeezerSongs();
        getAppleSongs();
    }, [params.id]);

    const label = decodeEntities(decodeURI(query));

    return (
        <PageShell>
            <div className="mb-2">
                <p className="text-xs text-muted-foreground">Search results for</p>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">{label}</h1>
            </div>

            <div className="mt-10">
                <SectionHeader title="Songs" badge={<SourceBadge source="saavn" />} />
                <CardRow
                    loading={loading}
                    isEmpty={!songs.length}
                    empty={`No songs found for "${label}" on JioSaavn.`}
                >
                    {songs.map((song) => (
                        <SongCard
                            key={song.id}
                            id={song.id}
                            image={song.image?.[2]?.url || ""}
                            artist={decodeEntities(song.artists?.primary?.[0]?.name) || "unknown"}
                            title={decodeEntities(song.name)}
                        />
                    ))}
                </CardRow>
            </div>

            {/* ---- YouTube Music / YouTube results ---- */}
            {(ytLoading || ytSongs.length > 0) && (
                <div className="mt-12">
                    <SectionHeader
                        title="More from YouTube"
                        subtitle="Songs missing from JioSaavn."
                        badge={<SourceBadge source="innertube" />}
                    />
                    <CardRow loading={ytLoading}>
                        {ytSongs.map((song) => (
                            <SongCard
                                key={song.id}
                                id={song.id}
                                image={song.image}
                                artist={decodeEntities(song.artist)}
                                title={decodeEntities(song.name)}
                                source={song.source}
                            />
                        ))}
                    </CardRow>
                </div>
            )}

            {/* ---- Audius results ---- */}
            {(auLoading || auSongs.length > 0) && (
                <div className="mt-12">
                    <SectionHeader
                        title="More from Audius"
                        subtitle="Independent artists, streamed full-length from Audius."
                        badge={<SourceBadge source="audius" />}
                    />
                    <CardRow loading={auLoading}>
                        {auSongs.map((song) => (
                            <SongCard
                                key={song.id}
                                id={song.id}
                                image={song.image}
                                artist={decodeEntities(song.artist)}
                                title={decodeEntities(song.name)}
                                source={song.source}
                            />
                        ))}
                    </CardRow>
                </div>
            )}

            {/* ---- Deezer results ---- */}
            {(dzLoading || dzSongs.length > 0) && (
                <div className="mt-12">
                    <SectionHeader
                        title="More from Deezer"
                        subtitle="International catalogue, matched to a full-length version on play."
                        badge={<SourceBadge source="deezer" />}
                    />
                    <CardRow loading={dzLoading}>
                        {dzSongs.map((song) => (
                            <SongCard
                                key={song.id}
                                id={song.id}
                                image={song.image}
                                artist={decodeEntities(song.artist)}
                                title={decodeEntities(song.name)}
                                source={song.source}
                            />
                        ))}
                    </CardRow>
                </div>
            )}

            {/* ---- Apple Music results ---- */}
            {(apLoading || apSongs.length > 0) && (
                <div className="mt-12">
                    <SectionHeader
                        title="More from Apple Music"
                        subtitle="Apple's catalogue, matched to a full-length version on play."
                        badge={<SourceBadge source="itunes" />}
                    />
                    <CardRow loading={apLoading}>
                        {apSongs.map((song) => (
                            <SongCard
                                key={song.id}
                                id={song.id}
                                image={song.image}
                                artist={decodeEntities(song.artist)}
                                title={decodeEntities(song.name)}
                                source={song.source}
                            />
                        ))}
                    </CardRow>
                </div>
            )}

            <div className="mt-12">
                <SectionHeader title="Related Albums" subtitle={`Albums matching "${label}"`} />
                <CardRow
                    loading={albumsLoading}
                    isEmpty={!albums.length}
                    empty="No related albums."
                >
                    {albums.map((album) => (
                        <AlbumCard
                            key={album.id}
                            lang={album.language}
                            desc={album.description || null}
                            id={`album/${album.id}`}
                            image={album.image?.[2]?.url || ""}
                            title={decodeEntities(album.name)}
                            artist={decodeEntities(album.artists?.primary?.[0]?.name) || "unknown"}
                        />
                    ))}
                </CardRow>
            </div>

            <div className="mt-12">
                <SectionHeader title="Related Artists" subtitle={`Artists matching "${label}"`} />
                <CardRow loading={loading} count={6} skeleton={ArtistSkeleton}>
                    {[...new Set(artists.map((a) => a.artists?.primary?.[0]?.id).filter(Boolean))].map((id) => {
                        const artistSong = artists.find((a) => a.artists?.primary?.[0]?.id === id);
                        const artist = artistSong?.artists?.primary?.[0];
                        if (!artist) return null;
                        return (
                            <ArtistCard
                                key={id}
                                id={id}
                                image={artist.image?.[2]?.url || `https://az-avatar.vercel.app/api/avatar/?bgColor=0f0f0f0&fontSize=60&text=${artist.name?.[0]?.toUpperCase() || "U"}`}
                                name={decodeEntities(artist.name) || "unknown"}
                            />
                        );
                    })}
                </CardRow>
            </div>
        </PageShell>
    )
}

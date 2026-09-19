"use client"
import AlbumCard from "@/components/cards/album";
import ArtistCard from "@/components/cards/artist";
import SongCard from "@/components/cards/song";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { getSongsByQuery, searchAlbumByQuery } from "@/lib/fetch";
import { useEffect, useState } from "react";
import Greeting from "@/components/page/greeting";
import GenreChips from "@/components/page/genre-chips";
import ContinueListening from "@/components/page/continue-listening";
import MadeForYou from "@/components/page/made-for-you";
import SourceBadge from "@/components/source-badge";
import { sourceOf } from "@/lib/unified-song";
import { decodeEntities, dedupeSongs } from "@/lib/text";
import SectionHeader from "@/components/page/section-header";

export default function Page() {
  const [latest, setLatest] = useState([]);
  const [popular, setPopular] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [ytSongs, setYtSongs] = useState([]);
  const [ytLoading, setYtLoading] = useState(true);
  const [spSongs, setSpSongs] = useState([]);
  const [spLoading, setSpLoading] = useState(true);
  const [spTitle, setSpTitle] = useState("From Spotify");
  const [dzSongs, setDzSongs] = useState([]);
  const [dzLoading, setDzLoading] = useState(true);
  const [auSongs, setAuSongs] = useState([]);
  const [auLoading, setAuLoading] = useState(true);

  const getSongs = async (e, type) => {
    try {
      const get = await getSongsByQuery(e);
      const data = await get.json();
      // JioSaavn returns duplicates and HTML-escaped names; clean both up so
      // the rows do not show the same track two or three times.
      const results = dedupeSongs(data?.data?.results || []);
      if (type === "latest") {
        setLatest(results);
      } else if (type === "popular") {
        setPopular(results);
      }
    } catch (err) {
      if (type === "latest") setLatest([]);
      else if (type === "popular") setPopular([]);
    }
  };

  const getAlbum = async () => {
    try {
      const get = await searchAlbumByQuery("latest");
      const data = await get.json();
      setAlbums(data?.data?.results || []);
    } catch (err) {
      setAlbums([]);
    }
  };

  // Trending tracks that come from YouTube Music / InnerTube rather than
  // JioSaavn. This is what makes the multi-source support visible on the home
  // screen instead of only inside search.
  const getYouTubeSongs = async () => {
    try {
      // A locale-relevant query - a generic "trending" search returns charts
      // from whichever region the server happens to sit in. The year is derived
      // rather than hardcoded, which previously made this row go stale.
      const year = new Date().getFullYear();
      const res = await fetch(
        `/api/music/search?q=${encodeURIComponent(`bollywood hits ${year}`)}&limit=20&sources=innertube,piped`
      );
      const json = await res.json();
      const items = dedupeSongs(
        (json?.results || []).filter((s) => s?.id && !s.id.startsWith("saavn:"))
      );
      setYtSongs(items);
    } catch (err) {
      setYtSongs([]);
    } finally {
      setYtLoading(false);
    }
  };

  // Spotify's own editorial chart. Spotify never serves full audio, so playing
  // one of these matches the recording onto JioSaavn first - see
  // lib/sources/match.js. The row exists for its catalogue and artwork.
  const getSpotifySongs = async () => {
    try {
      const res = await fetch("/api/music/discover?feed=spotify-playlist&row=hot-hits-hindi&limit=20");
      const json = await res.json();
      if (json?.title) setSpTitle(json.title);
      setSpSongs(dedupeSongs(json?.results || []));
    } catch (err) {
      setSpSongs([]);
    } finally {
      setSpLoading(false);
    }
  };

  // Deezer's global chart - a genuinely open endpoint, and a different mix to
  // the Indian-focused rows above.
  const getDeezerSongs = async () => {
    try {
      const res = await fetch("/api/music/discover?feed=deezer-chart&limit=20");
      const json = await res.json();
      setDzSongs(dedupeSongs(json?.results || []));
    } catch (err) {
      setDzSongs([]);
    } finally {
      setDzLoading(false);
    }
  };

  // Audius: a decentralised network where artists publish directly. Unlike every
  // other non-JioSaavn row, these tracks stream in full at 320kbps from Audius
  // itself - nothing is matched or substituted.
  const getAudiusSongs = async () => {
    try {
      const res = await fetch("/api/music/discover?feed=audius-trending&limit=20");
      const json = await res.json();
      setAuSongs(dedupeSongs(json?.results || []));
    } catch (err) {
      setAuSongs([]);
    } finally {
      setAuLoading(false);
    }
  };

  useEffect(() => {
    getSongs("latest", "latest");
    getSongs("trending", "popular");
    getAlbum();
    getYouTubeSongs();
    getSpotifySongs();
    getDeezerSongs();
    getAudiusSongs();
  }, []);

  return (
    <main className="px-4 py-5 sm:px-6 md:px-12 lg:px-20 xl:px-28 pb-28">
      <Greeting />
      <GenreChips />

      <ContinueListening />
      <MadeForYou />

      <div className="mt-12">
        <SectionHeader
          title="New Releases"
          subtitle="Fresh tracks, updated daily."
          badge={<SourceBadge source="saavn" />}
        />
        <ScrollArea className="rounded-md">
          <div className="flex gap-4">
            {latest.length ? latest.slice().map((song) => (
              <SongCard key={song.id} image={song.image?.[2]?.url || ""} album={song.album} title={decodeEntities(song.name)} artist={decodeEntities(song.artists?.primary?.[0]?.name) || "unknown"} id={song.id} />
            )) : Array.from({ length: 10 }).map((_, i) => <SongCard key={i} />)}
          </div>
          <ScrollBar orientation="horizontal" className="hidden sm:flex" />
        </ScrollArea>
      </div>

      <div className="mt-12">
        <SectionHeader
          title="From YouTube Music"
          subtitle="Tracks JioSaavn does not carry."
          badge={<SourceBadge source="innertube" />}
          href="/sources"
        />
        <ScrollArea className="rounded-md">
          <div className="flex gap-4">
            {ytLoading
              ? Array.from({ length: 10 }).map((_, i) => <SongCard key={`yt-sk-${i}`} />)
              : ytSongs.length
                ? ytSongs.map((song) => (
                  <SongCard
                    key={song.id}
                    image={song.image || ""}
                    title={decodeEntities(song.name)}
                    artist={decodeEntities(song.artist) || "unknown"}
                    id={song.id}
                    source={sourceOf(song.id)}
                  />
                ))
                : (
                  <p className="text-sm text-muted-foreground py-6">
                    YouTube Music is unreachable right now.
                  </p>
                )}
          </div>
          <ScrollBar orientation="horizontal" className="hidden sm:flex" />
        </ScrollArea>
      </div>

      <div className="mt-12">
        <SectionHeader
          title={spTitle}
          subtitle="Spotify's chart, matched to a full-length version on play."
          badge={<SourceBadge source="spotify" />}
          href="/library"
        />
        <ScrollArea className="rounded-md">
          <div className="flex gap-4">
            {spLoading
              ? Array.from({ length: 10 }).map((_, i) => <SongCard key={`sp-sk-${i}`} />)
              : spSongs.length
                ? spSongs.map((song) => (
                  <SongCard
                    key={song.id}
                    image={song.image || ""}
                    title={decodeEntities(song.name)}
                    artist={decodeEntities(song.artist) || "unknown"}
                    id={song.id}
                    source={sourceOf(song.id)}
                  />
                ))
                : (
                  <p className="text-sm text-muted-foreground py-6">
                    Spotify is unreachable right now.
                  </p>
                )}
          </div>
          <ScrollBar orientation="horizontal" className="hidden sm:flex" />
        </ScrollArea>
      </div>

      <div className="mt-12">
        <SectionHeader
          title="Global Chart"
          subtitle="What the world is playing, from Deezer."
          badge={<SourceBadge source="deezer" />}
          href="/sources"
        />
        <ScrollArea className="rounded-md">
          <div className="flex gap-4">
            {dzLoading
              ? Array.from({ length: 10 }).map((_, i) => <SongCard key={`dz-sk-${i}`} />)
              : dzSongs.length
                ? dzSongs.map((song) => (
                  <SongCard
                    key={song.id}
                    image={song.image || ""}
                    title={decodeEntities(song.name)}
                    artist={decodeEntities(song.artist) || "unknown"}
                    id={song.id}
                    source={sourceOf(song.id)}
                  />
                ))
                : (
                  <p className="text-sm text-muted-foreground py-6">
                    Deezer is unreachable right now.
                  </p>
                )}
          </div>
          <ScrollBar orientation="horizontal" className="hidden sm:flex" />
        </ScrollArea>
      </div>

      <div className="mt-12">
        <SectionHeader
          title="Trending on Audius"
          subtitle="Independent artists, streamed full-length straight from the source."
          badge={<SourceBadge source="audius" />}
          href="/sources"
        />
        <ScrollArea className="rounded-md">
          <div className="flex gap-4">
            {auLoading
              ? Array.from({ length: 10 }).map((_, i) => <SongCard key={`au-sk-${i}`} />)
              : auSongs.length
                ? auSongs.map((song) => (
                  <SongCard
                    key={song.id}
                    image={song.image || ""}
                    title={decodeEntities(song.name)}
                    artist={decodeEntities(song.artist) || "unknown"}
                    id={song.id}
                    source={sourceOf(song.id)}
                  />
                ))
                : (
                  <p className="text-sm text-muted-foreground py-6">
                    Audius is unreachable right now.
                  </p>
                )}
          </div>
          <ScrollBar orientation="horizontal" className="hidden sm:flex" />
        </ScrollArea>
      </div>

      <div className="mt-12">
        <SectionHeader
          title="Albums"
          subtitle="Latest full releases."
          badge={<SourceBadge source="saavn" />}
        />
        <ScrollArea className="rounded-md">
          <div className="flex gap-4">
            {albums.length ? albums.slice().map((song) => (
              <AlbumCard key={song.id} lang={song.language} image={song.image?.[2]?.url || ""} album={song.album} title={decodeEntities(song.name)} artist={decodeEntities(song.artists?.primary?.[0]?.name) || "unknown"} id={`album/${song.id}`} />
            )) : Array.from({ length: 10 }).map((_, i) => <SongCard key={i} />)}
          </div>
          <ScrollBar orientation="horizontal" className="hidden sm:flex" />
        </ScrollArea>
      </div>

      <div className="mt-12">
        <SectionHeader title="Artists" subtitle="Most searched right now." />
        <ScrollArea className="rounded-md">
          <div className="flex gap-4">
            {latest.length ? [...new Set(latest.map(a => a.artists?.primary?.[0]?.id).filter(Boolean))].map(id => {
              const artistSong = latest.find(a => a.artists?.primary?.[0]?.id === id);
              const artist = artistSong?.artists?.primary?.[0];
              if (!artist) return null;
              return (
                <ArtistCard key={id} id={id} image={artist.image?.[2]?.url || `https://az-avatar.vercel.app/api/avatar/?bgColor=0f0f0f0&fontSize=60&text=${artist.name?.[0]?.toUpperCase() || "U"}`} name={decodeEntities(artist.name) || "Unknown"} />
              );
            }) : Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="grid gap-2">
                <Skeleton className="h-[100px] w-[100px] rounded-full" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="hidden sm:flex" />
        </ScrollArea>
      </div>

      <div className="mt-12">
        <SectionHeader
          title="Trending"
          subtitle="Popular this week."
          badge={<SourceBadge source="saavn" />}
        />
        <ScrollArea className="rounded-md">
          <div className="flex gap-4">
            {popular.length ? popular.map((song) => (
              <SongCard key={song.id} id={song.id} image={song.image?.[2]?.url || ""} title={decodeEntities(song.name)} artist={decodeEntities(song.artists?.primary?.[0]?.name) || "unknown"} />
            )) : Array.from({ length: 10 }).map((_, i) => <SongCard key={i} />)}
          </div>
          <ScrollBar orientation="horizontal" className="hidden sm:flex" />
        </ScrollArea>
      </div>
    </main>
  )
}

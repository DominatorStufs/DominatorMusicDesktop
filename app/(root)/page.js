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

export default function Page() {
  const [latest, setLatest] = useState([]);
  const [popular, setPopular] = useState([]);
  const [albums, setAlbums] = useState([]);

  const getSongs = async (e, type) => {
    try {
      const get = await getSongsByQuery(e);
      const data = await get.json();
      const results = data?.data?.results || [];
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

  useEffect(() => {
    getSongs("latest", "latest");
    getSongs("trending", "popular");
    getAlbum();
  }, []);

  return (
    <main className="px-6 py-5 md:px-20 lg:px-32">
      <Greeting />
      <GenreChips />

      <ContinueListening />
      <MadeForYou />

      <div className="mt-14">
        <h1 className="text-base">Songs</h1>
        <p className="text-xs text-muted-foreground">Top new released songs.</p>
        <ScrollArea className="rounded-md mt-4">
          <div className="flex gap-4">
            {latest.length ? latest.slice().map((song) => (
              <SongCard key={song.id} image={song.image?.[2]?.url || ""} album={song.album} title={song.name} artist={song.artists?.primary?.[0]?.name || "unknown"} id={song.id} />
            )) : Array.from({ length: 10 }).map((_, i) => <SongCard key={i} />)}
          </div>
          <ScrollBar orientation="horizontal" className="hidden sm:flex" />
        </ScrollArea>
      </div>

      <div className="mt-14">
        <h1 className="text-base">Albums</h1>
        <p className="text-xs text-muted-foreground">Top new released albums.</p>
        <ScrollArea className="rounded-md mt-6">
          <div className="flex gap-4">
            {albums.length ? albums.slice().map((song) => (
              <AlbumCard key={song.id} lang={song.language} image={song.image?.[2]?.url || ""} album={song.album} title={song.name} artist={song.artists?.primary?.[0]?.name || "unknown"} id={`album/${song.id}`} />
            )) : Array.from({ length: 10 }).map((_, i) => <SongCard key={i} />)}
          </div>
          <ScrollBar orientation="horizontal" className="hidden sm:flex" />
        </ScrollArea>
      </div>

      <div className="mt-12">
        <h1 className="text-base">Artists</h1>
        <p className="text-xs text-muted-foreground">Most searched artists.</p>
        <ScrollArea className="rounded-md mt-6">
          <div className="flex gap-4">
            {latest.length ? [...new Set(latest.map(a => a.artists?.primary?.[0]?.id).filter(Boolean))].map(id => {
              const artistSong = latest.find(a => a.artists?.primary?.[0]?.id === id);
              const artist = artistSong?.artists?.primary?.[0];
              if (!artist) return null;
              return (
                <ArtistCard key={id} id={id} image={artist.image?.[2]?.url || `https://az-avatar.vercel.app/api/avatar/?bgColor=0f0f0f0&fontSize=60&text=${artist.name?.[0]?.toUpperCase() || "U"}`} name={artist.name || "Unknown"} />
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
        <h1 className="text-base">Trending</h1>
        <p className="text-xs text-muted-foreground">Most played songs in this week.</p>
        <ScrollArea className="rounded-md mt-6">
          <div className="flex gap-4">
            {popular.length ? popular.map((song) => (
              <SongCard key={song.id} id={song.id} image={song.image?.[2]?.url || ""} title={song.name} artist={song.artists?.primary?.[0]?.name || "unknown"} />
            )) : Array.from({ length: 10 }).map((_, i) => <SongCard key={i} />)}
          </div>
          <ScrollBar orientation="horizontal" className="hidden sm:flex" />
        </ScrollArea>
      </div>
    </main>
  )
}

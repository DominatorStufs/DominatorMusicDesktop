import { getSongsById } from "@/lib/fetch";
import Player from "../_components/Player";
import Recomandation from "../_components/Recomandation";
import AdvanceSearch from "../_components/AdvanceSearch";
import Search from "@/components/page/search";

export const generateMetadata = async ({ params }) => {
  try {
    const res = await getSongsById(params.id);
    if (!res || !res.ok) throw new Error("Failed to fetch song");
    const data = await res.json();
    const song = data?.data?.[0];
    if (!song) throw new Error("No song data");

    const artistName = data?.artists?.primary?.[0]?.name ?? "unknown";
    const albumName = song?.album?.name ?? "unknown";
    const imageUrl = song?.image?.[2]?.url ?? song?.image?.[1]?.url ?? song?.image?.[0]?.url ?? "/favi-icon.jpg";

    return {
      title: song?.name ?? "DominatorMusic",
      description: `Listen to "${song?.name ?? 'a song'}" by ${artistName} from the album "${albumName}".`,
      openGraph: {
        title: song?.name ?? "DominatorMusic",
        description: `Listen to "${song?.name ?? 'a song'}" by ${artistName}.`,
        type: "music.song",
        url: song?.url ?? "/",
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: song?.name ?? "DominatorMusic",
          },
        ],
        music: {
          album: song?.album?.url ?? undefined,
          release_date: song?.releaseDate ?? undefined,
          musician: artistName,
        },
      },
      twitter: {
        card: "summary_large_image",
        title: song?.name ?? "DominatorMusic",
        description: `Listen to "${song?.name ?? 'a song'}" by ${artistName}.`,
        images: imageUrl,
      },
    };
  } catch (err) {
    // Fallback metadata so a failed fetch won't break build or render
    return {
      title: "DominatorMusic",
      description: "Open-Source music streamer.",
    };
  }
};

export default function Page({ params }) {
  return (
    <div>
      <Player id={params.id} />
      <Recomandation id={params.id} />
    </div>
  );
}

import { getSongsById } from "@/lib/fetch";
import { normalizeId, sourceOf } from "@/lib/unified-song";
import Player from "../_components/Player";
import Recomandation from "../_components/Recomandation";
import AdvanceSearch from "../_components/AdvanceSearch";
import Search from "@/components/page/search";

/** Absolute origin for this deployment, needed for OG tags and server fetches. */
const getOrigin = () => {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
};

/**
 * Resolve a song for metadata purposes from ANY source.
 *
 * The previous version called getSongsById() with the raw route segment. For a
 * composite id ("saavn:rjkrTnma" / "innertube:abc", often arriving percent
 * encoded) that hit the legacy JioSaavn endpoint with a colon in the path, which
 * always failed - so every shared link fell back to the generic
 * "DominatorMusic / Open-Source music streamer" card with no artwork.
 */
const resolveSong = async (rawId) => {
  const id = normalizeId(rawId);
  const origin = getOrigin();

  // Unified path: works for saavn:, innertube: and piped: ids.
  if (id.includes(":")) {
    try {
      const res = await fetch(`${origin}/api/music/info?id=${encodeURIComponent(id)}`, {
        next: { revalidate: 3600 },
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.success && json.song) {
          const s = json.song;
          return {
            name: s.name,
            artist: s.artist || "unknown",
            album: s.album || "",
            image: s.image || "",
            source: sourceOf(id),
          };
        }
      }
    } catch (e) {
      // fall through to the generic card
    }
    return null;
  }

  // Legacy plain JioSaavn id.
  try {
    const res = await getSongsById(id);
    if (!res || !res.ok) return null;
    const data = await res.json();
    const song = data?.data?.[0];
    if (!song) return null;
    return {
      name: song?.name,
      // NOTE: artists live on the song, not on the response root. The old code
      // read data.artists.primary, which was always undefined -> "unknown".
      artist: song?.artists?.primary?.[0]?.name || song?.primaryArtists || "unknown",
      album: song?.album?.name || "",
      image:
        song?.image?.[2]?.url ?? song?.image?.[1]?.url ?? song?.image?.[0]?.url ?? "",
      source: "saavn",
    };
  } catch (e) {
    return null;
  }
};

export const generateMetadata = async ({ params }) => {
  const origin = getOrigin();
  const id = normalizeId(params.id);
  const canonical = `${origin}/${encodeURIComponent(id)}`;
  const song = await resolveSong(params.id);

  if (!song?.name) {
    return {
      metadataBase: new URL(origin),
      title: "DominatorMusic",
      description: "Open-Source music streamer.",
    };
  }

  const title = `${song.name} — ${song.artist}`;
  const description = song.album
    ? `Listen to "${song.name}" by ${song.artist} from "${song.album}" on DominatorMusic.`
    : `Listen to "${song.name}" by ${song.artist} on DominatorMusic.`;
  const image = song.image || `${origin}/favi-icon.jpg`;

  return {
    metadataBase: new URL(origin),
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: "music.song",
      // Must be the DominatorMusic page, not the source's own page, otherwise
      // chat apps link straight out to JioSaavn/YouTube.
      url: canonical,
      siteName: "DominatorMusic",
      images: [{ url: image, alt: title }],
      music: { musician: song.artist },
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
};

export default function Page({ params }) {
  return (
    <div>
      <Player id={params.id} />
      <Recomandation id={params.id} />
    </div>
  );
}

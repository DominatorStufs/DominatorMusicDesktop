import { getAlbumById } from "@/lib/fetch";
import Album from "../_components/Album";

/** Absolute origin for this deployment, needed for OG tags. */
const getOrigin = () => {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
};

export const generateMetadata = async ({ params }) => {
  const origin = getOrigin();
  const canonical = `${origin}/album/${encodeURIComponent(params.id)}`;
  try {
    const res = await getAlbumById(params.id);
    if (!res || !res.ok) throw new Error("Failed to fetch album");
    const data = await res.json();
    const album = data?.data;
    const albumName = album?.name ?? "Album";
    const artistName =
      album?.artists?.primary?.[0]?.name || album?.primaryArtists || "";
    const image =
      album?.image?.[2]?.url ?? album?.image?.[1]?.url ?? album?.image?.[0]?.url ?? "";

    const title = artistName ? `${albumName} — ${artistName}` : albumName;
    const description = artistName
      ? `Listen to the album "${albumName}" by ${artistName} on DominatorMusic.`
      : `Listen to the album "${albumName}" on DominatorMusic.`;

    // Album links were shareable but carried no OG tags at all, so chat apps
    // showed a bare URL with no artwork. Mirror the song page behaviour.
    return {
      metadataBase: new URL(origin),
      title,
      description,
      alternates: { canonical },
      openGraph: {
        title,
        description,
        type: "music.album",
        url: canonical,
        siteName: "DominatorMusic",
        images: image ? [{ url: image, alt: title }] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: image ? [image] : undefined,
      },
    };
  } catch (err) {
    return {
      metadataBase: new URL(origin),
      title: "DominatorMusic",
      description: "Open-Source music streamer.",
    };
  }
};

export default function Page({ params }) {
  return (
    <main>
      <Album id={params.id} />
    </main>
  );
}

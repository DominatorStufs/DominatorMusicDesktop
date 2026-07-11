import { getAlbumById } from "@/lib/fetch";
import Album from "../_components/Album";

export const generateMetadata = async ({ params }) => {
  try {
    const res = await getAlbumById(params.id);
    if (!res || !res.ok) throw new Error("Failed to fetch album");
    const data = await res.json();
    const albumName = data?.data?.name ?? "Album";
    return {
      title: `Album - ${albumName}`,
    };
  } catch (err) {
    return {
      title: "DominatorMusic",
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

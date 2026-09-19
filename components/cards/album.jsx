import Link from "next/link";
import { normalizeId } from "@/lib/unified-song";
import { Skeleton } from "../ui/skeleton";
import { Badge } from "../ui/badge";

export default function AlbumCard({ title, image, artist, id, desc, lang }) {
    return (
        <div className="group h-fit w-[150px] sm:w-[180px] lg:w-[200px] flex-shrink-0">
            <div className="overflow-hidden rounded-xl">
                {image ? (
                    <Link href={`/${encodeURIComponent(normalizeId(id))}`} className="block relative aspect-square">
                        <img
                            src={image}
                            alt={title}
                            loading="lazy"
                            className="h-full w-full object-cover bg-secondary/60 rounded-xl transition duration-300 group-hover:scale-[1.04]"
                        />
                        <div className="absolute inset-0 rounded-xl bg-black/20 opacity-0 transition duration-300 group-hover:opacity-100" />
                    </Link>
                ) : (
                    <Skeleton className="w-full aspect-square rounded-xl" />
                )}
            </div>
            <div className="cursor-pointer">
                {title ? (
                    <Link href={`/${encodeURIComponent(normalizeId(id))}`} className="mt-3 block min-w-0">
                        <h3 className="text-sm font-medium leading-snug truncate" title={title}>{title}</h3>
                    </Link>
                ) : (
                    <Skeleton className="w-[70%] h-4 mt-2" />
                )}
                {desc && (
                    <p className="text-xs text-muted-foreground">{desc.slice(0, 30)}</p>
                )}
                {artist ? (
                    <>
                        <p className="text-xs text-muted-foreground truncate mt-0.5 mb-1.5" title={artist}>{artist}</p>
                        {lang && <Badge variant="outline" className="font-normal">{lang}</Badge>}
                    </>
                ) : (
                    <Skeleton className="w-10 h-2 mt-2" />
                )}
            </div>
        </div>
    )
}
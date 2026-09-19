import Link from "next/link";
import { normalizeId, sourceOf } from "@/lib/unified-song";
import { Badge } from "../ui/badge";
import { Play } from "lucide-react";
import { decodeEntities } from "@/lib/text";
import SourceBadge from "@/components/source-badge";

export default function Next({ name, artist, image, id, next = true }) {
    const title = decodeEntities(name);
    const by = decodeEntities(artist);
    // Derived from the id, so Liked Songs and the up-next card tag Spotify /
    // Deezer / YouTube tracks the same way the grid cards do.
    const source = id ? sourceOf(id) : null;

    return (
        <Link href={`/${encodeURIComponent(normalizeId(id))}`} className="group block">
            <div className="flex items-center gap-3 bg-secondary/60 border border-transparent p-2 rounded-xl transition hover:bg-secondary hover:border-border active:scale-[0.99]">
                <img
                    src={image}
                    alt={title}
                    loading="lazy"
                    className="aspect-square w-11 h-11 rounded-lg object-cover bg-background/40 flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium truncate" title={title}>
                        {title}
                    </h3>
                    <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate">{by}</p>
                        {source && source !== "saavn" && (
                            <SourceBadge source={source} className="flex-shrink-0" />
                        )}
                    </div>
                </div>
                {next ? (
                    <Badge className="!font-normal flex-shrink-0">next</Badge>
                ) : (
                    <Badge className="flex-shrink-0 opacity-0 transition group-hover:opacity-100">
                        <Play size={16} className="w-3 px-0 h-4" />
                    </Badge>
                )}
            </div>
        </Link>
    )
}

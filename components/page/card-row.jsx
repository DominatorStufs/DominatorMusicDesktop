"use client";
// Horizontal scrolling row used by every page.
//
// Each page previously hand-rolled its own <ScrollArea> plus a different,
// copy-pasted skeleton block (five literal <div>s in some places). This gives
// all rows the same spacing, the same loading state and the same empty state.

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder matching the real song/album card dimensions. */
export function CardSkeleton() {
    return (
        <div className="w-[150px] sm:w-[180px] lg:w-[200px] flex-shrink-0">
            <Skeleton className="w-full aspect-square rounded-xl" />
            <Skeleton className="h-3.5 w-[75%] mt-3 rounded" />
            <Skeleton className="h-3 w-[45%] mt-2 rounded" />
        </div>
    );
}

/** Placeholder matching the circular artist card. */
export function ArtistSkeleton() {
    return (
        <div className="flex-shrink-0">
            <Skeleton className="h-[100px] w-[100px] rounded-full" />
            <Skeleton className="h-3 w-16 mt-2 mx-auto rounded" />
        </div>
    );
}

export default function CardRow({
    children,
    loading = false,
    count = 6,
    skeleton: SkeletonItem = CardSkeleton,
    empty = null,
    isEmpty = false,
}) {
    if (!loading && isEmpty && empty) {
        return <p className="text-sm text-muted-foreground py-6">{empty}</p>;
    }

    return (
        <ScrollArea className="rounded-md">
            <div className="flex gap-3 sm:gap-4 pb-1">
                {loading
                    ? Array.from({ length: count }).map((_, i) => <SkeletonItem key={`sk-${i}`} />)
                    : children}
            </div>
            <ScrollBar orientation="horizontal" className="hidden sm:flex" />
        </ScrollArea>
    );
}

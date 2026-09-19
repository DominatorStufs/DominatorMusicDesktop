"use client";
// Shared section heading for the home screen rows.
//
// Every row previously repeated the same markup with a plain `text-base` title,
// so all sections looked equally important and the page read as a flat list.
// This gives the rows a consistent, stronger hierarchy in one place.

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function SectionHeader({ title, subtitle, badge, href }) {
    const heading = (
        <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {badge}
            {href && (
                <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
            )}
        </div>
    );

    return (
        <div className="mb-4 flex items-end justify-between gap-4">
            <div className="min-w-0">
                {href ? (
                    <Link href={href} className="group inline-block">
                        {heading}
                    </Link>
                ) : (
                    heading
                )}
                {subtitle && (
                    <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                )}
            </div>
        </div>
    );
}

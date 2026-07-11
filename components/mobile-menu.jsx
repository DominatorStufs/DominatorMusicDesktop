"use client"
import { Home, Search } from "lucide-react";
import Link from "next/link";
import { useUIStyle } from "@/hooks/use-ui-style";

export default function MobileMenu() {
    const ctx = useUIStyle();

    if (!ctx?.mounted || ctx.uiStyle !== "ios") return null;

    return (
        <div className="fixed z-50 bottom-0 left-0 right-0 flex items-center justify-center pb-4 px-4 pointer-events-none">
            <div className="glass-surface pointer-events-auto flex bg-primary justify-center w-fit gap-2 items-center p-2 h-fit rounded-full shadow-lg border border-border/50 transition">
                <Link className="rounded-full h-9 w-11 flex items-center justify-center bg-background text-foreground text-sm gap-2 transition hover:opacity-80" href="/"><Home className="w-4 h-4" /></Link>
                <Link className="rounded-full h-9 w-11 flex items-center justify-center bg-background text-foreground text-sm gap-2 transition hover:opacity-80" href="/search/latest"><Search className="w-4 h-4" /></Link>
            </div>
        </div>
    );
};

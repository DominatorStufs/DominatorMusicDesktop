"use client"
import { Home, Search, Library } from "lucide-react";
import Link from "next/link";
import { useUIStyle } from "@/hooks/use-ui-style";
import { useMusic } from "./music-provider";

export default function MobileMenu() {
    const ctx = useUIStyle();
    const music = useMusic();

    if (!ctx?.mounted || ctx.uiStyle !== "ios") return null;

    // The player bar is also pinned to the bottom. Without this offset the tab
    // bar sat directly on top of the player controls.
    const raised = Boolean(music?.music);

    return (
        <div
            className={`fixed z-50 left-0 right-0 flex items-center justify-center px-4 pointer-events-none transition-all duration-300 ${
                raised ? "bottom-[88px] pb-0" : "bottom-0 pb-4"
            }`}
        >
            <div className="glass-surface mobile-tabbar pointer-events-auto flex bg-primary justify-center w-fit gap-2 items-center p-2 h-fit rounded-full shadow-lg border border-border/50 transition">
                <Link aria-label="Home" className="rounded-full h-9 w-11 flex items-center justify-center bg-background text-foreground text-sm gap-2 transition hover:opacity-80" href="/"><Home className="w-4 h-4" /></Link>
                <Link aria-label="Search" className="rounded-full h-9 w-11 flex items-center justify-center bg-background text-foreground text-sm gap-2 transition hover:opacity-80" href="/search/latest"><Search className="w-4 h-4" /></Link>
                <Link aria-label="Library" className="rounded-full h-9 w-11 flex items-center justify-center bg-background text-foreground text-sm gap-2 transition hover:opacity-80" href="/library"><Library className="w-4 h-4" /></Link>
            </div>
        </div>
    );
};

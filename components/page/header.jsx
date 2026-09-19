"use client"
import { ModeToggle } from "../ModeToggle";
import Logo from "./logo";
import { Button } from "../ui/button";
import Search from "./search";
import { ChevronLeft, Heart, Radio } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import AuthButton from "../auth-button";
import NowPlayingBadge from "../now-playing-badge";

export default function Header() {
    const path = usePathname();
    const isHome = path === "/";

    return (
        <header className="site-header glass-surface sticky top-0 z-40 flex flex-col gap-3 pt-4 pb-4 px-4 sm:px-6 md:px-12 lg:px-20 xl:px-28">
            <div className="flex items-center justify-between w-full gap-3">
                {/* Left: logo, plus a back control away from home */}
                <div className="flex items-center gap-2 min-w-0">
                    {!isHome && (
                        <Button
                            variant="secondary"
                            size="icon"
                            className="h-9 w-9 rounded-full flex-shrink-0"
                            asChild
                        >
                            <Link href="/" aria-label="Back to home">
                                <ChevronLeft className="w-4 h-4" />
                            </Link>
                        </Button>
                    )}
                    <Logo />
                </div>

                {/* Centre: search on desktop only (mobile gets its own row below) */}
                <div className="hidden sm:flex items-center gap-3 flex-1 max-w-md">
                    <Search />
                    <NowPlayingBadge />
                </div>

                {/* Right: these used to render ONLY on the home page, so theme,
                    library and sign-in vanished everywhere else. */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Link
                        href="/sources"
                        className="hidden sm:flex h-9 w-9 rounded-full bg-secondary items-center justify-center transition hover:opacity-80"
                        aria-label="Sources"
                        title="Multi-source status"
                    >
                        <Radio className="h-4 w-4" />
                    </Link>
                    <Link
                        href="/library"
                        className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center transition hover:opacity-80"
                        aria-label="Library"
                    >
                        <Heart className="h-4 w-4" />
                    </Link>
                    <ModeToggle />
                    <AuthButton />
                </div>
            </div>

            {/* Mobile search row. The layout used to render this separately and
                it drifted out of alignment with the header padding. */}
            <div className="sm:hidden flex items-center gap-2">
                <div className="flex-1 min-w-0">
                    <Search />
                </div>
                {/* The badge used to live only in the desktop-only centre
                    column, so it never appeared on a phone. */}
                <NowPlayingBadge />
            </div>
        </header>
    )
}

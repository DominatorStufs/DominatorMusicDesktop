"use client"
import Link from "next/link";

// Each genre gets its own gradient so the row reads as a set of destinations
// rather than a wall of identical grey pills.
const GENRES = [
    { label: "Bollywood", query: "bollywood hits", from: "from-rose-500", to: "to-orange-400" },
    { label: "Romantic", query: "romantic songs", from: "from-pink-500", to: "to-rose-400" },
    { label: "Party", query: "party songs", from: "from-fuchsia-500", to: "to-purple-500" },
    { label: "Chill", query: "chill lofi", from: "from-sky-500", to: "to-cyan-400" },
    { label: "Workout", query: "workout gym", from: "from-amber-500", to: "to-yellow-400" },
    { label: "Sad", query: "sad songs", from: "from-slate-500", to: "to-slate-400" },
    { label: "Devotional", query: "devotional bhajan", from: "from-emerald-500", to: "to-teal-400" },
    { label: "Hip-Hop", query: "hip hop rap", from: "from-violet-500", to: "to-indigo-500" },
];

export default function GenreChips() {
    return (
        <div className="mt-5 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-none">
            <div className="flex gap-2.5 w-max sm:w-auto sm:flex-wrap pb-1">
                {GENRES.map((g) => (
                    <Link
                        key={g.label}
                        href={`/search/${encodeURIComponent(g.query)}`}
                        className={`relative overflow-hidden flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium text-white
                            bg-gradient-to-br ${g.from} ${g.to}
                            shadow-sm transition duration-200 hover:brightness-110 hover:-translate-y-0.5 active:scale-95`}
                    >
                        {g.label}
                    </Link>
                ))}
            </div>
        </div>
    );
}

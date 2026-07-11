"use client"
import Link from "next/link";

const GENRES = [
    { label: "Bollywood", query: "bollywood hits" },
    { label: "Romantic", query: "romantic songs" },
    { label: "Party", query: "party songs" },
    { label: "Chill", query: "chill lofi" },
    { label: "Workout", query: "workout gym" },
    { label: "Sad", query: "sad songs" },
    { label: "Devotional", query: "devotional bhajan" },
    { label: "Hip-Hop", query: "hip hop rap" },
];

export default function GenreChips() {
    return (
        <div className="flex flex-wrap gap-2 mt-4">
            {GENRES.map((g) => (
                <Link
                    key={g.label}
                    href={`/search/${encodeURIComponent(g.query)}`}
                    className="px-4 py-2 rounded-full bg-secondary text-sm transition hover:opacity-80 active:scale-95"
                >
                    {g.label}
                </Link>
            ))}
        </div>
    );
}

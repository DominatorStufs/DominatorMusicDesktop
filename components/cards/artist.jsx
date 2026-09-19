import Link from "next/link";

export default function ArtistCard({ image, name, id }) {
    const safeName = name || "Unknown";
    return (
        <Link
            href={"/search/" + `${encodeURI(safeName.toLowerCase().split(" ").join("+"))}`}
            className="group block flex-shrink-0"
        >
            <div className="overflow-hidden h-[100px] w-[100px] rounded-full ring-2 ring-transparent transition duration-300 group-hover:ring-primary/40">
                <img
                    src={image}
                    alt={safeName}
                    loading="lazy"
                    className="rounded-full h-[100px] w-[100px] object-cover transition duration-300 group-hover:scale-105"
                />
            </div>
            <div className="mt-2 text-center">
                {/* Truncate with CSS - the old code printed only the first two
                    words, so "A.R. Rahman Jr" style names lost information. */}
                <h3 className="text-xs font-medium max-w-[100px] truncate mx-auto" title={safeName}>
                    {safeName}
                </h3>
            </div>
        </Link>
    )
}

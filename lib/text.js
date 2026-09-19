// ---------------------------------------------------------------------------
// Small text/list helpers shared by the home screen and the card components.
//
// The legacy JioSaavn endpoints used by lib/fetch.js return HTML-escaped names
// ("Kesariya (From &quot;Brahmastra&quot;)"). lib/sources/saavn.js already
// decoded these for the multi-source path, but the home screen calls the legacy
// helpers directly, so raw entities were rendering on screen.
// ---------------------------------------------------------------------------

/** Turn HTML entities coming from the JioSaavn API into real characters. */
export const decodeEntities = (str) => {
    if (typeof str !== "string") return str ?? "";
    return str
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&#039;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
        .trim();
};

/**
 * Drop repeated tracks from a result row.
 *
 * JioSaavn frequently returns the same song several times (different masters or
 * a "New Version" of the same title), which made the home rows look padded and
 * broken. Dedupe on id first, then on title+artist.
 */
export const dedupeSongs = (songs) => {
    const seen = new Set();
    const out = [];
    for (const song of songs || []) {
        if (!song?.id) continue;
        const title = decodeEntities(song.name || "").toLowerCase();
        const artist = decodeEntities(
            song.artists?.primary?.[0]?.name || song.primaryArtists || song.artist || ""
        ).toLowerCase();
        // Strip qualifiers so "Song" and "Song - New Version" collapse together.
        const base = title.replace(/\s*[-(\[].*$/, "").trim();
        const key = `${base}|${artist}`;
        if (seen.has(song.id) || seen.has(key)) continue;
        seen.add(song.id);
        seen.add(key);
        out.push(song);
    }
    return out;
};

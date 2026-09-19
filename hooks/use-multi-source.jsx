"use client";
// ---------------------------------------------------------------------------
// Client-side helpers for working with all three sources.
// None of your existing components were changed - these are just new tools.
// ---------------------------------------------------------------------------

import { useState, useCallback, useEffect } from "react";

/**
 * Search across all three sources.
 *
 *   const { results, loading, counts, search } = useMultiSearch();
 *   search("tum hi ho");
 */
export function useMultiSearch(initialQuery = "") {
    const [results, setResults] = useState([]);
    const [counts, setCounts] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const search = useCallback(async (query, { sources, limit = 15 } = {}) => {
        if (!query?.trim()) {
            setResults([]);
            return [];
        }
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ q: query, limit: String(limit) });
            if (sources?.length) params.set("sources", sources.join(","));
            const res = await fetch(`/api/music/search?${params}`);
            const data = await res.json();
            setResults(data.results || []);
            setCounts(data.counts || {});
            return data.results || [];
        } catch (e) {
            setError(e.message);
            setResults([]);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (initialQuery) search(initialQuery);
    }, [initialQuery, search]);

    return { results, counts, loading, error, search };
}

/**
 * Get a playable URL for a track from any source.
 * YouTube URLs are automatically routed through the proxy.
 *
 *   const url = await resolveAudioUrl("innertube:BjL7AuPsmEk", { name, artist });
 */
export async function resolveAudioUrl(compositeId, meta = {}) {
    const params = new URLSearchParams({ id: compositeId });
    if (meta.name) params.set("name", meta.name);
    if (meta.artist) params.set("artist", meta.artist);

    const res = await fetch(`/api/music/stream?${params}`);
    const data = await res.json();

    if (!data.success || !data.url) {
        return { url: null, error: data.error, tried: data.tried };
    }

    // JioSaavn plays directly; YouTube needs the proxy
    const needsProxy = ["innertube", "piped", "invidious"].includes(data.resolvedFrom);
    const url = needsProxy ? `/api/music/proxy?url=${encodeURIComponent(data.url)}` : data.url;

    return {
        url,
        directUrl: data.url,
        source: data.source,
        resolvedFrom: data.resolvedFrom,
        matchedTo: data.matchedTo,
        // True when the audio is a different recording to the one requested.
        substituted: Boolean(data.substituted),
        substitutedFrom: data.substitutedFrom || null,
        bitrate: data.bitrate,
    };
}

/** Hook form of the stream URL resolver */
export function useAudioUrl(compositeId, meta = {}) {
    const [state, setState] = useState({ url: null, loading: false, error: null, resolvedFrom: null });

    useEffect(() => {
        if (!compositeId) return;
        let cancelled = false;
        setState((s) => ({ ...s, loading: true, error: null }));

        resolveAudioUrl(compositeId, meta).then((r) => {
            if (cancelled) return;
            setState({
                url: r.url,
                loading: false,
                error: r.error || null,
                resolvedFrom: r.resolvedFrom || null,
                matchedTo: r.matchedTo || null,
            });
        });

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [compositeId, meta.name, meta.artist]);

    return state;
}

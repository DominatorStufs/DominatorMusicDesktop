const api_url = process.env.NEXT_PUBLIC_API_URL;

// Important: this file is imported on almost every page, so it must NEVER
// throw at import time - if NEXT_PUBLIC_API_URL isn't set, throwing here
// would crash the entire app with a blank white screen. Instead we warn
// once and let each function fail gracefully (the pages already handle
// failed/undefined responses).
if (!api_url && typeof window !== "undefined") {
    console.warn(
        "[DominatorMusic] NEXT_PUBLIC_API_URL is not set. Add it in Vercel → Project → Settings → Environment Variables, then redeploy."
    );
}

const request = async (path) => {
    if (!api_url) {
        throw new Error("Missing NEXT_PUBLIC_API_URL environment variable");
    }
    return fetch(`${api_url}${path}`);
};

export const getSongsByQuery = async (e) => {
    try {
        return await request(`search/songs?query=${e}`);
    }
    catch (err) {
        console.log(err);
    }
};

export const getSongsById = async (e) => {
    try {
        return await request(`songs/${e}`);
    }
    catch (err) {
        console.log(err);
    }
};

export const getSongsSuggestions = async (e) => {
    try {
        return await request(`songs/${e}/suggestions`);
    }
    catch (err) {
        console.log(err);
    }
};

export const searchAlbumByQuery = async (e) => {
    try {
        return await request(`search/albums?query=${e}`);
    }
    catch (err) {
        console.log(err);
    }
};

export const getAlbumById = async (e) => {
    try {
        return await request(`albums?id=${e}`);
    }
    catch (err) {
        console.log(err);
    }
};

// Tracks how long the user actually listens to each song (in seconds) and
// aggregates it into weekly / monthly "Wrapped"-style stats.
// Everything lives in localStorage - it's per-device, not a real account,
// but it's enough for a personal recap.

const SESSIONS_KEY = "listen-sessions";
const SHOWN_KEY = "stats-shown";

const read = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
};

const write = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { }
};

// Call when a listen session ends (song changes / player closes) with how
// many seconds were actually played.
export const logListenSession = (song, seconds) => {
    if (!song?.id || !seconds || seconds < 5) return; // ignore accidental taps
    const sessions = read(SESSIONS_KEY, []);
    sessions.push({
        id: song.id,
        name: song.name,
        artist: song.artist,
        seconds: Math.round(seconds),
        timestamp: Date.now(),
    });
    // cap history so localStorage doesn't grow forever
    write(SESSIONS_KEY, sessions.slice(-1000));
};

const aggregate = (sessions) => {
    const totalSeconds = sessions.reduce((a, s) => a + s.seconds, 0);
    const bySong = {};
    const byArtist = {};
    sessions.forEach((s) => {
        bySong[s.id] = bySong[s.id] || { id: s.id, name: s.name, artist: s.artist, seconds: 0, count: 0 };
        bySong[s.id].seconds += s.seconds;
        bySong[s.id].count += 1;
        if (s.artist) byArtist[s.artist] = (byArtist[s.artist] || 0) + s.seconds;
    });
    const topSong = Object.values(bySong).sort((a, b) => b.seconds - a.seconds)[0] || null;
    const topArtistEntry = Object.entries(byArtist).sort((a, b) => b[1] - a[1])[0];
    return {
        totalMinutes: Math.round(totalSeconds / 60),
        songCount: sessions.length,
        uniqueSongs: Object.keys(bySong).length,
        topSong,
        topArtist: topArtistEntry ? topArtistEntry[0] : null,
    };
};

export const getWeeklyStats = () => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const sessions = read(SESSIONS_KEY, []).filter((s) => s.timestamp >= weekAgo);
    return aggregate(sessions);
};

export const getMonthlyStats = () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const sessions = read(SESSIONS_KEY, []).filter((s) => s.timestamp >= monthStart);
    return aggregate(sessions);
};

// Decides whether to auto-pop the recap: weekly on Sundays, monthly on the 1st,
// each shown at most once per period.
export const getDueRecap = () => {
    const today = new Date();
    const shown = read(SHOWN_KEY, {});

    if (today.getDate() === 1) {
        const key = `${today.getFullYear()}-${today.getMonth()}`;
        if (shown.month !== key) {
            return { type: "monthly", stats: getMonthlyStats() };
        }
    }
    if (today.getDay() === 0) {
        const key = getWeekKey(today);
        if (shown.week !== key) {
            return { type: "weekly", stats: getWeeklyStats() };
        }
    }
    return null;
};

export const markRecapShown = (type) => {
    const today = new Date();
    const shown = read(SHOWN_KEY, {});
    if (type === "weekly") shown.week = getWeekKey(today);
    if (type === "monthly") shown.month = `${today.getFullYear()}-${today.getMonth()}`;
    write(SHOWN_KEY, shown);
};

function getWeekKey(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - firstDayOfYear) / 86400000);
    const week = Math.ceil((days + firstDayOfYear.getDay() + 1) / 7);
    return `${date.getFullYear()}-W${week}`;
}

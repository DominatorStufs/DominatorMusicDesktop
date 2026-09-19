# MusicHub

MusicHub is a web music app built using Next.js 14, App Router, and an unofficial music API. The user interface is styled with Tailwind CSS.

[![Follow me](https://img.shields.io/github/followers/DominatorStufs?style=social)](https://github.com/DominatorStufs)
[![Star this Repo](https://img.shields.io/github/stars/DominatorStufs/DominatorMusicDesktop?style=social)](https://github.com/DominatorStufs/DominatorMusicDesktop)

<br/>

![Homepage](/public/home.png)

## Features

- Browse and listen to a wide variety of music.
- **Multi-source search** — results from JioSaavn, YouTube Music (InnerTube) and
  Piped in one list, with a badge showing where each track came from.
- **Automatic source fallback** — if one source cannot serve a stream, the next
  one is tried, so playback rarely fails outright.
- Eight UI styles (Normal, Flat 2D, iOS, Neon, Retro, Pastel, Cyberpunk, Mono),
  an optional glass effect, and a custom accent colour.
- Light and Dark mode for user preference.
- Search for your favorite artists, albums, and tracks.
- Enjoy a seamless music listening experience.

## Screenshots

### Homepage

![Homepage](/public/home.png)

### Search Page

![Search Page](/public/search.png)

### Album Page

![Album Page](/public/album.png)

### Music Page

Player

![Music Page](/public/player.png)

Mobile Player

![Music Page](/public/player2.png)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/DominatorStufs/DominatorMusicDesktop.git
cd DominatorMusicDesktop
```

2. Install dependencies:

```bash
npm install or pnpm install
```

3. Run the development server:

```bash
npm run dev or pnpm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser to explore MusicHub.

## Setup Api

fork and deploy your own repo of `https://github.com/sumitkolhe/jiosaavn-api` get the deployment url and paste in .env file refer .env.example

## Multi-Source Music Fetching

DominatorMusic pulls tracks from eight sources at once. Five of them can serve
audio — JioSaavn, Audius, InnerTube (the same private YouTube API that Metrolist
and InnerTune use), Piped and Invidious — and three are metadata only: Deezer,
Spotify and Apple Music. The
section below documents the whole system: how to call it, how the fallback
chain is ordered, every bug that was fixed along the way, and what realistically
works once the app is deployed to a server.

---

### What was added

```
lib/sources/innertube.js        InnerTube client (same approach as Metrolist / InnerTune)
lib/sources/piped.js            Piped fallback (YouTube proxy instances)
lib/sources/invidious.js        Invidious fallback (third YouTube client, search/metadata)
lib/sources/audius.js           Audius decentralised network (full 320kbps streams, no key)
lib/sources/itunes.js           Apple Music via the public iTunes endpoint (catalogue + preview)
lib/sources/saavn.js            JioSaavn adapter, normalized to a shared shape
lib/sources/deezer.js           Deezer public API (search, charts, ISRC bridge)
lib/sources/spotify.js          Spotify embed data (catalogue, artwork, link import)
lib/sources/match.js            Cross-source matching (metadata track -> playable track)
lib/sources/lyrics.js           Time-synced lyrics from LRCLIB (open, no key)
lib/sources/index.js            Unifying layer + fallback chain
lib/unified-song.js             Converts any source into the JioSaavn-style shape the UI expects

app/api/music/search/route.js   Search across all three sources at once
app/api/music/stream/route.js   Stream URL resolution + automatic fallback
app/api/music/info/route.js     Metadata for a single track
app/api/music/related/route.js  Related / radio tracks for any source
app/api/music/link/route.js     Resolve a pasted Spotify / Deezer link
app/api/music/discover/route.js Home-screen rows (Deezer charts, Spotify playlists, Audius trending)
app/api/music/lyrics/route.js   Time-synced lyrics for the player
app/api/music/proxy/route.js    CORS + Range proxy for YouTube audio
app/api/music/health/route.js   Live diagnostics

components/source-badge.jsx     Badge showing which source a track came from
components/link-import.jsx      Paste a Spotify / Deezer link, import the tracks
components/lyrics-panel.jsx     Scrolling, tap-to-seek lyrics
hooks/use-multi-source.jsx      Client-side hooks
app/(root)/sources/page.jsx     /sources test page
```

`lib/fetch.js` and `.env.local` were never modified. Plain JioSaavn IDs still
follow the original code path, so existing behaviour is unchanged.

---

### How to use it

#### Search across all sources

```js
const res = await fetch("/api/music/search?q=tum hi ho");
const { results } = await res.json();
// each result: { id: "innertube:abc", source, sourceLabel, name, artist, image }
```

Restrict to specific sources:

```js
fetch("/api/music/search?q=blinding lights&sources=innertube,piped")
```

#### In a React component

```jsx
import { useMultiSearch } from "@/hooks/use-multi-source";

const { results, counts, loading, search } = useMultiSearch();
search("arijit singh");
// each item exposes sourceLabel: "JioSaavn" / "YouTube Music" / "YouTube"
```

#### Playing a track

```js
import { resolveAudioUrl } from "@/hooks/use-multi-source";

const { url, resolvedFrom, matchedTo } = await resolveAudioUrl(song.id, {
    name: song.name,
    artist: song.artist,
});
audioRef.current.src = url;
```

---

### The fallback chain

When a YouTube track is played:

```
1. Look for the same song on JioSaavn   -> full length, 320kbps
2. No confident match -> try InnerTube  (IOS -> ANDROID_MUSIC -> TVHTML5 -> WEB_REMIX)
3. Still nothing      -> try Piped instances
4. Last resort        -> relaxed JioSaavn match (guarded by word overlap)
```

The ordering is deliberate and is explained under Fix #4 below.

---

### Fix #1 — InnerTube returned "400 Precondition check failed"

**Cause:** outdated client versions and a hardcoded legacy API key. InnerTune's
public source code dates from 2022–23 and YouTube has moved on since.

**Fix:**

1. Updated `clientVersion` values — IOS `19.29.1` to `20.03.02`,
   ANDROID_MUSIC `5.01` to `8.12.53`, WEB_REMIX to `1.20241209.01.00`
2. Removed the `?key=` query parameter — modern InnerTube does not need it, and
   sending an old key is what triggered the precondition error
3. Reordered clients so IOS is tried first (most reliable)
4. Added required fields such as `deviceMake` and `osName`

---

### Fix #2 — "no supported source was found"

**Symptom:** a stream URL was returned but the player refused to decode it.

**Cause:** the code picked the highest-bitrate audio format, which on YouTube is
almost always itag 251 — `audio/webm; codecs="opus"`. Opus-in-WebM is not
supported by Safari, iOS, or several Android browsers.

**Fix:** `pickPlayableFormat()` now prefers `audio/mp4` (AAC, itag 140), which
plays everywhere, and only falls back to WebM when no mp4 exists. Slightly lower
bitrate (131k vs 167k), universally playable.

---

### Fix #3 — integrated into the real site

The multi-source code originally only worked on the `/sources` demo page. These
pages now use all three sources:

| File | Change |
|---|---|
| `app/(root)/search/_components/Search.jsx` | "More from YouTube" section below JioSaavn results |
| `app/(root)/page.js` | "From YouTube Music" row + source badges on every section |
| `app/(player)/_components/Player.jsx` | Detects `innertube:` / `piped:` IDs, loads via the unified layer |
| `components/cards/player.jsx` | Same for the mini player |
| `components/cards/song.jsx` | Optional `source` prop renders a badge |

---

### Fix #4 — the real reason playback failed

What googlevideo.com actually does when requested from a datacenter IP
(Vercel / AWS / CI sandbox):

| Request | Result |
|---|---|
| No `Range` header (what `<audio>` sends first) | 403 |
| `Range: bytes=0-` (open ended) | 403 |
| `Range: bytes=0-1048575` (bounded, 1MB) | 206 OK |
| `Range: bytes=1048576-...` (any later chunk) | 403 |

A server only ever receives the first ~1MB, roughly 60 seconds of audio, and the
browser's very first request was rejected outright.

Every workaround was tested and none of them help:

- lower-bitrate format (itag 139, smaller file) — 403
- `&range=` query parameter instead of the header — 403
- `&sq=` sequence parameter — 403
- `&alr=yes` redirect trick — 403
- `cpn` token attached — 403
- sequential chunks on a warm connection with the iOS user-agent — 403
- HLS manifest — not present in the iOS player response
- direct fetch from the browser — googlevideo sends no CORS headers

#### What changed

**1. The proxy speaks googlevideo's dialect.** It always sends a bounded `Range`
upstream, pulls the file in 1MB chunks, streams them as one continuous response,
and closes cleanly instead of erroring when YouTube cuts off.

**2. Playback priority was inverted.** A 60-second clip is not a song, so the
resolver looks for the track on JioSaavn first and only uses YouTube audio when
no confident match exists. YouTube is still used for search, where it genuinely
helps by surfacing songs JioSaavn does not carry.

**3. Smart match scoring.** Naive title matching mapped "Dil" to "Dil Bilei Meow
Meow". Scoring now weighs:

| Signal | Points |
|---|---|
| Exact title match | +100 |
| Title prefix match | +40 |
| Title substring match | +15 |
| Exact artist match | +60 |
| Partial artist match | +35 |
| Duration within 3s | +45 |
| Duration within 10s | +20 |
| Duration off by more than 60s | −30 |
| Length penalty | −0.5 per extra character |

Minimum confidence is 40, lowered to 20 when the duration agrees within 3
seconds. Below that, real YouTube audio is preferred over a wrong song.

Titles are also cleaned before searching, because YouTube titles carry noise
JioSaavn does not use: "Official Video", "(From ...)", "| Label", "4K",
"- Topic", "VEVO". Three query shapes are tried and the results merged.

---

### Fix #5 — percent-encoded IDs broke every YouTube track

**Symptom:** opening a YouTube track from the mini player or a recommendation
card showed a permanently blank screen.

**Cause:** composite IDs contain a colon (`innertube:RTIX2qjczJM`). During
client-side navigation Next.js encodes it as `%3A`, and every check in the
codebase tested the raw form:

```js
"innertube:RTIX2qjczJM".startsWith("innertube:")    // true
"innertube%3ARTIX2qjczJM".startsWith("innertube:")  // false
```

The app therefore treated it as a JioSaavn ID, queried the wrong API, got a 404,
and rendered nothing. It only affected YouTube tracks because JioSaavn IDs never
contain a colon.

**Fix:** a central `normalizeId()` in `lib/unified-song.js` (handles
double-encoded `%253A` too), mirrored server-side in `parseId()`, plus proper
encoding on all seven navigation links.

---

### Fix #6 — hosted deployments could not resolve any YouTube track

This was the reason the live Vercel deployment failed while local development
worked fine.

**Symptom:** `/api/music/stream?id=innertube:...` returned 404 with:

```
tried: ["saavn-match: no match found",
        "innertube: IOS:LOGIN_REQUIRED | ANDROID_MUSIC:LOGIN_REQUIRED
                  | TVHTML5:ERROR | WEB_REMIX:LOGIN_REQUIRED",
        "piped: all piped instances failed"]
```

**Cause:** on Vercel every InnerTube player client is blocked, so the app could
not learn the track's *title*. Without a title there is nothing to search for on
JioSaavn — hence "no match found", even though the song was sitting right there
in the JioSaavn catalogue.

**Fix:** YouTube's public **oEmbed** endpoint is not behind the bot check and
answers 200 from any IP:

```
https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=VIDEO_ID&format=json
```

`getSongInfo()` now falls back to oEmbed when every player client refuses, which
restores the title and artist and lets the JioSaavn match proceed.

Verified by bypassing the player endpoint entirely and using only oEmbed +
JioSaavn — the exact conditions on Vercel:

```
Shararat (From "Dhurandhar")  -> Shararat                 OK
Apna Bana Le (From "Bhediya") -> Apna Bana Le             OK
Dil                           -> Dil                      OK
Kesariya (From "Brahmastra")  -> Kesariya                 OK
Phir Bhi Tumko Chaahunga      -> Phir Bhi Tumko Chaahunga OK
Pehli Dafa                    -> Pehli Dafa               OK
Tujhko (From "Cocktail 2")    -> Tujhko                   OK
Dil Pagal                     -> Dil Paagal               OK
Adhi Adhi Raat                -> Adhi Adhi Raat           OK

10/10 playable on a Vercel-like host
```

A relaxed last-resort match was also added so the API never returns a bare 404,
guarded by a word-overlap check requiring at least 50% of title words to match —
a wrong song is worse than an honest failure.

---

### Can InnerTube be made to look like a real Android device?

This was implemented in full and measured. The short answer is no.

What was added (all of it correct, and kept in the codebase):

- proper numeric client IDs — `X-YouTube-Client-Name: 21` for ANDROID_MUSIC
  (everything was previously hardcoded to `1`, which means WEB and contradicted
  the user-agent being sent)
- a stable per-process `X-Goog-Visitor-Id`
- a `cpn` content playback nonce per request, as the real apps send
- realistic device fingerprint: Pixel 8, Android 14, SDK 34
- current app version 8.12.53
- `timeZone`, `utcOffsetMinutes`, `Accept-Language`, `X-Goog-Api-Format-Version`

Measured side by side:

```
OLD (name=1, no visitor)      LOGIN_REQUIRED  "Please sign in"
NEW (name=21, visitor, cpn)   LOGIN_REQUIRED  "Please sign in"
```

No difference at all. YouTube does not trust headers — it looks at the IP the
request originates from. A Vercel function runs from a known datacenter range,
and no amount of header spoofing turns a datacenter IP into a phone. Since 2024
there is also **PO Token (Proof of Origin)**, a cryptographic attestation
produced by running BotGuard JavaScript, which cannot be faked — only genuinely
executed.

Metrolist and InnerTune work because they genuinely run on a phone, on a
residential IP. They are not spoofing anything.

---

### What actually works where

| Source | Search | Stream (sandbox) | Stream (Vercel) |
|---|---|---|---|
| JioSaavn | yes | yes, 320kbps | yes, 320kbps |
| InnerTube | yes | yes, ~60s only | blocked |
| Piped | yes | instances down | instances down |

On a hosted deployment, **JioSaavn does the playback heavy lifting and that is
the correct design.** YouTube contributes a far larger search catalogue. Current
match rate is roughly 14 out of 16 popular tracks resolving to full-length
JioSaavn audio; the rest show a "Preview ~1 min" badge or fail honestly.

---

### Options for full-length YouTube playback

| Option | Works | Notes |
|---|---|---|
| Tauri desktop app | yes | Runs on the user's own IP — this repo is already named DominatorMusicDesktop |
| Self-host at home (PC / Raspberry Pi) | yes | Residential IP |
| Residential proxy in front of Vercel | yes | Paid, roughly $5–15/month |
| PO Token provider (bgutil-ytdlp-pot-provider) | partly | Requires a separate service, breaks often |
| Header / device spoofing | no | Tested and measured; makes no difference |

---

### Diagnostics

Open `/sources` in the running app to search across sources, filter by source,
play any track, and see which source each one resolved from.

After deploying, check:

```
https://your-site.vercel.app/api/music/health
```

It reports which sources are alive for both search and streaming.

## Spotify & Deezer

Both services are wired in as **metadata sources**. Neither will stream a
full-length track to an app without a paid account and a private API, so
DominatorMusic uses them for what they *will* give away — catalogue, artwork and
identity — and plays the audio from JioSaavn.

This is the same design the [Spotui](https://github.com/Spotui/Spotui) Android
app uses: Spotify supplies the library, a different service supplies the sound.

### What each one actually provides

| | Spotify | Deezer |
|---|---|---|
| Search | ✗ (no open endpoint) | ✓ `api.deezer.com/search` |
| Track / album / playlist metadata | ✓ via the embed pages | ✓ public API |
| Artwork | ✓ | ✓ |
| ISRC (the cross-service id) | ✗ | ✓ `track/isrc:<ISRC>` |
| Charts | ✗ | ✓ |
| Full-length audio | ✗ | ✗ (needs an account ARL) |
| 30-second preview | ✓ `p.scdn.co` | ✓ `cdnt-preview.dzcdn.net` |
| Login or API key needed | **No** | **No** |

Spotify's data comes from the pages behind its embeddable player
(`open.spotify.com/embed/track/<id>`), which return a `__NEXT_DATA__` blob with
the full entity — including a complete track list for albums and playlists.
`open.spotify.com/api/token` is **not** used: it now rejects any request without
an `sp_dc` session cookie.

### On the home screen

Two rows are served by `/api/music/discover`:

- **Hot Hits Hindi** — Spotify's own editorial playlist, read from its embed data.
- **Global Chart** — Deezer's live chart, a genuinely open endpoint.

Both are catalogue rows: playing a track from either matches it onto JioSaavn
first, as described below.

### Importing a link

Open **Library** and paste a link into *Import from a link*. Tracks, albums and
playlists all work, from either service:

```
https://open.spotify.com/playlist/37i9dQZF1DX0XUfTFmNBRM
https://open.spotify.com/track/0V3wPSX9ygBnCm8psDIegu
spotify:album:6i7mF7whyRJuLJ4ogbH2wh
https://www.deezer.com/album/302127
```

Or call the endpoint directly:

```
GET /api/music/link?url=<spotify or deezer url>
```

### How playback works

A Spotify or Deezer track is stored with a composite id (`spotify:<id>`). When
it is played, `lib/sources/match.js` looks for the same recording on JioSaavn
and streams that instead — full length, 320 kbps.

Matching is scored on title, artist and duration, and is deliberately strict:

- Titles are stripped of the decoration each service adds, so
  `Kesariya (From "Brahmastra")` and `Kesariya - Official Video` both reduce to
  the same thing.
- Artists are compared as a **set**, because services disagree about both the
  order and who counts as the artist — JioSaavn often credits the composer
  (`Mithoon`) where Spotify credits the singer (`Arijit Singh`).
- If the credits have nothing in common the match is rejected outright, even
  when the title and runtime line up. That case is almost always a cover or a
  karaoke version, and playing one of those is worse than admitting defeat.

When no confident match exists the player falls back to the service's own
30-second preview and says so, rather than silently playing the wrong song.

```
spotify:5uvG5xETXhVkBSr09RBjyC  ->  saavn-match      "Tera Mera Rishta"    (full, 320kbps)
spotify:0V3wPSX9ygBnCm8psDIegu  ->  spotify-preview  "Anti-Hero"           (30s, not on JioSaavn)
deezer:3191972361               ->  saavn-match      "Tum Hi Ho"           (full, 320kbps)
```

### Dead ends, for the record

These were all tested live and do **not** work, so there is no point retrying
them:

- `open.spotify.com/api/token` without an `sp_dc` cookie → `400 Unauthorized request`
- Odesli / song.link (the usual ISRC bridge) → `401 PUBLIC_API_ACCESS_DEPRECATED`
- The SpotiFLAC community proxies (`*-foss.spotbye.qzz.io`) → DNS no longer resolves
- The monochrome / squid.wtf TIDAL instances → suspended or offline
- Deezer full streams → need a personal ARL cookie plus Blowfish decryption

## Source fidelity

**If you pick a YouTube result, you get the YouTube recording.**

This used to be wrong. The resolver searched JioSaavn *first* for every YouTube
track, on the theory that a full-length 320 kbps file beats a stream that a
datacenter IP can only read the first minute of. The effect was that picking a
YouTube result and getting a JioSaavn recording was indistinguishable from a
bug: a different take, a different mix, sometimes a different language, with no
indication that a swap had happened.

The order is now:

1. **The source the user chose.** A YouTube track is requested from InnerTube,
   then Piped.
2. **A confident match**, only if step 1 genuinely failed. From a datacenter IP
   every YouTube client answers `LOGIN_REQUIRED`, so this is a common path.
3. **A relaxed match** as a last resort — still artist-checked, so it will never
   hand back a stranger's cover.

Whenever the audio is *not* the recording that was asked for, the response says
so and the player tells the user:

```json
{
  "resolvedFrom": "saavn-match",
  "substituted": true,
  "substitutedFrom": "YouTube Music",
  "matchedTo": { "name": "Tum Hi Ho", "artist": "Arijit Singh" }
}
```

### The chosen source is never overwritten in the UI

A second version of this bug survived the first fix. The player stored a single
`source` value, and it stored `resolvedFrom` in it — so a track picked from
YouTube that fell back to a match had its badge *rewritten* to JioSaavn. The
mini bar and the full-screen page also resolved the track independently, so
expanding a playing song re-ran the whole chain and the two views could disagree
about what was playing.

Both are fixed:

- A resolved track now carries **`requestedSource`** (what the user picked, never
  changed) alongside **`playbackSource`** (where the bytes came from). The badge
  shows the first; a `via …` chip appears next to it only when they differ.
- Resolutions are cached per track id, so expanding to full screen reuses the
  running result instead of re-resolving. The substitution notice is shown once,
  by whichever view resolved it first.

### Every source routes through the unified layer

The deepest cause was an id test. Both players gated on `isYouTubeId`, which is
true only for `innertube:` and `piped:`. A `spotify:` or `deezer:` id therefore
fell through to the **legacy JioSaavn path**, which called `getSongsById()` with
an id JioSaavn has never heard of — and that path hardcodes
`setSongSource("saavn")`. So a Spotify track reported JioSaavn no matter what
the resolver had actually done.

That test is now `isUnifiedId`, which is true for any prefixed id. Only a bare,
legacy JioSaavn id (`rjkrTnma`, no colon) keeps the old path. The same fix was
applied to the recommendations panel, which was asking JioSaavn for tracks
related to a Spotify id.

`SongCard` also derives its badge from the id, so any row — home, library,
history, search — tags Spotify and Deezer tracks without the caller passing a
prop. The mini player bar shows the badge too, not just the full-screen view.

### The song does not silently become a different song

Three separate faults made a YouTube or Spotify track turn into a JioSaavn one
shortly after playback started. All were found by driving the real UI in a
headless browser, not by reading the code.

**1. An empty `src` made the player load the page as audio.** The `<audio>`
element rendered `src={audioURL}` while `audioURL` was still `""`. An empty
`src` resolves against the current document, so the browser fetched the HTML
page and treated it as a media file. That produced a bogus `duration`, which
tripped the auto-advance effect, which navigated to the next recommendation —
all within about a second, before any badge could render. `src` is now omitted
entirely until a real URL exists.

**2. A truncated stream looked like a finished song.** googlevideo serves only
the first ~1MB to a datacenter IP, so playback stops near the one-minute mark
while `duration` still reports the full length. `currentTime === duration` then
read as "song over" and auto-advanced. Auto-advance is now skipped whenever the
audio is `truncated` or a 30-second `preview`; playback simply stops, and the
pill explains why.

**3. Recommendations dragged the queue onto another service.** Related tracks
for a YouTube song came back as `saavn:` ids, so the next song genuinely was a
JioSaavn one. `getRelated` now tries the sibling YouTube client and then a
YouTube artist search before it will fall back to JioSaavn.

The badge is derived from the id inside the card components, not passed in by
each caller, so every surface tags tracks consistently: the home rows, search
results, Continue Listening, Liked Songs, the up-next card, the mini player bar
and the full-screen player.

| Picked | Streamed | Badge shown |
|---|---|---|
| YouTube Music | YouTube Music | `YouTube Music` |
| YouTube | YouTube Music | `YouTube` + `via YouTube Music` |
| Spotify | JioSaavn match | `Spotify` + `via JioSaavn` |
| Deezer | Deezer preview | `Deezer` + `via Deezer preview` |
| Apple Music | JioSaavn match | `Apple Music` + `via JioSaavn` |
| Audius | Audius | `Audius` |
| JioSaavn | JioSaavn | `JioSaavn` |

Callers that genuinely want the best available audio rather than the exact
source can opt in with `preferMatch`:

```
GET /api/music/stream?id=innertube:VIDEOID&preferMatch=1
```

Spotify and Deezer are the exception: they *never* serve full audio, so a
substitution there is expected rather than a surprise. It is still flagged, but
with a separate `metadataOnly` flag, because the wording matters. Telling a user
that "Spotify could not stream this track" reads like a fault; the truth is that
Spotify only publishes catalogue data and 30-second previews. Those tracks now
say **"Spotify does not offer full tracks, so … is playing"**, while a genuine
failure of a streaming source keeps the "could not stream" wording.

### Audius, Apple Music and Invidious

A later research round probed every open music API that could be reached without
a key, and three of them survived a live test.

**Audius** is the most useful addition by a distance. It is a decentralised
network where artists publish their own work, which means there is no anti-bot
system to fight: `GET /v1/tracks/{id}/stream` redirects straight to a full-length
320kbps MP3, with no key, no cookie and no IP blocking. It is the only source
besides JioSaavn that reliably serves complete audio from a datacenter, and
unlike the YouTube clients it is not one policy change away from breaking. The
catalogue is independent and electronic-leaning rather than mainstream, so it
gets its own home row and search row instead of being folded into the others.

One catch: tracks can be gated (`is_streamable: false` or `is_stream_gated`), and
requesting one of those returns `404 track not found`. The adapter filters them
out of search results and checks again before resolving a stream, so a gated
track never reaches the player.

**Apple Music** is read through the public iTunes Search endpoint. It needs no
key, and its Indian catalogue and artwork are better than Deezer's — searches can
be pinned to the `IN` storefront and fall back to `US`. Apple only publishes a
30-second preview, so it behaves exactly like Spotify and Deezer: the recording
is matched onto a full-length source on play, and the badge says so.

**Invidious** is added as a third YouTube client. YouTube playback now tries the
source the user picked, then the other two clients, because InnerTube, Piped and
Invidious fail independently of one another. In practice Invidious search is
reliable but its `/api/v1/videos/{id}` endpoint returns no audio formats from a
datacenter IP, so it mostly contributes search results and a retry slot rather
than streams.

Probed and rejected: every public JioSaavn wrapper instance (`saavn.dev`,
`saavn.me` and the Vercel mirrors) is dead, Jamendo's demo key returns empty
results, and the public Cobalt instance is offline.

| Source | Key needed | Playback | Role |
|---|---|---|---|
| JioSaavn | no | full | primary |
| Audius | no | full, 320kbps | primary, independent catalogue |
| InnerTube | no | full (IP-dependent) | YouTube catalogue |
| Piped | no | full (instance-dependent) | YouTube fallback |
| Invidious | no | rarely | YouTube search + retry slot |
| Deezer | no | 30s preview | metadata |
| Spotify | no | none | metadata |
| Apple Music | no | 30s preview | metadata, strong Indian catalogue |

```
GET /api/music/search?q=lofi&sources=audius
GET /api/music/search?q=kesariya&sources=itunes
GET /api/music/discover?feed=audius-trending&limit=20
GET /api/music/discover?feed=audius-underground&limit=20
GET /api/music/health          # now probes all eight sources
```

### Now Playing tag

The header carries a live "Now Playing" pill that links back to the track. It
names the source it was picked from — `Now Playing · Spotify` — and it renders
on mobile as well, next to the search field. It previously sat inside the
desktop-only centre column, so it never appeared on a phone.

---

## Lyrics

Time-synced lyrics come from [LRCLIB](https://lrclib.net) — an open community
database with no API key, no account and no rotating token.

The obvious alternatives do not work for a web app:

| Source | Why not |
|---|---|
| Spotify lyrics | Musixmatch-backed, requires an `sp_dc` account cookie |
| Musixmatch API | Requires a rotating desktop-app token |
| Genius | No timing data, so lyrics cannot scroll |

Press the microphone button in the player. Lines scroll with the track, and
tapping one seeks to it. Tracks with only plain lyrics show them as a block;
tracks with none say so.

```
GET /api/music/lyrics?artist=Arijit+Singh&track=Tum+Hi+Ho&duration=261
GET /api/music/lyrics?id=saavn:abc123
```

Passing `duration` matters — it is what separates the original recording from a
remix or a live take with the same name.

---

## Last.fm Scrobbling

Every track you play can be sent to your [Last.fm](https://www.last.fm) profile,
the same way desktop players like Navidrome or foobar2000 do it.

There is nothing to configure on the server. Each user brings their own Last.fm
API key, so a fork of this project works out of the box and no key has to be
shared between everyone using the same deployment.

### Setup

1. Sign in to Last.fm and open <https://www.last.fm/api/account/create>.
2. Fill in an application name (for example `DominatorMusic`) and a description.
   Leave the callback URL blank - the app supplies it at runtime.
3. Last.fm shows an **API key** and a **shared secret** straight away. Copy both.
4. In the app, press the **Settings** button in the top right corner and choose
   **Setup Last.fm Key**.
5. Paste the key and the secret, press **Save key**, then press **Connect** and
   approve the app on the Last.fm page that opens.

That is it - every play from then on is scrobbled. To stop, press **Sign out**
to keep the key for later, or **Remove** to delete it entirely.

### How it works

- The key and secret live in that browser's `localStorage` and nowhere else.
  They are never written to the server's disk, environment or logs.
- Last.fm's write endpoints send no CORS headers and every call must carry an
  md5 signature, so signed calls are proxied through `/api/lastfm/*`. Those
  routes sign the single request with the credentials passed in and forget them
  as soon as the response is sent.
- Approving the app returns a one-time token to `/lastfm/callback`, which is a
  client page: it exchanges the token for a permanent session key using the key
  stored in that browser.
- A play is submitted once it passes Last.fm's own rules: the track must be
  longer than 30 seconds and must have been played for at least half its length
  or four minutes, whichever comes first.
- Titles are cleaned before submission. JioSaavn returns names such as
  `Kesariya (From "Brahmastra")`, which does not match the real track, so the
  film/album qualifier is stripped. Genuine variants (`Remix`, `Live`,
  `Acoustic`) are kept because those are separate recordings on Last.fm.
- Scrobbles that fail (no signal, server down) are queued in `localStorage` and
  retried automatically the next time the app loads.

## Contributing

Contributions are welcome! Please follow our [Contribution Guidelines](CONTRIBUTING.md).

## License

This project is licensed under the [MIT License](LICENSE).

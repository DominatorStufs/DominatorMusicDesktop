# Multi-Source Setup

This documentation now lives in the main [README.md](README.md), under the
**Multi-Source Music Fetching** section.

It covers:

- What was added (files and API routes)
- How to search, and how to resolve a playable URL
- The JioSaavn / InnerTube / Piped fallback chain
- Fix #1 — InnerTube "400 Precondition check failed"
- Fix #2 — "no supported source was found" (WebM/Opus vs AAC)
- Fix #3 — integrating multi-source into the real pages
- Fix #4 — the 1MB datacenter cap on googlevideo, and match scoring
- Fix #5 — percent-encoded composite IDs breaking every YouTube track
- Fix #6 — oEmbed metadata fallback for hosted deployments
- Whether InnerTube can be made to look like a real Android device (measured)
- What works where, and the options for full-length YouTube playback

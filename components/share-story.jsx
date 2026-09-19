"use client"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
    Credenza,
    CredenzaContent,
    CredenzaHeader,
    CredenzaTitle,
    CredenzaDescription,
    CredenzaBody,
} from "@/components/ui/credenza"
import { Loader2, Share2, Copy, Check, Download, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { normalizeId } from "@/lib/unified-song"

// ---------------------------------------------------------------------------
// Story card generator.
//
// Draws a 1080x1920 "Now Playing" card sized for Instagram / WhatsApp status.
//
// The layout is computed top-down from a single cursor rather than with
// hardcoded Y offsets. The previous version used fixed numbers and the
// waveform (ending at y=1725) overlapped the link pill (starting at y=1700),
// so the two elements were drawn on top of each other on every single card.
// ---------------------------------------------------------------------------

const W = 1080
const H = 1920

// Three colourways so a shared card does not always look identical.
const THEMES = [
    { id: "midnight", label: "Midnight", accent: "#8b5cf6", bg: "#0a0a0f" },
    { id: "sunset", label: "Sunset", accent: "#f97316", bg: "#140a06" },
    { id: "mint", label: "Mint", accent: "#10b981", bg: "#04120d" },
]

export default function ShareStoryButton({ id, name, artist, image }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [preview, setPreview] = useState(null) // { url, blob }
    const [copied, setCopied] = useState(false)
    const [theme, setTheme] = useState(THEMES[0])
    const objectUrlRef = useRef(null)

    const getSongLink = () =>
        typeof window === "undefined" ? "" : `https://${window.location.host}/${encodeURIComponent(normalizeId(id || ""))}`

    /** Clean, human-readable label for the card footer. */
    const shortLabel = () => {
        if (typeof window === "undefined") return "Tap to listen"
        return window.location.host.replace(/^www\./, "")
    }

    // ---------------------------- canvas helpers ---------------------------

    const roundRect = (ctx, x, y, w, h, r) => {
        const radius = Math.min(r, w / 2, h / 2)
        ctx.beginPath()
        ctx.moveTo(x + radius, y)
        ctx.arcTo(x + w, y, x + w, y + h, radius)
        ctx.arcTo(x + w, y + h, x, y + h, radius)
        ctx.arcTo(x, y + h, x, y, radius)
        ctx.arcTo(x, y, x + w, y, radius)
        ctx.closePath()
    }

    /** Lay text out into at most `maxLines`, ellipsising the final line. */
    const layoutText = (ctx, text, maxWidth, maxLines) => {
        const words = String(text || "").split(/\s+/).filter(Boolean)
        if (!words.length) return []
        const lines = []
        let line = ""
        for (const word of words) {
            const candidate = line ? `${line} ${word}` : word
            if (ctx.measureText(candidate).width > maxWidth && line) {
                lines.push(line)
                line = word
                if (lines.length === maxLines) break
            } else {
                line = candidate
            }
        }
        if (lines.length < maxLines && line) lines.push(line)

        // Ellipsise if the text did not fit
        if (lines.length === maxLines) {
            const consumed = lines.join(" ").split(/\s+/).length
            if (consumed < words.length || ctx.measureText(lines[maxLines - 1]).width > maxWidth) {
                let last = lines[maxLines - 1]
                while (last.length && ctx.measureText(`${last}…`).width > maxWidth) {
                    last = last.slice(0, -1)
                }
                lines[maxLines - 1] = `${last.trimEnd()}…`
            }
        }
        return lines
    }

    /** Average colour of the artwork, used to tint the background. */
    const averageColor = (img) => {
        try {
            const c = document.createElement("canvas")
            c.width = c.height = 16
            const cx = c.getContext("2d")
            cx.drawImage(img, 0, 0, 16, 16)
            const { data } = cx.getImageData(0, 0, 16, 16)
            let r = 0, g = 0, b = 0
            for (let i = 0; i < data.length; i += 4) {
                r += data[i]; g += data[i + 1]; b += data[i + 2]
            }
            const n = data.length / 4
            return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) }
        } catch {
            // Tainted canvas (CDN without CORS) - fall back to the theme colour.
            return null
        }
    }

    const loadImage = (src) =>
        new Promise((resolve, reject) => {
            const img = new Image()
            img.crossOrigin = "anonymous"
            img.onload = () => resolve(img)
            img.onerror = () => reject(new Error("Could not load album art"))
            img.src = src
        })

    // ------------------------------ the card -------------------------------

    const generateCard = async () => {
        const img = await loadImage(image)

        const canvas = document.createElement("canvas")
        canvas.width = W
        canvas.height = H
        const ctx = canvas.getContext("2d")

        // ---- background: tinted base, blurred art, vignette ----
        ctx.fillStyle = theme.bg
        ctx.fillRect(0, 0, W, H)

        const avg = averageColor(img)
        if (avg) {
            const tint = ctx.createLinearGradient(0, 0, 0, H)
            tint.addColorStop(0, `rgba(${avg.r},${avg.g},${avg.b},0.55)`)
            tint.addColorStop(1, `rgba(${avg.r},${avg.g},${avg.b},0.12)`)
            ctx.fillStyle = tint
            ctx.fillRect(0, 0, W, H)
        }

        // Cover the WHOLE canvas. A square image scaled to the width only spans
        // 1080px of a 1920px canvas, which left visible flat bands top and
        // bottom. Scale to cover and centre it instead.
        ctx.save()
        ctx.filter = "blur(110px) saturate(140%)"
        ctx.globalAlpha = 0.9
        const bgScale = Math.max(W / img.width, H / img.height) * 1.25
        const bgW = img.width * bgScale
        const bgH = img.height * bgScale
        ctx.drawImage(img, (W - bgW) / 2, (H - bgH) / 2, bgW, bgH)
        ctx.restore()

        const shade = ctx.createLinearGradient(0, 0, 0, H)
        shade.addColorStop(0, "rgba(0,0,0,0.72)")
        shade.addColorStop(0.35, "rgba(0,0,0,0.52)")
        shade.addColorStop(0.68, "rgba(0,0,0,0.70)")
        shade.addColorStop(1, "rgba(0,0,0,0.93)")
        ctx.fillStyle = shade
        ctx.fillRect(0, 0, W, H)

        ctx.textAlign = "center"

        // ---- layout cursor: everything below flows from here ----
        let y = 250

        // Header pill: NOW PLAYING
        ctx.font = "700 30px system-ui, -apple-system, 'Segoe UI', sans-serif"
        const headText = "NOW PLAYING"
        const headW = ctx.measureText(headText).width + 96
        const headH = 68
        ctx.fillStyle = "rgba(255,255,255,0.14)"
        roundRect(ctx, (W - headW) / 2, y, headW, headH, headH / 2)
        ctx.fill()
        ctx.strokeStyle = "rgba(255,255,255,0.22)"
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.fillStyle = theme.accent
        ctx.beginPath()
        ctx.arc((W - headW) / 2 + 42, y + headH / 2, 9, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = "#ffffff"
        ctx.letterSpacing = "3px"
        ctx.fillText(headText, W / 2 + 14, y + headH / 2 + 11)
        ctx.letterSpacing = "0px"

        y += headH + 110

        // Album art with a soft drop shadow
        const artSize = 760
        const artX = (W - artSize) / 2
        ctx.save()
        ctx.shadowColor = "rgba(0,0,0,0.65)"
        ctx.shadowBlur = 80
        ctx.shadowOffsetY = 30
        ctx.fillStyle = "#000"
        roundRect(ctx, artX, y, artSize, artSize, 56)
        ctx.fill()
        ctx.restore()

        ctx.save()
        roundRect(ctx, artX, y, artSize, artSize, 56)
        ctx.clip()
        // cover-fit so non-square art is never stretched
        const ratio = Math.max(artSize / img.width, artSize / img.height)
        const dw = img.width * ratio
        const dh = img.height * ratio
        ctx.drawImage(img, artX + (artSize - dw) / 2, y + (artSize - dh) / 2, dw, dh)
        ctx.restore()

        // subtle inner edge
        ctx.strokeStyle = "rgba(255,255,255,0.14)"
        ctx.lineWidth = 3
        roundRect(ctx, artX, y, artSize, artSize, 56)
        ctx.stroke()

        y += artSize + 104

        // Scrim behind the text block. Album art with large lettering (movie
        // posters especially) otherwise shows through and fights the title.
        const scrimTop = y - 96
        const scrim = ctx.createLinearGradient(0, scrimTop, 0, H)
        scrim.addColorStop(0, "rgba(0,0,0,0)")
        scrim.addColorStop(0.18, "rgba(0,0,0,0.62)")
        scrim.addColorStop(1, "rgba(0,0,0,0.92)")
        ctx.fillStyle = scrim
        ctx.fillRect(0, scrimTop, W, H - scrimTop)

        // Title (up to two lines)
        ctx.save()
        ctx.shadowColor = "rgba(0,0,0,0.55)"
        ctx.shadowBlur = 24
        ctx.shadowOffsetY = 2
        ctx.fillStyle = "#ffffff"
        ctx.font = "800 62px system-ui, -apple-system, 'Segoe UI', sans-serif"
        const titleLines = layoutText(ctx, name || "Unknown song", 880, 2)
        for (const line of titleLines) {
            ctx.fillText(line, W / 2, y)
            y += 74
        }
        ctx.restore()

        y += 8

        // Artist (single line)
        ctx.fillStyle = "rgba(255,255,255,0.72)"
        ctx.font = "500 40px system-ui, -apple-system, 'Segoe UI', sans-serif"
        const artistLine = layoutText(ctx, artist || "Unknown artist", 860, 1)[0] || ""
        ctx.fillText(artistLine, W / 2, y)

        y += 96

        // Waveform - deterministic per song so the same track looks consistent
        const seed = String(name || "").split("").reduce((a, ch) => a + ch.charCodeAt(0), 0)
        const barCount = 44
        const areaW = 800
        const gap = 7
        const barW = areaW / barCount - gap
        const baseX = (W - areaW) / 2
        for (let i = 0; i < barCount; i++) {
            const wave = Math.abs(Math.sin(i * 0.55 + seed * 0.013))
            const h = 16 + wave * 104
            const played = i < barCount * 0.42
            ctx.fillStyle = played ? theme.accent : "rgba(255,255,255,0.30)"
            roundRect(ctx, baseX + i * (barW + gap), y - h / 2, barW, h, barW / 2)
            ctx.fill()
        }

        // ---- footer ----
        // No drawn "link pill" here on purpose.
        //
        // Instagram's tappable link comes from its own Link sticker, which the
        // user adds on top of this image. Painting a second, fake URL pill onto
        // the card meant the story ended up showing two links - one real and
        // tappable, one baked into the picture and dead. The area below the
        // waveform is deliberately left clear so the real sticker has somewhere
        // clean to sit.
        //
        // The domain still appears once, as the footer line, so the card works
        // on its own when it is saved or sent as a plain image.
        ctx.textAlign = "center"
        ctx.fillStyle = "rgba(255,255,255,0.55)"
        ctx.font = "600 32px system-ui, -apple-system, 'Segoe UI', sans-serif"
        ctx.letterSpacing = "1px"
        ctx.fillText(shortLabel(), W / 2, H - 120)
        ctx.letterSpacing = "0px"

        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => (blob ? resolve(blob) : reject(new Error("Could not generate image"))),
                "image/png"
            )
        })
    }

    // ------------------------------- actions -------------------------------

    const build = async (nextTheme) => {
        setLoading(true)
        try {
            const blob = await generateCard()
            if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
            const url = URL.createObjectURL(blob)
            objectUrlRef.current = url
            setPreview({ url, blob })
        } catch (e) {
            toast.error("Couldn't generate the story card", {
                description: "The album art may be blocked. Try again.",
            })
        } finally {
            setLoading(false)
        }
    }

    const handleOpen = async () => {
        if (!image) {
            toast.error("Artwork hasn't loaded yet", { description: "Give it a second and try again." })
            return
        }
        setOpen(true)
        await build()
    }

    const pickTheme = async (t) => {
        if (t.id === theme.id || loading) return
        setTheme(t)
        // regenerate on the next tick so `theme` is applied
        setTimeout(() => build(), 0)
    }

    /**
     * One share action: open the phone's native share sheet so the user picks
     * the app (Instagram, WhatsApp, Telegram, anything installed).
     *
     * The card image and the link travel together, so whichever app is chosen
     * gets both. The link is also copied to the clipboard first, because apps
     * that accept only the image (Instagram Stories drops text) still need the
     * user to be able to paste it into a Link sticker.
     */
    const handleShare = async () => {
        const link = getSongLink()
        const title = `${name} — ${artist}`

        // Copy first so the link is always available no matter which app the
        // user ends up choosing.
        let copiedLink = false
        try {
            await navigator.clipboard.writeText(link)
            copiedLink = true
        } catch (e) {
            // clipboard may be blocked - the Copy link button is still there
        }

        const file = preview
            ? new File([preview.blob], "now-playing.png", { type: "image/png" })
            : null
        const canShareFile =
            file && navigator.canShare && navigator.canShare({ files: [file] })

        try {
            if (canShareFile) {
                // Image + link in a single sheet. The user chooses the target
                // app; image-only apps take the card, chat apps take the link.
                await navigator.share({ files: [file], title, text: `🎧 ${title}\n${link}` })
                if (copiedLink) {
                    toast.success("Link copied", {
                        description:
                            "For an Instagram story: tap the sticker icon, choose Link, and paste. The space under the waveform is left clear for it.",
                        duration: 8000,
                    })
                }
                return
            }

            if (navigator.share) {
                // No file support: share the link on its own, which keeps the
                // rich OG preview intact in chat apps.
                await navigator.share({ title, text: `🎧 ${title}`, url: link })
                return
            }
        } catch (e) {
            // user dismissed the sheet - nothing to report
            return
        }

        // Desktop browsers without the Web Share API.
        if (preview) handleDownload()
        toast.success(
            copiedLink
                ? "Link copied and card saved — share it from your phone or upload it manually"
                : "Card saved"
        )
    }

    const handleCopy = async () => {
        const link = getSongLink()
        try {
            await navigator.clipboard.writeText(`🎧 ${name} — ${artist}\nListen on DominatorMusic: ${link}`)
            setCopied(true)
            toast.success("Link copied")
            setTimeout(() => setCopied(false), 2000)
        } catch (e) {
            toast.error("Couldn't copy the link")
        }
    }

    const handleDownload = () => {
        if (!preview) return
        const safe = String(name || "now-playing").replace(/[^a-z0-9]+/gi, "-").toLowerCase()
        const a = document.createElement("a")
        a.href = preview.url
        a.download = `${safe}-story.png`
        a.click()
        toast.success("Saved to your downloads")
    }

    const onOpenChange = (v) => {
        setOpen(v)
        if (!v && objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current)
            objectUrlRef.current = null
            setPreview(null)
        }
    }

    return (
        <>
            <Button size="icon" variant="ghost" onClick={handleOpen} aria-label="Share to story">
                <Share2 className="h-4 w-4" />
            </Button>

            <Credenza open={open} onOpenChange={onOpenChange}>
                <CredenzaContent className="glass-surface sm:max-w-md">
                    <CredenzaHeader>
                        <CredenzaTitle className="flex items-center gap-2">
                            <Share2 className="h-4 w-4" /> Share this song
                        </CredenzaTitle>
                        <CredenzaDescription>
                            A story card sized for Instagram and WhatsApp status.
                        </CredenzaDescription>
                    </CredenzaHeader>

                    <CredenzaBody className="grid gap-4 pb-6">
                        {/* Preview keeps the 9:16 ratio so the dialog never jumps
                            between the loading and loaded states. */}
                        <div className="relative mx-auto w-full max-w-[260px] aspect-[9/16] rounded-2xl overflow-hidden bg-secondary/40 border border-border">
                            {preview && (
                                <img
                                    src={preview.url}
                                    alt={`Story card for ${name}`}
                                    className={`h-full w-full object-cover transition-opacity duration-300 ${loading ? "opacity-40" : "opacity-100"}`}
                                />
                            )}
                            {loading && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                    <span className="text-[11px] text-muted-foreground">Rendering…</span>
                                </div>
                            )}
                        </div>

                        {/* Colourway picker */}
                        <div className="flex items-center justify-center gap-2">
                            {THEMES.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => pickTheme(t)}
                                    disabled={loading}
                                    aria-label={`${t.label} theme`}
                                    aria-pressed={theme.id === t.id}
                                    className={`h-8 w-8 rounded-full transition disabled:opacity-50 ${
                                        theme.id === t.id
                                            ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110"
                                            : "hover:scale-105 opacity-70"
                                    }`}
                                    style={{ background: t.accent }}
                                />
                            ))}
                            <button
                                onClick={() => build()}
                                disabled={loading}
                                aria-label="Regenerate card"
                                className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center transition hover:bg-secondary/70 disabled:opacity-50"
                            >
                                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <Button onClick={handleShare} disabled={!preview || loading} className="col-span-2 gap-2 h-11">
                                <Share2 className="h-4 w-4" /> Share
                            </Button>
                            <Button onClick={handleCopy} disabled={loading} variant="secondary" className="gap-2">
                                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                                {copied ? "Copied" : "Copy link"}
                            </Button>
                            <Button onClick={handleDownload} disabled={!preview || loading} variant="secondary" className="gap-2">
                                <Download className="h-4 w-4" /> Save card
                            </Button>
                        </div>

                        <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                            Pick any app from your phone&apos;s share sheet. The link is copied too — for
                            Instagram stories, paste it into a{" "}
                            <span className="font-medium text-foreground">Link sticker</span> so viewers can tap through.
                        </p>
                    </CredenzaBody>
                </CredenzaContent>
            </Credenza>
        </>
    )
}

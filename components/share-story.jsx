"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Credenza,
    CredenzaContent,
    CredenzaHeader,
    CredenzaTitle,
    CredenzaDescription,
    CredenzaBody,
} from "@/components/ui/credenza"
import { Loader2, Share2, Copy, Check, Download } from "lucide-react"
import { toast } from "sonner"

// Draws a vertical "Now Playing" story card (1080x1920) with album art, a waveform
// and a small "listen on" link watermark - similar to Spotify's story cards.
export default function ShareStoryButton({ id, name, artist, image }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [preview, setPreview] = useState(null) // { url, blob }
    const [copied, setCopied] = useState(false)

    const getSongLink = () => `https://${window.location.host}/${id}`

    const generateCard = () =>
        new Promise((resolve, reject) => {
            const canvas = document.createElement("canvas")
            canvas.width = 1080
            canvas.height = 1920
            const ctx = canvas.getContext("2d")

            const img = new Image()
            img.crossOrigin = "anonymous"
            img.onload = () => {
                try {
                    // Background: blurred, darkened album art
                    ctx.filter = "blur(40px) brightness(0.45)"
                    ctx.drawImage(img, -100, 300, canvas.width + 200, canvas.width + 200)
                    ctx.filter = "none"

                    // dark gradient overlay for readability
                    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height)
                    grad.addColorStop(0, "rgba(0,0,0,0.35)")
                    grad.addColorStop(0.6, "rgba(0,0,0,0.55)")
                    grad.addColorStop(1, "rgba(0,0,0,0.85)")
                    ctx.fillStyle = grad
                    ctx.fillRect(0, 0, canvas.width, canvas.height)

                    // "Now Playing" label
                    ctx.fillStyle = "#ffffff"
                    ctx.font = "600 34px sans-serif"
                    ctx.textAlign = "center"
                    ctx.fillText("♪ NOW PLAYING", canvas.width / 2, 620)

                    // album art (rounded square, centered)
                    const artSize = 700
                    const artX = (canvas.width - artSize) / 2
                    const artY = 680
                    const radius = 40
                    ctx.save()
                    ctx.beginPath()
                    ctx.moveTo(artX + radius, artY)
                    ctx.arcTo(artX + artSize, artY, artX + artSize, artY + artSize, radius)
                    ctx.arcTo(artX + artSize, artY + artSize, artX, artY + artSize, radius)
                    ctx.arcTo(artX, artY + artSize, artX, artY, radius)
                    ctx.arcTo(artX, artY, artX + artSize, artY, radius)
                    ctx.closePath()
                    ctx.clip()
                    ctx.drawImage(img, artX, artY, artSize, artSize)
                    ctx.restore()

                    // song name
                    ctx.fillStyle = "#ffffff"
                    ctx.font = "700 52px sans-serif"
                    wrapText(ctx, name || "Unknown song", canvas.width / 2, artY + artSize + 100, 900, 60)

                    // artist name
                    ctx.fillStyle = "rgba(255,255,255,0.75)"
                    ctx.font = "400 36px sans-serif"
                    ctx.fillText(artist || "Unknown artist", canvas.width / 2, artY + artSize + 190)

                    // waveform bars
                    const barCount = 40
                    const barAreaWidth = 800
                    const barX = (canvas.width - barAreaWidth) / 2
                    const barY = artY + artSize + 280
                    const barWidth = barAreaWidth / barCount - 6
                    for (let i = 0; i < barCount; i++) {
                        const h = 20 + Math.abs(Math.sin(i * 0.6)) * 90 + Math.random() * 20
                        ctx.fillStyle = i < barCount * 0.4 ? "#ffffff" : "rgba(255,255,255,0.35)"
                        ctx.fillRect(barX + i * (barWidth + 6), barY - h / 2, barWidth, h)
                    }

                    // "listen on" watermark pill, like Spotify's story cards
                    const linkLabel = getSongLink().replace("https://", "")
                    ctx.font = "600 28px sans-serif"
                    const pillPadding = 28
                    const pillWidth = ctx.measureText(linkLabel).width + pillPadding * 2 + 50
                    const pillHeight = 76
                    const pillX = (canvas.width - pillWidth) / 2
                    const pillY = canvas.height - 220
                    ctx.fillStyle = "rgba(255,255,255,0.12)"
                    roundRect(ctx, pillX, pillY, pillWidth, pillHeight, pillHeight / 2)
                    ctx.fill()
                    ctx.fillStyle = "#ffffff"
                    ctx.font = "600 30px sans-serif"
                    ctx.fillText("♫", pillX + 45, pillY + pillHeight / 2 + 11)
                    ctx.font = "600 28px sans-serif"
                    ctx.fillText(linkLabel, pillX + pillWidth / 2 + 20, pillY + pillHeight / 2 + 10)

                    // branding
                    ctx.fillStyle = "rgba(255,255,255,0.55)"
                    ctx.font = "500 30px sans-serif"
                    ctx.fillText("DominatorMusic", canvas.width / 2, canvas.height - 100)

                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob)
                        else reject(new Error("Could not generate image"))
                    }, "image/png")
                } catch (e) {
                    reject(e)
                }
            }
            img.onerror = () => reject(new Error("Could not load album art"))
            img.src = image
        })

    const roundRect = (ctx, x, y, w, h, r) => {
        ctx.beginPath()
        ctx.moveTo(x + r, y)
        ctx.arcTo(x + w, y, x + w, y + h, r)
        ctx.arcTo(x + w, y + h, x, y + h, r)
        ctx.arcTo(x, y + h, x, y, r)
        ctx.arcTo(x, y, x + w, y, r)
        ctx.closePath()
    }

    const wrapText = (ctx, text, x, y, maxWidth, lineHeight) => {
        const words = text.split(" ")
        let line = ""
        let lines = []
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + " "
            if (ctx.measureText(testLine).width > maxWidth && n > 0) {
                lines.push(line)
                line = words[n] + " "
            } else {
                line = testLine
            }
        }
        lines.push(line)
        lines = lines.slice(0, 2)
        lines.forEach((l, i) => ctx.fillText(l.trim(), x, y + i * lineHeight))
    }

    const handleOpen = async () => {
        if (!image) {
            toast.error("Song art not loaded yet, try again in a moment!")
            return
        }
        setOpen(true)
        setLoading(true)
        try {
            const blob = await generateCard()
            const url = URL.createObjectURL(blob)
            setPreview({ url, blob })
        } catch (e) {
            toast.error("Couldn't generate the story card, try again!")
            setOpen(false)
        } finally {
            setLoading(false)
        }
    }

    const handleShare = async () => {
        if (!preview) return
        const link = getSongLink()
        // Only put the link in ONE field. If we send both `text` (with the
        // link inside it) and a separate `url`, most share sheets
        // (WhatsApp, Instagram) append both and the link shows up twice.
        const caption = `🎧 ${name} - ${artist}\nListen on DominatorMusic:`
        try {
            const file = new File([preview.blob], "now-playing.png", { type: "image/png" })
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                // Sharing an image: keep the link only inside the text, since
                // the separate `url` field is ignored/duplicated by most apps
                // once a file is attached.
                await navigator.share({
                    files: [file],
                    title: `${name} - ${artist}`,
                    text: `${caption} ${link}`,
                })
            } else if (navigator.share) {
                // No image support: text + url as two separate fields is fine
                // here since there's no file competing for the caption.
                await navigator.share({ title: `${name} - ${artist}`, text: caption, url: link })
            } else {
                await handleCopy()
            }
        } catch (e) {
            // user cancelled the share sheet, nothing to do
        }
    }

    const handleCopy = async () => {
        const link = getSongLink()
        try {
            await navigator.clipboard.writeText(`🎧 ${name} - ${artist}\nListen on DominatorMusic: ${link}`)
            setCopied(true)
            toast.success("Link copied!")
            setTimeout(() => setCopied(false), 2000)
        } catch (e) {
            toast.error("Couldn't copy the link")
        }
    }

    const handleDownload = () => {
        if (!preview) return
        const a = document.createElement("a")
        a.href = preview.url
        a.download = "now-playing.png"
        a.click()
        toast.success("Story card downloaded!")
    }

    return (
        <>
            <Button size="icon" variant="ghost" onClick={handleOpen} aria-label="Share to story">
                <Share2 className="h-4 w-4" />
            </Button>
            <Credenza open={open} onOpenChange={setOpen}>
                <CredenzaContent className="glass-surface">
                    <CredenzaHeader>
                        <CredenzaTitle className="flex items-center gap-2">
                            <Share2 className="h-4 w-4" /> Share Now Playing
                        </CredenzaTitle>
                        <CredenzaDescription>Share this song straight to Instagram, WhatsApp or WhatsApp Business status</CredenzaDescription>
                    </CredenzaHeader>
                    <CredenzaBody className="grid gap-4 pb-6">
                        <div className="rounded-2xl overflow-hidden bg-secondary/40 border border-border flex items-center justify-center min-h-[280px]">
                            {loading ? (
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            ) : preview ? (
                                <img src={preview.url} alt="Now playing story card" className="max-h-[420px] w-auto rounded-xl" />
                            ) : null}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <Button onClick={handleShare} disabled={!preview} className="col-span-3 gap-2">
                                <Share2 className="h-4 w-4" /> Share
                            </Button>
                            <Button onClick={handleCopy} disabled={!preview} variant="secondary" className="gap-2">
                                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy Link
                            </Button>
                            <Button onClick={handleDownload} disabled={!preview} variant="secondary" className="col-span-2 gap-2">
                                <Download className="h-4 w-4" /> Download
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground text-center">
                            The song link is included in the share text so anyone can tap it and listen here.
                        </p>
                    </CredenzaBody>
                </CredenzaContent>
            </Credenza>
        </>
    )
}

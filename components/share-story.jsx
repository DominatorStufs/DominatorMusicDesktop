"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Share2 } from "lucide-react"
import { toast } from "sonner"

// Draws a vertical "Now Playing" story card (1080x1920) with album art + a waveform
// then either opens the native share sheet (so it can be shared straight to
// Instagram / WhatsApp / WhatsApp Business stories) or falls back to a download.
export default function ShareStoryButton({ name, artist, image }) {
    const [loading, setLoading] = useState(false)

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

                    // branding
                    ctx.fillStyle = "rgba(255,255,255,0.6)"
                    ctx.font = "500 32px sans-serif"
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

    const handleShare = async () => {
        if (!image) {
            toast.error("Song art not loaded yet, try again in a moment!")
            return
        }
        setLoading(true)
        try {
            const blob = await generateCard()
            const file = new File([blob], "now-playing.png", { type: "image/png" })

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: "Now Playing",
                    text: `Listening to ${name} by ${artist}`,
                })
            } else {
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = "now-playing.png"
                a.click()
                URL.revokeObjectURL(url)
                toast.success("Story card downloaded! Share it on Instagram/WhatsApp Status manually.")
            }
        } catch (e) {
            toast.error("Couldn't generate the story card, try again!")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button size="icon" variant="ghost" onClick={handleShare} aria-label="Share to story">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
        </Button>
    )
}

"use client"
import { useState } from "react"
import { Switch } from "@/components/ui/switch"
import {
    Credenza,
    CredenzaContent,
    CredenzaHeader,
    CredenzaTitle,
    CredenzaDescription,
    CredenzaBody,
} from "@/components/ui/credenza"
import { useUIStyle, UI_STYLES } from "@/hooks/use-ui-style"
import { Sparkles, Layers, Smartphone, Square, Zap, Tv, Cloud, Terminal, Circle, RotateCcw } from "lucide-react"
import { toast } from "sonner"

const STYLE_META = {
    normal: { label: "Normal", icon: Square },
    flat: { label: "Flat 2D", icon: Layers },
    ios: { label: "iOS", icon: Smartphone },
    neon: { label: "Neon", icon: Zap },
    retro: { label: "Retro", icon: Tv },
    pastel: { label: "Pastel", icon: Cloud },
    cyberpunk: { label: "Cyberpunk", icon: Terminal },
    mono: { label: "Mono", icon: Circle },
}

export default function UIStyleButton() {
    const [open, setOpen] = useState(false)
    const ctx = useUIStyle()

    if (!ctx?.mounted) return null
    const { uiStyle, setUiStyle, glass, setGlass, accentColor, setAccentColor, resetAccentColor } = ctx

    const handleSelectStyle = (style) => {
        setUiStyle(style)
        toast.success(`UI Style: ${STYLE_META[style].label}`)
    }

    const handleGlass = (v) => {
        setGlass(v)
        toast.success(v ? "Glass effect on" : "Glass effect off")
    }

    const handleColor = (e) => {
        setAccentColor(e.target.value)
    }

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                aria-label="UI settings"
                className="glass-surface fixed top-4 right-4 z-[60] h-10 w-10 rounded-full bg-secondary/80 border border-border flex items-center justify-center shadow-md transition hover:scale-105 active:scale-95"
            >
                <Sparkles className="h-4 w-4" />
            </button>
            <Credenza open={open} onOpenChange={setOpen}>
                <CredenzaContent className="glass-surface">
                    <CredenzaHeader>
                        <CredenzaTitle className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4" /> UI Settings
                        </CredenzaTitle>
                        <CredenzaDescription>Customize how the app looks</CredenzaDescription>
                    </CredenzaHeader>
                    <CredenzaBody className="grid gap-4 pb-6">
                        <div>
                            <p className="text-sm font-medium mb-2">UI Style</p>
                            <div className="grid grid-cols-4 gap-2">
                                {UI_STYLES.map((style) => {
                                    const meta = STYLE_META[style]
                                    const Icon = meta.icon
                                    const active = uiStyle === style
                                    return (
                                        <button
                                            key={style}
                                            onClick={() => handleSelectStyle(style)}
                                            className={`flex flex-col items-center gap-1 rounded-xl border p-3 transition active:scale-95 ${active ? "border-primary bg-primary/10" : "border-border bg-secondary/50 hover:bg-secondary/70"}`}
                                        >
                                            <Icon className="h-4 w-4" />
                                            <span className="text-[11px] text-muted-foreground">{meta.label}</span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="flex items-center justify-between w-full rounded-xl border border-border bg-secondary/50 p-4">
                            <div>
                                <p className="text-sm font-medium">Glass Effect</p>
                                <p className="text-xs text-muted-foreground">Frosted, translucent look</p>
                            </div>
                            <Switch checked={glass} onCheckedChange={handleGlass} />
                        </div>

                        <div className="flex items-center justify-between w-full rounded-xl border border-border bg-secondary/50 p-4">
                            <div>
                                <p className="text-sm font-medium">Accent Color</p>
                                <p className="text-xs text-muted-foreground">Pick your own theme color</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {accentColor && (
                                    <button onClick={resetAccentColor} aria-label="Reset color" className="h-8 w-8 rounded-full flex items-center justify-center bg-secondary hover:opacity-80 transition">
                                        <RotateCcw className="h-3.5 w-3.5" />
                                    </button>
                                )}
                                <input
                                    type="color"
                                    value={accentColor || "#7c3aed"}
                                    onChange={handleColor}
                                    className="h-9 w-9 rounded-full overflow-hidden border-0 cursor-pointer bg-transparent"
                                    aria-label="Pick accent color"
                                />
                            </div>
                        </div>
                    </CredenzaBody>
                </CredenzaContent>
            </Credenza>
        </>
    )
}

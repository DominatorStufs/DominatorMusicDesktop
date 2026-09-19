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
import { Sparkles, Layers, Smartphone, Square, Zap, Tv, Cloud, Terminal, Circle, RotateCcw, Settings, Radio, ChevronRight, ChevronLeft, Palette } from "lucide-react"
import LastfmSettings from "@/components/lastfm-settings"
import { toast } from "sonner"

// `swatch` mirrors the palette each style applies in globals.css, so the picker
// previews the actual look instead of showing eight identical grey tiles.
const STYLE_META = {
    normal: {
        label: "Normal", icon: Square, hint: "Default look",
        swatch: ["#7c3aed", "#1e1b2e", "#e8e6f0"],
    },
    flat: {
        label: "Flat 2D", icon: Layers, hint: "No depth",
        swatch: ["#2563eb", "#111827", "#f3f4f6"],
    },
    ios: {
        label: "iOS", icon: Smartphone, hint: "Apple style",
        swatch: ["#0a84ff", "#1c1c1e", "#f2f2f7"],
    },
    neon: {
        label: "Neon", icon: Zap, hint: "Glowing edges",
        swatch: ["#e83ef5", "#0d0716", "#22d3ee"],
    },
    retro: {
        label: "Retro", icon: Tv, hint: "Warm paper",
        swatch: ["#d2401e", "#f0e2c8", "#3a2a1c"],
    },
    pastel: {
        label: "Pastel", icon: Cloud, hint: "Soft & airy",
        swatch: ["#f08ab0", "#fdf2f8", "#a5d8e8"],
    },
    cyberpunk: {
        label: "Cyberpunk", icon: Terminal, hint: "High contrast",
        swatch: ["#ffe81a", "#0a0e21", "#0fd8e8"],
    },
    mono: {
        label: "Mono", icon: Circle, hint: "Greyscale",
        swatch: ["#171717", "#fafafa", "#8a8a8a"],
    },
}

// The settings dialog is a small two-level menu: a list of sections, and the
// section itself. Keeping the copy in one place keeps the header in sync.
const MENU = [
    {
        id: "appearance",
        label: "Appearance",
        hint: "Style, glass effect and accent color",
        Icon: Palette,
        tint: "bg-primary/15 text-primary border border-primary/30",
    },
    {
        id: "lastfm",
        label: "Setup Last.fm Key",
        hint: "Scrobble your plays with your own API key",
        Icon: Radio,
        tint: "bg-red-500/15 text-red-500 border border-red-500/30",
    },
]

const PANEL_META = {
    menu: {
        title: "Settings",
        description: "Customize the app and connect your accounts",
        icon: <Settings className="h-4 w-4" />,
    },
    appearance: {
        title: "Appearance",
        description: "Customize how the app looks",
        icon: <Sparkles className="h-4 w-4" />,
    },
    lastfm: {
        title: "Last.fm",
        description: "Scrobble what you play with your own API key",
        icon: <Radio className="h-4 w-4" />,
    },
}

export default function UIStyleButton() {
    const [open, setOpen] = useState(false)
    // Which panel the dialog is showing: the menu, or one of its sections.
    const [panel, setPanel] = useState("menu")
    const ctx = useUIStyle()

    // Always reopen on the menu so the dialog never resumes mid-flow.
    const handleOpenChange = (v) => {
        setOpen(v)
        if (!v) setTimeout(() => setPanel("menu"), 200)
    }

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
                aria-label="Settings"
                className="glass-surface fixed top-4 right-4 z-[60] h-10 w-10 rounded-full bg-secondary/80 border border-border flex items-center justify-center shadow-md transition hover:scale-105 active:scale-95"
            >
                <Settings className="h-4 w-4" />
            </button>
            <Credenza open={open} onOpenChange={handleOpenChange}>
                <CredenzaContent className="glass-surface">
                    <CredenzaHeader>
                        <CredenzaTitle className="flex items-center gap-2">
                            {PANEL_META[panel].icon} {PANEL_META[panel].title}
                        </CredenzaTitle>
                        <CredenzaDescription>{PANEL_META[panel].description}</CredenzaDescription>
                    </CredenzaHeader>
                    <CredenzaBody className="grid gap-4 pb-6">

                        {/* ---------- root menu ---------- */}
                        {panel === "menu" && (
                            <div className="grid gap-2">
                                {MENU.map(({ id, label, hint, Icon, tint }) => (
                                    <button
                                        key={id}
                                        onClick={() => setPanel(id)}
                                        className="flex items-center gap-3 rounded-xl border border-border bg-secondary/50 p-4 text-left transition hover:bg-secondary/70 active:scale-[0.99]"
                                    >
                                        <span className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${tint}`}>
                                            <Icon className="h-4 w-4" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-medium">{label}</span>
                                            <span className="block text-xs text-muted-foreground">{hint}</span>
                                        </span>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* ---------- last.fm ---------- */}
                        {panel === "lastfm" && <LastfmSettings onBack={() => setPanel("menu")} />}

                        {/* ---------- appearance ---------- */}
                        {panel === "appearance" && (
                          <div className="grid gap-4">
                            <button
                                onClick={() => setPanel("menu")}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition w-fit"
                            >
                                <ChevronLeft className="h-3.5 w-3.5" /> Back to settings
                            </button>
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
                                            title={meta.hint}
                                            className={`relative flex flex-col items-center gap-1.5 rounded-xl border p-3 transition active:scale-95 overflow-hidden ${active
                                                ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                                                : "border-border bg-secondary/50 hover:bg-secondary/70"}`}
                                        >
                                            {/* Live preview of the palette this style applies */}
                                            <span className="flex h-3 w-full gap-0.5 rounded-sm overflow-hidden">
                                                {meta.swatch.map((c, i) => (
                                                    <span key={i} className="flex-1" style={{ background: c }} />
                                                ))}
                                            </span>
                                            <Icon className="h-4 w-4" />
                                            <span className={`text-[11px] leading-tight ${active ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                                                {meta.label}
                                            </span>
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
                          </div>
                        )}
                    </CredenzaBody>
                </CredenzaContent>
            </Credenza>
        </>
    )
}

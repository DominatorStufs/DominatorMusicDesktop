"use client"
import { createContext, useContext, useEffect, useState } from "react"

const UIStyleContext = createContext(null)

export const UI_STYLES = ["normal", "flat", "ios", "neon", "retro", "pastel", "cyberpunk", "mono"]

// Converts a #rrggbb hex color into "H S% L%" (the format our CSS variables use)
function hexToHsl(hex) {
    let r = parseInt(hex.slice(1, 3), 16) / 255
    let g = parseInt(hex.slice(3, 5), 16) / 255
    let b = parseInt(hex.slice(5, 7), 16) / 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    let h, s, l = (max + min) / 2
    if (max === min) {
        h = s = 0
    } else {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break
            case g: h = (b - r) / d + 2; break
            case b: h = (r - g) / d + 4; break
        }
        h /= 6
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

export function UIStyleProvider({ children }) {
    const [uiStyle, setUiStyleState] = useState("normal")
    const [glass, setGlassState] = useState(false)
    const [accentColor, setAccentColorState] = useState(null)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        let savedStyle = "normal"
        let savedGlass = false
        let savedAccent = null
        try {
            savedStyle = localStorage.getItem("ui-style") || "normal"
            savedGlass = localStorage.getItem("ui-glass") === "on"
            savedAccent = localStorage.getItem("ui-accent") || null
        } catch (e) { }
        setUiStyleState(savedStyle)
        setGlassState(savedGlass)
        setAccentColorState(savedAccent)
        document.documentElement.setAttribute("data-ui-style", savedStyle)
        document.documentElement.setAttribute("data-glass", savedGlass ? "on" : "off")
        if (savedAccent) {
            document.documentElement.style.setProperty("--primary", hexToHsl(savedAccent))
            document.documentElement.style.setProperty("--ring", hexToHsl(savedAccent))
        }
        setMounted(true)
    }, [])

    const setUiStyle = (style) => {
        setUiStyleState(style)
        try { localStorage.setItem("ui-style", style) } catch (e) { }
        document.documentElement.setAttribute("data-ui-style", style)
    }

    const cycleUiStyle = () => {
        const idx = UI_STYLES.indexOf(uiStyle)
        const next = UI_STYLES[(idx + 1) % UI_STYLES.length]
        setUiStyle(next)
        return next
    }

    const setGlass = (on) => {
        setGlassState(on)
        try { localStorage.setItem("ui-glass", on ? "on" : "off") } catch (e) { }
        document.documentElement.setAttribute("data-glass", on ? "on" : "off")
    }

    const setAccentColor = (hex) => {
        setAccentColorState(hex)
        try { localStorage.setItem("ui-accent", hex) } catch (e) { }
        document.documentElement.style.setProperty("--primary", hexToHsl(hex))
        document.documentElement.style.setProperty("--ring", hexToHsl(hex))
    }

    const resetAccentColor = () => {
        setAccentColorState(null)
        try { localStorage.removeItem("ui-accent") } catch (e) { }
        document.documentElement.style.removeProperty("--primary")
        document.documentElement.style.removeProperty("--ring")
    }

    return (
        <UIStyleContext.Provider value={{
            uiStyle, setUiStyle, cycleUiStyle,
            glass, setGlass,
            accentColor, setAccentColor, resetAccentColor,
            mounted
        }}>
            {children}
        </UIStyleContext.Provider>
    )
}

export const useUIStyle = () => useContext(UIStyleContext)

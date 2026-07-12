"use client"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
    Credenza,
    CredenzaContent,
    CredenzaHeader,
    CredenzaTitle,
    CredenzaDescription,
    CredenzaBody,
} from "@/components/ui/credenza"
import { SlidersHorizontal, RotateCcw } from "lucide-react"
import { useState } from "react"

export default function EqualizerButton({ eq, size = "icon", variant = "ghost" }) {
    const [open, setOpen] = useState(false)

    useEffect(() => {
        if (open) eq.ensureGraph()
    }, [open]);

    if (!eq) return null

    return (
        <>
            <Button size={size} variant={variant} onClick={() => setOpen(true)} aria-label="Equalizer">
                <SlidersHorizontal className="h-4 w-4" />
            </Button>
            <Credenza open={open} onOpenChange={setOpen}>
                <CredenzaContent className="glass-surface">
                    <CredenzaHeader>
                        <CredenzaTitle className="flex items-center gap-2">
                            <SlidersHorizontal className="h-4 w-4" /> Equalizer
                        </CredenzaTitle>
                        <CredenzaDescription>
                            {eq.supported ? "Fine-tune bass and treble" : "Equalizer isn't supported in this browser"}
                        </CredenzaDescription>
                    </CredenzaHeader>
                    <CredenzaBody className="grid gap-6 pb-8">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium">Bass</p>
                                <span className="text-xs text-muted-foreground">{eq.bass > 0 ? "+" : ""}{eq.bass} dB</span>
                            </div>
                            <Slider
                                disabled={!eq.supported}
                                value={[eq.bass]}
                                min={-15}
                                max={15}
                                step={1}
                                onValueChange={(v) => eq.setBass(v[0])}
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium">Treble</p>
                                <span className="text-xs text-muted-foreground">{eq.treble > 0 ? "+" : ""}{eq.treble} dB</span>
                            </div>
                            <Slider
                                disabled={!eq.supported}
                                value={[eq.treble]}
                                min={-15}
                                max={15}
                                step={1}
                                onValueChange={(v) => eq.setTreble(v[0])}
                            />
                        </div>
                        <Button variant="secondary" size="sm" className="gap-2 w-fit" onClick={eq.reset} disabled={!eq.supported}>
                            <RotateCcw className="h-3.5 w-3.5" /> Reset
                        </Button>
                    </CredenzaBody>
                </CredenzaContent>
            </Credenza>
        </>
    )
}

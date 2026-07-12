"use client"
import { useRef, useCallback, useState } from "react";

// Wraps an <audio> element with a small Web Audio graph:
// source -> bass (low shelf) -> treble (high shelf) -> speakers
//
// Important: we only touch the Web Audio API once the user actually opens
// the equalizer panel (call `ensureGraph()`), so people who never use the
// EQ are never at risk of this breaking normal playback. Once
// `createMediaElementSource` is called on an <audio> element it can never
// be called again on that same element, so we guard against double-init.
export function useEqualizer(audioRef) {
    const ctxRef = useRef(null);
    const bassNodeRef = useRef(null);
    const trebleNodeRef = useRef(null);
    const [bass, setBassState] = useState(0);
    const [treble, setTrebleState] = useState(0);
    const [supported, setSupported] = useState(true);

    const ensureGraph = useCallback(() => {
        if (ctxRef.current || !audioRef.current) return;
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) {
                setSupported(false);
                return;
            }
            const ctx = new AudioContextClass();
            const source = ctx.createMediaElementSource(audioRef.current);

            const bassFilter = ctx.createBiquadFilter();
            bassFilter.type = "lowshelf";
            bassFilter.frequency.value = 200;
            bassFilter.gain.value = bass;

            const trebleFilter = ctx.createBiquadFilter();
            trebleFilter.type = "highshelf";
            trebleFilter.frequency.value = 3000;
            trebleFilter.gain.value = treble;

            source.connect(bassFilter);
            bassFilter.connect(trebleFilter);
            trebleFilter.connect(ctx.destination);

            ctxRef.current = ctx;
            bassNodeRef.current = bassFilter;
            trebleNodeRef.current = trebleFilter;
        } catch (e) {
            // Any failure here (unsupported browser, element already has a
            // source, etc.) just disables the EQ - normal playback is
            // untouched since we never got as far as rerouting the audio.
            setSupported(false);
        }
    }, [audioRef, bass, treble]);

    const resume = () => {
        if (ctxRef.current?.state === "suspended") ctxRef.current.resume();
    };

    const setBass = (db) => {
        setBassState(db);
        if (bassNodeRef.current) bassNodeRef.current.gain.value = db;
        resume();
    };

    const setTreble = (db) => {
        setTrebleState(db);
        if (trebleNodeRef.current) trebleNodeRef.current.gain.value = db;
        resume();
    };

    const reset = () => {
        setBass(0);
        setTreble(0);
    };

    return { bass, treble, setBass, setTreble, reset, supported, ensureGraph };
}

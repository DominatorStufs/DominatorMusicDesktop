"use client"
import { useEffect, useState } from "react";
import { getLikedSongs, getHistory } from "@/lib/library";

export default function Greeting() {
    const [greeting, setGreeting] = useState("Hello");
    const [subtitle, setSubtitle] = useState("Here's some music for you.");

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting("Good morning");
        else if (hour < 17) setGreeting("Good afternoon");
        else if (hour < 21) setGreeting("Good evening");
        else setGreeting("Good night");

        const liked = getLikedSongs();
        const history = getHistory();
        if (history.length) {
            setSubtitle(`Continue listening to ${history[0].name}`);
        } else if (liked.length) {
            setSubtitle(`You have ${liked.length} liked song${liked.length > 1 ? "s" : ""} waiting for you.`);
        } else {
            setSubtitle("Discover new music curated just for you.");
        }
    }, []);

    return (
        <div className="mb-2">
            <h1 className="text-2xl font-semibold">{greeting} 👋</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
    );
}

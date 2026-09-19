"use client"
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function Error({ error, reset }) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-6 text-center">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground max-w-sm">
                Couldn't load this page. If this keeps happening, make sure NEXT_PUBLIC_API_URL is set correctly in your deployment settings.
            </p>
            <Button onClick={() => reset()} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Try again
            </Button>
        </div>
    );
}

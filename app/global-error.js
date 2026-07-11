"use client"
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function GlobalError({ error, reset }) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <html>
            <body>
                <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
                    <h1 className="text-xl font-semibold">Something went wrong</h1>
                    <p className="text-sm text-muted-foreground max-w-sm">
                        This usually means the app's environment variables (like NEXT_PUBLIC_API_URL) aren't set on the server. Check your Vercel project settings.
                    </p>
                    <Button onClick={() => reset()} className="gap-2">
                        <RefreshCw className="h-4 w-4" /> Try again
                    </Button>
                </div>
            </body>
        </html>
    );
}

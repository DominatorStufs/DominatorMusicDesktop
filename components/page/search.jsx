"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { SearchIcon } from "lucide-react";

export default function Search({ params }) {
  const [query, setQuery] = useState("");
  const inpRef = useRef(null);
  const router = useRouter();

  const handleSubmit = (e) => {
    e.preventDefault();
    const q = query?.trim();
    if (!q) {
      router.push("/");
      return;
    }
    router.push(`/search/${encodeURIComponent(q)}`);
    inpRef.current?.blur();
    setQuery("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center relative z-10 w-full">
      <Button variant="ghost" type="submit" size="icon" className="absolute right-0 rounded-xl rounded-l-none bg-none">
        <SearchIcon className="w-4 h-4" />
      </Button>
      <Input
        ref={inpRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
        type="search"
        className="rounded-lg bg-secondary/50"
        name="query"
        placeholder="Try Nakhre by ZackKnight.."
      />
    </form>
  );
}

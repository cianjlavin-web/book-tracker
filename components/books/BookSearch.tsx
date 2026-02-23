"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { searchBooks, type BookSearchResult } from "@/lib/openLibrary";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface BookSearchProps {
  onSelect: (book: BookSearchResult) => void;
  onClose?: () => void;
}

export function BookSearch({ onSelect, onClose }: BookSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const res = await searchBooks(q);
    setResults(res);
    setSearched(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearched(false); return; }
    const id = setTimeout(() => doSearch(query), 500);
    return () => clearTimeout(id);
  }, [query, doSearch]);

  return (
    <div className="flex flex-col gap-4">
      <Input
        placeholder="Search by title or author..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />

      {loading && (
        <p className="text-center text-sm text-[#6B6B6B] py-4">Searching...</p>
      )}

      {!loading && searched && results.length === 0 && (
        <p className="text-center text-sm text-[#6B6B6B] py-4">No results found</p>
      )}

      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
        {results.map((book) => (
          <button
            key={book.olId}
            onClick={() => onSelect(book)}
            className="flex gap-3 p-3 rounded-xl hover:bg-white text-left transition-colors"
          >
            <div className="flex-shrink-0 w-10 h-14 rounded-lg overflow-hidden bg-gray-200">
              {book.coverUrl ? (
                <Image src={book.coverUrl} alt={book.title} width={40} height={56} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#F4A7CB] to-[#E8599A] flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{book.title.slice(0, 2)}</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1A1A1A] line-clamp-1">{book.title}</p>
              <p className="text-xs text-[#6B6B6B]">{book.author}</p>
              {book.publishedYear && (
                <p className="text-xs text-[#6B6B6B]">{book.publishedYear}</p>
              )}
            </div>
          </button>
        ))}
      </div>

      {onClose && (
        <Button variant="ghost" onClick={onClose} className="text-[#6B6B6B]">
          Cancel
        </Button>
      )}
    </div>
  );
}

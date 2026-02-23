"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { USER_ID } from "@/lib/user";
import { searchByGenre, searchByAuthor, type GoogleBookInfo } from "@/lib/googleBooks";
import { Card, SectionLabel, SectionTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Textarea } from "@/components/ui/Input";
import type { BookSearchResult } from "@/lib/openLibrary";

interface AIBook {
  title: string;
  author: string;
  description: string;
  reason: string;
}

interface UserBook {
  books: { title: string; author: string; genres: string[] | null };
  status: string;
}

export default function ExplorePage() {
  const [topGenres, setTopGenres] = useState<string[]>([]);
  const [topAuthors, setTopAuthors] = useState<string[]>([]);
  const [genreRecs, setGenreRecs] = useState<GoogleBookInfo[]>([]);
  const [authorRecs, setAuthorRecs] = useState<GoogleBookInfo[]>([]);
  const [existingTitles, setExistingTitles] = useState<Set<string>>(new Set());
  const [loadingRecs, setLoadingRecs] = useState(true);

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBooks, setAiBooks] = useState<AIBook[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [addingBook, setAddingBook] = useState<string | null>(null);
  const [addedBooks, setAddedBooks] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("user_books")
      .select("status, books(title, author, genres)")
      .eq("user_id", USER_ID);

    const userBooks = (data ?? []) as unknown as UserBook[];
    const titles = new Set(userBooks.map((b) => b.books.title.toLowerCase()));
    setExistingTitles(titles);

    // Top genres from finished + reading books
    const genreCounts: Record<string, number> = {};
    const authorCounts: Record<string, number> = {};

    userBooks
      .filter((b) => b.status === "finished" || b.status === "reading")
      .forEach((b) => {
        (b.books.genres ?? []).forEach((g) => {
          genreCounts[g] = (genreCounts[g] ?? 0) + 1;
        });
        if (b.books.author) {
          authorCounts[b.books.author] = (authorCounts[b.books.author] ?? 0) + 1;
        }
      });

    const genres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([g]) => g);

    const authors = Object.entries(authorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([a]) => a);

    setTopGenres(genres);
    setTopAuthors(authors);

    // Fetch recommendations
    const [genreResults, authorResults] = await Promise.all([
      genres.length > 0
        ? searchByGenre(genres[0], 10)
        : Promise.resolve([]),
      authors.length > 0
        ? searchByAuthor(authors[0], 8)
        : Promise.resolve([]),
    ]);

    setGenreRecs(genreResults.filter((b) => !titles.has(b.title.toLowerCase())).slice(0, 6));
    setAuthorRecs(authorResults.filter((b) => !titles.has(b.title.toLowerCase())).slice(0, 4));
    setLoadingRecs(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAIRecommend() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError("");
    setAiBooks([]);

    try {
      // Get user's read books for context
      const supabase = createClient();
      const { data: readData } = await supabase
        .from("user_books")
        .select("books(title, author)")
        .eq("user_id", USER_ID)
        .eq("status", "finished");

      const { data: tbrData } = await supabase
        .from("user_books")
        .select("books(title, author)")
        .eq("user_id", USER_ID)
        .eq("status", "want_to_read");

      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          readBooks: (readData ?? []).map((b: { books: unknown }) => b.books),
          tbrBooks: (tbrData ?? []).map((b: { books: unknown }) => b.books),
        }),
      });

      const json = await res.json();
      if (json.error) {
        setAiError(json.error === "ANTHROPIC_API_KEY not configured"
          ? "AI recommendations require an Anthropic API key. Add ANTHROPIC_API_KEY to your .env.local file."
          : json.error
        );
      } else {
        setAiBooks(json.books ?? []);
      }
    } catch {
      setAiError("Something went wrong. Please try again.");
    }
    setAiLoading(false);
  }

  async function addToTBR(book: GoogleBookInfo | AIBook) {
    const key = book.title;
    setAddingBook(key);
    const supabase = createClient();

    const { data: bookData } = await supabase
      .from("books")
      .upsert(
        {
          title: book.title,
          author: book.author,
          cover_url: "coverUrl" in book ? book.coverUrl : null,
          total_pages: "pageCount" in book ? book.pageCount : null,
          genres: "categories" in book ? book.categories : [],
          description: "description" in book ? book.description : null,
        },
        { onConflict: "ol_id" }
      )
      .select("id")
      .single();

    if (bookData) {
      await supabase.from("user_books").upsert(
        { user_id: USER_ID, book_id: bookData.id, status: "want_to_read" },
        { onConflict: "user_id,book_id" }
      );
      setAddedBooks((prev) => new Set([...prev, key]));
    }
    setAddingBook(null);
  }

  return (
    <div className="p-4">
      <div className="pt-6 pb-4">
        <SectionLabel>Discover</SectionLabel>
        <SectionTitle>Explore Books</SectionTitle>
      </div>

      {/* AI Recommendations */}
      <Card className="mb-5">
        <SectionLabel>Powered by AI</SectionLabel>
        <h2 className="font-[family-name:var(--font-playfair)] text-xl font-bold text-[#1A1A1A] mb-3">
          Ask for recommendations
        </h2>
        <Textarea
          placeholder={`e.g. "A cozy mystery set in Japan" or "Books like The Secret History" or "Uplifting sci-fi with strong female leads"`}
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          rows={3}
        />
        <Button
          onClick={handleAIRecommend}
          disabled={aiLoading || !aiPrompt.trim()}
          className="mt-3 w-full"
        >
          {aiLoading ? "Finding books..." : "Recommend books"}
        </Button>

        {aiError && (
          <p className="text-sm text-red-500 mt-3">{aiError}</p>
        )}

        {aiBooks.length > 0 && (
          <div className="mt-4 flex flex-col gap-3">
            {aiBooks.map((book, i) => (
              <div key={i} className="bg-white rounded-2xl p-4">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#1A1A1A] text-sm">{book.title}</p>
                    <p className="text-xs text-[#6B6B6B] mb-1">{book.author}</p>
                    <p className="text-xs text-[#1A1A1A] mb-1">{book.description}</p>
                    <p className="text-xs text-[#E8599A] italic">✦ {book.reason}</p>
                  </div>
                  <button
                    onClick={() => addToTBR(book)}
                    disabled={addingBook === book.title || addedBooks.has(book.title)}
                    className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full bg-[#FAE0EE] text-[#E8599A] hover:bg-[#F4A7CB] disabled:opacity-50 transition-colors"
                  >
                    {addedBooks.has(book.title) ? "Added ✓" : addingBook === book.title ? "..." : "+ TBR"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Genre-based recommendations */}
      {loadingRecs ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-40 bg-white/20 rounded-[20px] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {genreRecs.length > 0 && (
            <div className="mb-5">
              <SectionLabel>Based on your love of</SectionLabel>
              <SectionTitle className="mb-3">{topGenres[0]}</SectionTitle>
              <div className="flex flex-col gap-3">
                {genreRecs.map((book, i) => (
                  <RecommendedBookCard
                    key={i}
                    book={book}
                    onAdd={() => addToTBR(book)}
                    adding={addingBook === book.title}
                    added={addedBooks.has(book.title)}
                  />
                ))}
              </div>
            </div>
          )}

          {authorRecs.length > 0 && (
            <div className="mb-5">
              <SectionLabel>More from</SectionLabel>
              <SectionTitle className="mb-3">{topAuthors[0]}</SectionTitle>
              <div className="flex flex-col gap-3">
                {authorRecs.map((book, i) => (
                  <RecommendedBookCard
                    key={i}
                    book={book}
                    onAdd={() => addToTBR(book)}
                    adding={addingBook === book.title}
                    added={addedBooks.has(book.title)}
                  />
                ))}
              </div>
            </div>
          )}

          {genreRecs.length === 0 && authorRecs.length === 0 && (
            <Card className="text-center py-8">
              <p className="text-[#6B6B6B] text-sm mb-1">No personalised recommendations yet</p>
              <p className="text-[#6B6B6B] text-xs">Mark some books as finished to get recommendations based on your taste</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function RecommendedBookCard({
  book,
  onAdd,
  adding,
  added,
}: {
  book: GoogleBookInfo;
  onAdd: () => void;
  adding: boolean;
  added: boolean;
}) {
  return (
    <div className="bg-[#F7F4F0] rounded-[20px] p-4">
      <div className="flex gap-3">
        <div className="flex-shrink-0 w-[56px] h-[80px] rounded-xl overflow-hidden bg-gray-200">
          {book.coverUrl ? (
            <Image src={book.coverUrl} alt={book.title} width={56} height={80} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#F4A7CB] to-[#E8599A] flex items-center justify-center">
              <span className="text-white text-xs font-bold">{book.title.slice(0, 2)}</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#1A1A1A] text-sm leading-tight">{book.title}</p>
          <p className="text-xs text-[#6B6B6B] mb-1">{book.author}</p>
          {book.averageRating && (
            <p className="text-xs text-[#6B6B6B] mb-1">★ {book.averageRating.toFixed(1)} · {book.ratingsCount?.toLocaleString()} ratings</p>
          )}
          {book.description && (
            <p className="text-xs text-[#1A1A1A] line-clamp-2 mb-2">{book.description}</p>
          )}
          {book.categories.slice(0, 2).map((c) => (
            <Badge key={c} variant="pink" className="text-[10px] mr-1">{c}</Badge>
          ))}
        </div>
      </div>
      <button
        onClick={onAdd}
        disabled={adding || added}
        className="mt-3 w-full text-sm font-medium py-2 rounded-full bg-[#FAE0EE] text-[#E8599A] hover:bg-[#F4A7CB] disabled:opacity-50 transition-colors"
      >
        {added ? "Added to TBR ✓" : adding ? "Adding..." : "+ Add to Want to Read"}
      </button>
    </div>
  );
}

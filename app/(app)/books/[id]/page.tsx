"use client";

import { useState, useEffect, useCallback, use } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { USER_ID } from "@/lib/user";
import { ReadingTimer } from "@/components/timer/ReadingTimer";
import { StarRating } from "@/components/books/StarRating";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Textarea } from "@/components/ui/Input";
import { Input } from "@/components/ui/Input";
import { formatDate, formatDuration, progressPercent } from "@/lib/utils";

interface Session {
  id: string;
  date: string;
  duration_seconds: number;
  pages_read: number;
  start_page: number | null;
  end_page: number | null;
}

interface BookDetail {
  id: string;
  status: "reading" | "finished" | "want_to_read" | "dnf";
  current_page: number;
  start_date: string | null;
  finish_date: string | null;
  rating: number | null;
  review: string | null;
  books: {
    id: string;
    title: string;
    author: string;
    cover_url: string | null;
    total_pages: number | null;
    genres: string[] | null;
    published_year: number | null;
  };
}

export default function BookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [book, setBook] = useState<BookDetail | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<BookDetail["status"]>("reading");
  const [communityRating, setCommunityRating] = useState<number | null>(null);
  const [communityRatingCount, setCommunityRatingCount] = useState<number | null>(null);
  const [description, setDescription] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("user_books")
      .select("id, status, current_page, start_date, finish_date, rating, review, books(id, title, author, cover_url, total_pages, genres, published_year)")
      .eq("id", id)
      .single();
    if (data) {
      const bookData = data as unknown as BookDetail;
      setBook(bookData);
      setRating(data.rating ?? 0);
      setReview(data.review ?? "");
      setCurrentPage(data.current_page ?? 0);
      setTotalPages(bookData.books.total_pages);
      setStatus(data.status);

      // Fetch community rating + description via server route (cached in browser)
      try {
        const params = new URLSearchParams({ title: bookData.books.title, author: bookData.books.author });
        const res = await fetch(`/api/book-details?${params}`);
        if (res.ok) {
          const gb = await res.json();
          if (gb) {
            setCommunityRating(gb.averageRating);
            setCommunityRatingCount(gb.ratingsCount);
            if (gb.description) setDescription(gb.description);
          }
        }
      } catch {
        // Non-critical — page works fine without community data
      }
    }

    const { data: sessData } = await supabase
      .from("reading_sessions")
      .select("id, date, duration_seconds, pages_read, start_page, end_page")
      .eq("user_book_id", id)
      .order("date", { ascending: false })
      .limit(20);
    setSessions(sessData ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function saveDetails() {
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("user_books")
      .update({
        rating: rating > 0 ? rating : null,
        review: review || null,
        current_page: currentPage,
        status,
        finish_date:
          status === "finished" && !book?.finish_date
            ? new Date().toISOString().split("T")[0]
            : undefined,
      })
      .eq("id", id);
    setSaving(false);
    load();
  }

  async function handlePageUpdate() {
    const supabase = createClient();
    await supabase.from("user_books").update({ current_page: currentPage }).eq("id", id);
  }

  async function handleTotalPagesUpdate() {
    if (!book) return;
    const supabase = createClient();
    await supabase.from("books").update({ total_pages: totalPages }).eq("id", book.books.id);
  }

  if (loading) {
    return (
      <div className="p-4 pt-6">
        <div className="h-48 bg-white/20 rounded-[20px] animate-pulse mb-4" />
        <div className="h-32 bg-white/20 rounded-[20px] animate-pulse" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="p-4 pt-6 text-center text-white">
        <p>Book not found</p>
        <Button onClick={() => router.back()} className="mt-4">Go back</Button>
      </div>
    );
  }

  const progress = progressPercent(currentPage, totalPages);

  return (
    <div className="p-4">
      {/* Back button */}
      <button onClick={() => router.back()} className="text-white/85 text-sm mb-4 flex items-center gap-1">
        ← Back
      </button>

      {/* Hero */}
      <div className="bg-[#F7F4F0] rounded-[24px] p-5 mb-4">
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-[80px] h-[116px] rounded-xl overflow-hidden bg-gray-200 shadow-md">
            {book.books.cover_url ? (
              <Image src={book.books.cover_url} alt={book.books.title} width={80} height={116} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#F4A7CB] to-[#E8599A] flex items-center justify-center">
                <span className="text-white text-lg font-bold">{book.books.title.slice(0, 2)}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-[family-name:var(--font-playfair)] text-xl font-bold text-[#1A1A1A] leading-tight mb-1">
              {book.books.title}
            </h1>
            <p className="text-sm text-[#6B6B6B] mb-2">{book.books.author}</p>
            {book.books.published_year && (
              <p className="text-xs text-[#6B6B6B]">{book.books.published_year}</p>
            )}
            {communityRating && (
              <p className="text-xs text-[#6B6B6B] mt-1">
                ★ {communityRating.toFixed(1)} community rating
                {communityRatingCount && ` · ${communityRatingCount.toLocaleString()} ratings`}
              </p>
            )}
            {book.books.genres && book.books.genres.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {book.books.genres.slice(0, 3).map((g) => (
                  <Badge key={g} variant="pink" className="text-[10px]">{g}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status selector */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {(["reading", "finished", "want_to_read", "dnf"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                status === s ? "bg-[#E8599A] text-white border-[#E8599A]" : "border-gray-300 text-[#6B6B6B]"
              }`}
            >
              {s === "want_to_read" ? "Want to Read" : s === "dnf" ? "DNF" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      {description && (
        <div className="bg-[#F7F4F0] rounded-[24px] p-5 mb-4">
          <p className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-2">About this book</p>
          <p className="text-sm text-[#1A1A1A] leading-relaxed line-clamp-6">{description}</p>
        </div>
      )}

      {/* Progress */}
      {status === "reading" && (
        <div className="bg-[#F7F4F0] rounded-[24px] p-5 mb-4">
          <p className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-3">Progress</p>
          {totalPages && (
            <>
              <div className="progress-bar mb-2">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-[#6B6B6B] mb-3">{progress}% complete</p>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Current page"
              type="number"
              value={String(currentPage)}
              onChange={(e) => setCurrentPage(parseInt(e.target.value) || 0)}
              onBlur={handlePageUpdate}
              min={0}
              max={totalPages ?? undefined}
            />
            <Input
              label="Total pages"
              type="number"
              value={String(totalPages ?? "")}
              onChange={(e) => setTotalPages(parseInt(e.target.value) || null)}
              onBlur={handleTotalPagesUpdate}
              min={1}
              placeholder="Unknown"
            />
          </div>
        </div>
      )}

      {/* Timer */}
      {(status === "reading") && (
        <div className="mb-4">
          <ReadingTimer
            userBookId={id}
            bookTitle={book.books.title}
            currentPage={currentPage}
            totalPages={totalPages}
            onSessionSaved={(_, endPage) => {
              setCurrentPage(endPage);
              load();
            }}
          />
        </div>
      )}

      {/* Rating + Review */}
      <div className="bg-[#F7F4F0] rounded-[24px] p-5 mb-4">
        <p className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-3">Rating & Review</p>
        <StarRating value={rating} onChange={setRating} />
        <div className="mt-3">
          <Textarea
            placeholder="Write a short review..."
            value={review}
            onChange={(e) => setReview(e.target.value)}
            rows={3}
          />
        </div>
        <Button onClick={saveDetails} disabled={saving} className="mt-3 w-full">
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      {/* Session history */}
      {sessions.length > 0 && (
        <div className="bg-[#F7F4F0] rounded-[24px] p-5 mb-4">
          <p className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-3">Reading Sessions</p>
          <div className="flex flex-col gap-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-[#1A1A1A]">{formatDate(s.date)}</p>
                  <p className="text-xs text-[#6B6B6B]">
                    {s.pages_read > 0 ? `${s.pages_read} pages` : "No pages logged"}
                  </p>
                </div>
                <span className="text-sm font-medium text-[#E8599A]">
                  {formatDuration(s.duration_seconds)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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
import { Modal } from "@/components/ui/Modal";
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
  const [editingReview, setEditingReview] = useState(false);
  const [status, setStatus] = useState<BookDetail["status"]>("reading");
  const [communityRating, setCommunityRating] = useState<number | null>(null);
  const [communityRatingCount, setCommunityRatingCount] = useState<number | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editPages, setEditPages] = useState("");
  const [editMinutes, setEditMinutes] = useState("");
  const [addingSession, setAddingSession] = useState(false);
  const [newSessionDate, setNewSessionDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [newSessionPages, setNewSessionPages] = useState("");
  const [newSessionMinutes, setNewSessionMinutes] = useState("");

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
    setEditingReview(false);
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

  async function saveSessionEdit() {
    if (!editingSession) return;
    const supabase = createClient();
    await supabase
      .from("reading_sessions")
      .update({
        pages_read: parseInt(editPages) || 0,
        duration_seconds: (parseInt(editMinutes) || 0) * 60,
      })
      .eq("id", editingSession.id);
    setEditingSession(null);
    load();
  }

  async function deleteSession(sessionId: string) {
    const supabase = createClient();
    await supabase.from("reading_sessions").delete().eq("id", sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  }

  async function addSession() {
    if (!newSessionDate) return;
    const supabase = createClient();
    await supabase.from("reading_sessions").insert({
      user_id: USER_ID,
      user_book_id: id,
      date: newSessionDate,
      duration_seconds: (parseInt(newSessionMinutes) || 0) * 60,
      pages_read: parseInt(newSessionPages) || 0,
    });
    setAddingSession(false);
    setNewSessionPages("");
    setNewSessionMinutes("");
    setNewSessionDate(new Date().toISOString().split("T")[0]);
    load();
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

        {/* Review: read-only by default, editable on tap */}
        <div className="mt-4">
          {review && !editingReview ? (
            <div className="relative">
              <p className="text-sm text-[#1A1A1A] leading-relaxed whitespace-pre-wrap pr-8">
                {review.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")}
              </p>
              <button
                onClick={() => setEditingReview(true)}
                className="absolute top-0 right-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 text-[#6B6B6B] transition-colors"
                title="Edit review"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            </div>
          ) : (
            <div>
              <textarea
                ref={(el) => {
                  if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
                }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = el.scrollHeight + "px";
                }}
                placeholder="Write a short review..."
                value={review}
                onChange={(e) => setReview(e.target.value)}
                autoFocus={editingReview}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-[#1A1A1A] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#E8599A] focus:border-transparent resize-none overflow-hidden min-h-[80px]"
              />
              {editingReview && (
                <button
                  onClick={() => { setReview(book?.review ?? ""); setEditingReview(false); }}
                  className="text-xs text-[#6B6B6B] mt-1 hover:text-[#1A1A1A]"
                >
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>

        <Button onClick={saveDetails} disabled={saving} className="mt-3 w-full">
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      {/* Session history */}
      <div className="bg-[#F7F4F0] rounded-[24px] p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-[#6B6B6B] uppercase tracking-wide">Reading Sessions</p>
          <button
            onClick={() => setAddingSession(true)}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-[#E8599A] text-white hover:bg-[#d44d8a] transition-colors flex-shrink-0"
            title="Log a session"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
        {sessions.length === 0 ? (
          <p className="text-xs text-[#6B6B6B] text-center py-3">No sessions logged yet</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center py-2 border-b border-gray-100 last:border-0 gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#1A1A1A]">{formatDate(s.date)}</p>
                  <p className="text-xs text-[#6B6B6B]">
                    {s.pages_read > 0 ? `${s.pages_read} pages` : "No pages logged"}
                  </p>
                </div>
                <span className="text-sm font-medium text-[#E8599A]">
                  {s.duration_seconds > 0 ? formatDuration(s.duration_seconds) : "Time not logged"}
                </span>
                <button
                  onClick={() => {
                    setEditingSession(s);
                    setEditPages(String(s.pages_read));
                    setEditMinutes(String(Math.round(s.duration_seconds / 60)));
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 text-[#6B6B6B] transition-colors flex-shrink-0"
                  title="Edit session"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add session modal */}
      <Modal
        open={addingSession}
        onClose={() => { setAddingSession(false); setNewSessionPages(""); setNewSessionMinutes(""); }}
        title="Log a session"
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-1 block">Date</label>
            <input
              type="date"
              value={newSessionDate}
              max={new Date().toISOString().split("T")[0]}
              onChange={(e) => setNewSessionDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#E8599A]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-1 block">
                Pages read <span className="normal-case">(optional)</span>
              </label>
              <input
                type="number"
                min={0}
                value={newSessionPages}
                placeholder="0"
                onChange={(e) => setNewSessionPages(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#E8599A]"
              />
            </div>
            <div>
              <label className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-1 block">
                Minutes <span className="normal-case">(optional)</span>
              </label>
              <input
                type="number"
                min={0}
                value={newSessionMinutes}
                placeholder="0"
                onChange={(e) => setNewSessionMinutes(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#E8599A]"
              />
            </div>
          </div>
          <Button onClick={addSession} disabled={!newSessionDate} className="w-full">
            Log Session
          </Button>
        </div>
      </Modal>

      {/* Edit session modal */}
      <Modal
        open={!!editingSession}
        onClose={() => setEditingSession(null)}
        title={editingSession ? `Edit session — ${formatDate(editingSession.date)}` : ""}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-1 block">Pages read</label>
              <input
                type="number"
                min={0}
                value={editPages}
                onChange={(e) => setEditPages(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#E8599A]"
              />
            </div>
            <div>
              <label className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-1 block">Minutes</label>
              <input
                type="number"
                min={0}
                value={editMinutes}
                onChange={(e) => setEditMinutes(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#E8599A]"
              />
            </div>
          </div>
          <Button onClick={saveSessionEdit} className="w-full">Save changes</Button>
          <button
            onClick={() => { deleteSession(editingSession!.id); setEditingSession(null); }}
            className="text-sm text-red-400 hover:text-red-600 text-center transition-colors"
          >
            Delete this session
          </button>
        </div>
      </Modal>
    </div>
  );
}

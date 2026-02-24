"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { USER_ID } from "@/lib/user";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { BookSearch } from "@/components/books/BookSearch";
import { ReadingTimer } from "@/components/timer/ReadingTimer";
import { progressPercent, formatDurationShort } from "@/lib/utils";
import type { BookSearchResult } from "@/lib/openLibrary";

interface CurrentlyReading {
  id: string;
  current_page: number;
  books: {
    title: string;
    author: string;
    cover_url: string | null;
    total_pages: number | null;
  };
}

interface TodayStats {
  pages: number;
  seconds: number;
}

export default function HomePage() {
  const [reading, setReading] = useState<CurrentlyReading[]>([]);
  const [todayStats, setTodayStats] = useState<TodayStats>({ pages: 0, seconds: 0 });
  const [streak, setStreak] = useState(0);
  const [yearlyGoal, setYearlyGoal] = useState(50);
  const [booksFinished, setBooksFinished] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    // Currently reading
    const { data: readingData } = await supabase
      .from("user_books")
      .select("id, current_page, books(title, author, cover_url, total_pages)")
      .eq("user_id", USER_ID)
      .eq("status", "reading")
      .order("added_at", { ascending: false });

    setReading((readingData as unknown as CurrentlyReading[]) ?? []);

    // Today's sessions
    const { data: todaySessions } = await supabase
      .from("reading_sessions")
      .select("duration_seconds, pages_read")
      .eq("user_id", USER_ID)
      .eq("date", today);

    const pages = (todaySessions ?? []).reduce((s, r) => s + (r.pages_read ?? 0), 0);
    const seconds = (todaySessions ?? []).reduce((s, r) => s + (r.duration_seconds ?? 0), 0);
    setTodayStats({ pages, seconds });

    // Reading streak
    const { data: sessionDates } = await supabase
      .from("reading_sessions")
      .select("date")
      .eq("user_id", USER_ID)
      .order("date", { ascending: false });

    if (sessionDates && sessionDates.length > 0) {
      const dateSet = new Set(sessionDates.map((s) => s.date));
      const pad = (n: number) => String(n).padStart(2, "0");
      const toLocalStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const cursor = new Date();
      if (!dateSet.has(toLocalStr(cursor))) {
        cursor.setDate(cursor.getDate() - 1);
      }
      let s = 0;
      while (dateSet.has(toLocalStr(cursor))) {
        s++;
        cursor.setDate(cursor.getDate() - 1);
      }
      setStreak(s);
    }

    // Books finished this year
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from("user_books")
      .select("*", { count: "exact", head: true })
      .eq("user_id", USER_ID)
      .eq("status", "finished")
      .gte("finish_date", `${year}-01-01`);
    setBooksFinished(count ?? 0);

    // Yearly goal
    const { data: profile } = await supabase
      .from("profiles")
      .select("yearly_goal")
      .eq("id", USER_ID)
      .single();
    setYearlyGoal(profile?.yearly_goal ?? 50);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAddBook(book: BookSearchResult) {
    const supabase = createClient();
    const { data: bookData } = await supabase
      .from("books")
      .upsert(
        {
          title: book.title,
          author: book.author,
          cover_url: book.coverUrl,
          total_pages: book.totalPages,
          genres: book.genres,
          isbn: book.isbn,
          published_year: book.publishedYear,
          ol_id: book.olId,
        },
        { onConflict: "ol_id" }
      )
      .select()
      .single();
    if (!bookData) return;
    await supabase.from("user_books").upsert(
      {
        user_id: USER_ID,
        book_id: bookData.id,
        status: "reading",
        start_date: new Date().toISOString().split("T")[0],
      },
      { onConflict: "user_id,book_id" }
    );
    setShowAddModal(false);
    load();
  }

  const goalProgress = Math.min(100, Math.round((booksFinished / yearlyGoal) * 100));

  return (
    <div className="p-4">
      {/* Gradient header */}
      <div
        className="rounded-[24px] p-6 mb-4"
        style={{ background: "linear-gradient(135deg, var(--color-gradient-a), var(--color-gradient-b))" }}
      >
        <p className="text-white/80 text-xs uppercase tracking-wider mb-1">Today</p>
        <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold text-white mb-4">
          Reading Dashboard
        </h1>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/20 rounded-2xl p-3 text-center">
            <p className="text-white text-2xl font-bold">{reading.length}</p>
            <p className="text-white/85 text-xs">Reading</p>
          </div>
          <div className="bg-white/20 rounded-2xl p-3 text-center">
            <p className="text-white text-2xl font-bold">{todayStats.pages}</p>
            <p className="text-white/85 text-xs">Pages today</p>
          </div>
          <div className="bg-white/20 rounded-2xl p-3 text-center">
            <p className="text-white text-2xl font-bold">{formatDurationShort(todayStats.seconds)}</p>
            <p className="text-white/85 text-xs">Time today</p>
          </div>
        </div>
      </div>

      {/* Streak + goal */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card className="flex items-center gap-3">
          <div className="text-2xl">🔥</div>
          <div>
            <p className="text-[#1A1A1A] text-xl font-bold">{streak}</p>
            <p className="text-xs text-[#6B6B6B]">Day streak</p>
          </div>
        </Card>
        <Card>
          <p className="text-xs text-[#6B6B6B] mb-1">{booksFinished} / {yearlyGoal} books</p>
          <div className="progress-bar mb-1">
            <div className="progress-bar-fill" style={{ width: `${goalProgress}%` }} />
          </div>
          <p className="text-xs text-[#E8599A] font-medium">{goalProgress}% of goal</p>
        </Card>
      </div>

      {/* Currently reading */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-white">Now Reading</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#E8599A] text-white text-xl leading-none hover:bg-[#d44d8a] active:scale-95 transition-all"
          >
            +
          </button>
        </div>

        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[1, 2].map((i) => (
              <div key={i} className="flex-shrink-0 w-28 h-40 bg-white/20 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : reading.length === 0 ? (
          <Card className="text-center py-8">
            <p className="text-[#6B6B6B] text-sm mb-3">You&apos;re not reading anything yet</p>
            <Link
              href="/library"
              className="inline-flex items-center justify-center text-sm font-medium bg-[#E8599A] text-white px-4 py-2 rounded-full hover:bg-[#d44d8a]"
            >
              Browse Library
            </Link>
          </Card>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {reading.map((ub) => {
              const progress = progressPercent(ub.current_page, ub.books.total_pages);
              return (
                <Link key={ub.id} href={`/books/${ub.id}`} className="flex-shrink-0 w-[100px]">
                  <div className="w-[100px] h-[144px] rounded-xl overflow-hidden bg-gray-200 shadow-md mb-2">
                    {ub.books.cover_url ? (
                      <Image
                        src={ub.books.cover_url}
                        alt={ub.books.title}
                        width={100}
                        height={144}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#F4A7CB] to-[#E8599A] flex items-center justify-center">
                        <span className="text-white text-sm font-bold text-center px-1 leading-tight">
                          {ub.books.title.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-white font-medium line-clamp-2 leading-tight mb-1">
                    {ub.books.title}
                  </p>
                  {ub.books.total_pages && (
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                    </div>
                  )}
                  <p className="text-[10px] text-white/75 mt-0.5">{progress}%</p>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Reading Timer */}
      {reading.length > 0 && (
        <div className="mt-6">
            <h2 className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-white mb-3">Start a Session</h2>

          {/* Book selector */}
          {reading.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4">
              {reading.map((ub) => (
                <button
                  key={ub.id}
                  onClick={() => setSelectedBookId(ub.id)}
                  className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    (selectedBookId ?? reading[0].id) === ub.id
                      ? "bg-[#E8599A] text-white border-[#E8599A]"
                      : "bg-white/20 text-white border-white/30"
                  }`}
                >
                  {ub.books.title.length > 20 ? ub.books.title.slice(0, 20) + "…" : ub.books.title}
                </button>
              ))}
            </div>
          )}

          {(() => {
            const activeBook = reading.find((b) => b.id === (selectedBookId ?? reading[0].id)) ?? reading[0];
            return (
              <ReadingTimer
                key={activeBook.id}
                userBookId={activeBook.id}
                bookTitle={activeBook.books.title}
                currentPage={activeBook.current_page}
                totalPages={activeBook.books.total_pages}
                onSessionSaved={() => load()}
              />
            );
          })()}
        </div>
      )}

      {/* Quick actions */}
      <div className="mt-6">
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/library"
            className="bg-[#F7F4F0] rounded-[20px] p-4 flex items-center gap-3 hover:shadow-md transition-shadow"
          >
            <span className="text-2xl">📚</span>
            <span className="text-sm font-medium text-[#1A1A1A]">My Library</span>
          </Link>
          <Link
            href="/stats"
            className="bg-[#F7F4F0] rounded-[20px] p-4 flex items-center gap-3 hover:shadow-md transition-shadow"
          >
            <span className="text-2xl">📊</span>
            <span className="text-sm font-medium text-[#1A1A1A]">Stats</span>
          </Link>
          <Link
            href="/import"
            className="bg-[#F7F4F0] rounded-[20px] p-4 flex items-center gap-3 hover:shadow-md transition-shadow"
          >
            <span className="text-2xl">📥</span>
            <span className="text-sm font-medium text-[#1A1A1A]">Import Books</span>
          </Link>
          <Link
            href="/settings"
            className="bg-[#F7F4F0] rounded-[20px] p-4 flex items-center gap-3 hover:shadow-md transition-shadow"
          >
            <span className="text-2xl">⚙️</span>
            <span className="text-sm font-medium text-[#1A1A1A]">Settings</span>
          </Link>
        </div>
      </div>

      {/* Add book modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add to Currently Reading">
        <BookSearch onSelect={handleAddBook} onClose={() => setShowAddModal(false)} />
      </Modal>
    </div>
  );
}

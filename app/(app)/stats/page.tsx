"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { USER_ID } from "@/lib/user";
import { Card } from "@/components/ui/Card";
import { PillFilter } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { GenreDonutChart } from "@/components/charts/GenreDonutChart";
import { AuthorBarChart } from "@/components/charts/AuthorBarChart";
import { BooksPerMonthChart } from "@/components/charts/BooksPerMonthChart";
import { RatingDistributionChart } from "@/components/charts/RatingDistributionChart";
import { StreakCalendar } from "@/components/charts/StreakCalendar";
import { formatDurationShort, formatDate } from "@/lib/utils";

type Period = "Monthly" | "Yearly" | "All-time";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DEFAULT_PAST_GOALS: Record<number, number> = { 2024: 20, 2025: 50 };
const FULL_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface UserBookOption {
  id: string;
  title: string;
}

interface BookRecord { title: string; days: number }
interface SessionRecord { title: string; date: string; seconds: number }

export default function StatsPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const [period, setPeriod] = useState<Period>("Yearly");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [monthlyYear, setMonthlyYear] = useState(currentYear);
  const [monthlyMonth, setMonthlyMonth] = useState(currentMonth);
  const [calendarMonth, setCalendarMonth] = useState(new Date(currentYear, currentMonth, 1));
  const [loading, setLoading] = useState(true);

  // Stats data
  const [genreData, setGenreData] = useState<{ name: string; value: number }[]>([]);
  const [authorData, setAuthorData] = useState<{ name: string; books: number }[]>([]);
  const [booksPerPeriodData, setBooksPerPeriodData] = useState<{ month: string; books: number }[]>([]);
  const [ratingData, setRatingData] = useState<{ rating: string; count: number }[]>([]);
  const [allSessionDates, setAllSessionDates] = useState<string[]>([]);
  const [dateCoverMap, setDateCoverMap] = useState<Record<string, string[]>>({});
  const [avgPages, setAvgPages] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [yearlyGoal, setYearlyGoal] = useState(50);
  const [booksFinished, setBooksFinished] = useState(0);
  const [streak, setStreak] = useState(0);

  // New stats
  const [avgDaysToFinish, setAvgDaysToFinish] = useState<number | null>(null);
  const [quickestBook, setQuickestBook] = useState<BookRecord | null>(null);
  const [longestBook, setLongestBook] = useState<BookRecord | null>(null);
  const [longestSession, setLongestSession] = useState<SessionRecord | null>(null);
  const [shortestSession, setShortestSession] = useState<SessionRecord | null>(null);

  // Goal editing
  const [editingGoal, setEditingGoal] = useState(false);
  const [editGoalValue, setEditGoalValue] = useState("");
  const [pastYearGoals, setPastYearGoals] = useState<Record<number, number>>({});

  // Backdating
  const [userBooks, setUserBooks] = useState<UserBookOption[]>([]);
  const [backdateDate, setBackdateDate] = useState<string | null>(null);
  const [backdateEndDate, setBackdateEndDate] = useState("");
  const [backdateBookId, setBackdateBookId] = useState("");
  const [backdatePages, setBackdatePages] = useState("");
  const [backdateMinutes, setBackdateMinutes] = useState("");
  const [savingBackdate, setSavingBackdate] = useState(false);
  const [addSessionEndDate, setAddSessionEndDate] = useState("");

  // Day sessions modal (for tapping active calendar dates)
  interface DaySession {
    id: string;
    duration_seconds: number;
    pages_read: number;
    bookTitle: string;
    userBookId: string;
  }
  const [editDayDate, setEditDayDate] = useState<string | null>(null);
  const [editDaySessions, setEditDaySessions] = useState<DaySession[]>([]);
  const [editDayLoading, setEditDayLoading] = useState(false);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlinePages, setInlinePages] = useState("");
  const [inlineMinutes, setInlineMinutes] = useState("");

  // Load per-year goals from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("yearly_goals");
      if (stored) setPastYearGoals(JSON.parse(stored));
    } catch {}
  }, []);

  // Reset goal editing when year changes
  useEffect(() => { setEditingGoal(false); }, [selectedYear]);

  // Fetch user books once for the backdate modal
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("user_books")
      .select("id, status, finish_date, added_at, books(title)")
      .eq("user_id", USER_ID)
      .then(({ data }) => {
        if (data) {
          interface RawUB { id: string; status: string; finish_date: string | null; added_at: string; books: { title: string } | null }
          const statusOrder = (s: string) => s === "reading" ? 0 : s === "finished" ? 1 : 2;
          const sorted = (data as unknown as RawUB[])
            .filter((ub) => ub.books)
            .sort((a, b) => {
              const oa = statusOrder(a.status), ob = statusOrder(b.status);
              if (oa !== ob) return oa - ob;
              if (a.status === "finished") return (b.finish_date ?? "").localeCompare(a.finish_date ?? "");
              return (b.added_at ?? "").localeCompare(a.added_at ?? "");
            });
          setUserBooks(sorted.map((ub) => ({ id: ub.id, title: ub.books!.title })));
        }
      });
  }, []);

  // Load all-time session dates + cover map for the calendar (always unfiltered)
  const loadAllSessionDates = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("reading_sessions")
      .select("date, user_books(books(cover_url))")
      .eq("user_id", USER_ID);

    const dates: string[] = [];
    const coverMap: Record<string, string[]> = {};

    interface RawSession {
      date: string;
      user_books: { books: { cover_url: string | null } | null } | null;
    }

    (data as unknown as RawSession[] ?? []).forEach((s) => {
      dates.push(s.date);
      const cover = s.user_books?.books?.cover_url;
      if (cover) {
        if (!coverMap[s.date]) coverMap[s.date] = [];
        if (!coverMap[s.date].includes(cover)) coverMap[s.date].push(cover);
      }
    });

    setAllSessionDates([...new Set(dates)]);
    setDateCoverMap(coverMap);
  }, []);

  const loadStats = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const today = new Date();

    let range: { from: string; to: string } | null = null;
    if (period === "Yearly") {
      range = { from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31` };
    } else if (period === "Monthly") {
      const from = `${monthlyYear}-${String(monthlyMonth + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(monthlyYear, monthlyMonth + 1, 0).getDate();
      const to = `${monthlyYear}-${String(monthlyMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      range = { from, to };
    }

    // Finished books — include start_date and title for new stats
    let finishedQuery = supabase
      .from("user_books")
      .select("rating, finish_date, start_date, books(title, author, genres, total_pages)")
      .eq("user_id", USER_ID)
      .eq("status", "finished");
    if (range) finishedQuery = finishedQuery.gte("finish_date", range.from).lte("finish_date", range.to);
    const { data: finished } = await finishedQuery;

    setBooksFinished(finished?.length ?? 0);

    interface FinishedBook {
      rating: number | null;
      finish_date: string | null;
      start_date: string | null;
      books: { title: string | null; author: string | null; genres: string[] | null; total_pages: number | null } | null;
    }
    const finishedTyped = (finished ?? []) as unknown as FinishedBook[];

    // Genre aggregation
    const genreCounts: Record<string, number> = {};
    finishedTyped.forEach((ub) => {
      (ub.books?.genres ?? []).forEach((g) => {
        genreCounts[g] = (genreCounts[g] ?? 0) + 1;
      });
    });
    setGenreData(
      Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, value]) => ({ name, value }))
    );

    // Author aggregation
    const authorCounts: Record<string, number> = {};
    finishedTyped.forEach((ub) => {
      const a = ub.books?.author;
      if (a) authorCounts[a] = (authorCounts[a] ?? 0) + 1;
    });
    setAuthorData(
      Object.entries(authorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, books]) => ({ name, books }))
    );

    // Rating distribution
    const ratingBuckets: Record<string, number> = {};
    finishedTyped.forEach((ub) => {
      if (ub.rating) {
        const key = Number(ub.rating).toFixed(1);
        ratingBuckets[key] = (ratingBuckets[key] ?? 0) + 1;
      }
    });
    setRatingData(
      Object.entries(ratingBuckets)
        .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
        .map(([rating, count]) => ({ rating: `★${rating}`, count }))
    );

    // Books per period chart
    if (period === "Yearly") {
      const counts: Record<string, number> = {};
      finishedTyped.forEach((ub) => {
        if (!ub.finish_date) return;
        const key = MONTH_NAMES[new Date(ub.finish_date).getMonth()];
        counts[key] = (counts[key] ?? 0) + 1;
      });
      setBooksPerPeriodData(MONTH_NAMES.map((m) => ({ month: m, books: counts[m] ?? 0 })));
    } else if (period === "All-time") {
      const counts: Record<string, number> = {};
      finishedTyped.forEach((ub) => {
        if (!ub.finish_date) return;
        const year = String(new Date(ub.finish_date).getFullYear());
        counts[year] = (counts[year] ?? 0) + 1;
      });
      const sorted = Object.entries(counts).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
      setBooksPerPeriodData(sorted.map(([year, books]) => ({ month: year, books })));
    } else {
      setBooksPerPeriodData([]);
    }

    // Days to finish
    const booksWithDays = finishedTyped
      .filter((ub) => ub.start_date && ub.finish_date)
      .map((ub) => ({
        title: ub.books?.title ?? "Unknown",
        days: Math.round(
          (new Date(ub.finish_date!).getTime() - new Date(ub.start_date!).getTime()) / 86400000
        ),
      }))
      .filter((b) => b.days >= 0);

    if (booksWithDays.length > 0) {
      const avg = Math.round(booksWithDays.reduce((sum, b) => sum + b.days, 0) / booksWithDays.length);
      setAvgDaysToFinish(avg);
      const sorted = [...booksWithDays].sort((a, b) => a.days - b.days);
      setQuickestBook(sorted[0]);
      setLongestBook(sorted[sorted.length - 1]);
    } else {
      setAvgDaysToFinish(null);
      setQuickestBook(null);
      setLongestBook(null);
    }

    // Sessions — include book title for session records
    interface SessionWithTitle {
      date: string;
      duration_seconds: number;
      pages_read: number;
      user_books: { books: { title: string } | null } | null;
    }

    let sessQuery = supabase
      .from("reading_sessions")
      .select("date, duration_seconds, pages_read, user_books(books(title))")
      .eq("user_id", USER_ID);
    if (range) sessQuery = sessQuery.gte("date", range.from).lte("date", range.to);
    const { data: sessions } = await sessQuery;
    const sessTyped = (sessions ?? []) as unknown as SessionWithTitle[];

    const totalSeconds = sessTyped.reduce((s, r) => s + r.duration_seconds, 0);
    setTotalTime(totalSeconds);
    const totalPagesRead = sessTyped.reduce((s, r) => s + r.pages_read, 0);
    const uniqueDays = new Set(sessTyped.map((s) => s.date)).size;
    setAvgPages(uniqueDays > 0 ? Math.round(totalPagesRead / uniqueDays) : 0);

    // Session records (longest / shortest)
    const sessWithDuration = sessTyped.filter((s) => s.duration_seconds >= 60);
    if (sessWithDuration.length > 0) {
      const sortedSess = [...sessWithDuration].sort((a, b) => a.duration_seconds - b.duration_seconds);
      const sh = sortedSess[0];
      const lo = sortedSess[sortedSess.length - 1];
      setShortestSession({ title: sh.user_books?.books?.title ?? "Unknown", date: sh.date, seconds: sh.duration_seconds });
      setLongestSession({ title: lo.user_books?.books?.title ?? "Unknown", date: lo.date, seconds: lo.duration_seconds });
    } else {
      setShortestSession(null);
      setLongestSession(null);
    }

    // Streak (always all-time)
    const { data: allDatesData } = await supabase
      .from("reading_sessions")
      .select("date")
      .eq("user_id", USER_ID);
    const dateSet = new Set((allDatesData ?? []).map((s: { date: string }) => s.date));
    const pad = (n: number) => String(n).padStart(2, "0");
    const toLocalStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const cursor = new Date(today);
    if (!dateSet.has(toLocalStr(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }
    let s = 0;
    while (dateSet.has(toLocalStr(cursor))) {
      s++;
      cursor.setDate(cursor.getDate() - 1);
    }
    setStreak(s);

    // Yearly goal
    const { data: profile } = await supabase
      .from("profiles")
      .select("yearly_goal")
      .eq("id", USER_ID)
      .single();
    setYearlyGoal(profile?.yearly_goal ?? 50);

    setLoading(false);
  }, [period, selectedYear, monthlyYear, monthlyMonth]);

  useEffect(() => {
    loadStats();
    loadAllSessionDates();
  }, [loadStats, loadAllSessionDates]);

  async function saveBackdate() {
    if (!backdateDate || !backdateBookId) return;
    setSavingBackdate(true);
    const supabase = createClient();

    // Build list of dates in range
    const start = new Date(backdateDate + "T12:00:00");
    const end = backdateEndDate ? new Date(backdateEndDate + "T12:00:00") : start;
    const dates: string[] = [];
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split("T")[0]);
    }

    for (const date of dates) {
      await supabase.from("reading_sessions").insert({
        user_id: USER_ID,
        user_book_id: backdateBookId,
        date,
        duration_seconds: (parseInt(backdateMinutes) || 0) * 60,
        pages_read: parseInt(backdatePages) || 0,
      });
    }
    setSavingBackdate(false);
    setBackdateDate(null);
    setBackdateEndDate("");
    loadAllSessionDates();
    loadStats();
  }

  async function openDayModal(date: string) {
    if (allSessionDates.includes(date)) {
      setEditDayDate(date);
      setEditDayLoading(true);
      setInlineEditId(null);
      setBackdateBookId(userBooks[0]?.id ?? "");
      setBackdatePages("");
      setBackdateMinutes("");
      const supabase = createClient();
      const { data } = await supabase
        .from("reading_sessions")
        .select("id, duration_seconds, pages_read, user_books(id, books(title))")
        .eq("user_id", USER_ID)
        .eq("date", date);
      interface RawDaySess {
        id: string;
        duration_seconds: number;
        pages_read: number;
        user_books: { id: string; books: { title: string } | null } | null;
      }
      setEditDaySessions(
        (data as unknown as RawDaySess[] ?? []).map((s) => ({
          id: s.id,
          duration_seconds: s.duration_seconds,
          pages_read: s.pages_read,
          bookTitle: s.user_books?.books?.title ?? "Unknown",
          userBookId: s.user_books?.id ?? "",
        }))
      );
      setEditDayLoading(false);
    } else {
      setBackdateDate(date);
      setBackdateBookId(userBooks[0]?.id ?? "");
      setBackdatePages("");
      setBackdateMinutes("");
    }
  }

  async function saveInlineEdit(sessionId: string) {
    const supabase = createClient();
    await supabase
      .from("reading_sessions")
      .update({
        pages_read: parseInt(inlinePages) || 0,
        duration_seconds: (parseInt(inlineMinutes) || 0) * 60,
      })
      .eq("id", sessionId);
    setInlineEditId(null);
    setEditDaySessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? { ...s, pages_read: parseInt(inlinePages) || 0, duration_seconds: (parseInt(inlineMinutes) || 0) * 60 }
          : s
      )
    );
    loadAllSessionDates();
    loadStats();
  }

  async function deleteDaySession(sessionId: string) {
    const supabase = createClient();
    await supabase.from("reading_sessions").delete().eq("id", sessionId);
    setEditDaySessions((prev) => prev.filter((s) => s.id !== sessionId));
    loadAllSessionDates();
    loadStats();
  }

  async function addSessionToDay() {
    if (!editDayDate || !backdateBookId) return;
    setSavingBackdate(true);
    const supabase = createClient();

    // Build list of dates in range
    const start = new Date(editDayDate + "T12:00:00");
    const end = addSessionEndDate ? new Date(addSessionEndDate + "T12:00:00") : start;
    const dates: string[] = [];
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split("T")[0]);
    }

    let lastSess: unknown = null;
    for (const date of dates) {
      const { data } = await supabase
        .from("reading_sessions")
        .insert({
          user_id: USER_ID,
          user_book_id: backdateBookId,
          date,
          duration_seconds: (parseInt(backdateMinutes) || 0) * 60,
          pages_read: parseInt(backdatePages) || 0,
        })
        .select("id, duration_seconds, pages_read, user_books(id, books(title))")
        .single();
      if (date === editDayDate) lastSess = data;
    }

    setSavingBackdate(false);
    setBackdatePages("");
    setBackdateMinutes("");
    setAddSessionEndDate("");

    if (lastSess) {
      interface RawDaySess {
        id: string; duration_seconds: number; pages_read: number;
        user_books: { id: string; books: { title: string } | null } | null;
      }
      const s = lastSess as unknown as RawDaySess;
      setEditDaySessions((prev) => [...prev, {
        id: s.id,
        duration_seconds: s.duration_seconds,
        pages_read: s.pages_read,
        bookTitle: s.user_books?.books?.title ?? "Unknown",
        userBookId: s.user_books?.id ?? "",
      }]);
    }
    loadAllSessionDates();
    loadStats();
  }

  async function saveGoal(newGoal: number) {
    if (newGoal < 1) return;
    if (selectedYear === currentYear) {
      const supabase = createClient();
      await supabase.from("profiles").update({ yearly_goal: newGoal }).eq("id", USER_ID);
      setYearlyGoal(newGoal);
    } else {
      const updated = { ...pastYearGoals, [selectedYear]: newGoal };
      setPastYearGoals(updated);
      localStorage.setItem("yearly_goals", JSON.stringify(updated));
    }
    setEditingGoal(false);
  }

  const effectiveGoal =
    selectedYear === currentYear
      ? yearlyGoal
      : pastYearGoals[selectedYear] ?? DEFAULT_PAST_GOALS[selectedYear] ?? 50;
  const goalProgress = Math.min(100, Math.round((booksFinished / effectiveGoal) * 100));
  const goalCompleted = booksFinished >= effectiveGoal;

  function prevMonth() {
    if (monthlyMonth === 0) { setMonthlyMonth(11); setMonthlyYear((y) => y - 1); }
    else setMonthlyMonth((m) => m - 1);
  }
  function nextMonth() {
    if (monthlyYear > currentYear || (monthlyYear === currentYear && monthlyMonth >= currentMonth)) return;
    if (monthlyMonth === 11) { setMonthlyMonth(0); setMonthlyYear((y) => y + 1); }
    else setMonthlyMonth((m) => m + 1);
  }
  const isAtCurrentOrFutureMonth =
    monthlyYear > currentYear || (monthlyYear === currentYear && monthlyMonth >= currentMonth);

  const periodLabel =
    period === "Monthly"
      ? `${FULL_MONTH_NAMES[monthlyMonth]} ${monthlyYear}`
      : period === "Yearly"
      ? String(selectedYear)
      : "All Time";

  return (
    <div className="p-4">
      {/* Header */}
      <div className="pt-6 pb-4">
        <p className="text-xs text-white/80 uppercase tracking-wider mb-1">Your</p>
        <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold text-white">
          Reading Stats
        </h1>
      </div>

      {/* Period filter */}
      <div className="mb-4">
        <PillFilter
          options={["Monthly", "Yearly", "All-time"]}
          value={period}
          onChange={(v) => setPeriod(v as Period)}
        />
      </div>

      {/* Month / Year navigation */}
      {period !== "All-time" && (
        <div className="flex items-center justify-center gap-4 mb-5">
          <button
            onClick={period === "Monthly" ? prevMonth : () => setSelectedYear((y) => y - 1)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
          >
            ←
          </button>
          <span className="text-white font-medium text-sm min-w-[160px] text-center">
            {periodLabel}
          </span>
          <button
            onClick={period === "Monthly" ? nextMonth : () => setSelectedYear((y) => y + 1)}
            disabled={period === "Monthly" ? isAtCurrentOrFutureMonth : selectedYear >= currentYear}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            →
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 bg-white/20 rounded-[20px] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Yearly goal */}
          {period === "Yearly" && (
            <Card>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-[#6B6B6B] uppercase tracking-wide">
                  Reading Goal {selectedYear}
                </p>
                <button
                  onClick={() => { setEditingGoal(true); setEditGoalValue(String(effectiveGoal)); }}
                  className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200 text-[#6B6B6B] transition-colors"
                  title="Edit goal"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              </div>

              {editingGoal ? (
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="number"
                    min={1}
                    value={editGoalValue}
                    onChange={(e) => setEditGoalValue(e.target.value)}
                    autoFocus
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#E8599A]"
                  />
                  <Button onClick={() => saveGoal(parseInt(editGoalValue) || 50)} size="sm">Save</Button>
                  <button onClick={() => setEditingGoal(false)} className="text-xs text-[#6B6B6B]">Cancel</button>
                </div>
              ) : goalCompleted ? (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-[family-name:var(--font-playfair)] text-3xl font-bold text-[#E8599A]">
                      {booksFinished}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#E8599A]">🎉 Goal completed!</p>
                      <p className="text-xs text-[#6B6B6B]">{booksFinished} of {effectiveGoal} books</p>
                    </div>
                  </div>
                  <div className="progress-bar" style={{ height: "10px" }}>
                    <div className="progress-bar-fill" style={{ width: "100%", height: "10px" }} />
                  </div>
                  <p className="text-xs text-[#6B6B6B] mt-2">{booksFinished} of {effectiveGoal} books read</p>
                </>
              ) : (
                <>
                  <div className="flex items-end justify-between mb-3">
                    <span className="font-[family-name:var(--font-playfair)] text-3xl font-bold text-[#E8599A]">
                      {booksFinished}
                    </span>
                    <span className="text-sm text-[#6B6B6B]">of {effectiveGoal} books</span>
                  </div>
                  <div className="progress-bar" style={{ height: "10px" }}>
                    <div className="progress-bar-fill" style={{ width: `${goalProgress}%`, height: "10px" }} />
                  </div>
                  <p className="text-xs text-[#6B6B6B] mt-2">
                    {goalProgress}% complete · {Math.max(0, effectiveGoal - booksFinished)} to go
                  </p>
                </>
              )}
            </Card>
          )}

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-[#E8599A]">{streak}</p>
              <p className="text-xs text-[#6B6B6B]">Day streak</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-2xl font-bold text-[#E8599A]">{avgPages}</p>
              <p className="text-xs text-[#6B6B6B]">Avg pages/day</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-lg font-bold text-[#E8599A]">{formatDurationShort(totalTime)}</p>
              <p className="text-xs text-[#6B6B6B]">Total time</p>
            </Card>
          </div>

          {/* Streak calendar (always all-time dates) */}
          <Card>
            <p className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-1">Reading</p>
            <p className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-[#E8599A] mb-3">
              Streak
            </p>
            <StreakCalendar
              activeDates={allSessionDates}
              dateCoverMap={dateCoverMap}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              onDateClick={openDayModal}
            />
          </Card>

          {/* Books finished per month (Yearly) or per year (All-time) */}
          {period !== "Monthly" && booksPerPeriodData.some((d) => d.books > 0) && (
            <Card>
              <p className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-1">Books finished per</p>
              <p className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-[#E8599A] mb-3">
                {period === "Yearly" ? "Month" : "Year"}
              </p>
              <BooksPerMonthChart data={booksPerPeriodData} />
            </Card>
          )}

          {/* Reading pace */}
          {avgDaysToFinish !== null && (
            <Card>
              <p className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-1">Reading pace</p>
              <p className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-[#E8599A] mb-3">
                Days per book
              </p>
              <div className="flex items-center gap-3 mb-4">
                <p className="font-[family-name:var(--font-playfair)] text-4xl font-bold text-[#1A1A1A]">
                  {avgDaysToFinish}
                </p>
                <p className="text-sm text-[#6B6B6B] leading-tight">avg days<br />to finish</p>
              </div>
              {quickestBook && longestBook && quickestBook.title !== longestBook.title && (
                <div className="border-t border-gray-100 pt-3 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-[10px] text-[#6B6B6B] uppercase tracking-wide mb-0.5">Quickest finish</p>
                      <p className="text-sm font-medium text-[#1A1A1A] line-clamp-1">{quickestBook.title}</p>
                    </div>
                    <span className="text-sm font-semibold text-[#E8599A] whitespace-nowrap">{quickestBook.days}d</span>
                  </div>
                  <div className="flex justify-between items-start pt-2 border-t border-gray-100">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-[10px] text-[#6B6B6B] uppercase tracking-wide mb-0.5">Longest to finish</p>
                      <p className="text-sm font-medium text-[#1A1A1A] line-clamp-1">{longestBook.title}</p>
                    </div>
                    <span className="text-sm font-semibold text-[#E8599A] whitespace-nowrap">{longestBook.days}d</span>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Session records */}
          {(longestSession || shortestSession) && (
            <Card>
              <p className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-1">Session records</p>
              <p className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-[#E8599A] mb-3">
                Best &amp; shortest
              </p>
              <div className="flex flex-col gap-0">
                {longestSession && (
                  <div className="flex justify-between items-start py-2 border-b border-gray-100">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-[10px] text-[#6B6B6B] uppercase tracking-wide mb-0.5">Longest session</p>
                      <p className="text-sm font-medium text-[#1A1A1A] line-clamp-1">{longestSession.title}</p>
                      <p className="text-xs text-[#6B6B6B]">{formatDate(longestSession.date)}</p>
                    </div>
                    <span className="text-sm font-semibold text-[#E8599A] whitespace-nowrap">
                      {formatDurationShort(longestSession.seconds)}
                    </span>
                  </div>
                )}
                {shortestSession && (
                  <div className="flex justify-between items-start py-2">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-[10px] text-[#6B6B6B] uppercase tracking-wide mb-0.5">Shortest session</p>
                      <p className="text-sm font-medium text-[#1A1A1A] line-clamp-1">{shortestSession.title}</p>
                      <p className="text-xs text-[#6B6B6B]">{formatDate(shortestSession.date)}</p>
                    </div>
                    <span className="text-sm font-semibold text-[#E8599A] whitespace-nowrap">
                      {formatDurationShort(shortestSession.seconds)}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Genres */}
          {genreData.length > 0 && (
            <Card>
              <p className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-1">Most read</p>
              <p className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-[#E8599A] mb-3">
                Genres
              </p>
              <GenreDonutChart data={genreData} />
            </Card>
          )}

          {/* Authors */}
          {authorData.length > 0 && (
            <Card>
              <p className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-1">Most read</p>
              <p className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-[#E8599A] mb-3">
                Authors
              </p>
              <AuthorBarChart data={authorData} />
            </Card>
          )}

          {/* Rating distribution */}
          {ratingData.length > 0 && (
            <Card>
              <p className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-1">Your</p>
              <p className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-[#E8599A] mb-3">
                Ratings
              </p>
              <RatingDistributionChart data={ratingData} />
            </Card>
          )}

          {/* Empty state */}
          {booksFinished === 0 && genreData.length === 0 && (
            <Card className="text-center py-8">
              <p className="text-[#6B6B6B] text-sm">No finished books for this period</p>
            </Card>
          )}
        </div>
      )}

      {/* Backdate session modal */}
      <Modal
        open={!!backdateDate}
        onClose={() => { setBackdateDate(null); setBackdateEndDate(""); }}
        title={`Log session — ${backdateDate ?? ""}`}
      >
        <div className="flex flex-col gap-4">
          {userBooks.length === 0 ? (
            <p className="text-sm text-[#6B6B6B]">No books in your library yet.</p>
          ) : (
            <>
              <div>
                <label className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-1 block">
                  Book
                </label>
                <select
                  value={backdateBookId}
                  onChange={(e) => setBackdateBookId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#E8599A]"
                >
                  {userBooks.map((ub) => (
                    <option key={ub.id} value={ub.id}>{ub.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-1 block">
                  End date <span className="normal-case text-[#6B6B6B]">(optional — log across multiple days)</span>
                </label>
                <input
                  type="date"
                  value={backdateEndDate}
                  min={backdateDate ?? undefined}
                  onChange={(e) => setBackdateEndDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#E8599A]"
                />
                {backdateEndDate && backdateDate && backdateEndDate > backdateDate && (
                  <p className="text-xs text-[#E8599A] mt-1">
                    Will log {Math.round((new Date(backdateEndDate).getTime() - new Date(backdateDate).getTime()) / 86400000) + 1} days
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-1 block">
                    Pages read <span className="normal-case">(optional)</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={backdatePages}
                    placeholder="0"
                    onChange={(e) => setBackdatePages(e.target.value)}
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
                    value={backdateMinutes}
                    placeholder="0"
                    onChange={(e) => setBackdateMinutes(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#E8599A]"
                  />
                </div>
              </div>
              <Button
                onClick={saveBackdate}
                disabled={savingBackdate || !backdateBookId}
                className="w-full"
              >
                {savingBackdate ? "Saving..." : backdateEndDate && backdateEndDate > (backdateDate ?? "") ? "Log Sessions" : "Log Session"}
              </Button>
            </>
          )}
        </div>
      </Modal>
      {/* Edit existing day sessions modal */}
      <Modal
        open={!!editDayDate}
        onClose={() => { setEditDayDate(null); setInlineEditId(null); setAddSessionEndDate(""); }}
        title={editDayDate ? formatDate(editDayDate) : ""}
      >
        {editDayLoading ? (
          <div className="text-center py-4 text-sm text-[#6B6B6B]">Loading...</div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Existing sessions */}
            {editDaySessions.length > 0 && (
              <div>
                <p className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-2">Sessions logged</p>
                <div className="flex flex-col">
                  {editDaySessions.map((s) => (
                    <div key={s.id}>
                      {inlineEditId === s.id ? (
                        <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-3 mb-2">
                          <p className="text-sm font-medium text-[#1A1A1A]">{s.bookTitle}</p>
                          <div className="grid grid-cols-2 gap-2">
                            <input type="number" min={0} value={inlinePages} onChange={(e) => setInlinePages(e.target.value)} placeholder="Pages"
                              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#E8599A]" />
                            <input type="number" min={0} value={inlineMinutes} onChange={(e) => setInlineMinutes(e.target.value)} placeholder="Minutes"
                              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#E8599A]" />
                          </div>
                          <div className="flex items-center gap-3">
                            <Button onClick={() => saveInlineEdit(s.id)} className="flex-1">Save</Button>
                            <button onClick={() => setInlineEditId(null)} className="text-sm text-[#6B6B6B]">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 py-2 border-b border-gray-100 last:border-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#1A1A1A] line-clamp-1">{s.bookTitle}</p>
                            <p className="text-xs text-[#6B6B6B]">
                              {s.pages_read > 0 ? `${s.pages_read} pages` : "No pages"} · {s.duration_seconds > 0 ? formatDurationShort(s.duration_seconds) : "Time not logged"}
                            </p>
                          </div>
                          <button
                            onClick={() => { setInlineEditId(s.id); setInlinePages(String(s.pages_read)); setInlineMinutes(String(Math.round(s.duration_seconds / 60))); }}
                            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 text-[#6B6B6B] flex-shrink-0"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteDaySession(s.id)}
                            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 text-red-400 flex-shrink-0"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add another session */}
            {userBooks.length > 0 && (
              <div>
                <p className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-2">
                  {editDaySessions.length > 0 ? "Add another session" : "Log a session"}
                </p>
                <div className="flex flex-col gap-3">
                  <select value={backdateBookId} onChange={(e) => setBackdateBookId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#E8599A]">
                    {userBooks.map((ub) => (
                      <option key={ub.id} value={ub.id}>{ub.title}</option>
                    ))}
                  </select>
                  <div>
                    <label className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-1 block">
                      End date <span className="normal-case text-[#6B6B6B]">(optional — log across multiple days)</span>
                    </label>
                    <input
                      type="date"
                      value={addSessionEndDate}
                      min={editDayDate ?? undefined}
                      onChange={(e) => setAddSessionEndDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#E8599A]"
                    />
                    {addSessionEndDate && editDayDate && addSessionEndDate > editDayDate && (
                      <p className="text-xs text-[#E8599A] mt-1">
                        Will log {Math.round((new Date(addSessionEndDate).getTime() - new Date(editDayDate).getTime()) / 86400000) + 1} days
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="number" min={0} value={backdatePages} placeholder="Pages (optional)" onChange={(e) => setBackdatePages(e.target.value)}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#E8599A]" />
                    <input type="number" min={0} value={backdateMinutes} placeholder="Minutes (optional)" onChange={(e) => setBackdateMinutes(e.target.value)}
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#E8599A]" />
                  </div>
                  <Button onClick={addSessionToDay} disabled={savingBackdate || !backdateBookId} className="w-full">
                    {savingBackdate ? "Saving..." : addSessionEndDate && addSessionEndDate > (editDayDate ?? "") ? "Log Sessions" : "Log Session"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

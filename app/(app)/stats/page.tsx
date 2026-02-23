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
import { formatDurationShort } from "@/lib/utils";

type Period = "Monthly" | "Yearly" | "All-time";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface UserBookOption {
  id: string;
  title: string;
}

export default function StatsPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

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
  const [avgPages, setAvgPages] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [yearlyGoal, setYearlyGoal] = useState(50);
  const [booksFinished, setBooksFinished] = useState(0);
  const [streak, setStreak] = useState(0);

  // Backdating
  const [userBooks, setUserBooks] = useState<UserBookOption[]>([]);
  const [backdateDate, setBackdateDate] = useState<string | null>(null);
  const [backdateBookId, setBackdateBookId] = useState("");
  const [backdatePages, setBackdatePages] = useState("0");
  const [backdateMinutes, setBackdateMinutes] = useState("30");
  const [savingBackdate, setSavingBackdate] = useState(false);

  // Fetch user books once for the backdate modal
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("user_books")
      .select("id, books(title)")
      .eq("user_id", USER_ID)
      .in("status", ["reading", "finished"])
      .then(({ data }) => {
        if (data) {
          interface RawUB { id: string; books: { title: string } | null }
          setUserBooks(
            (data as unknown as RawUB[])
              .filter((ub) => ub.books)
              .map((ub) => ({ id: ub.id, title: ub.books!.title }))
          );
        }
      });
  }, []);

  // Load all-time session dates for the calendar (always unfiltered)
  const loadAllSessionDates = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("reading_sessions")
      .select("date")
      .eq("user_id", USER_ID);
    setAllSessionDates([...new Set((data ?? []).map((s: { date: string }) => s.date))]);
  }, []);

  const loadStats = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const today = new Date();

    // Build date range based on current period/nav state
    let range: { from: string; to: string } | null = null;
    if (period === "Yearly") {
      range = { from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31` };
    } else if (period === "Monthly") {
      const from = `${monthlyYear}-${String(monthlyMonth + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(monthlyYear, monthlyMonth + 1, 0).getDate();
      const to = `${monthlyYear}-${String(monthlyMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      range = { from, to };
    }

    // Finished books
    let finishedQuery = supabase
      .from("user_books")
      .select("rating, finish_date, books(author, genres, total_pages)")
      .eq("user_id", USER_ID)
      .eq("status", "finished");
    if (range) finishedQuery = finishedQuery.gte("finish_date", range.from).lte("finish_date", range.to);
    const { data: finished } = await finishedQuery;

    setBooksFinished(finished?.length ?? 0);

    interface FinishedBook {
      rating: number | null;
      finish_date: string | null;
      books: { author: string | null; genres: string[] | null; total_pages: number | null } | null;
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

    // Sessions
    let sessQuery = supabase
      .from("reading_sessions")
      .select("date, duration_seconds, pages_read")
      .eq("user_id", USER_ID);
    if (range) sessQuery = sessQuery.gte("date", range.from).lte("date", range.to);
    const { data: sessions } = await sessQuery;

    const totalSeconds = (sessions ?? []).reduce((s: number, r: { duration_seconds: number }) => s + r.duration_seconds, 0);
    setTotalTime(totalSeconds);
    const totalPagesRead = (sessions ?? []).reduce((s: number, r: { pages_read: number }) => s + r.pages_read, 0);
    const uniqueDays = new Set((sessions ?? []).map((s: { date: string }) => s.date)).size;
    setAvgPages(uniqueDays > 0 ? Math.round(totalPagesRead / uniqueDays) : 0);

    // Streak (always all-time regardless of period filter)
    const { data: allDatesData } = await supabase
      .from("reading_sessions")
      .select("date")
      .eq("user_id", USER_ID)
      .order("date", { ascending: false });
    const uniqueDatesAll = [...new Set((allDatesData ?? []).map((s: { date: string }) => s.date))].sort().reverse();
    let s = 0;
    for (let i = 0; i < uniqueDatesAll.length; i++) {
      const d = new Date(uniqueDatesAll[i]);
      const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000);
      if (diffDays <= i + 1) s++;
      else break;
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
    await supabase.from("reading_sessions").insert({
      user_id: USER_ID,
      user_book_id: backdateBookId,
      date: backdateDate,
      duration_seconds: (parseInt(backdateMinutes) || 0) * 60,
      pages_read: parseInt(backdatePages) || 0,
    });
    setSavingBackdate(false);
    setBackdateDate(null);
    loadAllSessionDates();
    loadStats();
  }

  const goalProgress = Math.min(100, Math.round((booksFinished / yearlyGoal) * 100));

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
          {/* Yearly goal (current year only) */}
          {period === "Yearly" && selectedYear === currentYear && (
            <Card>
              <p className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-2">
                Reading Goal {currentYear}
              </p>
              <div className="flex items-end justify-between mb-3">
                <span className="font-[family-name:var(--font-playfair)] text-3xl font-bold text-[#E8599A]">
                  {booksFinished}
                </span>
                <span className="text-sm text-[#6B6B6B]">of {yearlyGoal} books</span>
              </div>
              <div className="progress-bar" style={{ height: "10px" }}>
                <div className="progress-bar-fill" style={{ width: `${goalProgress}%`, height: "10px" }} />
              </div>
              <p className="text-xs text-[#6B6B6B] mt-2">
                {goalProgress}% complete · {Math.max(0, yearlyGoal - booksFinished)} to go
              </p>
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

          {/* Streak calendar (always all-time dates) */}
          <Card>
            <p className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-1">Reading</p>
            <p className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-[#E8599A] mb-3">
              Streak
            </p>
            <StreakCalendar
              activeDates={allSessionDates}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              onDateClick={(date) => {
                setBackdateDate(date);
                setBackdateBookId(userBooks[0]?.id ?? "");
                setBackdatePages("0");
                setBackdateMinutes("30");
              }}
            />
          </Card>
        </div>
      )}

      {/* Backdate session modal */}
      <Modal
        open={!!backdateDate}
        onClose={() => setBackdateDate(null)}
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-1 block">
                    Pages read
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={backdatePages}
                    onChange={(e) => setBackdatePages(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:ring-2 focus:ring-[#E8599A]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-1 block">
                    Minutes
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={backdateMinutes}
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
                {savingBackdate ? "Saving..." : "Log Session"}
              </Button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

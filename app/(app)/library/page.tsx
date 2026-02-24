"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { USER_ID } from "@/lib/user";
import { BookCard } from "@/components/books/BookCard";
import { BookSearch } from "@/components/books/BookSearch";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import type { BookSearchResult } from "@/lib/openLibrary";

type Status = "reading" | "finished" | "want_to_read" | "dnf";
type SortKey = "date_added" | "date_finished" | "published_year" | "my_rating" | "title" | "community_rating";
type SortDir = "desc" | "asc";

interface UserBook {
  id: string;
  status: Status;
  current_page: number;
  rating: number | null;
  added_at: string;
  finish_date: string | null;
  books: {
    id: string;
    title: string;
    author: string;
    cover_url: string | null;
    total_pages: number | null;
    published_year: number | null;
  };
}

interface CommunityEntry {
  rating: number | null;
  coverUrl: string | null;
}

const TABS = [
  { id: "reading", label: "Reading" },
  { id: "finished", label: "Finished" },
  { id: "want_to_read", label: "Want to Read" },
  { id: "dnf", label: "DNF" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "date_added", label: "Date Added" },
  { key: "date_finished", label: "Date Finished" },
  { key: "published_year", label: "Publication Year" },
  { key: "my_rating", label: "My Rating" },
  { key: "community_rating", label: "Community Rating" },
  { key: "title", label: "Title (A–Z)" },
];

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<Status>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("library_tab");
      if (saved && ["reading", "finished", "want_to_read", "dnf"].includes(saved)) return saved as Status;
    }
    return "reading";
  });

  function handleTabChange(tab: Status) {
    setActiveTab(tab);
    sessionStorage.setItem("library_tab", tab);
  }
  const [books, setBooks] = useState<UserBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingStatus, setAddingStatus] = useState<Status>("want_to_read");
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("library_sort_key");
      if (saved && ["date_added", "date_finished", "published_year", "my_rating", "title", "community_rating"].includes(saved)) return saved as SortKey;
    }
    return "date_added";
  });
  const [sortDir, setSortDir] = useState<SortDir>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("library_sort_dir");
      if (saved === "asc" || saved === "desc") return saved;
    }
    return "desc";
  });
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [communityData, setCommunityData] = useState<Map<string, CommunityEntry>>(new Map());
  // Track which user_book ids have already been fetched so we don't re-fetch on re-renders
  const fetchedIds = useRef<Set<string>>(new Set());

  const loadBooks = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("user_books")
      .select("id, status, current_page, rating, added_at, finish_date, books(id, title, author, cover_url, total_pages, published_year)")
      .eq("user_id", USER_ID);
    setBooks((data as unknown as UserBook[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadBooks(); }, [loadBooks]);

  // Fetch community data (ratings + cover fallbacks) only for books in the current tab.
  // Results are cached in the browser via Cache-Control headers on /api/book-details,
  // so navigating back to this page or switching tabs doesn't re-hit the API.
  useEffect(() => {
    if (loading || books.length === 0) return;

    const tabBooks = books.filter((b) => b.status === activeTab);
    const unfetched = tabBooks.filter((b) => !fetchedIds.current.has(b.id));
    if (unfetched.length === 0) return;

    // Mark as fetched immediately so this effect doesn't fire again for the same books
    unfetched.forEach((b) => fetchedIds.current.add(b.id));

    (async () => {
      const supabase = createClient();
      const results = await Promise.all(
        unfetched.map(async (ub) => {
          try {
            const params = new URLSearchParams({ title: ub.books.title, author: ub.books.author });
            const res = await fetch(`/api/book-details?${params}`);
            if (!res.ok) return { id: ub.id, bookDbId: ub.books.id, hadCover: !!ub.books.cover_url, rating: null, coverUrl: null };
            const gb = await res.json();
            return { id: ub.id, bookDbId: ub.books.id, hadCover: !!ub.books.cover_url, rating: gb?.averageRating ?? null, coverUrl: gb?.coverUrl ?? null };
          } catch {
            return { id: ub.id, bookDbId: ub.books.id, hadCover: !!ub.books.cover_url, rating: null, coverUrl: null };
          }
        })
      );

      // Save cover URLs to the DB (awaited) so they survive page navigations
      await Promise.all(
        results
          .filter((r) => !r.hadCover && r.coverUrl)
          .map((r) => supabase.from("books").update({ cover_url: r.coverUrl }).eq("id", r.bookDbId))
      );

      setCommunityData((prev) => {
        const merged = new Map(prev);
        for (const r of results) merged.set(r.id, { rating: r.rating, coverUrl: r.coverUrl });
        return merged;
      });

      // Also update local books state immediately so covers don't flash away on tab switches
      setBooks((prev) =>
        prev.map((b) => {
          const r = results.find((res) => res.id === b.id);
          if (r?.coverUrl && !b.books.cover_url) {
            return { ...b, books: { ...b.books, cover_url: r.coverUrl } };
          }
          return b;
        })
      );
    })();
  }, [books, activeTab, loading]);

  async function handleRemoveBook(userBookId: string) {
    const supabase = createClient();
    await supabase.from("user_books").delete().eq("id", userBookId);
    setBooks((prev) => prev.filter((b) => b.id !== userBookId));
  }

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
        status: addingStatus,
        start_date: addingStatus === "reading" ? new Date().toISOString().split("T")[0] : null,
      },
      { onConflict: "user_id,book_id" }
    );

    setShowAddModal(false);
    loadBooks();
  }

  const sorted = useMemo(() => {
    const filtered = books.filter((b) => b.status === activeTab);
    const dir = sortDir === "desc" ? -1 : 1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "date_added":
          return dir * (new Date(b.added_at).getTime() - new Date(a.added_at).getTime());
        case "date_finished":
          if (!a.finish_date && !b.finish_date) return 0;
          if (!a.finish_date) return 1;
          if (!b.finish_date) return -1;
          return dir * (new Date(b.finish_date).getTime() - new Date(a.finish_date).getTime());
        case "published_year":
          return dir * ((b.books.published_year ?? 0) - (a.books.published_year ?? 0));
        case "my_rating":
          return dir * ((b.rating ?? 0) - (a.rating ?? 0));
        case "community_rating": {
          const rA = communityData.get(a.id)?.rating ?? 0;
          const rB = communityData.get(b.id)?.rating ?? 0;
          return dir * (rB - rA);
        }
        case "title":
          return dir * a.books.title.localeCompare(b.books.title);
        default:
          return 0;
      }
    });
  }, [books, activeTab, sortKey, sortDir, communityData]);

  const activeSortLabel = SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? "Sort";

  return (
    <div className="p-4">
      {/* Header */}
      <div className="pt-6 pb-4">
        <p className="text-xs text-white/80 uppercase tracking-wider mb-1">My</p>
        <h1 className="font-[family-name:var(--font-playfair)] text-3xl font-bold text-white">
          Library
        </h1>
      </div>

      {/* Tabs */}
      <Tabs tabs={TABS} activeTab={activeTab} onChange={(id) => { handleTabChange(id as Status); setShowSortMenu(false); }} className="mb-3" />

      {/* Sort bar */}
      <div className="flex justify-end items-center gap-2 mb-3 relative">
        {/* Asc/Desc toggle */}
        <button
          onClick={() => setSortDir((d) => { const next = d === "desc" ? "asc" : "desc"; sessionStorage.setItem("library_sort_dir", next); return next; })}
          title={sortDir === "desc" ? "Descending" : "Ascending"}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 text-white/80 hover:bg-white/30 transition-colors"
        >
          {sortDir === "desc" ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <polyline points="19 12 12 19 5 12" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          )}
        </button>

        <button
          onClick={() => setShowSortMenu((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-white/80 bg-white/20 px-3 py-1.5 rounded-full hover:bg-white/30 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="6" y1="12" x2="18" y2="12" />
            <line x1="9" y1="18" x2="15" y2="18" />
          </svg>
          {activeSortLabel}
        </button>

        {showSortMenu && (
          <div className="absolute top-9 right-0 bg-[#F7F4F0] rounded-2xl shadow-lg overflow-hidden z-20 min-w-[180px]">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => { setSortKey(opt.key); sessionStorage.setItem("library_sort_key", opt.key); setShowSortMenu(false); }}
                className={`w-full text-left text-sm px-4 py-2.5 transition-colors ${
                  sortKey === opt.key
                    ? "bg-[#FAE0EE] text-[#E8599A] font-medium"
                    : "text-[#1A1A1A] hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Book list */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white/20 rounded-[20px] h-28 animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-white/85 text-sm">No books here yet</p>
          <p className="text-white/65 text-xs mt-1">Tap + to add a book</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((ub) => {
            const community = communityData.get(ub.id);
            const resolvedCover = ub.books.cover_url ?? community?.coverUrl ?? null;
            return (
              <BookCard
                key={ub.id}
                id={ub.id}
                title={ub.books.title}
                author={ub.books.author}
                coverUrl={resolvedCover}
                status={ub.status}
                currentPage={ub.current_page}
                totalPages={ub.books.total_pages}
                rating={ub.rating}
                communityRating={community?.rating ?? null}
                onRemove={() => handleRemoveBook(ub.id)}
              />
            );
          })}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-[#E8599A] text-white shadow-lg flex items-center justify-center text-2xl hover:bg-[#d44d8a] active:scale-95 transition-all z-30"
      >
        +
      </button>

      {/* Add book modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Add a book">
        <div className="mb-3">
          <p className="text-xs text-[#6B6B6B] mb-2">Add to shelf:</p>
          <div className="flex gap-2 flex-wrap">
            {(["want_to_read", "reading", "finished"] as Status[]).map((s) => (
              <button
                key={s}
                onClick={() => setAddingStatus(s)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  addingStatus === s
                    ? "bg-[#E8599A] text-white border-[#E8599A]"
                    : "border-gray-300 text-[#6B6B6B]"
                }`}
              >
                {s === "want_to_read" ? "Want to Read" : s === "reading" ? "Reading" : "Finished"}
              </button>
            ))}
          </div>
        </div>
        <BookSearch onSelect={handleAddBook} onClose={() => setShowAddModal(false)} />
      </Modal>
    </div>
  );
}

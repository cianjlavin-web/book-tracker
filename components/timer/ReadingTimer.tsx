"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { USER_ID } from "@/lib/user";
import { formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";

interface ReadingTimerProps {
  userBookId: string;
  bookTitle: string;
  currentPage: number;
  totalPages: number | null;
  onSessionSaved?: (pagesRead: number, endPage: number) => void;
}

const STORAGE_KEY = "reading_timer_state";

interface TimerState {
  status: "idle" | "running" | "paused";
  elapsed: number;
  startedAt: number | null;
  userBookId: string;
}

export function ReadingTimer({
  userBookId,
  bookTitle,
  currentPage,
  totalPages,
  onSessionSaved,
}: ReadingTimerProps) {
  const [timerState, setTimerState] = useState<TimerState>({
    status: "idle",
    elapsed: 0,
    startedAt: null,
    userBookId,
  });
  const [showStopModal, setShowStopModal] = useState(false);
  const [startPage, setStartPage] = useState(String(currentPage));
  const [endPage, setEndPage] = useState(String(currentPage));
  const [saving, setSaving] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const state: TimerState = JSON.parse(stored);
      if (state.userBookId === userBookId) {
        if (state.status === "running" && state.startedAt) {
          const now = Date.now();
          const elapsed = state.elapsed + Math.floor((now - state.startedAt) / 1000);
          setTimerState({ ...state, elapsed, startedAt: now });
        } else {
          setTimerState(state);
        }
      }
    }
  }, [userBookId]);

  // Interval tick
  useEffect(() => {
    if (timerState.status === "running") {
      intervalRef.current = setInterval(() => {
        setTimerState((prev) => {
          const updated = { ...prev, elapsed: prev.elapsed + 1 };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerState.status]);

  const handleStart = useCallback(() => {
    const now = Date.now();
    const newState: TimerState = {
      status: "running",
      elapsed: timerState.elapsed,
      startedAt: now,
      userBookId,
    };
    setTimerState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  }, [timerState.elapsed, userBookId]);

  const handlePause = useCallback(() => {
    const newState: TimerState = { ...timerState, status: "paused", startedAt: null };
    setTimerState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  }, [timerState]);

  const handleStop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setShowStopModal(true);
  }, []);

  async function saveSession() {
    setSaving(true);
    const supabase = createClient();

    const sp = parseInt(startPage) || currentPage;
    const ep = parseInt(endPage) || currentPage;
    const pagesRead = Math.max(0, ep - sp);

    const now = new Date().toISOString();
    const startedAt = timerState.startedAt
      ? new Date(timerState.startedAt - timerState.elapsed * 1000).toISOString()
      : new Date(Date.now() - timerState.elapsed * 1000).toISOString();

    await supabase.from("reading_sessions").insert({
      user_id: USER_ID,
      user_book_id: userBookId,
      date: new Date().toISOString().split("T")[0],
      duration_seconds: timerState.elapsed,
      pages_read: pagesRead,
      start_page: sp,
      end_page: ep,
      started_at: startedAt,
      ended_at: now,
    });

    if (ep > currentPage) {
      await supabase
        .from("user_books")
        .update({ current_page: ep })
        .eq("id", userBookId);
    }

    const resetState: TimerState = { status: "idle", elapsed: 0, startedAt: null, userBookId };
    setTimerState(resetState);
    localStorage.removeItem(STORAGE_KEY);
    setShowStopModal(false);
    setSaving(false);
    onSessionSaved?.(pagesRead, ep);
  }

  function handleDiscardStop() {
    const resetState: TimerState = { status: "idle", elapsed: 0, startedAt: null, userBookId };
    setTimerState(resetState);
    localStorage.removeItem(STORAGE_KEY);
    setShowStopModal(false);
  }

  const { status, elapsed } = timerState;

  return (
    <>
      <div className="bg-white rounded-[20px] p-5 shadow-sm">
        <p className="text-xs text-[#6B6B6B] uppercase tracking-wide mb-3">Reading Timer</p>

        {/* Display */}
        <div className="text-center mb-4">
          <span
            className={`font-[family-name:var(--font-playfair)] text-4xl font-bold tabular-nums ${
              status === "running" ? "text-[#E8599A]" : "text-[#1A1A1A]"
            }`}
          >
            {formatDuration(elapsed)}
          </span>
          <p className="text-xs text-[#6B6B6B] mt-1">{bookTitle}</p>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-3">
          {status === "idle" && (
            <Button onClick={handleStart} size="lg">
              Start Reading
            </Button>
          )}
          {status === "running" && (
            <>
              <Button variant="secondary" onClick={handlePause}>
                Pause
              </Button>
              <Button variant="danger" size="sm" onClick={handleStop}>
                Stop
              </Button>
            </>
          )}
          {status === "paused" && (
            <>
              <Button onClick={handleStart}>
                Resume
              </Button>
              <Button variant="danger" size="sm" onClick={handleStop}>
                Stop
              </Button>
            </>
          )}
        </div>
      </div>

      <Modal open={showStopModal} onClose={handleDiscardStop} title="Save reading session">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[#6B6B6B]">
            You read for <strong>{formatDuration(elapsed)}</strong>. Enter your page progress:
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Started on page"
              type="number"
              value={startPage}
              onChange={(e) => setStartPage(e.target.value)}
              min={0}
              max={totalPages ?? undefined}
            />
            <Input
              label="Ended on page"
              type="number"
              value={endPage}
              onChange={(e) => setEndPage(e.target.value)}
              min={0}
              max={totalPages ?? undefined}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={saveSession} disabled={saving} className="flex-1">
              {saving ? "Saving..." : "Save session"}
            </Button>
            <Button variant="ghost" onClick={handleDiscardStop} className="text-[#6B6B6B]">
              Discard
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

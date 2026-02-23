"use client";

import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from "date-fns";

interface StreakCalendarProps {
  activeDates: string[]; // all-time YYYY-MM-DD strings
  month: Date;
  onMonthChange: (m: Date) => void;
  onDateClick?: (date: string) => void;
}

export function StreakCalendar({ activeDates, month, onMonthChange, onDateClick }: StreakCalendarProps) {
  const activeSet = new Set(activeDates);
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const days = eachDayOfInterval({ start, end });
  const startDow = getDay(start);
  const today = format(new Date(), "yyyy-MM-dd");
  const isCurrentOrFutureMonth =
    format(month, "yyyy-MM") >= format(new Date(), "yyyy-MM");

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => onMonthChange(subMonths(month, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-[#6B6B6B] transition-colors"
        >
          ←
        </button>
        <p className="text-sm font-medium text-[#1A1A1A]">
          {format(month, "MMMM yyyy")}
        </p>
        <button
          onClick={() => onMonthChange(addMonths(month, 1))}
          disabled={isCurrentOrFutureMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-[#6B6B6B] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          →
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="text-center text-[10px] text-[#6B6B6B] font-medium">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startDow }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {days.map((day) => {
          const iso = format(day, "yyyy-MM-dd");
          const isActive = activeSet.has(iso);
          const isToday = iso === today;
          const isFuture = iso > today;

          return (
            <button
              key={iso}
              onClick={() => !isFuture && onDateClick?.(iso)}
              disabled={isFuture}
              className={`aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-colors ${
                isActive
                  ? "bg-[#E8599A] text-white hover:bg-[#d44d8a]"
                  : isToday
                  ? "bg-[#FAE0EE] text-[#E8599A] ring-1 ring-[#E8599A] hover:bg-[#f0c8dd]"
                  : isFuture
                  ? "bg-gray-50 text-gray-300 cursor-default"
                  : "bg-gray-100 text-[#6B6B6B] hover:bg-[#FAE0EE] hover:text-[#E8599A] cursor-pointer"
              }`}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>

      {onDateClick && (
        <p className="text-[10px] text-[#6B6B6B] text-center mt-3">
          Tap any past date to log a reading session
        </p>
      )}
    </div>
  );
}

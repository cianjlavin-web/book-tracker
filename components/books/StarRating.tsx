"use client";

import { useState } from "react";
import { snapRating } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange: (rating: number) => void;
  readonly?: boolean;
}

export function StarRating({ value, onChange, readonly = false }: StarRatingProps) {
  const [hover, setHover] = useState<number | null>(null);

  const displayRating = hover ?? value;

  function handleStarClick(star: number, zone: number) {
    if (readonly) return;
    // zone: 1=quarter, 2=half, 3=three-quarters, 4=full
    const rating = snapRating(star - 1 + zone * 0.25);
    onChange(Math.max(0.25, rating));
  }

  function handleStarHover(star: number, zone: number) {
    if (readonly) return;
    setHover(snapRating(star - 1 + zone * 0.25));
  }

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.min(1, Math.max(0, displayRating - star + 1));
        return (
          <div key={star} className="relative w-7 h-7" style={{ cursor: readonly ? "default" : "pointer" }}>
            {/* Background star */}
            <svg width="28" height="28" viewBox="0 0 24 24" className="absolute inset-0">
              <polygon
                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                fill="#e5e7eb"
                stroke="#d1d5db"
                strokeWidth="1"
              />
            </svg>

            {/* Filled star (clipped) */}
            <svg width="28" height="28" viewBox="0 0 24 24" className="absolute inset-0" style={{ clipPath: `inset(0 ${(1 - fill) * 100}% 0 0)` }}>
              <polygon
                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                fill="#E8599A"
                stroke="#E8599A"
                strokeWidth="1"
              />
            </svg>

            {/* Click zones (4 per star) */}
            {!readonly && (
              <div className="absolute inset-0 flex">
                {[1, 2, 3, 4].map((zone) => (
                  <div
                    key={zone}
                    className="flex-1 h-full"
                    onClick={() => handleStarClick(star, zone)}
                    onMouseEnter={() => handleStarHover(star, zone)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      <span className="ml-2 text-sm font-medium text-[#1A1A1A] min-w-[2.5rem]">
        {displayRating > 0 ? displayRating.toFixed(2) : "—"}
      </span>
    </div>
  );
}

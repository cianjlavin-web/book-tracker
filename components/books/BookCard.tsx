import Image from "next/image";
import Link from "next/link";
import { progressPercent } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";

interface BookCardProps {
  id: string;
  title: string;
  author: string;
  coverUrl?: string | null;
  status: "reading" | "finished" | "want_to_read" | "dnf";
  currentPage?: number;
  totalPages?: number | null;
  rating?: number | null;
  communityRating?: number | null;
  onRemove?: () => void;
  variant?: "compact" | "full";
}

export function BookCard({
  id,
  title,
  author,
  coverUrl,
  status,
  currentPage = 0,
  totalPages,
  rating,
  communityRating,
  onRemove,
  variant = "full",
}: BookCardProps) {
  const progress = progressPercent(currentPage, totalPages ?? null);

  return (
    <Link href={`/books/${id}`} className="block">
      <div className="bg-[#F7F4F0] rounded-[20px] shadow-sm p-4 hover:shadow-md transition-shadow relative">
        {onRemove && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
            className="absolute top-3 right-3 w-6 h-6 rounded-full bg-gray-200 hover:bg-red-100 hover:text-red-500 text-gray-400 flex items-center justify-center transition-colors text-sm leading-none"
            title="Remove from library"
          >
            ×
          </button>
        )}
        <div className="flex gap-3">
          {/* Cover */}
          <div className="flex-shrink-0 w-[60px] h-[88px] rounded-xl overflow-hidden bg-gray-200">
            {coverUrl ? (
              <Image
                src={coverUrl}
                alt={title}
                width={60}
                height={88}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#F4A7CB] to-[#E8599A]">
                <span className="text-white text-xs font-bold text-center px-1 leading-tight">
                  {title.slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[#1A1A1A] text-sm leading-tight line-clamp-2 mb-0.5">
              {title}
            </p>
            <p className="text-xs text-[#6B6B6B] mb-1">{author}</p>

            {communityRating != null && (
              <p className="text-xs text-[#6B6B6B] mb-1.5">
                ★ {communityRating.toFixed(1)} community
              </p>
            )}

            {status === "reading" && totalPages && (
              <>
                <div className="progress-bar mb-1">
                  <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-[#6B6B6B]">
                  {currentPage} / {totalPages} pages · {progress}%
                </p>
              </>
            )}

            {status === "finished" && rating != null && (
              <div className="flex items-center gap-1">
                <StarDisplay rating={rating} />
                <span className="text-xs text-[#6B6B6B]">{rating.toFixed(2)}</span>
              </div>
            )}

            {status === "want_to_read" && (
              <Badge variant="gray">Want to read</Badge>
            )}

            {status === "dnf" && (
              <Badge variant="orange">DNF</Badge>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function BookCoverCompact({
  id,
  title,
  coverUrl,
  currentPage,
  totalPages,
}: {
  id: string;
  title: string;
  coverUrl?: string | null;
  currentPage?: number;
  totalPages?: number | null;
}) {
  const progress = progressPercent(currentPage ?? 0, totalPages ?? null);
  return (
    <Link href={`/books/${id}`} className="flex-shrink-0 w-[80px]">
      <div className="w-[80px] h-[116px] rounded-xl overflow-hidden bg-gray-200 mb-2 shadow-sm">
        {coverUrl ? (
          <Image src={coverUrl} alt={title} width={80} height={116} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#F4A7CB] to-[#E8599A]">
            <span className="text-white text-xs font-bold text-center px-1">
              {title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      {totalPages ? (
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
    </Link>
  );
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.min(1, Math.max(0, rating - star + 1));
        const gradId = `star-${star}-${rating}`;
        return (
          <svg key={star} width="12" height="12" viewBox="0 0 24 24">
            <defs>
              <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="0">
                <stop offset={`${fill * 100}%`} style={{ stopColor: "var(--color-pink)" }} />
                <stop offset={`${fill * 100}%`} style={{ stopColor: "#e5e7eb" }} />
              </linearGradient>
            </defs>
            <polygon
              points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
              fill={`url(#${gradId})`}
              style={{ stroke: "var(--color-pink)", strokeWidth: "1" }}
            />
          </svg>
        );
      })}
    </div>
  );
}

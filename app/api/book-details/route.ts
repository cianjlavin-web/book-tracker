import { fetchBookDetails } from "@/lib/googleBooks";
import { NextRequest, NextResponse } from "next/server";

// Strip series info like " (Series Name, #1)" to improve search accuracy
function cleanTitle(title: string): string {
  return title.replace(/\s*\([^)]*#\d+[^)]*\)\s*$/, "").trim();
}

async function fetchOpenLibraryRating(
  title: string,
  author: string
): Promise<{ averageRating: number; ratingsCount: number } | null> {
  try {
    const params = new URLSearchParams({
      title: cleanTitle(title),
      author,
      limit: "1",
      fields: "key,ratings_average,ratings_count",
    });
    const res = await fetch(`https://openlibrary.org/search.json?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const doc = data.docs?.[0];
    if (!doc?.ratings_average || doc.ratings_average === 0) return null;
    return {
      averageRating: Math.round(doc.ratings_average * 100) / 100,
      ratingsCount: doc.ratings_count ?? 0,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "";
  const author = searchParams.get("author") ?? "";

  if (!title) {
    return NextResponse.json(null);
  }

  // Fetch Google Books (description, cover, rating)
  const gb = await fetchBookDetails(title, author);

  // If Google Books has no rating, try Open Library as fallback
  let result = gb ? { ...gb } : null;
  if (!result?.averageRating) {
    const ol = await fetchOpenLibraryRating(title, author);
    if (ol) {
      if (result) {
        result.averageRating = ol.averageRating;
        result.ratingsCount = ol.ratingsCount;
      } else {
        // Google Books found nothing at all — return minimal data with OL rating
        result = {
          title,
          author,
          description: null,
          averageRating: ol.averageRating,
          ratingsCount: ol.ratingsCount,
          pageCount: null,
          publishedDate: null,
          categories: [],
          coverUrl: null,
          isbn: null,
        };
      }
    }
  }

  // Browser + CDN cache for 1 hour
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

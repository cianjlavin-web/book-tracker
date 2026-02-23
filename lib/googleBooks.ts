export interface GoogleBookInfo {
  title: string;
  author: string;
  description: string | null;
  averageRating: number | null;
  ratingsCount: number | null;
  pageCount: number | null;
  publishedDate: string | null;
  categories: string[];
  coverUrl: string | null;
  isbn: string | null;
}

interface GBVolume {
  volumeInfo: {
    title: string;
    authors?: string[];
    description?: string;
    averageRating?: number;
    ratingsCount?: number;
    pageCount?: number;
    publishedDate?: string;
    categories?: string[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    industryIdentifiers?: { type: string; identifier: string }[];
  };
}

function parseVolume(vol: GBVolume): GoogleBookInfo {
  const v = vol.volumeInfo;
  const isbn =
    v.industryIdentifiers?.find((i) => i.type === "ISBN_13")?.identifier ??
    v.industryIdentifiers?.find((i) => i.type === "ISBN_10")?.identifier ??
    null;

  const cover =
    v.imageLinks?.thumbnail?.replace("http://", "https://") ??
    v.imageLinks?.smallThumbnail?.replace("http://", "https://") ??
    null;

  return {
    title: v.title,
    author: v.authors?.[0] ?? "Unknown Author",
    description: v.description ?? null,
    averageRating: v.averageRating ?? null,
    ratingsCount: v.ratingsCount ?? null,
    pageCount: v.pageCount ?? null,
    publishedDate: v.publishedDate ?? null,
    categories: v.categories ?? [],
    coverUrl: cover,
    isbn,
  };
}

// Strip series info like " (The Name, #1)" or " (Series Name)" from end of titles
function cleanTitle(title: string): string {
  return title.replace(/\s*\([^)]*#\d+[^)]*\)\s*$/, "").replace(/\s*\([^)]{20,}\)\s*$/, "").trim();
}

async function gbFetch(q: string): Promise<GoogleBookInfo | null> {
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1`
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.items?.length) return null;
  return parseVolume(data.items[0]);
}

export async function fetchBookDetails(
  title: string,
  author: string
): Promise<GoogleBookInfo | null> {
  try {
    const clean = cleanTitle(title);
    // Try strict query first
    const strict = await gbFetch(`intitle:${clean} inauthor:${author}`);
    if (strict) return strict;
    // Fall back to a plain text search
    const loose = await gbFetch(`${clean} ${author}`);
    return loose;
  } catch {
    return null;
  }
}

export async function searchGoogleBooks(
  query: string,
  maxResults = 10
): Promise<GoogleBookInfo[]> {
  try {
    const q = encodeURIComponent(query);
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=${maxResults}&orderBy=relevance`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []).map(parseVolume);
  } catch {
    return [];
  }
}

export async function searchByGenre(
  genre: string,
  maxResults = 8
): Promise<GoogleBookInfo[]> {
  return searchGoogleBooks(`subject:${genre}`, maxResults);
}

export async function searchByAuthor(
  author: string,
  maxResults = 5
): Promise<GoogleBookInfo[]> {
  return searchGoogleBooks(`inauthor:${author}`, maxResults);
}

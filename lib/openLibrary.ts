export interface OLBook {
  key: string;
  title: string;
  author_name?: string[];
  cover_i?: number;
  number_of_pages_median?: number;
  first_publish_year?: number;
  isbn?: string[];
  subject?: string[];
}

export interface BookSearchResult {
  olId: string;
  title: string;
  author: string;
  coverUrl: string | null;
  totalPages: number | null;
  publishedYear: number | null;
  genres: string[];
  isbn: string | null;
}

export async function searchBooks(query: string, limit = 10): Promise<BookSearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    fields: "key,title,author_name,cover_i,number_of_pages_median,first_publish_year,isbn,subject",
  });
  const res = await fetch(`https://openlibrary.org/search.json?${params}`);
  if (!res.ok) return [];
  const data = await res.json();

  return (data.docs ?? []).map((doc: OLBook) => ({
    olId: doc.key.replace("/works/", ""),
    title: doc.title,
    author: doc.author_name?.[0] ?? "Unknown Author",
    coverUrl: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : null,
    totalPages: doc.number_of_pages_median ?? null,
    publishedYear: doc.first_publish_year ?? null,
    genres: doc.subject?.slice(0, 5) ?? [],
    isbn: doc.isbn?.[0] ?? null,
  }));
}

export function getCoverUrl(coverId: number, size: "S" | "M" | "L" = "M"): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

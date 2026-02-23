import Papa from "papaparse";
import { searchBooks } from "./openLibrary";

export interface GoodreadsRow {
  title: string;
  author: string;
  myRating: number;
  dateRead: string | null;
  shelves: string;
  numPages: number | null;
  goodreadsId: string;
}

export interface ImportBook {
  title: string;
  author: string;
  rating: number | null;
  dateRead: string | null;
  status: "reading" | "finished" | "want_to_read" | "dnf";
  numPages: number | null;
  goodreadsId: string;
  olId: string | null;
  coverUrl: string | null;
  genres: string[];
}

function mapStatus(shelves: string): ImportBook["status"] {
  if (shelves === "currently-reading") return "reading";
  if (shelves === "read") return "finished";
  if (shelves === "to-read") return "want_to_read";
  return "want_to_read";
}

export function parseGoodreadsCSV(csvText: string): GoodreadsRow[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  return result.data.map((row) => ({
    title: row["Title"] ?? row["title"] ?? "",
    author: row["Author"] ?? row["author"] ?? "",
    myRating: parseFloat(row["My Rating"] ?? row["my_rating"] ?? "0") || 0,
    dateRead: row["Date Read"] || row["date_read"] || null,
    shelves: row["Exclusive Shelf"] ?? row["Bookshelves"] ?? "",
    numPages: parseInt(row["Number of Pages"] ?? row["number_of_pages"] ?? "0") || null,
    goodreadsId: row["Book Id"] ?? row["book_id"] ?? "",
  }));
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function enrichWithOpenLibrary(
  rows: GoodreadsRow[],
  onProgress?: (current: number, total: number) => void
): Promise<ImportBook[]> {
  const results: ImportBook[] = [];
  const batchSize = 5;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const enriched = await Promise.all(
      batch.map(async (row): Promise<ImportBook> => {
        const base: ImportBook = {
          title: row.title,
          author: row.author,
          rating: row.myRating > 0 ? row.myRating : null,
          dateRead: row.dateRead,
          status: mapStatus(row.shelves),
          numPages: row.numPages,
          goodreadsId: row.goodreadsId,
          olId: null,
          coverUrl: null,
          genres: [],
        };

        try {
          const results = await searchBooks(`${row.title} ${row.author}`, 3);
          if (results.length > 0) {
            const match = results[0];
            base.olId = match.olId;
            base.coverUrl = match.coverUrl;
            base.genres = match.genres;
            if (!base.numPages && match.totalPages) base.numPages = match.totalPages;
          }
        } catch {
          // continue without OL data
        }
        return base;
      })
    );

    results.push(...enriched);
    onProgress?.(Math.min(i + batchSize, rows.length), rows.length);

    // Rate-limit: small pause between batches
    if (i + batchSize < rows.length) await sleep(500);
  }

  return results;
}

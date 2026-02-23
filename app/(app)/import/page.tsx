"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { USER_ID } from "@/lib/user";
import { parseGoodreadsCSV, enrichWithOpenLibrary, type ImportBook } from "@/lib/goodreadsImport";
import { Button } from "@/components/ui/Button";
import { Card, SectionLabel, SectionTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type ImportStep = "upload" | "preview" | "importing" | "done";

export default function ImportPage() {
  const [step, setStep] = useState<ImportStep>("upload");
  const [books, setBooks] = useState<ImportBook[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState("");
  const [importedCount, setImportedCount] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [enriching, setEnriching] = useState(false);

  async function processFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      setError("Please upload a CSV file");
      return;
    }
    const text = await file.text();
    const rows = parseGoodreadsCSV(text);
    if (rows.length === 0) {
      setError("No books found in CSV. Make sure it's a valid Goodreads export.");
      return;
    }
    setError("");
    setEnriching(true);
    setProgress({ current: 0, total: rows.length });

    const enriched = await enrichWithOpenLibrary(rows, (current, total) => {
      setProgress({ current, total });
    });
    setBooks(enriched);
    setEnriching(false);
    setStep("preview");
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  async function doImport() {
    setStep("importing");
    const supabase = createClient();

    let count = 0;
    const batchSize = 10;

    for (let i = 0; i < books.length; i += batchSize) {
      const batch = books.slice(i, i + batchSize);
      setProgress({ current: i, total: books.length });

      for (const book of batch) {
        // Upsert book
        const bookPayload = {
          title: book.title,
          author: book.author,
          cover_url: book.coverUrl,
          total_pages: book.numPages,
          genres: book.genres,
          ol_id: book.olId,
        };

        let bookId: string | null = null;

        if (book.olId) {
          const { data } = await supabase
            .from("books")
            .upsert(bookPayload, { onConflict: "ol_id" })
            .select("id")
            .single();
          bookId = data?.id ?? null;
        } else {
          // Try title+author match
          const { data: existing } = await supabase
            .from("books")
            .select("id")
            .eq("title", book.title)
            .eq("author", book.author)
            .single();
          if (existing) {
            bookId = existing.id;
          } else {
            const { data } = await supabase.from("books").insert(bookPayload).select("id").single();
            bookId = data?.id ?? null;
          }
        }

        if (!bookId) continue;

        // Upsert user_book
        await supabase.from("user_books").upsert(
          {
            user_id: USER_ID,
            book_id: bookId,
            status: book.status,
            rating: book.rating,
            finish_date: book.dateRead ? new Date(book.dateRead).toISOString().split("T")[0] : null,
            goodreads_id: book.goodreadsId || null,
          },
          { onConflict: "user_id,book_id" }
        );
        count++;
      }
    }

    setImportedCount(count);
    setStep("done");
  }

  return (
    <div className="p-4">
      <div className="pt-6 pb-4">
        <SectionLabel>Goodreads</SectionLabel>
        <SectionTitle>Import Books</SectionTitle>
      </div>

      {step === "upload" && (
        <Card>
          <p className="text-sm text-[#6B6B6B] mb-4">
            Export your Goodreads library as a CSV and upload it here. We&apos;ll enrich it with
            cover art and metadata from Open Library.
          </p>

          {/* Drag & drop zone */}
          <div
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer ${
              dragging ? "border-[#E8599A] bg-[#FAE0EE]" : "border-gray-300 hover:border-[#E8599A]"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("csv-input")?.click()}
          >
            <div className="text-4xl mb-3">📥</div>
            <p className="text-sm font-medium text-[#1A1A1A]">Drop your Goodreads CSV here</p>
            <p className="text-xs text-[#6B6B6B] mt-1">or click to browse</p>
            <input
              id="csv-input"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>

          {enriching && (
            <div className="mt-4 text-center">
              <p className="text-sm text-[#6B6B6B] mb-2">
                Looking up books... {progress.current} / {progress.total}
              </p>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
        </Card>
      )}

      {step === "preview" && (
        <div>
          <Card className="mb-4">
            <p className="text-sm font-medium text-[#1A1A1A]">
              Found <strong>{books.length}</strong> books
            </p>
            <p className="text-xs text-[#6B6B6B] mt-1">Review the list below and click Import when ready.</p>
          </Card>

          <div className="flex flex-col gap-2 mb-4 max-h-96 overflow-y-auto">
            {books.slice(0, 50).map((book, i) => (
              <div key={i} className="bg-[#F7F4F0] rounded-xl p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A1A1A] line-clamp-1">{book.title}</p>
                  <p className="text-xs text-[#6B6B6B]">{book.author}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={book.status === "finished" ? "green" : book.status === "reading" ? "pink" : "gray"}>
                    {book.status === "want_to_read" ? "TBR" : book.status}
                  </Badge>
                  {book.rating && (
                    <span className="text-xs text-[#6B6B6B]">★{book.rating.toFixed(1)}</span>
                  )}
                </div>
              </div>
            ))}
            {books.length > 50 && (
              <p className="text-center text-xs text-white/60 py-2">...and {books.length - 50} more</p>
            )}
          </div>

          <div className="flex gap-3">
            <Button onClick={doImport} className="flex-1">
              Import {books.length} books
            </Button>
            <Button variant="secondary" onClick={() => setStep("upload")}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {step === "importing" && (
        <Card className="text-center py-8">
          <div className="text-4xl mb-4">⏳</div>
          <p className="font-medium text-[#1A1A1A] mb-2">Importing your books...</p>
          <p className="text-sm text-[#6B6B6B] mb-4">
            {progress.current} / {books.length}
          </p>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${books.length > 0 ? (progress.current / books.length) * 100 : 0}%` }}
            />
          </div>
        </Card>
      )}

      {step === "done" && (
        <Card className="text-center py-8">
          <div className="text-4xl mb-4">✅</div>
          <p className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-[#1A1A1A] mb-2">
            Import complete!
          </p>
          <p className="text-sm text-[#6B6B6B] mb-6">
            Successfully imported {importedCount} books to your library.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => window.location.href = "/library"}>
              View Library
            </Button>
            <Button variant="secondary" onClick={() => { setStep("upload"); setBooks([]); }}>
              Import more
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

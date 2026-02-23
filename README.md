# Book Tracker

A personal book tracking web app with Fable-inspired design. Track reading progress, time sessions, stats/charts, and import your Goodreads history.

## Features

- **Currently Reading** — track page progress with progress bars and per-day stats
- **Reading Timer** — start/pause/stop timer that logs sessions to the database
- **Reading Stats** — genres, top authors, ratings, streaks, books per month (Monthly/Yearly/All-time)
- **Goodreads CSV Import** — import your reading history with cover art from Open Library
- **Ratings** — 0.25 increment star ratings + short reviews
- **Yearly Reading Goal** — set and track your annual target
- **Fable-inspired design** — cream cards, muted purple-gray background, hot pink accent

## Setup

### 1. Create a Supabase project at [supabase.com](https://supabase.com)

### 2. Run the schema

In the Supabase SQL editor, run `supabase/schema.sql`.

### 3. Configure env vars

```bash
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 4. Run locally

```bash
npm install
npm run dev
```

## Deploy to Vercel

Push to GitHub → import in Vercel → add the two Supabase env vars → deploy.

## Goodreads Import

Goodreads → My Books → Import/Export → Export Library → upload the CSV in the app's Import page.

## Stack

Next.js 16 · TypeScript · Tailwind CSS · Recharts · Supabase · Open Library API

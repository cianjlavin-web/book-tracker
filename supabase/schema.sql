-- Book Tracker Schema
-- Run this in the Supabase SQL editor

-- profiles (one per auth user)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username TEXT,
  avatar_url TEXT,
  yearly_goal INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- shared book catalog
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  cover_url TEXT,
  total_pages INTEGER,
  genres TEXT[],
  isbn TEXT,
  published_year INTEGER,
  ol_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- user's personal library entries
CREATE TABLE user_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles NOT NULL,
  book_id UUID REFERENCES books NOT NULL,
  status TEXT CHECK (status IN ('reading','finished','want_to_read','dnf')) DEFAULT 'want_to_read',
  current_page INTEGER DEFAULT 0,
  start_date DATE,
  finish_date DATE,
  rating DECIMAL(4,2),
  review TEXT,
  goodreads_id TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- individual reading sessions
CREATE TABLE reading_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles NOT NULL,
  user_book_id UUID REFERENCES user_books NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_seconds INTEGER DEFAULT 0,
  pages_read INTEGER DEFAULT 0,
  start_page INTEGER,
  end_page INTEGER,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_sessions ENABLE ROW LEVEL SECURITY;

-- profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- books policies (shared catalog — everyone can read, authenticated can insert)
CREATE POLICY "Anyone can read books" ON books FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert books" ON books FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated can update books" ON books FOR UPDATE USING (auth.role() = 'authenticated');

-- user_books policies
CREATE POLICY "Users can view own books" ON user_books FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own books" ON user_books FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own books" ON user_books FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own books" ON user_books FOR DELETE USING (auth.uid() = user_id);

-- reading_sessions policies
CREATE POLICY "Users can view own sessions" ON reading_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON reading_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON reading_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sessions" ON reading_sessions FOR DELETE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

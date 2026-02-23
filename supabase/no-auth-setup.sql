-- Run this in the Supabase SQL editor AFTER schema.sql
-- Sets up the app for single-user use without login

-- 1. Insert your profile row
INSERT INTO profiles (id, username, yearly_goal)
VALUES ('d535fa25-7a3c-4587-bc91-693c47db435f', 'me', 50)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow the anonymous (public) key to access all tables for this user
-- (Since there's no login, requests come in as the "anon" role)

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Anon can read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Anon can update profiles" ON profiles FOR UPDATE USING (true);
CREATE POLICY "Anon can insert profiles" ON profiles FOR INSERT WITH CHECK (true);

-- user_books
DROP POLICY IF EXISTS "Users can view own books" ON user_books;
DROP POLICY IF EXISTS "Users can insert own books" ON user_books;
DROP POLICY IF EXISTS "Users can update own books" ON user_books;
DROP POLICY IF EXISTS "Users can delete own books" ON user_books;
CREATE POLICY "Anon full access user_books" ON user_books FOR ALL USING (true) WITH CHECK (true);

-- reading_sessions
DROP POLICY IF EXISTS "Users can view own sessions" ON reading_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON reading_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON reading_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON reading_sessions;
CREATE POLICY "Anon full access reading_sessions" ON reading_sessions FOR ALL USING (true) WITH CHECK (true);

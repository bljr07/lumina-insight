-- ============================================
-- Lumina Insight — Supabase Database Schema v2
-- With Supabase Auth integration
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================

-- First, drop old tables if they exist (from v1)
DROP TABLE IF EXISTS daily_activity CASCADE;
DROP TABLE IF EXISTS milestones CASCADE;
DROP TABLE IF EXISTS focus_sessions CASCADE;
DROP TABLE IF EXISTS break_logs CASCADE;
DROP TABLE IF EXISTS quiz_results CASCADE;
DROP TABLE IF EXISTS topic_mastery CASCADE;
DROP TABLE IF EXISTS study_sessions CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 1. User profiles (linked to auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  education TEXT DEFAULT 'Undergraduate',
  year INT DEFAULT 2,
  course TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Study sessions
CREATE TABLE study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_minutes INT,
  topics TEXT[] DEFAULT '{}',
  intensity INT DEFAULT 0 CHECK (intensity BETWEEN 0 AND 4),
  focus_score FLOAT DEFAULT 0,
  distractions INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Topic mastery
CREATE TABLE topic_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  topic TEXT NOT NULL,
  mastery FLOAT DEFAULT 0 CHECK (mastery BETWEEN 0 AND 1),
  time_spent_hours FLOAT DEFAULT 0,
  last_studied_at TIMESTAMPTZ DEFAULT now(),
  subtopics TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, topic)
);

-- 4. Quiz / bridging exercise results
CREATE TABLE quiz_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  total_cards INT NOT NULL,
  correct INT NOT NULL,
  score FLOAT GENERATED ALWAYS AS (correct::FLOAT / NULLIF(total_cards, 0)) STORED,
  card_details JSONB DEFAULT '[]',
  completed_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Break / rest logs
CREATE TABLE break_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  duration_minutes INT NOT NULL,
  ringtone TEXT DEFAULT 'gentle',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed BOOLEAN DEFAULT false
);

-- 6. Focus mode sessions
CREATE TABLE focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  duration_seconds INT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Growth milestones
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month TEXT NOT NULL,
  mastery_score FLOAT DEFAULT 0,
  label TEXT DEFAULT '',
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Daily activity summary
CREATE TABLE daily_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  total_minutes INT DEFAULT 0,
  intensity INT DEFAULT 0 CHECK (intensity BETWEEN 0 AND 4),
  topics TEXT[] DEFAULT '{}',
  session_count INT DEFAULT 0,
  UNIQUE(user_id, date)
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX idx_profiles_user ON profiles(user_id);
CREATE INDEX idx_sessions_user ON study_sessions(user_id);
CREATE INDEX idx_sessions_started ON study_sessions(started_at);
CREATE INDEX idx_mastery_user ON topic_mastery(user_id);
CREATE INDEX idx_daily_user_date ON daily_activity(user_id, date);
CREATE INDEX idx_quiz_user ON quiz_results(user_id);
CREATE INDEX idx_milestones_user ON milestones(user_id);

-- ============================================
-- Row Level Security — users can only access their own data
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE break_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own rows
CREATE POLICY "Users own data" ON profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users own data" ON study_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users own data" ON topic_mastery FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users own data" ON quiz_results FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users own data" ON break_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users own data" ON focus_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users own data" ON milestones FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users own data" ON daily_activity FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

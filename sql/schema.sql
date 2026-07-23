-- ==============================================================================
-- SupaPulse Database Schema & RLS Policies
-- Execute this script in your Supabase SQL Editor: https://supabase.com/dashboard
-- ==============================================================================

-- 1. Create table for storing keep-alive heartbeat logs
CREATE TABLE IF NOT EXISTS public.keep_alive_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    note TEXT
);

-- 2. Create index on created_at for fast cleanup queries
CREATE INDEX IF NOT EXISTS idx_keep_alive_logs_created_at 
ON public.keep_alive_logs (created_at);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.keep_alive_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies: Allow anon & authenticated roles to perform heartbeat operations
CREATE POLICY "Allow anon read keep_alive_logs"
ON public.keep_alive_logs
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow anon insert keep_alive_logs"
ON public.keep_alive_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow anon delete keep_alive_logs"
ON public.keep_alive_logs
FOR DELETE
TO anon, authenticated
USING (true);

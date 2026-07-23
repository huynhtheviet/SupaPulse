-- Create table for storing keep-alive ping logs
CREATE TABLE IF NOT EXISTS public.keep_alive_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    note TEXT
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.keep_alive_logs ENABLE ROW LEVEL SECURITY;

-- Allow anon key to SELECT logs
CREATE POLICY "Allow anon read keep_alive_logs"
ON public.keep_alive_logs
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow anon key to INSERT logs
CREATE POLICY "Allow anon insert keep_alive_logs"
ON public.keep_alive_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow anon key to DELETE old logs (for auto cleanup)
CREATE POLICY "Allow anon delete keep_alive_logs"
ON public.keep_alive_logs
FOR DELETE
TO anon, authenticated
USING (true);

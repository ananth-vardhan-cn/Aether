-- =============================================
-- GENERATION SESSIONS TABLE (For Real-time Progress)
-- Run this in Supabase SQL Editor
-- =============================================

-- Table to track generation progress in real-time
CREATE TABLE IF NOT EXISTS public.generation_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, generating, completed, error
    steps JSONB DEFAULT '[]'::jsonb,        -- Array of {id, label, status, fileType, lineCount}
    build_plan TEXT,                         -- Build plan streamed in real-time
    error_message TEXT,                      -- Error message if status is 'error'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_generation_sessions_user_id ON public.generation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_sessions_created_at ON public.generation_sessions(created_at DESC);

-- Enable RLS
ALTER TABLE public.generation_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own sessions" ON public.generation_sessions 
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON public.generation_sessions 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON public.generation_sessions 
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON public.generation_sessions 
    FOR DELETE USING (auth.uid() = user_id);

-- Auto-update timestamp
CREATE TRIGGER update_generation_sessions_updated_at 
    BEFORE UPDATE ON public.generation_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Realtime (IMPORTANT!)
ALTER PUBLICATION supabase_realtime ADD TABLE generation_sessions;

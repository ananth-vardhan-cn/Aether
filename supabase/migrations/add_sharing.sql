-- =============================================
-- MIGRATION: Add sharing support
-- Run this on existing databases
-- =============================================

-- Add sharing columns
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS share_id TEXT UNIQUE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Add index for fast share_id lookups
CREATE INDEX IF NOT EXISTS idx_projects_share_id ON public.projects(share_id) WHERE share_id IS NOT NULL;

-- Add policy for public access (drop first if exists to avoid conflicts)
DROP POLICY IF EXISTS "Anyone can view public projects" ON public.projects;
CREATE POLICY "Anyone can view public projects" ON public.projects FOR SELECT USING (is_public = true);

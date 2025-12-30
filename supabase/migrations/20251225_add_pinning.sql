-- Migration: Add pinning support to projects
-- Run with: npx supabase db push

-- Add is_pinned column with default false
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

-- Add pinned_at timestamp to track when project was pinned (for sorting)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

-- Create index for efficient sorting of pinned projects
CREATE INDEX IF NOT EXISTS idx_projects_is_pinned ON public.projects(is_pinned, pinned_at DESC);

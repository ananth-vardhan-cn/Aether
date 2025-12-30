-- =============================================
-- MIGRATION: Add GitHub integration support
-- Run this in Supabase SQL Editor
-- =============================================

-- Add GitHub access token to profiles (for OAuth)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS github_access_token TEXT;

-- Add GitHub repo info to projects
-- Structure: { "owner": "username", "name": "repo-name", "branch": "main", "lastCommitSha": "abc123" }
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS github_repo JSONB;

-- Create index for projects with GitHub repos
CREATE INDEX IF NOT EXISTS idx_projects_github_repo ON public.projects(github_repo) WHERE github_repo IS NOT NULL;

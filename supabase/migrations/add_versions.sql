-- =============================================
-- MIGRATION: Add version history support
-- Run this in Supabase SQL Editor
-- =============================================

-- Create project_versions table
CREATE TABLE IF NOT EXISTS public.project_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  files JSONB NOT NULL,
  preview_code TEXT,
  prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, version_number)
);

-- Index for fast version lookups
CREATE INDEX IF NOT EXISTS idx_versions_project ON project_versions(project_id, version_number DESC);

-- Enable RLS
ALTER TABLE project_versions ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "Users can view their project versions" ON project_versions;
CREATE POLICY "Users can view their project versions" ON project_versions 
  FOR SELECT USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their project versions" ON project_versions;
CREATE POLICY "Users can insert their project versions" ON project_versions 
  FOR INSERT WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete their project versions" ON project_versions;
CREATE POLICY "Users can delete their project versions" ON project_versions 
  FOR DELETE USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

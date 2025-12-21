import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { File } from '../types';

export interface ProjectVersion {
    id: string;
    projectId: string;
    versionNumber: number;
    files: File[];
    previewCode: string;
    prompt: string;
    createdAt: Date;
}

interface VersionRow {
    id: string;
    project_id: string;
    version_number: number;
    files: File[];
    preview_code: string;
    prompt: string;
    created_at: string;
}

const MAX_VERSIONS = 5;

const rowToVersion = (row: VersionRow): ProjectVersion => ({
    id: row.id,
    projectId: row.project_id,
    versionNumber: row.version_number,
    files: row.files,
    previewCode: row.preview_code || '',
    prompt: row.prompt || '',
    createdAt: new Date(row.created_at),
});

export function useProjectVersions() {
    const [versions, setVersions] = useState<ProjectVersion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch all versions for a project
    const fetchVersions = useCallback(async (projectId: string) => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('project_versions')
                .select('*')
                .eq('project_id', projectId)
                .order('version_number', { ascending: false });

            if (fetchError) throw fetchError;
            setVersions((data || []).map(rowToVersion));
        } catch (err: any) {
            setError(err.message);
            setVersions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Save a new version (auto-manages max 5)
    const saveVersion = useCallback(async (
        projectId: string,
        files: File[],
        previewCode: string,
        prompt: string
    ): Promise<ProjectVersion | null> => {
        try {
            // Get current max version number
            const { data: existing } = await supabase
                .from('project_versions')
                .select('version_number')
                .eq('project_id', projectId)
                .order('version_number', { ascending: false })
                .limit(1);

            const nextVersion = (existing?.[0]?.version_number || 0) + 1;

            // Insert new version
            const { data, error: insertError } = await supabase
                .from('project_versions')
                .insert({
                    project_id: projectId,
                    version_number: nextVersion,
                    files,
                    preview_code: previewCode,
                    prompt,
                })
                .select()
                .single();

            if (insertError) throw insertError;

            // Delete old versions if exceeding max
            const { data: allVersions } = await supabase
                .from('project_versions')
                .select('id, version_number')
                .eq('project_id', projectId)
                .order('version_number', { ascending: false });

            if (allVersions && allVersions.length > MAX_VERSIONS) {
                const toDelete = allVersions.slice(MAX_VERSIONS).map(v => v.id);
                await supabase
                    .from('project_versions')
                    .delete()
                    .in('id', toDelete);
            }

            return rowToVersion(data);
        } catch (err: any) {
            setError(err.message);
            return null;
        }
    }, []);

    // Get a specific version
    const getVersion = useCallback(async (versionId: string): Promise<ProjectVersion | null> => {
        try {
            const { data, error: fetchError } = await supabase
                .from('project_versions')
                .select('*')
                .eq('id', versionId)
                .single();

            if (fetchError) throw fetchError;
            return rowToVersion(data);
        } catch (err: any) {
            setError(err.message);
            return null;
        }
    }, []);

    return {
        versions,
        loading,
        error,
        fetchVersions,
        saveVersion,
        getVersion,
    };
}

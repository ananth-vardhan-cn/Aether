import { useState, useEffect, useCallback } from 'react';
import { supabase, ProjectRow } from '../lib/supabase';
import { Project, File, Message } from '../types';

interface UseProjectsReturn {
    projects: Project[];
    loading: boolean;
    error: string | null;
    createProject: (project: Partial<Project>) => Promise<Project>;
    updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
    refreshProjects: () => Promise<void>;
    shareProject: (id: string) => Promise<string>;
    unshareProject: (id: string) => Promise<void>;
    pinProject: (id: string) => Promise<void>;
    unpinProject: (id: string) => Promise<void>;
}

// Convert database row to app Project type
const rowToProject = (row: ProjectRow): Project => ({
    id: row.id,
    name: row.name,
    lastModified: new Date(row.updated_at).getTime(),
    files: row.files as File[],
    previewCode: row.preview_code,
    messages: row.messages as Message[],
    shareId: row.share_id,
    isPublic: row.is_public,
    isPinned: row.is_pinned,
    pinnedAt: row.pinned_at ? new Date(row.pinned_at).getTime() : undefined,
});

// Convert app Project to database row format
const projectToRow = (project: Partial<Project>, userId: string) => ({
    user_id: userId,
    name: project.name || 'Untitled Project',
    files: project.files || [],
    preview_code: project.previewCode || '',
    messages: project.messages || [],
});

export function useProjects(userId: string | undefined): UseProjectsReturn {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch all projects for the user
    const refreshProjects = useCallback(async () => {
        if (!userId) {
            setProjects([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from('projects')
                .select('*')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false });

            if (fetchError) throw fetchError;

            setProjects((data || []).map(rowToProject));
        } catch (err: any) {
            console.error('Error fetching projects:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    // Initial load
    useEffect(() => {
        refreshProjects();
    }, [refreshProjects]);

    // Create a new project
    const createProject = useCallback(async (project: Partial<Project>): Promise<Project> => {
        if (!userId) throw new Error('Must be logged in to create projects');

        const { data, error: insertError } = await supabase
            .from('projects')
            .insert(projectToRow(project, userId))
            .select()
            .single();

        if (insertError) throw insertError;

        const newProject = rowToProject(data);
        setProjects(prev => [newProject, ...prev]);
        return newProject;
    }, [userId]);

    // Update an existing project
    const updateProject = useCallback(async (id: string, updates: Partial<Project>) => {
        if (!userId) throw new Error('Must be logged in to update projects');

        const updateData: Record<string, unknown> = {};
        if (updates.name !== undefined) updateData.name = updates.name;
        if (updates.files !== undefined) updateData.files = updates.files;
        if (updates.previewCode !== undefined) updateData.preview_code = updates.previewCode;
        if (updates.messages !== undefined) updateData.messages = updates.messages;

        const { error: updateError } = await supabase
            .from('projects')
            .update(updateData)
            .eq('id', id)
            .eq('user_id', userId);

        if (updateError) throw updateError;

        setProjects(prev =>
            prev.map(p =>
                p.id === id
                    ? { ...p, ...updates, lastModified: Date.now() }
                    : p
            )
        );
    }, [userId]);

    // Delete a project
    const deleteProject = useCallback(async (id: string) => {
        if (!userId) throw new Error('Must be logged in to delete projects');

        const { error: deleteError } = await supabase
            .from('projects')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (deleteError) throw deleteError;

        setProjects(prev => prev.filter(p => p.id !== id));
    }, [userId]);

    // Share a project (generate share_id and set is_public = true)
    const shareProject = useCallback(async (id: string): Promise<string> => {
        if (!userId) throw new Error('Must be logged in to share projects');

        // Generate a short unique share ID
        const shareId = crypto.randomUUID().split('-')[0];

        const { error: updateError } = await supabase
            .from('projects')
            .update({ share_id: shareId, is_public: true })
            .eq('id', id)
            .eq('user_id', userId);

        if (updateError) throw updateError;

        setProjects(prev =>
            prev.map(p =>
                p.id === id
                    ? { ...p, shareId, isPublic: true }
                    : p
            )
        );

        return shareId;
    }, [userId]);

    // Unshare a project (set is_public = false)
    const unshareProject = useCallback(async (id: string): Promise<void> => {
        if (!userId) throw new Error('Must be logged in to unshare projects');

        const { error: updateError } = await supabase
            .from('projects')
            .update({ is_public: false })
            .eq('id', id)
            .eq('user_id', userId);

        if (updateError) throw updateError;

        setProjects(prev =>
            prev.map(p =>
                p.id === id
                    ? { ...p, isPublic: false }
                    : p
            )
        );
    }, [userId]);

    // Pin a project (set is_pinned = true, pinned_at = now)
    const pinProject = useCallback(async (id: string): Promise<void> => {
        if (!userId) throw new Error('Must be logged in to pin projects');

        const now = new Date().toISOString();

        const { error: updateError } = await supabase
            .from('projects')
            .update({ is_pinned: true, pinned_at: now })
            .eq('id', id)
            .eq('user_id', userId);

        if (updateError) throw updateError;

        setProjects(prev =>
            prev.map(p =>
                p.id === id
                    ? { ...p, isPinned: true, pinnedAt: new Date(now).getTime() }
                    : p
            )
        );
    }, [userId]);

    // Unpin a project (set is_pinned = false, pinned_at = null)
    const unpinProject = useCallback(async (id: string): Promise<void> => {
        if (!userId) throw new Error('Must be logged in to unpin projects');

        const { error: updateError } = await supabase
            .from('projects')
            .update({ is_pinned: false, pinned_at: null })
            .eq('id', id)
            .eq('user_id', userId);

        if (updateError) throw updateError;

        setProjects(prev =>
            prev.map(p =>
                p.id === id
                    ? { ...p, isPinned: false, pinnedAt: undefined }
                    : p
            )
        );
    }, [userId]);

    return {
        projects,
        loading,
        error,
        createProject,
        updateProject,
        deleteProject,
        refreshProjects,
        shareProject,
        unshareProject,
        pinProject,
        unpinProject,
    };
}

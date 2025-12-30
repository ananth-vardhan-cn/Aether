import { useState, useCallback, useEffect } from 'react';
import { supabase, GitHubRepoInfo } from '../lib/supabase';
import { File } from '../types';

// GitHub OAuth configuration - using Supabase project URL for redirect
const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID as string;
const GITHUB_REDIRECT_URI = `${window.location.origin}/github-callback`;

export interface GitHubStatus {
    isConnected: boolean;
    hasRepo: boolean;
    repoInfo: {
        owner: string;
        name: string;
        branch: string;
        url: string;
    } | null;
    githubUsername: string | null;
}

export interface ChangedFile {
    name: string;
    status: 'modified' | 'added' | 'deleted';
}

export function useGitHub(projectId: string | null, files: File[]) {
    const [status, setStatus] = useState<GitHubStatus>({
        isConnected: false,
        hasRepo: false,
        repoInfo: null,
        githubUsername: null,
    });
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [changedFiles, setChangedFiles] = useState<ChangedFile[]>([]);
    const [lastCommittedFiles, setLastCommittedFiles] = useState<File[]>([]);

    // Fetch GitHub status when projectId changes
    const fetchStatus = useCallback(async () => {
        if (!projectId) return;

        try {
            const { data, error: funcError } = await supabase.functions.invoke('github-get-status', {
                body: { projectId },
            });

            if (funcError) throw funcError;

            setStatus({
                isConnected: data.isConnected,
                hasRepo: data.hasRepo,
                repoInfo: data.repoInfo,
                githubUsername: data.githubUsername,
            });

            // If we have a repo, fetch the last committed files from project
            if (data.hasRepo) {
                const { data: project } = await supabase
                    .from('projects')
                    .select('files')
                    .eq('id', projectId)
                    .single();

                // Store current files as "last committed" for comparison
                // In a real impl, we'd fetch from GitHub; this is simplified
                if (project) {
                    setLastCommittedFiles(project.files as File[]);
                }
            }
        } catch (err: unknown) {
            console.error('Error fetching GitHub status:', err);
        }
    }, [projectId]);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    // Calculate changed files when files change
    useEffect(() => {
        if (!status.hasRepo || files.length === 0) {
            setChangedFiles([]);
            return;
        }

        const changes: ChangedFile[] = [];
        const lastFilesMap = new Map(lastCommittedFiles.map(f => [f.name, f.content]));
        const currentFilesMap = new Map(files.map(f => [f.name, f.content]));

        // Check for modified and added files
        for (const file of files) {
            const lastContent = lastFilesMap.get(file.name);
            if (lastContent === undefined) {
                changes.push({ name: file.name, status: 'added' });
            } else if (lastContent !== file.content) {
                changes.push({ name: file.name, status: 'modified' });
            }
        }

        // Check for deleted files
        for (const lastFile of lastCommittedFiles) {
            if (!currentFilesMap.has(lastFile.name)) {
                changes.push({ name: lastFile.name, status: 'deleted' });
            }
        }

        setChangedFiles(changes);
    }, [files, lastCommittedFiles, status.hasRepo]);

    // Start GitHub OAuth flow
    const connectGitHub = useCallback(() => {
        if (!GITHUB_CLIENT_ID) {
            setError('GitHub OAuth not configured');
            return;
        }

        const scope = 'repo';
        const state = crypto.randomUUID(); // Could store this for verification
        const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(GITHUB_REDIRECT_URI)}&scope=${scope}&state=${state}`;

        // Open OAuth in popup
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
            authUrl,
            'github-oauth',
            `width=${width},height=${height},left=${left},top=${top}`
        );

        // Listen for OAuth callback
        const handleMessage = async (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (event.data?.type !== 'github-oauth-callback') return;

            window.removeEventListener('message', handleMessage);
            popup?.close();

            const { code } = event.data;
            if (!code) {
                setError('No authorization code received');
                return;
            }

            setLoading(true);
            try {
                const { data, error: oauthError } = await supabase.functions.invoke('github-oauth', {
                    body: { code },
                });

                if (oauthError) throw oauthError;
                if (data.error) throw new Error(data.error);

                await fetchStatus();
                setError(null);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Failed to connect GitHub');
            } finally {
                setLoading(false);
            }
        };

        window.addEventListener('message', handleMessage);
    }, [fetchStatus]);

    // Create a new GitHub repository
    const createRepo = useCallback(async (repoName: string, description: string, isPrivate: boolean) => {
        if (!projectId) {
            setError('No project selected');
            return false;
        }

        setSyncing(true);
        setError(null);

        try {
            const { data, error: createError } = await supabase.functions.invoke('github-create-repo', {
                body: {
                    projectId,
                    repoName,
                    description,
                    isPrivate,
                    files: files.map(f => ({ name: f.name, content: f.content })),
                },
            });

            if (createError) throw createError;
            if (data.error) throw new Error(data.error);

            // Update status and mark all files as committed
            await fetchStatus();
            setLastCommittedFiles([...files]);
            setChangedFiles([]);

            return true;
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to create repository');
            return false;
        } finally {
            setSyncing(false);
        }
    }, [projectId, files, fetchStatus]);

    // Commit changes to GitHub
    const commit = useCallback(async (message: string) => {
        if (!projectId || changedFiles.length === 0) {
            return false;
        }

        setSyncing(true);
        setError(null);

        try {
            const { data, error: commitError } = await supabase.functions.invoke('github-commit', {
                body: {
                    projectId,
                    message,
                    files: files.map(f => ({ name: f.name, content: f.content })),
                },
            });

            if (commitError) throw commitError;
            if (data.error) throw new Error(data.error);

            // Mark all files as committed
            setLastCommittedFiles([...files]);
            setChangedFiles([]);

            return true;
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to commit changes');
            return false;
        } finally {
            setSyncing(false);
        }
    }, [projectId, files, changedFiles.length]);

    return {
        status,
        loading,
        syncing,
        error,
        changedFiles,
        hasChanges: changedFiles.length > 0,
        connectGitHub,
        createRepo,
        commit,
        refreshStatus: fetchStatus,
    };
}

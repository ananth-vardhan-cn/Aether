import React, { useState, useEffect } from 'react';
import { Icons } from './ui/Icons';
import { useGitHub, ChangedFile } from '../hooks/useGitHub';
import { File } from '../types';

interface GitHubModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string | null;
    projectName: string;
    files: File[];
}

// File type icon based on extension
const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.tsx') || fileName.endsWith('.ts')) {
        return <span className="text-blue-400 font-mono text-xs">{'{}'}</span>;
    }
    if (fileName.endsWith('.css')) {
        return <span className="text-pink-400 font-mono text-xs">✎</span>;
    }
    if (fileName.endsWith('.json')) {
        return <span className="text-yellow-400 font-mono text-xs">{'{}'}</span>;
    }
    if (fileName.endsWith('.html')) {
        return <span className="text-orange-400 font-mono text-xs">≡</span>;
    }
    return <span className="text-zinc-400 font-mono text-xs">≡</span>;
};

export const GitHubModal: React.FC<GitHubModalProps> = ({
    isOpen,
    onClose,
    projectId,
    projectName,
    files,
}) => {
    const {
        status,
        loading,
        syncing,
        error,
        changedFiles,
        hasChanges,
        connectGitHub,
        createRepo,
        commit,
    } = useGitHub(projectId, files);

    const [repoName, setRepoName] = useState('');
    const [repoDescription, setRepoDescription] = useState('');
    const [isPrivate, setIsPrivate] = useState(true);
    const [commitMessage, setCommitMessage] = useState('');

    // Auto-generate repo name from project name
    useEffect(() => {
        if (projectName && !repoName) {
            const sanitized = projectName
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
            setRepoName(sanitized || 'my-aether-app');
        }
    }, [projectName, repoName]);

    if (!isOpen) return null;

    const handleCreateRepo = async () => {
        if (!repoName) return;
        const success = await createRepo(repoName, repoDescription, isPrivate);
        if (success) {
            // Reset form
            setRepoDescription('');
        }
    };

    const handleCommit = async () => {
        if (!commitMessage) return;
        const success = await commit(commitMessage);
        if (success) {
            setCommitMessage('');
        }
    };

    // Syncing overlay
    if (syncing) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center">
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                <div className="relative z-10 w-full max-w-md mx-4 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                        <div className="flex items-center gap-2">
                            <Icons.Github size={20} className="text-white" />
                            <span className="font-semibold text-white">GitHub</span>
                        </div>
                        {status.repoInfo && (
                            <span className="text-sm text-zinc-400">
                                {status.repoInfo.owner}/{status.repoInfo.name} on {status.repoInfo.branch}
                            </span>
                        )}
                    </div>

                    {/* Syncing Content */}
                    <div className="flex flex-col items-center justify-center py-16 px-6">
                        <div className="relative mb-6">
                            <Icons.Github size={64} className="text-white" />
                            <div className="absolute inset-0 animate-ping">
                                <Icons.Github size={64} className="text-white opacity-20" />
                            </div>
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Syncing your changes</h3>
                        <p className="text-zinc-400 text-sm">We're uploading your changes to GitHub</p>
                        <div className="mt-6 flex gap-1">
                            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative z-10 w-full max-w-md mx-4 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                        <Icons.Github size={20} className="text-white" />
                        <span className="font-semibold text-white">GitHub</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {status.repoInfo && (
                            <span className="text-sm text-zinc-400">
                                {status.repoInfo.owner}/{status.repoInfo.name} on {status.repoInfo.branch}
                            </span>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                        >
                            <Icons.X size={18} />
                        </button>
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* Content based on state */}
                <div className="p-4">
                    {/* State 1: Not connected to GitHub */}
                    {!status.isConnected && (
                        <div className="flex flex-col items-center py-8">
                            <Icons.Github size={48} className="text-white mb-4" />
                            <h3 className="text-lg font-semibold text-white mb-2">Connect to GitHub</h3>
                            <p className="text-zinc-400 text-sm text-center mb-6">
                                Connect your GitHub account to sync your project and track changes
                            </p>
                            <button
                                onClick={connectGitHub}
                                disabled={loading}
                                className="px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Connecting...' : 'Connect GitHub'}
                            </button>
                        </div>
                    )}

                    {/* State 2: Connected but no repo - Create Repo Form */}
                    {status.isConnected && !status.hasRepo && (
                        <div className="space-y-4">
                            <p className="text-zinc-400 text-sm">
                                Fill out the information below to create your repo and make your first commit
                            </p>

                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">
                                    Repository name
                                </label>
                                <input
                                    type="text"
                                    value={repoName}
                                    onChange={(e) => setRepoName(e.target.value)}
                                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
                                    placeholder="my-awesome-app"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-2">
                                    Repository description
                                </label>
                                <input
                                    type="text"
                                    value={repoDescription}
                                    onChange={(e) => setRepoDescription(e.target.value)}
                                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
                                    placeholder="Created with Aether AI"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-3">
                                    Visibility
                                </label>
                                <div className="space-y-2">
                                    <label className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-xl cursor-pointer hover:bg-zinc-900">
                                        <input
                                            type="radio"
                                            checked={isPrivate}
                                            onChange={() => setIsPrivate(true)}
                                            className="mt-1"
                                        />
                                        <div>
                                            <div className="font-medium text-white">Private</div>
                                            <div className="text-sm text-zinc-500">
                                                Only you can access this repo on GitHub.com
                                            </div>
                                        </div>
                                    </label>
                                    <label className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-xl cursor-pointer hover:bg-zinc-900">
                                        <input
                                            type="radio"
                                            checked={!isPrivate}
                                            onChange={() => setIsPrivate(false)}
                                            className="mt-1"
                                        />
                                        <div>
                                            <div className="font-medium text-white">Public</div>
                                            <div className="text-sm text-zinc-500">
                                                This means your GitHub repo will be discoverable by everyone on GitHub.com
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    onClick={handleCreateRepo}
                                    disabled={!repoName || loading}
                                    className="w-full px-4 py-3 bg-zinc-800 text-white font-medium rounded-xl hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Create Git repo
                                </button>
                            </div>
                        </div>
                    )}

                    {/* State 3: Connected with repo, no changes */}
                    {status.isConnected && status.hasRepo && !hasChanges && (
                        <div className="flex flex-col items-center py-12">
                            <Icons.Github size={48} className="text-white mb-4" />
                            <p className="text-zinc-400">No changes to commit</p>
                        </div>
                    )}

                    {/* State 4: Connected with repo, has changes */}
                    {status.isConnected && status.hasRepo && hasChanges && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-zinc-400 mb-2">
                                    What changes did you make?
                                </label>
                                <textarea
                                    value={commitMessage}
                                    onChange={(e) => setCommitMessage(e.target.value)}
                                    rows={2}
                                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent resize-none"
                                    placeholder="feat: Add new feature..."
                                />
                            </div>

                            <div className="border-t border-zinc-800 pt-4">
                                <p className="text-sm text-zinc-400 mb-3">
                                    {changedFiles.length} changed file{changedFiles.length !== 1 ? 's' : ''}
                                </p>
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {changedFiles.map((file: ChangedFile) => (
                                        <div
                                            key={file.name}
                                            className="flex items-center justify-between py-2 px-3 bg-zinc-900/50 rounded-lg"
                                        >
                                            <div className="flex items-center gap-2">
                                                {getFileIcon(file.name)}
                                                <span className="text-sm text-zinc-300">{file.name}</span>
                                            </div>
                                            <span className="text-xs text-zinc-500 capitalize">
                                                {file.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    onClick={handleCommit}
                                    disabled={!commitMessage || loading}
                                    className="w-full px-4 py-3 bg-zinc-800 text-white font-medium rounded-xl hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Stage and commit all changes
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

import React, { useState } from 'react';
import { Icons } from './ui/Icons';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectName: string;
    shareId: string | null | undefined;
    isPublic: boolean;
    onShare: () => Promise<string>;
    onUnshare: () => Promise<void>;
}

export const ShareModal: React.FC<ShareModalProps> = ({
    isOpen,
    onClose,
    projectName,
    shareId,
    isPublic,
    onShare,
    onUnshare,
}) => {
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const shareUrl = shareId ? `${window.location.origin}?share=${shareId}` : '';

    const handleToggleShare = async () => {
        setError(null);
        setLoading(true);
        try {
            if (isPublic) {
                await onUnshare();
            } else {
                await onShare();
            }
        } catch (err: any) {
            setError(err.message || 'Failed to update sharing status');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyLink = async () => {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            setError('Failed to copy link');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative z-10 w-full max-w-md mx-4 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-aether-lime to-emerald-600 flex items-center justify-center">
                            <Icons.Share size={20} className="text-black" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Share Project</h2>
                            <p className="text-sm text-zinc-500 truncate max-w-[200px]">{projectName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <Icons.X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Public Toggle */}
                    <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
                        <div className="flex items-center gap-3">
                            <Icons.Globe size={20} className={isPublic ? 'text-aether-lime' : 'text-zinc-500'} />
                            <div>
                                <p className="text-sm font-medium text-white">Public Access</p>
                                <p className="text-xs text-zinc-500">
                                    {isPublic ? 'Anyone with the link can view' : 'Only you can access'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleToggleShare}
                            disabled={loading}
                            className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${isPublic ? 'bg-aether-lime' : 'bg-zinc-700'
                                } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            <span
                                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-200 ${isPublic ? 'translate-x-6' : 'translate-x-0'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Share Link */}
                    {isPublic && shareId && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="text-sm font-medium text-zinc-400">Share Link</label>
                            <div className="flex gap-2">
                                <div className="flex-1 flex items-center gap-2 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                                    <Icons.Link size={16} className="text-zinc-500 shrink-0" />
                                    <span className="text-sm text-zinc-300 truncate font-mono">{shareUrl}</span>
                                </div>
                                <button
                                    onClick={handleCopyLink}
                                    className={`px-4 py-3 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 shrink-0 ${copied
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                        : 'bg-aether-lime text-black hover:bg-lime-300'
                                        }`}
                                >
                                    {copied ? (
                                        <>
                                            <Icons.Check size={16} />
                                            <span>Copied!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Icons.Copy size={16} />
                                            <span>Copy</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-zinc-900/30 border-t border-zinc-800">
                    <p className="text-xs text-zinc-600 text-center">
                        {isPublic
                            ? '🌐 Your project is live! Share the link with anyone.'
                            : '🔒 Enable public access to get a shareable link.'}
                    </p>
                </div>
            </div>
        </div>
    );
};

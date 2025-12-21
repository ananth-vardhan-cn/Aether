import React, { useState, useRef, useEffect } from 'react';
import { Project } from '../types';
import { Icons } from './ui/Icons';
import { Logo } from './ui/Logo';
import type { User } from '@supabase/supabase-js';

interface HeaderBarProps {
    projects: Project[];
    currentProjectId: string | null;
    onSelectProject: (id: string) => void;
    onNewProject: () => void;
    onDeleteProject?: (id: string) => void;
    user?: User | null;
    onAuthClick?: () => void;
    onSignOut?: () => void;
    onHome?: () => void;
    // Version history props
    showVersionHistory?: boolean;
    onVersionHistoryClick?: () => void;
    onCloseVersionHistory?: () => void;
    isLoading?: boolean;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
    projects,
    currentProjectId,
    onSelectProject,
    onNewProject,
    onDeleteProject,
    user,
    onAuthClick,
    onSignOut,
    onHome,
    showVersionHistory = false,
    onVersionHistoryClick,
    onCloseVersionHistory,
    isLoading = false,
    onToggleProjects,
    showProjects = false,
}) => {
    const [showLogoMenu, setShowLogoMenu] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const logoRef = useRef<HTMLDivElement>(null);
    const profileRef = useRef<HTMLDivElement>(null);

    // Close panels when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (logoRef.current && !logoRef.current.contains(e.target as Node)) {
                setShowLogoMenu(false);
            }
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
                setShowProfileMenu(false);
            }
        };

        if (showLogoMenu || showProfileMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showLogoMenu, showProfileMenu]);

    const handleSelectProject = (id: string) => {
        onSelectProject(id);
        // setShowProjects(false); // Controlled by parent now, usually parent toggles it off
    };

    const handleHome = () => {
        onHome?.();
        setShowLogoMenu(false);
    };

    return (
        <div className="h-14 bg-black border-b border-zinc-900 flex items-center justify-between px-4 shrink-0">
            {/* Left: Logo (with dropdown) + Projects */}
            <div className="flex items-center gap-4">
                {/* Logo with dropdown menu (only interactive when in a project) */}
                <div ref={logoRef} className="relative">
                    <button
                        onClick={() => currentProjectId && setShowLogoMenu(!showLogoMenu)}
                        className={`flex items-center gap-2 font-bold text-lg tracking-tighter transition-opacity ${currentProjectId ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
                    >
                        <Logo className="w-6 h-6" />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500">Aether</span>
                        <span className="text-[9px] bg-aether-lime text-black px-1.5 py-0.5 rounded font-mono font-bold uppercase">Beta</span>
                    </button>

                    {/* Logo Dropdown Menu - Only show when in a project */}
                    {showLogoMenu && currentProjectId && (
                        <div className="absolute top-full left-0 mt-2 w-56 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 z-50">
                            {/* Go Home */}
                            <button
                                onClick={handleHome}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
                            >
                                <Icons.Home size={16} className="text-zinc-500" />
                                Go to Home
                            </button>

                            <div className="border-t border-zinc-800" />

                            {/* Profile Section */}
                            {user ? (
                                <>
                                    <div className="px-4 py-3 border-b border-zinc-800">
                                        <p className="text-xs text-white truncate font-medium">{user.email}</p>
                                        <p className="text-[10px] text-zinc-500 mt-0.5">Cloud synced</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            onSignOut?.();
                                            setShowLogoMenu(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-400 hover:text-red-400 hover:bg-zinc-900 transition-colors"
                                    >
                                        <Icons.ChevronLeft size={16} />
                                        Sign Out
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => {
                                        onAuthClick?.();
                                        setShowLogoMenu(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-aether-lime hover:bg-zinc-900 transition-colors"
                                >
                                    <Icons.Eye size={16} />
                                    Sign In
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Loading + Projects + Version History */}
            <div className="flex items-center gap-0">
                {/* Loading indicator */}
                {isLoading && (
                    <div className="flex items-center gap-2 text-xs text-aether-lime">
                        <div className="w-2 h-2 rounded-full bg-aether-lime animate-pulse" />
                        <span className="hidden sm:inline font-mono">Building...</span>
                    </div>
                )}

                {/* Projects & Version History - Matching PreviewWindow toggle style */}
                {currentProjectId && (
                    <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-600">
                        <button
                            onClick={onToggleProjects}
                            className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-all ${showProjects
                                ? 'bg-zinc-700 text-white shadow-sm'
                                : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            title="Projects"
                        >
                            <Icons.Layout size={14} />
                            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showProjects ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>
                                <span className="whitespace-nowrap">Projects</span>
                            </div>
                        </button>

                        {onVersionHistoryClick && (
                            <button
                                onClick={showVersionHistory ? onCloseVersionHistory : onVersionHistoryClick}
                                className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-all ${showVersionHistory
                                    ? 'bg-zinc-700 text-white shadow-sm'
                                    : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                                title={showVersionHistory ? 'Back to chat' : 'Version History'}
                            >
                                <Icons.History size={14} />
                                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showVersionHistory ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>
                                    <span className="whitespace-nowrap">History</span>
                                </div>
                            </button>
                        )}
                    </div>
                )}

                {/* Profile Icon - Only show on home page (no project selected) */}
                {!currentProjectId && (
                    <div ref={profileRef} className="relative">
                        <button
                            onClick={() => user ? setShowProfileMenu(!showProfileMenu) : onAuthClick?.()}
                            className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                            title={user ? user.email || 'Profile' : 'Sign In'}
                        >
                            {user ? (
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-aether-lime to-emerald-600 flex items-center justify-center text-black text-xs font-bold">
                                    {user.email?.charAt(0).toUpperCase() || 'U'}
                                </div>
                            ) : (
                                <Icons.User size={18} />
                            )}
                        </button>

                        {/* Profile Dropdown */}
                        {showProfileMenu && user && (
                            <div className="absolute top-full right-0 mt-2 w-56 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 z-50">
                                <div className="px-4 py-3 border-b border-zinc-800">
                                    <p className="text-xs text-white truncate font-medium">{user.email}</p>
                                    <p className="text-[10px] text-zinc-500 mt-0.5">Cloud synced</p>
                                </div>
                                <button
                                    onClick={() => {
                                        onSignOut?.();
                                        setShowProfileMenu(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-400 hover:text-red-400 hover:bg-zinc-900 transition-colors"
                                >
                                    <Icons.ChevronLeft size={16} />
                                    Sign Out
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

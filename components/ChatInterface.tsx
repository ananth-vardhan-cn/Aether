import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Message, MessageRole, ViewState, GenerationStep, Project, File } from '../types';
import { Icons } from './ui/Icons';
import { Logo } from './ui/Logo';
import { sanitizePrompt, getPromptLimits } from '../lib/sanitize';
import { ProjectVersion } from '../hooks/useProjectVersions';
import { SandpackProvider, SandpackLayout, SandpackPreview } from "@codesandbox/sandpack-react";
import { amethyst } from "@codesandbox/sandpack-themes";
import * as Diff from 'diff';

const MAX_CHARS = getPromptLimits().maxLength;

interface ChatInterfaceProps {
    messages: Message[];
    onSendMessage: (content: string) => void;
    viewState: ViewState;
    isLoading: boolean;
    generationSteps: GenerationStep[];
    projects?: Project[];
    onSelectProject?: (id: string) => void;
    onDeleteProject?: (id: string) => void;
    // Version history props
    versions?: ProjectVersion[];
    versionsLoading?: boolean;
    currentFiles?: File[];
    onHistoryClick?: () => void;
    onRevert?: (version: ProjectVersion) => void;
    showVersionHistory?: boolean;
    onCloseVersionHistory?: () => void;
    onPreviewVersion?: (version: ProjectVersion | null) => void;
    previewingVersionId?: string | null;
    // User info
    userEmail?: string | null;
}

const PREVIEW_LOADING_TEXTS = [
    "Generating Live Preview...",
    "Compiling your masterpiece...",
    "Aligning pixels with precision...",
    "Teaching divs to behave...",
    "Injecting aesthetic vibes...",
    "Polishing the UI glass...",
    "Summoning the render engine...",
    "Making it look stunning...",
    "Optimizing responsiveness..."
];

const PLACEHOLDER_PROMPTS = [
    "Build a SaaS landing page for an AI startup...",
    "Create a crypto trading dashboard with dark mode...",
    "Design a portfolio website for a creative agency..."
];

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
    messages,
    onSendMessage,
    viewState,
    isLoading,
    generationSteps,
    projects = [],
    onSelectProject,
    onDeleteProject,
    versions = [],
    versionsLoading = false,
    currentFiles = [],
    onHistoryClick,
    onRevert,
    showVersionHistory = false,
    onCloseVersionHistory,
    onPreviewVersion,
    previewingVersionId = null,
    userEmail = null
}) => {
    const [input, setInput] = useState('');
    const [loadingTextIndex, setLoadingTextIndex] = useState(0);
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const [visibleProjectCount, setVisibleProjectCount] = useState(6);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (scrollRef.current && viewState === ViewState.BUILDING) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, generationSteps, isLoading, viewState]);

    // Rotate loading text
    useEffect(() => {
        if (isLoading) {
            const interval = setInterval(() => {
                setLoadingTextIndex((prev) => (prev + 1) % PREVIEW_LOADING_TEXTS.length);
            }, 3000);
            return () => clearInterval(interval);
        } else {
            setLoadingTextIndex(0);
        }
    }, [isLoading]);

    // Rotate placeholder prompts
    useEffect(() => {
        const interval = setInterval(() => {
            setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_PROMPTS.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const handleSend = () => {
        if (!input.trim() || isLoading) return;

        // Pre-validate
        const result = sanitizePrompt(input);
        if (!result.isValid) {
            alert(result.error);
            return;
        }

        onSendMessage(result.sanitizedPrompt);
        setInput('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const target = e.target;
        target.style.height = 'auto';
        target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
        setInput(target.value);
    };

    const getMessageStyles = (role: MessageRole) => {
        switch (role) {
            case MessageRole.USER:
                const userInitial = userEmail ? userEmail.charAt(0).toUpperCase() : 'U';
                return {
                    container: 'flex-row-reverse',
                    avatarBg: 'bg-zinc-800',
                    bubble: 'bg-zinc-800 text-white rounded-2xl rounded-tr-sm',
                    icon: <span className="text-xs font-bold text-aether-lime">{userInitial}</span>
                };
            case MessageRole.SYSTEM:
                return {
                    container: 'flex-row',
                    avatarBg: 'bg-amber-500/20',
                    bubble: 'bg-amber-500/10 border border-amber-500/20 text-amber-200 rounded-2xl rounded-tl-sm',
                    icon: <Icons.Zap size={16} className="text-amber-500" />
                };
            default: // ASSISTANT
                return {
                    container: 'flex-row',
                    avatarBg: 'bg-zinc-950 border border-zinc-800',
                    bubble: 'bg-zinc-900/50 border border-zinc-800 text-zinc-300 rounded-2xl rounded-tl-sm',
                    icon: <Logo className="w-4 h-4" />
                };
        }
    };

    // ----------------------------------------------------------------------
    // VIEW: LANDING (Hero Input)
    // ----------------------------------------------------------------------
    if (viewState === ViewState.LANDING) {
        return (
            <div className="flex-1 flex flex-col h-full w-full overflow-y-auto custom-scrollbar">

                {/* HERO SECTION - Full Height */}
                <div className="min-h-screen flex flex-col items-center justify-center p-6 relative">

                    {/* Vibrant Background Globs */}
                    <div className="absolute top-[20%] left-[20%] w-[500px] h-[500px] bg-aether-purple/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen animate-float" />
                    <div className="absolute bottom-[20%] right-[20%] w-[600px] h-[600px] bg-aether-lime/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen animate-float" style={{ animationDelay: '-2s' }} />

                    <div className="z-10 w-full max-w-3xl flex flex-col items-center gap-10">

                        {/* Hero Text */}
                        <div className="space-y-4 text-center">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-aether-lime mb-4 backdrop-blur-md">
                                <Icons.Sparkles size={12} />
                                <span>POWERED BY GEMINI 3 PRO</span>
                            </div>
                            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white">
                                Build the <span className="text-transparent bg-clip-text bg-gradient-to-r from-aether-lime to-emerald-400">extraordinary.</span>
                            </h1>
                            <p className="text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed">
                                Aether turns simple prompts into award-winning web applications. No coding required. Just dream it.
                            </p>
                        </div>

                        {/* Main Input Box */}
                        <div className="w-full relative group">
                            {/* Glowing border effect */}
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-aether-lime via-aether-purple to-aether-lime opacity-30 group-hover:opacity-70 transition duration-500 rounded-2xl blur filter group-focus-within:opacity-100 animate-gradient-x" />

                            <div className="relative bg-zinc-950 rounded-2xl p-2 flex flex-col gap-2 ring-1 ring-white/10 shadow-2xl">
                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={autoResize}
                                    onKeyDown={handleKeyDown}
                                    placeholder="What are we building today? (e.g. 'A futuristic landing page for a space tourism company')"
                                    className="w-full bg-transparent text-white placeholder-zinc-600 text-xl p-4 resize-none focus:outline-none max-h-64 font-medium leading-relaxed"
                                    rows={1}
                                    autoFocus
                                />
                                <div className="flex justify-between items-center px-2 pb-1">
                                    <div className="flex items-center gap-2">
                                        {/* Character counter */}
                                        <span className={`text-xs font-mono ${input.length > MAX_CHARS ? 'text-red-400' : input.length > MAX_CHARS * 0.8 ? 'text-amber-400' : 'text-zinc-600'}`}>
                                            {input.length}/{MAX_CHARS}
                                        </span>
                                    </div>
                                    <button
                                        onClick={handleSend}
                                        disabled={!input.trim() || isLoading}
                                        className={`
                                    px-4 py-2 rounded-xl flex items-center gap-2 font-semibold transition-all duration-200
                                    ${input.trim()
                                                ? 'bg-white text-black hover:bg-aether-lime hover:scale-105'
                                                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'}
                                `}
                                    >
                                        <span>Generate</span>
                                        <Icons.Send size={16} className={isLoading ? 'animate-spin' : ''} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Suggestions */}
                        <div className="flex flex-wrap justify-center gap-3">
                            {[
                                'SaaS Landing Page',
                                'Crypto Dashboard',
                                'AI Chat Interface',
                                'Portfolio Site'
                            ].map((suggestion) => (
                                <button
                                    key={suggestion}
                                    onClick={() => setInput(`Build a modern ${suggestion.toLowerCase()} with dark mode and beautiful typography.`)}
                                    className="px-4 py-2 rounded-full border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20 text-zinc-400 hover:text-white text-sm transition-all backdrop-blur-sm"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>

                        {/* Scroll Indicator */}
                        {projects.filter(p => p.files.length > 0 || p.previewCode).length > 0 && (
                            <div className="absolute bottom-10 animate-bounce text-zinc-600">
                                <Icons.ChevronRight className="rotate-90" size={24} />
                            </div>
                        )}
                    </div>
                </div>

                {/* PROJECTS SECTION (Below Fold) */}
                {projects.filter(p => p.files.length > 0 || p.previewCode).length > 0 && (
                    <div className="w-full max-w-7xl mx-auto px-6 pb-20">
                        <div className="flex items-center gap-4 mb-12">
                            <h2 className="text-3xl font-bold tracking-tight text-white">Your Masterpieces</h2>
                            <div className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent"></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {projects.filter(p => p.files.length > 0 || p.previewCode).slice(0, visibleProjectCount).map((project) => (
                                <div
                                    key={project.id}
                                    className="group relative flex flex-col h-[320px] overflow-hidden rounded-3xl bg-zinc-900/40 border border-white/5 hover:border-white/20 transition-all duration-500 hover:-translate-y-1"
                                >
                                    {/* Project Preview (Iframe) */}
                                    <div
                                        onClick={() => onSelectProject && onSelectProject(project.id)}
                                        className="relative h-[65%] w-full overflow-hidden bg-zinc-950 border-b border-zinc-800 cursor-pointer"
                                    >
                                        {project.previewCode ? (
                                            <div className="w-full h-full relative pointer-events-none select-none">
                                                <iframe
                                                    srcDoc={project.previewCode}
                                                    className="w-full h-full border-none bg-white"
                                                    tabIndex={-1}
                                                    loading="lazy"
                                                    title={`Preview of ${project.name}`}
                                                />
                                                {/* Overlay to ensure clicks go to parent */}
                                                <div className="absolute inset-0 bg-transparent"></div>
                                            </div>
                                        ) : project.files.length > 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-zinc-900 to-zinc-950">
                                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-aether-lime/20 to-emerald-500/10 flex items-center justify-center mb-3">
                                                    <Icons.Code size={28} className="text-aether-lime" />
                                                </div>
                                                <p className="text-sm text-zinc-400 font-medium">Click to view app</p>
                                                <p className="text-xs text-zinc-600 mt-1">{project.files.length} files ready</p>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-zinc-700">
                                                <Icons.Layout size={48} />
                                            </div>
                                        )}

                                        {/* Hover Gradient Overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                    </div>

                                    {/* Project Info */}
                                    <div className="flex-1 p-5 flex flex-col justify-between bg-gradient-to-b from-zinc-900/0 to-zinc-900/50">
                                        <div className="flex items-start justify-between gap-2">
                                            <div onClick={() => onSelectProject && onSelectProject(project.id)} className="cursor-pointer">
                                                <h3 className="text-lg font-bold text-zinc-100 leading-tight line-clamp-1 group-hover:text-aether-lime transition-colors">
                                                    {project.name}
                                                </h3>
                                                <p className="text-xs text-zinc-500 font-mono mt-1">
                                                    {new Date(project.lastModified).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                </p>
                                            </div>

                                            {onDeleteProject && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDeleteProject(project.id);
                                                    }}
                                                    className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    title="Delete Project"
                                                >
                                                    <Icons.Trash size={16} />
                                                </button>
                                            )}
                                        </div>

                                        <div
                                            onClick={() => onSelectProject && onSelectProject(project.id)}
                                            className="flex items-center justify-between mt-2 cursor-pointer"
                                        >
                                            <div className="flex items-center gap-2 text-xs font-mono text-zinc-600 uppercase tracking-wider">
                                                <Icons.FileGeneric size={12} />
                                                <span>{project.files.length} Files</span>
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-aether-lime group-hover:text-black transition-all duration-300">
                                                <Icons.ChevronRight size={14} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Load More Button */}
                        {projects.filter(p => p.files.length > 0 || p.previewCode).length > visibleProjectCount && (
                            <div className="flex justify-center mt-10">
                                <button
                                    onClick={() => setVisibleProjectCount(prev => prev + 6)}
                                    className="group px-6 py-3 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-aether-lime/30 text-zinc-400 hover:text-white font-medium transition-all duration-300 flex items-center gap-3"
                                >
                                    <span>Load More</span>
                                    <span className="text-xs text-zinc-600 font-mono">
                                        ({visibleProjectCount} of {projects.filter(p => p.files.length > 0 || p.previewCode).length})
                                    </span>
                                    <Icons.ChevronRight className="rotate-90 group-hover:translate-y-0.5 transition-transform" size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // ----------------------------------------------------------------------
    // VIEW: SIDEBAR CHAT (Building Mode)
    // ----------------------------------------------------------------------
    return (
        <div className="flex flex-col h-full w-full bg-black relative z-20">

            {/* Version History View OR Messages Area */}
            {showVersionHistory ? (
                <VersionHistoryView
                    versions={versions}
                    versionsLoading={versionsLoading}
                    currentFiles={currentFiles}
                    onRevert={onRevert}
                    onPreviewVersion={onPreviewVersion}
                    previewingVersionId={previewingVersionId}
                />
            ) : (
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide pb-4">
                    {messages.map((msg) => {
                        const style = getMessageStyles(msg.role);
                        return (
                            <div
                                key={msg.id}
                                className={`flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 ${style.container}`}
                            >
                                {/* Avatar */}
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${style.avatarBg}`}>
                                    {style.icon}
                                </div>

                                {/* Bubble */}
                                <div className={`max-w-[85%] p-3.5 text-sm leading-relaxed shadow-md ${style.bubble}`}>
                                    {msg.content}
                                </div>
                            </div>
                        );
                    })}

                    {/* Live Generation Log */}
                    {isLoading && (
                        <div className="flex gap-4 animate-in fade-in">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-aether-lime to-emerald-600 flex items-center justify-center shrink-0 animate-pulse">
                                <Icons.Code size={16} className="text-black" />
                            </div>
                            <div className="bg-zinc-950 border border-zinc-800 text-zinc-400 rounded-2xl rounded-tl-sm p-0 overflow-hidden w-[85%] shadow-xl">
                                <div className="bg-zinc-900/50 p-3 border-b border-zinc-800 flex items-center gap-2">
                                    <div className="flex space-x-1">
                                        <div className="w-2 h-2 bg-aether-lime rounded-full animate-pulse"></div>
                                    </div>
                                    <span className="font-mono text-xs uppercase tracking-wide text-aether-lime font-bold">Building Project...</span>
                                </div>
                                <div className="p-3 space-y-2 max-h-[300px] overflow-y-auto">
                                    {generationSteps.map((step) => {
                                        const isPreviewStep = step.id === 'preview' && step.status === 'in-progress';
                                        return (
                                            <div key={step.id} className="flex items-center gap-3 text-xs font-mono transition-all duration-300 animate-in slide-in-from-left-2">
                                                {step.status === 'completed' ? (
                                                    <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                                                        <Icons.Check size={10} strokeWidth={3} />
                                                    </div>
                                                ) : (
                                                    <div className="w-4 h-4 rounded-full border-2 border-t-transparent border-aether-lime animate-spin shrink-0" />
                                                )}

                                                {/* Dynamic Text for Preview Step */}
                                                <span className={step.status === 'completed' ? 'text-zinc-500' : 'text-zinc-200'}>
                                                    {isPreviewStep ? (
                                                        <span className="inline-block animate-in fade-in slide-in-from-bottom-1 duration-500" key={loadingTextIndex}>
                                                            {PREVIEW_LOADING_TEXTS[loadingTextIndex]}
                                                        </span>
                                                    ) : step.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Input Area - Sticky at bottom */}
            <div className="sticky bottom-0 w-full p-4 pb-5 bg-gradient-to-t from-black via-black/95 to-transparent pt-8 mt-auto">
                <div className="relative bg-zinc-900 rounded-2xl p-3 ring-1 ring-zinc-700 focus-within:ring-aether-lime/50 transition-all shadow-2xl">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={autoResize}
                        onKeyDown={handleKeyDown}
                        placeholder={PLACEHOLDER_PROMPTS[placeholderIndex]}
                        className="w-full bg-transparent text-white placeholder-zinc-600 text-base p-3 resize-none focus:outline-none max-h-40 font-medium leading-relaxed"
                        rows={2}
                    />
                    <div className="flex justify-between items-center mt-2 px-1">
                        <span className="text-[10px] text-zinc-600 font-mono">SHIFT+ENTER for new line</span>
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-mono ${input.length > MAX_CHARS ? 'text-red-400' : input.length > MAX_CHARS * 0.8 ? 'text-amber-400' : 'text-zinc-600'}`}>
                                {input.length}/{MAX_CHARS}
                            </span>
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || isLoading}
                                className={`
                            p-2 rounded-lg transition-all duration-200
                            ${input.trim()
                                        ? 'bg-aether-lime text-black hover:bg-emerald-400 shadow-[0_0_10px_rgba(190,242,100,0.3)]'
                                        : 'text-zinc-600 bg-zinc-800/50'}
                        `}
                            >
                                <Icons.Send size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Smart summarization: extract key action from prompt
const summarizePrompt = (prompt: string): string => {
    if (!prompt) return 'Initial version';

    // Common action patterns to extract
    const patterns = [
        /^(add|create|make|build|implement|fix|update|change|modify|remove|delete|style|design)/i,
        /^(the )?(.+?) (page|section|component|button|header|footer|nav|form|modal)/i,
    ];

    const cleanPrompt = prompt.trim().toLowerCase();

    // Extract first meaningful phrase (up to 50 chars)
    const words = cleanPrompt.split(' ').slice(0, 8);
    let summary = words.join(' ');
    if (summary.length > 50) {
        summary = summary.substring(0, 47) + '...';
    }

    // Capitalize first letter
    return summary.charAt(0).toUpperCase() + summary.slice(1);
};

// Inline Version History View Component
const VersionHistoryView: React.FC<{
    versions: ProjectVersion[];
    versionsLoading: boolean;
    currentFiles: File[];
    onRevert?: (version: ProjectVersion) => void;
    onPreviewVersion?: (version: ProjectVersion | null) => void;
    previewingVersionId?: string | null;
}> = ({ versions, versionsLoading, currentFiles, onRevert, onPreviewVersion, previewingVersionId }) => {
    const [diffVersion, setDiffVersion] = useState<ProjectVersion | null>(null);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    const handleRevert = (version: ProjectVersion) => {
        if (confirm(`Revert to this version? This will replace your current code.`)) {
            onRevert?.(version);
        }
        setOpenMenuId(null);
    };

    const handlePreview = (version: ProjectVersion) => {
        // If clicking the latest version (first in list), go back to current state
        // Otherwise, preview the selected historical version
        const isLatestVersion = versions.length > 0 && versions[0].id === version.id;
        if (isLatestVersion) {
            onPreviewVersion?.(null); // Clear preview, show current
        } else {
            onPreviewVersion?.(version);
        }
        setOpenMenuId(null);
    };

    const handleViewChanges = (version: ProjectVersion) => {
        setDiffVersion(version);
        if (version.files.length > 0) setSelectedFile(version.files[0].name);
        setOpenMenuId(null);
    };

    // Diff result for selected file
    const diffResult = useMemo(() => {
        if (!diffVersion || !selectedFile) return [];
        const oldFile = diffVersion.files.find(f => f.name === selectedFile);
        const newFile = currentFiles.find(f => f.name === selectedFile);
        return Diff.diffLines(oldFile?.content || '', newFile?.content || '');
    }, [diffVersion, selectedFile, currentFiles]);

    // All file names for diff view
    const allFileNames = useMemo(() => {
        if (!diffVersion) return [];
        const names = new Set<string>();
        diffVersion.files.forEach(f => names.add(f.name));
        currentFiles.forEach(f => names.add(f.name));
        return Array.from(names).sort();
    }, [diffVersion, currentFiles]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setOpenMenuId(null);
        if (openMenuId) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [openMenuId]);

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
            {versionsLoading ? (
                <div className="flex items-center justify-center py-10">
                    <div className="animate-spin w-6 h-6 border-2 border-aether-lime border-t-transparent rounded-full" />
                </div>
            ) : versions.length === 0 ? (
                <div className="text-center py-10 text-zinc-600">
                    <Icons.History size={32} className="mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No versions yet</p>
                    <p className="text-xs mt-1">Versions are saved after each generation</p>
                </div>
            ) : (
                versions.map((version) => {
                    const isSelected = previewingVersionId === version.id;
                    return (
                        <div
                            key={version.id}
                            onClick={() => handlePreview(version)}
                            className={`group flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${isSelected
                                ? 'bg-zinc-900/60 border-aether-lime/50'
                                : 'bg-zinc-900/30 hover:bg-zinc-800/80 border-zinc-800/50 hover:border-zinc-600'
                                }`}
                        >
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate transition-colors ${isSelected ? 'text-aether-lime' : 'text-zinc-300 group-hover:text-white'
                                    }`}>
                                    {summarizePrompt(version.prompt)}
                                </p>
                                <p className="text-xs text-zinc-600 font-mono mt-0.5">
                                    {version.createdAt.toLocaleString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </p>
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-1 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handlePreview(version); }}
                                    className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                                    title="Preview"
                                >
                                    <Icons.Eye size={14} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleViewChanges(version); }}
                                    className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                                    title="View changes"
                                >
                                    <Icons.Code size={14} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleRevert(version); }}
                                    className="p-1.5 text-zinc-500 hover:text-aether-lime hover:bg-aether-lime/10 rounded-lg transition-colors"
                                    title="Revert"
                                >
                                    <Icons.Refresh size={14} />
                                </button>

                                {/* 3-dot menu */}
                                <div className="relative">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenMenuId(openMenuId === version.id ? null : version.id);
                                        }}
                                        className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                                        title="More options"
                                    >
                                        <Icons.MoreVertical size={14} />
                                    </button>

                                    {/* Dropdown menu */}
                                    {openMenuId === version.id && (
                                        <div
                                            className="absolute right-0 top-full mt-1 w-44 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <button
                                                onClick={() => handlePreview(version)}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                                            >
                                                <Icons.Eye size={14} className="text-zinc-500" />
                                                Preview
                                            </button>
                                            <button
                                                onClick={() => handleViewChanges(version)}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                                            >
                                                <Icons.Code size={14} className="text-zinc-500" />
                                                View Changes
                                            </button>
                                            <div className="border-t border-zinc-800" />
                                            <button
                                                onClick={() => handleRevert(version)}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-aether-lime hover:bg-aether-lime/10 transition-colors"
                                            >
                                                <Icons.Refresh size={14} />
                                                Restore Version
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })
            )}


            {/* Diff Modal */}
            {diffVersion && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80" onClick={() => setDiffVersion(null)} />
                    <div className="relative z-10 w-full max-w-4xl h-[70vh] bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-3 border-b border-zinc-800">
                            <span className="text-sm font-medium text-white">Changes: {summarizePrompt(diffVersion.prompt)} → Current</span>
                            <button onClick={() => setDiffVersion(null)} className="p-1.5 text-zinc-500 hover:text-white">
                                <Icons.X size={16} />
                            </button>
                        </div>
                        <div className="flex flex-1 overflow-hidden">
                            <div className="w-40 border-r border-zinc-800 overflow-y-auto bg-zinc-900/50">
                                {allFileNames.map(name => (
                                    <button
                                        key={name}
                                        onClick={() => setSelectedFile(name)}
                                        className={`w-full text-left px-3 py-2 text-xs font-mono truncate transition-colors ${selectedFile === name ? 'bg-aether-lime/10 text-aether-lime' : 'text-zinc-400 hover:bg-zinc-800'}`}
                                    >
                                        {name.split('/').pop()}
                                    </button>
                                ))}
                            </div>
                            <div className="flex-1 overflow-auto p-3 font-mono text-xs">
                                {diffResult.map((part, i) => (
                                    <div key={i} className={`whitespace-pre-wrap ${part.added ? 'bg-emerald-500/20 text-emerald-300' : part.removed ? 'bg-red-500/20 text-red-300' : 'text-zinc-500'}`}>
                                        {part.value}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Message, MessageRole, ViewState, GenerationStep, Project, File, AIModel, AIProvider, AI_MODELS } from '../types';
import { Icons } from './ui/Icons';
import { sanitizePrompt, getPromptLimits } from '../lib/sanitize';
import { ProjectVersion } from '../hooks/useProjectVersions';
import { SandpackProvider, SandpackLayout, SandpackPreview } from "@codesandbox/sandpack-react";
import { amethyst } from "@codesandbox/sandpack-themes";
import * as Diff from 'diff';
import { GenerationLog } from './GenerationLog';
import { ActionsCard, BuildSummaryCard, PersistedActionsCard } from './BuildCard';
import { AnimatePresence, motion } from 'framer-motion';
import { extractDependencies } from '../lib/extractDependencies';
import { ModelSelector } from './ModelSelector';

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
    onPinProject?: (id: string, isPinned: boolean) => void;
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
    // Build plan/summary for display
    buildPlan?: string;
    buildSummary?: string;
    // Error handling
    pendingError?: string | null;
    onAutoFix?: (error: string) => void;
    onDismissError?: () => void;
    isAutoFixing?: boolean;  // Hide Aether label during auto-fix
    // Model selection
    selectedModel?: AIModel;
    onSelectModel?: (model: AIModel) => void;
    configuredProviders?: Record<AIProvider, boolean>;
    onApiKeysClick?: () => void;
    // Edit message
    onEditMessage?: (messageId: string, newContent: string) => void;
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

const SystemErrorCard: React.FC<{ error: string; isFixing?: boolean }> = ({ error, isFixing = false }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Determine the display text and state based on isFixing
    const statusText = isFixing
        ? "Analyzing and fixing the error..."
        : "Analyzed and fixed runtime error";

    return (
        <div className="flex animate-in fade-in slide-in-from-bottom-2 duration-300 w-full">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden w-full max-w-[85%] shadow-sm">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-zinc-800/50 transition-colors gap-3"
                >
                    <div className="flex items-center gap-2 text-zinc-300 text-sm font-medium">
                        {isFixing && (
                            <div className="w-4 h-4 rounded-full border-2 border-aether-lime border-t-transparent animate-spin shrink-0" />
                        )}
                        <span>{statusText}</span>
                    </div>
                    <div className={`text-zinc-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                        <Icons.ChevronRight size={16} />
                    </div>
                </button>
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="p-3 pt-0 text-xs font-mono text-zinc-400 break-words leading-relaxed border-t border-zinc-800 whitespace-pre-wrap">
                                {error}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
    messages,
    onSendMessage,
    viewState,
    isLoading,
    generationSteps,
    projects = [],
    onSelectProject,
    onDeleteProject,
    onPinProject,
    versions = [],
    versionsLoading = false,
    currentFiles = [],
    onHistoryClick,
    onRevert,
    showVersionHistory = false,
    onCloseVersionHistory,
    onPreviewVersion,
    previewingVersionId = null,
    userEmail = null,
    buildPlan = '',
    buildSummary = '',
    pendingError = null,
    onAutoFix,
    onDismissError,
    isAutoFixing = false,
    selectedModel = AI_MODELS[0],
    onSelectModel,
    configuredProviders = { gemini: true, anthropic: false, openai: false },
    onApiKeysClick,
    onEditMessage
}) => {
    const [input, setInput] = useState('');
    const [loadingTextIndex, setLoadingTextIndex] = useState(0);
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const [visibleProjectCount, setVisibleProjectCount] = useState(6);
    const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
    const [editText, setEditText] = useState('');
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
                return {
                    container: 'flex-row-reverse',
                    bubble: 'bg-zinc-800 text-white rounded-2xl',
                };
            case MessageRole.SYSTEM:
                return {
                    container: 'flex-row',
                    bubble: 'bg-amber-500/10 border border-amber-500/20 text-amber-200 rounded-2xl rounded-tl-sm',
                };
            default: // ASSISTANT
                return {
                    container: 'flex-row',
                    bubble: 'bg-transparent text-zinc-300',
                };
        }
    };

    // Check if this is the first assistant message in the conversation
    const isFirstAssistantMessage = (index: number) => {
        for (let i = 0; i < index; i++) {
            if (messages[i].role === MessageRole.ASSISTANT) return false;
        }
        return messages[index]?.role === MessageRole.ASSISTANT;
    };

    // ----------------------------------------------------------------------
    // VIEW: LANDING (Hero Input)
    // ----------------------------------------------------------------------
    if (viewState === ViewState.LANDING) {
        return (
            <div className="flex-1 flex flex-col h-full w-full overflow-y-scroll custom-scrollbar bg-[#0A0A0A] relative selection:bg-aether-lime selection:text-black">

                {/* HORIZON GLOW BACKGROUND */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
                    {/* The Glow Behind - Split into two side sources to fade middle */}
                    <div
                        className="absolute bottom-[-20%] left-[-20%] right-[-20%] h-[500px] rounded-[100%]"
                        style={{
                            background: `
                                radial-gradient(circle at 20% 50%, rgba(190, 242, 100, 0.8) 0%, transparent 50%),
                                radial-gradient(circle at 80% 50%, rgba(190, 242, 100, 0.8) 0%, transparent 50%)
                            `,
                            opacity: 0.2,
                            filter: 'blur(80px)',
                            transform: 'translateZ(0)', // Force GPU
                        }}
                    />

                    {/* Center Fade Arc - Green glow arc above chat interface */}
                    <div
                        className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[50vh]"
                        style={{
                            background: 'radial-gradient(ellipse 60% 40% at 50% 80%, rgba(190, 242, 100, 0.5) 0%, rgba(190, 242, 100, 0.15) 50%, transparent 80%)',
                            filter: 'blur(50px)',
                            transform: 'translateZ(0)',
                        }}
                    />

                    {/* The Planet Edge (Sharp White Line) */}
                    <div
                        className="absolute left-[50%] -translate-x-1/2 bottom-[-118vw] w-[160vw] h-[140vw] rounded-[100%] bg-[#0A0A0A] border-t-[18px] border-white/90"
                        style={{
                            boxShadow: `
                                0 -5px 0 0 rgba(190, 242, 100, 0.1),
                                0 -10px 0 0 rgba(190, 242, 100, 1.0),
                                0 -14px 0 0 rgba(190, 242, 100, 0.2),
                                0 -50px 100px -10px rgba(190, 242, 100, 0.4)
                            `
                        }}
                    >
                    </div>

                    {/* Secondary Green Rim (Atmosphere) */}
                    <div
                        className="absolute left-[50%] -translate-x-1/2 bottom-[-118vw] w-[160vw] h-[140vw] rounded-[100%]"
                        style={{
                            boxShadow: '0 -20px 60px rgba(190, 242, 100, 0.3)',
                            opacity: 0.3
                        }}
                    />
                </div>

                {/* Center Fade Arc - Green glow arc above chat interface (outside overflow container) */}
                <div
                    className="absolute top-[55%] left-1/2 -translate-x-1/2 -translate-y-full w-[90vw] h-[450px] pointer-events-none z-[5]"
                    style={{
                        background: 'radial-gradient(ellipse 90% 100% at 50% 100%, rgba(190, 242, 100, 0.5) 0%, rgba(190, 242, 100, 0.2) 30%, rgba(190, 242, 100, 0.08) 60%, transparent 90%)',
                        filter: 'blur(50px)',
                    }}
                />

                {/* HERO SECTION - Full Height */}
                <div className="min-h-screen flex flex-col items-center justify-center p-6 relative z-10">

                    <div className="w-full max-w-3xl flex flex-col items-center gap-6 -mt-12">


                        {/* Hero Text */}
                        <motion.div
                            initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                            className="space-y-4 text-center"
                        >
                            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white">
                                What will you <span className="bg-clip-text text-transparent bg-gradient-to-t from-lime-500 to-white italic pl-1 pr-3 mr-1">build</span> today?
                            </h1>
                            <p className="text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed font-medium">
                                Create stunning apps & websites by chatting with AI.
                            </p>
                        </motion.div>

                        {/* Main Input Box */}
                        <motion.div
                            initial={{ y: -20 }}
                            animate={{ y: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
                            className="w-full max-w-2xl relative group mt-4"
                        >
                            {/* Input Container */}
                            <div className="relative bg-[#1E1E1E] rounded-xl p-3 flex flex-col gap-2 ring-1 ring-white/5 focus-within:ring-aether-lime/50 shadow-2xl transition-all duration-300">
                                {/* Textarea with animated placeholder */}
                                <div className="relative">
                                    <textarea
                                        ref={textareaRef}
                                        value={input}
                                        onChange={autoResize}
                                        onKeyDown={handleKeyDown}
                                        className="w-full bg-transparent text-white text-base p-3 resize-none focus:outline-none min-h-[80px] max-h-64 font-normal leading-relaxed custom-scrollbar"
                                        rows={2}
                                    />
                                    {/* Animated placeholder overlay - word by word */}
                                    {!input && (
                                        <div className="absolute top-0 left-0 p-3 pointer-events-none">
                                            <AnimatePresence mode="wait">
                                                <motion.div
                                                    key={placeholderIndex}
                                                    initial="hidden"
                                                    animate="visible"
                                                    exit="exit"
                                                    className="text-zinc-400/60 font-normal flex flex-wrap gap-x-1.5"
                                                    style={{ fontSize: '15px' }}
                                                >
                                                    {PLACEHOLDER_PROMPTS[placeholderIndex].split(' ').map((word, wordIndex) => (
                                                        <motion.span
                                                            key={wordIndex}
                                                            variants={{
                                                                hidden: { opacity: 0, filter: "blur(12px)" },
                                                                visible: {
                                                                    opacity: 1,
                                                                    filter: "blur(0px)",
                                                                    transition: {
                                                                        duration: 0.4,
                                                                        delay: wordIndex * 0.1,
                                                                        ease: "easeOut"
                                                                    }
                                                                },
                                                                exit: {
                                                                    opacity: 0,
                                                                    filter: "blur(12px)",
                                                                    transition: { duration: 0.2 }
                                                                }
                                                            }}
                                                        >
                                                            {word}
                                                        </motion.span>
                                                    ))}
                                                </motion.div>
                                            </AnimatePresence>
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-between items-center px-2 pt-2 border-t border-white/5">
                                    <div className="flex items-center gap-3">
                                        <ModelSelector
                                            selectedModel={selectedModel}
                                            onSelectModel={(model) => onSelectModel?.(model)}
                                            configuredProviders={configuredProviders}
                                            disabled={isLoading}
                                            onApiKeysClick={onApiKeysClick}
                                        />
                                    </div>

                                    <button
                                        onClick={handleSend}
                                        disabled={!input.trim() || isLoading}
                                        className={`
                                            px-4 py-1.5 rounded-lg flex items-center gap-2 font-medium text-sm transition-all duration-200
                                            ${input.trim()
                                                ? 'bg-aether-lime text-black shadow-lg hover:bg-lime-300'
                                                : 'bg-lime-900/30 text-zinc-400 cursor-not-allowed'}}
                                        `}
                                    >
                                        <span>Build now</span>
                                        <Icons.Send size={14} className={isLoading ? 'animate-spin' : ''} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>

                        {/* Scroll Indicator */}
                        {projects.filter(p => p.files.length > 0 || p.previewCode).length > 0 && (
                            <div className="absolute bottom-[-100px] animate-bounce text-zinc-700 cursor-pointer hover:text-white transition-colors" onClick={() => {
                                document.getElementById('masterpieces')?.scrollIntoView({ behavior: 'smooth' });
                            }}>
                                <Icons.ChevronRight className="rotate-90" size={24} />
                            </div>
                        )}

                    </div>
                </div>

                {/* PROJECTS SECTION (Below Fold) */}
                {
                    projects.filter(p => p.files.length > 0 || p.previewCode).length > 0 && (
                        <div id="masterpieces" className="w-full max-w-7xl mx-auto px-6 pb-20 pt-10 min-h-screen">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-100px" }}
                                transition={{ duration: 0.6 }}
                                className="flex items-center gap-4 mb-12"
                            >
                                <h2 className="text-3xl font-bold tracking-tight text-white">Your Masterpieces</h2>
                                <div className="h-px flex-1 bg-gradient-to-r from-zinc-800 to-transparent"></div>
                            </motion.div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[...projects]
                                    .filter(p => p.files.length > 0 || p.previewCode)
                                    .sort((a, b) => {
                                        // Pinned projects come first
                                        if (a.isPinned && !b.isPinned) return -1;
                                        if (!a.isPinned && b.isPinned) return 1;
                                        // Both pinned: sort by pinnedAt (most recently pinned first)
                                        if (a.isPinned && b.isPinned) {
                                            return (b.pinnedAt || 0) - (a.pinnedAt || 0);
                                        }
                                        // Both unpinned: sort by lastModified
                                        return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
                                    })
                                    .slice(0, visibleProjectCount)
                                    .map((project, index) => (
                                        <motion.div
                                            key={project.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            whileInView={{ opacity: 1, y: 0 }}
                                            viewport={{ once: true, margin: "-50px" }}
                                            transition={{ duration: 0.5, delay: index * 0.1 }}
                                            className="group relative flex flex-col h-[320px] overflow-hidden rounded-xl bg-[#111] border border-white/5 hover:border-white/10 transition-all duration-500 hover:-translate-y-1 shadow-lg"
                                        >
                                            {/* Project Preview */}
                                            <div
                                                onClick={() => onSelectProject && onSelectProject(project.id)}
                                                className="relative h-[65%] w-full overflow-hidden bg-black border-b border-white/5 cursor-pointer"
                                            >
                                                {project.previewCode ? (
                                                    <div className="w-full h-full relative pointer-events-none select-none grayscale group-hover:grayscale-0 transition-all duration-500">
                                                        <iframe
                                                            srcDoc={project.previewCode}
                                                            className="w-full h-full border-none bg-white opacity-80 group-hover:opacity-100 transition-opacity"
                                                            tabIndex={-1}
                                                            loading="lazy"
                                                            title={`Preview of ${project.name}`}
                                                        />
                                                        {/* Overlay to ensure clicks go to parent */}
                                                        <div className="absolute inset-0 bg-transparent"></div>
                                                    </div>
                                                ) : project.files.length > 0 ? (
                                                    /* Sandpack-based preview for projects with files */
                                                    <div className="w-full h-full relative pointer-events-none select-none overflow-hidden">
                                                        {/* Scaled container for thumbnail view */}
                                                        <div
                                                            className="absolute top-0 left-0 origin-top-left"
                                                            style={{
                                                                width: '200%',
                                                                height: '200%',
                                                                transform: 'scale(0.5)',
                                                            }}
                                                        >
                                                            <SandpackProvider
                                                                template="react-ts"
                                                                theme={amethyst}
                                                                files={(() => {
                                                                    const sandpackFiles: Record<string, string> = {};
                                                                    project.files.forEach(f => {
                                                                        let path = f.name.startsWith('/') ? f.name : `/${f.name}`;
                                                                        sandpackFiles[path] = f.content;
                                                                    });
                                                                    return sandpackFiles;
                                                                })()}
                                                                customSetup={{
                                                                    dependencies: extractDependencies(project.files)
                                                                }}
                                                                options={{
                                                                    externalResources: [
                                                                        "https://cdn.tailwindcss.com"
                                                                    ],
                                                                    classes: {
                                                                        "sp-wrapper": "!h-full",
                                                                        "sp-layout": "!h-full !border-none !bg-transparent",
                                                                        "sp-preview": "!h-full",
                                                                        "sp-preview-container": "!h-full !bg-white",
                                                                        "sp-preview-iframe": "!h-full"
                                                                    }
                                                                }}
                                                            >
                                                                <SandpackLayout className="!h-full !border-none !rounded-none">
                                                                    <SandpackPreview
                                                                        showNavigator={false}
                                                                        showRefreshButton={false}
                                                                        showOpenInCodeSandbox={false}
                                                                        className="!h-full"
                                                                    />
                                                                </SandpackLayout>
                                                            </SandpackProvider>
                                                        </div>
                                                        {/* Overlay to ensure clicks go to parent */}
                                                        <div className="absolute inset-0 bg-transparent"></div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-center h-full text-zinc-800">
                                                        <Icons.Layout size={48} />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Project Info */}
                                            <div className="flex-1 p-5 flex flex-col justify-between">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div onClick={() => onSelectProject && onSelectProject(project.id)} className="cursor-pointer">
                                                        <h3 className="text-lg font-bold text-zinc-300 leading-tight line-clamp-1 group-hover:text-white transition-colors">
                                                            {project.name}
                                                        </h3>
                                                        <p className="text-xs text-zinc-600 font-mono mt-1 group-hover:text-zinc-500">
                                                            {new Date(project.lastModified).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center gap-1">
                                                        {/* Pin Button */}
                                                        {onPinProject && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onPinProject(project.id, !project.isPinned);
                                                                }}
                                                                className={`p-2 rounded-lg transition-all ${project.isPinned
                                                                    ? 'text-white bg-zinc-800'
                                                                    : 'text-zinc-600 hover:text-white hover:bg-zinc-800 opacity-0 group-hover:opacity-100'
                                                                    }`}
                                                                title={project.isPinned ? 'Unpin Project' : 'Pin Project'}
                                                            >
                                                                <Icons.Pin size={16} className={project.isPinned ? 'fill-current' : ''} />
                                                            </button>
                                                        )}

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
                                                </div>

                                                <div
                                                    onClick={() => onSelectProject && onSelectProject(project.id)}
                                                    className="flex items-center justify-between mt-2 cursor-pointer"
                                                >
                                                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-600 uppercase tracking-wider group-hover:text-zinc-500">
                                                        <Icons.FileGeneric size={12} />
                                                        <span>{project.files.length} Files</span>
                                                    </div>
                                                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-aether-lime group-hover:text-black text-zinc-600 transition-all duration-300">
                                                        <Icons.ChevronRight size={14} />
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                            </div>

                            {/* Load More Button */}
                            {projects.filter(p => p.files.length > 0 || p.previewCode).length > visibleProjectCount && (
                                <div className="flex justify-center mt-10">
                                    <button
                                        onClick={() => setVisibleProjectCount(prev => prev + 6)}
                                        className="group px-6 py-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white font-medium transition-all duration-300 flex items-center gap-3"
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
                    )
                }
            </div >
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
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-8 scrollbar-hide pb-32">
                    {/* Empty state placeholder when no messages */}
                    {messages.length === 0 && !isLoading && (
                        <div className="flex-1 flex flex-col items-center justify-center h-full text-center py-16">
                            <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">
                                Describe what you want to create, and Aether will generate a live preview of your app.
                            </p>
                        </div>
                    )}

                    {messages.map((msg, index) => {
                        const style = getMessageStyles(msg.role);
                        const isLastAssistantMessage = msg.role === MessageRole.ASSISTANT &&
                            index === messages.length - 1;
                        const showAetherLabel = isFirstAssistantMessage(index);

                        return (
                            <React.Fragment key={msg.id}>
                                {/* User message - no avatar, right-aligned */}
                                {msg.role === MessageRole.USER && (
                                    <div className="flex flex-col items-end animate-in fade-in slide-in-from-bottom-2 duration-300 group/usermsg">
                                        {/* Inline Edit Card - styled like modal but inline */}
                                        {editingMessage?.id === msg.id ? (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.98 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden"
                                            >
                                                {/* Header */}
                                                <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
                                                    <h3 className="text-sm font-semibold text-white">Edit Message</h3>
                                                    <button
                                                        onClick={() => {
                                                            setEditingMessage(null);
                                                            setEditText('');
                                                        }}
                                                        className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                                                    >
                                                        <Icons.X size={16} />
                                                    </button>
                                                </div>

                                                {/* Content */}
                                                <div className="p-4">
                                                    <p className="text-xs text-zinc-500 mb-3">
                                                        Editing will remove all responses after this and regenerate.
                                                    </p>
                                                    <textarea
                                                        value={editText}
                                                        onChange={(e) => setEditText(e.target.value)}
                                                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-4 text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-aether-lime/50 min-h-[100px] max-h-[250px]"
                                                        placeholder="Edit your message..."
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Escape') {
                                                                setEditingMessage(null);
                                                                setEditText('');
                                                            }
                                                        }}
                                                    />
                                                </div>

                                                {/* Footer */}
                                                <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800 bg-zinc-900/50">
                                                    <button
                                                        onClick={() => {
                                                            setEditingMessage(null);
                                                            setEditText('');
                                                        }}
                                                        className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (editingMessage && editText.trim() && onEditMessage) {
                                                                onEditMessage(editingMessage.id, editText.trim());
                                                                setEditingMessage(null);
                                                                setEditText('');
                                                            }
                                                        }}
                                                        disabled={!editText.trim() || editText.trim() === msg.content}
                                                        className="px-3 py-1.5 text-xs font-bold bg-aether-lime text-black rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                                    >
                                                        <Icons.Refresh size={12} />
                                                        Revert & Send
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ) : (
                                            <>
                                                <div className={`px-8 py-3.5 text-sm leading-relaxed ${style.bubble}`}>
                                                    {msg.content}
                                                </div>
                                                {/* Action buttons - appear on hover, below message */}
                                                <div className="flex items-center gap-1 mt-1.5 -mb-4 opacity-0 group-hover/usermsg:opacity-100 transition-all">
                                                    {/* Edit button */}
                                                    <button
                                                        onClick={() => {
                                                            setEditingMessage({ id: msg.id, content: msg.content });
                                                            setEditText(msg.content);
                                                        }}
                                                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
                                                        title="Edit message"
                                                        disabled={isLoading}
                                                    >
                                                        <Icons.Edit size={16} />
                                                    </button>
                                                    {/* Copy button */}
                                                    <button
                                                        onClick={async () => {
                                                            await navigator.clipboard.writeText(msg.content);
                                                        }}
                                                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"
                                                        title="Copy message"
                                                    >
                                                        <Icons.Copy size={16} />
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* System message */}
                                {msg.role === MessageRole.SYSTEM && (
                                    <>
                                        {msg.isError ? (
                                            // Pass isFixing only for the last system error message when auto-fixing
                                            <SystemErrorCard
                                                error={msg.content}
                                                isFixing={isAutoFixing && isLoading && index === messages.length - 1}
                                            />
                                        ) : (
                                            <div className="flex animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                <div className={`max-w-[85%] p-3.5 text-sm leading-relaxed ${style.bubble}`}>
                                                    {msg.content}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* Assistant message - with Aether label on first message */}
                                {msg.role === MessageRole.ASSISTANT && (
                                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        {/* Aether label - only on first assistant message */}
                                        {showAetherLabel && (
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-base font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500">Aether</span>
                                            </div>
                                        )}
                                        {/* Thinking Time - only if available */}
                                        {msg.thinkingTime && (
                                            <div className="flex items-center gap-1.5 mb-2 text-xs text-zinc-500 font-mono">
                                                <Icons.Lightbulb size={12} />
                                                <span>Thought for {msg.thinkingTime}s</span>
                                            </div>
                                        )}

                                        {/* Message content */}
                                        <div className={`text-sm leading-relaxed ${style.bubble}`}>
                                            {msg.content}
                                        </div>

                                        {/* Show persisted actions for this message */}
                                        {msg.actions && msg.actions.length > 0 && (
                                            <div className="mt-3">
                                                <PersistedActionsCard actions={msg.actions} tokenCount={msg.tokenCount} />
                                            </div>
                                        )}

                                        {/* Show persisted build summary for this message */}
                                        {msg.buildSummary && (
                                            <div className="mt-3">
                                                <BuildSummaryCard summary={msg.buildSummary} />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}

                    {/* Live Generation - Plan and steps show during streaming */}
                    {isLoading && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Aether label - hidden during auto-fix */}
                            {!isAutoFixing && (
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-base font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500">Aether</span>
                                </div>
                            )}

                            {/* Thinking state - shows before build plan or file steps appear, hidden during auto-fix */}
                            {!isAutoFixing && !buildPlan && (generationSteps.length === 0 || (generationSteps.length === 1 && generationSteps[0].id === 'init')) && (
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-5 h-5 rounded-full border-2 border-aether-lime border-t-transparent animate-spin" />
                                    <span className="text-sm text-zinc-400 animate-pulse">Thinking...</span>
                                </div>
                            )}

                            {/* Build plan - shows as soon as streamed */}
                            {!isAutoFixing && buildPlan && (
                                <div className="text-sm text-zinc-300 leading-relaxed mb-4">
                                    {buildPlan}
                                </div>
                            )}

                            {/* Live file creation steps - only show when there are actual file steps */}
                            {generationSteps.length > 0 && !(generationSteps.length === 1 && generationSteps[0].id === 'init') && (
                                <div className="mt-3">
                                    {/* Header */}
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="relative flex items-center justify-center w-5 h-5">
                                            <div className="absolute w-2.5 h-2.5 bg-aether-lime rounded-full animate-ping opacity-75" />
                                            <div className="w-2 h-2 bg-aether-lime rounded-full" />
                                        </div>
                                        <span className="font-mono text-xs uppercase tracking-wider text-aether-lime font-bold">
                                            Building Project
                                        </span>
                                        <span className="text-zinc-600 text-xs font-mono">
                                            {generationSteps.filter(s => s.status === 'completed').length}/{generationSteps.length} files
                                        </span>
                                    </div>

                                    {/* Steps List */}
                                    <div className="space-y-1.5 max-h-[350px] overflow-y-auto custom-scrollbar">
                                        {generationSteps.map((step, index) => (
                                            <div key={step.id} className="flex items-center gap-3 py-2 text-xs font-mono">
                                                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                                                    {step.status === 'completed' ? (
                                                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                                            <Icons.Check size={12} strokeWidth={3} />
                                                        </div>
                                                    ) : step.status === 'in-progress' ? (
                                                        <div className="w-5 h-5 rounded-full border-2 border-aether-lime border-t-transparent animate-spin" />
                                                    ) : (
                                                        <div className="w-5 h-5 rounded-full border border-zinc-700 bg-zinc-900" />
                                                    )}
                                                </div>
                                                <span className={`flex-1 truncate ${step.status === 'completed' ? 'text-zinc-500' : step.status === 'in-progress' ? 'text-zinc-100' : 'text-zinc-600'}`}>
                                                    {step.label}
                                                </span>
                                                {step.lineCount && step.lineCount > 0 && (
                                                    <span className="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                                                        {step.lineCount} lines
                                                    </span>
                                                )}
                                                {step.status === 'in-progress' && (
                                                    <span className="text-[10px] text-aether-lime animate-pulse">
                                                        writing...
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Error Notification Card - Compact with expand */}
            <AnimatePresence>
                {pendingError && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="sticky bottom-[140px] mx-4 mb-2 z-10"
                    >
                        {/* Compact error bar */}
                        <div className="bg-red-950/90 backdrop-blur-sm border border-red-500/30 rounded-xl overflow-hidden shadow-lg">
                            {/* Main row - always visible */}
                            <div className="flex items-center justify-between p-3 gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="shrink-0 w-6 h-6 rounded-md bg-red-500/20 flex items-center justify-center">
                                        <Icons.AlertTriangle size={14} className="text-red-400" />
                                    </div>
                                    <span className="text-sm font-medium text-red-300 truncate">
                                        Runtime Error
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={onDismissError}
                                        className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-700/50 rounded-lg transition-colors"
                                        title="Dismiss"
                                    >
                                        <Icons.X size={14} />
                                    </button>
                                    <button
                                        onClick={() => onAutoFix && onAutoFix(pendingError)}
                                        className="px-3 py-1.5 text-xs font-bold text-black bg-aether-lime hover:bg-emerald-400 rounded-lg transition-colors flex items-center gap-1.5"
                                    >
                                        <Icons.Sparkles size={12} />
                                        Auto-fix
                                    </button>
                                </div>
                            </div>

                            {/* Error details - expandable (shown on hover or focus) */}
                            <div className="px-3 pb-3 pt-0">
                                <p className="text-[11px] text-red-400/70 font-mono line-clamp-1">
                                    {pendingError.length > 100 ? pendingError.substring(0, 100) + '...' : pendingError}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

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
                        <ModelSelector
                            selectedModel={selectedModel}
                            onSelectModel={(model) => onSelectModel?.(model)}
                            configuredProviders={configuredProviders}
                            disabled={isLoading}
                            onApiKeysClick={onApiKeysClick}
                            showDetailsPanel={false}
                        />
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
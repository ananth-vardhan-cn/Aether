import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from './ui/Icons';
import { GenerationStep } from '../types';

interface BuildPlanCardProps {
    plan: string;
}

/**
 * Displays the build plan at the start of generation
 */
export const BuildPlanCard: React.FC<BuildPlanCardProps> = ({ plan }) => {
    if (!plan) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-zinc-300 leading-relaxed"
        >
            {plan}
        </motion.div>
    );
};

interface ActionsCardProps {
    steps: GenerationStep[];
    isLoading: boolean;
}

/**
 * Collapsible actions list showing files created/modified
 */
export const ActionsCard: React.FC<ActionsCardProps> = ({ steps, isLoading }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    // Filter to only show file steps (not init/preview)
    const fileSteps = steps.filter(s => s.id !== 'init' && s.id !== 'preview');
    const completedCount = fileSteps.filter(s => s.status === 'completed').length;
    const totalCount = fileSteps.length;

    if (totalCount === 0 && !isLoading) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3"
        >
            {/* Header - Clickable to expand/collapse */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors w-full"
            >
                <motion.div
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <Icons.ChevronRight size={14} />
                </motion.div>

                {isLoading ? (
                    <div className="w-3 h-3 rounded-full border-2 border-aether-lime border-t-transparent animate-spin" />
                ) : (
                    <Icons.Check size={14} className="text-emerald-500" />
                )}

                <span className="font-mono">
                    {isLoading ? `${completedCount} action${completedCount !== 1 ? 's' : ''} taken` : `${completedCount} action${completedCount !== 1 ? 's' : ''} taken`}
                </span>
            </button>

            {/* Expandable content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-2 pl-5 space-y-1.5 border-l border-zinc-800">
                            {fileSteps.map((step) => {
                                const isCreating = step.label.startsWith('Creating');
                                return (
                                    <motion.div
                                        key={step.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex items-center gap-2 text-xs font-mono"
                                    >
                                        {step.status === 'completed' ? (
                                            <Icons.Check size={12} className="text-emerald-500 shrink-0" />
                                        ) : (
                                            <div className="w-3 h-3 rounded-full border-2 border-aether-lime border-t-transparent animate-spin shrink-0" />
                                        )}
                                        <span className="text-zinc-500">
                                            {isCreating ? 'Wrote' : 'Edited'}
                                        </span>
                                        <span className={`px-1.5 py-0.5 rounded ${step.status === 'completed' ? 'bg-zinc-800/50 text-zinc-400' : 'bg-aether-lime/10 text-aether-lime'}`}>
                                            {step.id}
                                        </span>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

interface BuildSummaryCardProps {
    summary: string;
}

/**
 * Displays the build summary at the end of generation
 * Parses bullet points (• ) and renders them on separate lines
 */
export const BuildSummaryCard: React.FC<BuildSummaryCardProps> = ({ summary }) => {
    if (!summary) return null;

    // Split by bullet points to render separately
    const parts = summary.split(/(?=• )/);
    const intro = parts[0]?.trim();
    const bullets = parts.slice(1).map(b => b.trim());

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-zinc-300 leading-relaxed"
        >
            {/* Intro text */}
            {intro && <p className="mb-2">{intro}</p>}

            {/* Bullet points */}
            {bullets.length > 0 && (
                <ul className="space-y-1 text-zinc-400">
                    {bullets.map((bullet, i) => {
                        // Parse markdown bold (**text**) into styled spans
                        const text = bullet.replace(/^• /, '');
                        const parts = text.split(/(\*\*[^*]+\*\*)/g);

                        return (
                            <li key={i} className="flex items-start gap-2">
                                <span className="text-aether-lime shrink-0">•</span>
                                <span>
                                    {parts.map((part, j) => {
                                        if (part.startsWith('**') && part.endsWith('**')) {
                                            return <strong key={j} className="text-zinc-200 font-semibold">{part.slice(2, -2)}</strong>;
                                        }
                                        return <span key={j}>{part}</span>;
                                    })}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </motion.div>
    );
};

interface PersistedActionsCardProps {
    actions: { fileName: string; lineCount: number }[];
    tokenCount?: number;
}

/**
 * Displays persisted actions (file names with line counts) that were saved with the message
 * Used for showing actions after page reload when generationSteps are no longer available
 */
export const PersistedActionsCard: React.FC<PersistedActionsCardProps> = ({ actions, tokenCount }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!actions || actions.length === 0) return null;

    // Format token count for display (e.g., 1234 -> "1.2K", 12345 -> "12.3K")
    const formatTokens = (tokens: number) => {
        if (tokens >= 1000) {
            return `${(tokens / 1000).toFixed(1)}K`;
        }
        return tokens.toString();
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
        >
            {/* Header - Clickable to expand/collapse */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors w-full"
            >
                <motion.div
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <Icons.ChevronRight size={14} />
                </motion.div>

                <Icons.Check size={14} className="text-emerald-500" />

                <span className="font-mono">
                    {actions.length} action{actions.length !== 1 ? 's' : ''} taken
                </span>

                {/* Token count on the right */}
                {tokenCount && tokenCount > 0 && (
                    <>
                        <span className="text-zinc-700 mx-1">•</span>
                        <span className="font-mono text-zinc-600">
                            {formatTokens(tokenCount)} tokens
                        </span>
                    </>
                )}
            </button>

            {/* Expandable content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-2 pl-5 space-y-1.5 border-l border-zinc-800">
                            {actions.map((action) => (
                                <motion.div
                                    key={typeof action === 'string' ? action : action.fileName}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center gap-2 text-xs font-mono"
                                >
                                    <Icons.Check size={12} className="text-emerald-500 shrink-0" />
                                    <span className="text-zinc-500">Wrote</span>
                                    <span className="px-1.5 py-0.5 rounded bg-zinc-800/50 text-zinc-400">
                                        {typeof action === 'string' ? action : action.fileName}
                                    </span>
                                    {/* Line count badge */}
                                    {typeof action !== 'string' && action.lineCount > 0 && (
                                        <span className="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                                            {action.lineCount} lines
                                        </span>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

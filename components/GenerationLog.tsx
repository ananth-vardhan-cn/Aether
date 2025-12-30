import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GenerationStep } from '../types';
import { Icons } from './ui/Icons';

interface GenerationLogProps {
    steps: GenerationStep[];
    isVisible: boolean;
}

/**
 * GenerationLog Component
 * Displays real-time file creation progress during AI generation
 * Similar to Replit/Lovable/Bolt file creation logs
 */
export const GenerationLog: React.FC<GenerationLogProps> = ({ steps, isVisible }) => {
    if (!isVisible || steps.length === 0) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="animate-in fade-in"
        >
            {/* Aether label */}
            <div className="flex items-center gap-2 mb-3">
                <span className="text-base font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500">Aether</span>
            </div>

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
                    {steps.filter(s => s.status === 'completed').length}/{steps.length} files
                </span>
            </div>

            {/* Steps List */}
            <div className="space-y-1.5 max-h-[350px] overflow-y-auto custom-scrollbar">
                <AnimatePresence mode="popLayout">
                    {steps.map((step, index) => (
                        <GenerationStepItem key={step.id} step={step} index={index} />
                    ))}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

/**
 * Individual step item component
 */
const GenerationStepItem: React.FC<{ step: GenerationStep; index: number }> = ({ step, index }) => {
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ delay: index * 0.05, duration: 0.2 }}
            className="flex items-center gap-3 py-2 text-xs font-mono"
        >
            {/* Status Indicator */}
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
                {step.status === 'completed' ? (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400"
                    >
                        <Icons.Check size={12} strokeWidth={3} />
                    </motion.div>
                ) : step.status === 'in-progress' ? (
                    <div className="w-5 h-5 rounded-full border-2 border-aether-lime border-t-transparent animate-spin" />
                ) : (
                    <div className="w-5 h-5 rounded-full border border-zinc-700 bg-zinc-900" />
                )}
            </div>

            {/* Label */}
            <span className={`
                flex-1 truncate
                ${step.status === 'completed' ? 'text-zinc-500' : ''}
                ${step.status === 'in-progress' ? 'text-zinc-100' : ''}
                ${step.status === 'pending' ? 'text-zinc-600' : ''}
            `}>
                {step.label}
            </span>

            {/* Line count badge (if available) */}
            {step.lineCount && step.lineCount > 0 && (
                <span className="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                    {step.lineCount} lines
                </span>
            )}

            {/* In-progress indicator */}
            {step.status === 'in-progress' && (
                <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="text-[10px] text-aether-lime"
                >
                    writing...
                </motion.span>
            )}
        </motion.div>
    );
};

export default GenerationLog;

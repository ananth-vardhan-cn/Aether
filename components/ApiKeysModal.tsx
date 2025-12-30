import React, { useState } from 'react';
import { Icons } from './ui/Icons';
import { useApiKeys, AIProvider } from '../hooks/useApiKeys';
import { motion, AnimatePresence } from 'framer-motion';
import { ProviderLogo } from './ModelSelector';

interface ApiKeysModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PROVIDERS: { id: AIProvider; name: string; placeholder: string }[] = [
    {
        id: 'gemini',
        name: 'Google Gemini',
        placeholder: 'AIza...',
    },
    {
        id: 'anthropic',
        name: 'Anthropic Claude',
        placeholder: 'sk-ant-...',
    },
    {
        id: 'openai',
        name: 'OpenAI',
        placeholder: 'sk-...',
    },
];

export function ApiKeysModal({ isOpen, onClose }: ApiKeysModalProps) {
    const { configured, loading, error, saveApiKey, deleteApiKey } = useApiKeys();
    const [inputs, setInputs] = useState<Record<AIProvider, string>>({
        gemini: '',
        anthropic: '',
        openai: '',
    });
    const [savingProvider, setSavingProvider] = useState<AIProvider | null>(null);
    const [focusedProvider, setFocusedProvider] = useState<AIProvider | null>(null);

    const handleSave = async (provider: AIProvider) => {
        const key = inputs[provider].trim();
        if (!key) return;

        setSavingProvider(provider);
        const success = await saveApiKey(provider, key);
        if (success) {
            setInputs(prev => ({ ...prev, [provider]: '' }));
        }
        setSavingProvider(null);
    };

    const handleDelete = async (provider: AIProvider) => {
        setSavingProvider(provider);
        await deleteApiKey(provider);
        setSavingProvider(null);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 10 }}
                    transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
                    className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative group"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Subtle top highlight */}
                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-zinc-500 to-transparent" />

                    {/* Header */}
                    <div className="px-6 py-6 pb-2 flex items-start justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
                                <Icons.Key className="w-5 h-5 text-zinc-400" />
                                API Keys
                            </h2>
                            <p className="text-sm text-zinc-400 mt-1">
                                Configure providers to unlock premium models.
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 -mr-2 -mt-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-500 hover:text-white"
                        >
                            <Icons.X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4">
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-xs flex items-center gap-2"
                            >
                                <Icons.AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </motion.div>
                        )}

                        <div className="space-y-3">
                            {PROVIDERS.map((provider) => (
                                <div
                                    key={provider.id}
                                    className={`
                                        relative overflow-hidden rounded-xl border transition-all duration-300
                                        ${focusedProvider === provider.id || inputs[provider.id]
                                            ? 'bg-zinc-800 border-zinc-600 shadow-lg'
                                            : 'bg-zinc-800/70 border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800'
                                        }
                                    `}
                                >
                                    <div className="p-4 flex items-center gap-4">
                                        {/* Logo Container */}
                                        <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center shrink-0 shadow-sm">
                                            <ProviderLogo provider={provider.id} size={20} />
                                        </div>

                                        {/* Info & Input */}
                                        <div className="flex-1 min-w-0 flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-zinc-200">{provider.name}</span>

                                                {configured[provider.id] && (
                                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/10">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)] animate-pulse" />
                                                        <span className="text-[10px] font-medium text-emerald-500">Active</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="relative flex-1 group/input">
                                                    <input
                                                        type="password"
                                                        value={inputs[provider.id]}
                                                        onFocus={() => setFocusedProvider(provider.id)}
                                                        onBlur={() => setFocusedProvider(null)}
                                                        onChange={(e) => setInputs(prev => ({ ...prev, [provider.id]: e.target.value }))}
                                                        placeholder={configured[provider.id] ? '••••••••••••••••••••••••' : `Enter ${provider.name} API Key`}
                                                        className={`
                                                            w-full bg-zinc-900 border rounded-lg px-3 py-2.5 text-sm text-white font-mono
                                                            placeholder:text-zinc-500 focus:outline-none transition-all duration-200
                                                            ${inputs[provider.id] ? 'border-zinc-600' : 'border-zinc-700 group-hover/input:border-zinc-600'}
                                                            focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30
                                                        `}
                                                    />
                                                    <Icons.Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                                                </div>

                                                <AnimatePresence mode="wait">
                                                    {configured[provider.id] && !inputs[provider.id] ? (
                                                        <motion.button
                                                            initial={{ opacity: 0, scale: 0.9 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            exit={{ opacity: 0, scale: 0.9 }}
                                                            onClick={() => handleDelete(provider.id)}
                                                            className="p-2.5 rounded-lg bg-zinc-800 hover:bg-red-500/20 text-zinc-300 hover:text-red-400 border border-zinc-700 hover:border-red-500/30 transition-all"
                                                            title="Delete Key"
                                                        >
                                                            <Icons.Trash className="w-3.5 h-3.5" />
                                                        </motion.button>
                                                    ) : (
                                                        <motion.button
                                                            initial={{ opacity: 0, scale: 0.9 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            exit={{ opacity: 0, scale: 0.9 }}
                                                            onClick={() => handleSave(provider.id)}
                                                            disabled={loading || !inputs[provider.id].trim()}
                                                            className={`
                                                                px-4 py-2 rounded-lg text-xs font-medium transition-all shadow-sm
                                                                ${inputs[provider.id].trim()
                                                                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
                                                                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-800'}
                                                            `}
                                                        >
                                                            {savingProvider === provider.id ? (
                                                                <Icons.Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            ) : (
                                                                'Save'
                                                            )}
                                                        </motion.button>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-black/20 border-t border-zinc-800/50 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                            <Icons.Shield className="w-3 h-3" />
                            <span>End-to-end encrypted storage</span>
                        </div>
                        <a
                            href="https://aether.ai/docs/keys"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
                        >
                            Need help?
                            <Icons.ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

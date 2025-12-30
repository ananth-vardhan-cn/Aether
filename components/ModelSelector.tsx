import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AIModel, AI_MODELS, AIProvider } from '../types';
import { Icons } from './ui/Icons';
import { createPortal } from 'react-dom';

// ============== SHARED COMPONENTS ==============

// Provider Logo Component using actual image files
export const ProviderLogo = ({ provider, size = 16 }: { provider: AIProvider; size?: number }) => {
    const logoMap: Record<AIProvider, string> = {
        gemini: '/images/gemini.jpg',
        anthropic: '/images/claude-logo-png_seeklogo-554534.png',
        openai: '/images/chatgpt.png'
    };

    return (
        <img
            src={logoMap[provider]}
            alt={`${provider} logo`}
            width={size}
            height={size}
            className="rounded-sm object-contain"
        />
    );
};

// Metric Bar Component for details panel
const MetricBar = ({ value, label }: { value: number; label: string }) => (
    <div className="flex items-center justify-between gap-4 text-xs group/metric">
        <span className="text-zinc-500 font-medium w-20">{label}</span>
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((level) => (
                <div
                    key={level}
                    className={`h-1.5 rounded-full transition-all duration-300 w-5 ${level <= value
                        ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                        : 'bg-zinc-800'
                        }`}
                />
            ))}
        </div>
    </div>
);

// ============== MODEL DETAILS CARD ==============

interface ModelDetailsCardProps {
    model: AIModel;
    isConfigured: boolean;
}

export const ModelDetailsCard: React.FC<ModelDetailsCardProps> = ({ model, isConfigured }) => (
    <motion.div
        key={model.id}
        initial={{ opacity: 0, x: -10, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -10, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="w-[340px] bg-[#1a1a1a] border border-zinc-800 rounded-xl shadow-2xl p-4 flex flex-col gap-2.5 pointer-events-auto"
    >
        {/* Compact Header */}
        <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${model.provider === 'gemini' ? 'bg-blue-500/10' :
                model.provider === 'anthropic' ? 'bg-orange-500/10' :
                    'bg-zinc-800'
                }`}>
                <ProviderLogo provider={model.provider} size={14} />
            </div>
            <h3 className="text-sm font-bold text-white">{model.name}</h3>
        </div>

        {/* Capabilities - Comma separated */}
        {model.capabilities && (
            <p className="text-xs text-zinc-300 leading-relaxed">
                {model.capabilities.join(', ')}
            </p>
        )}

        {/* Metrics */}
        {model.metrics && (
            <div className="space-y-2.5 bg-zinc-900/30 p-3 rounded-lg border border-white/5">
                <MetricBar value={model.metrics.speed} label="Speed" />
                <MetricBar value={model.metrics.intelligence} label="Intelligence" />
                <MetricBar value={model.metrics.context} label="Context" />
            </div>
        )}

        {/* Warning */}
        {!isConfigured && (
            <div className="mt-auto bg-zinc-800/50 border border-zinc-700 rounded-lg p-2.5 flex items-start gap-2">
                <Icons.Lock size={14} className="text-zinc-400 shrink-0 mt-0.5" />
                <p className="text-xs text-zinc-300">
                    Provider not configured. Click "Configure Keys" to enable.
                </p>
            </div>
        )}
    </motion.div>
);

// ============== MODEL DROPDOWN ==============

interface ModelDropdownProps {
    selectedModel?: AIModel;
    onSelectModel: (model: AIModel) => void;
    configuredProviders: Record<AIProvider, boolean>;
    onApiKeysClick?: () => void;
    onHoverModel?: (model: AIModel | null) => void;
    menuPosition: { top: number; left: number };
    onClose: () => void;
}

export const ModelDropdown: React.FC<ModelDropdownProps> = ({
    selectedModel,
    onSelectModel,
    configuredProviders,
    onApiKeysClick,
    onHoverModel,
    menuPosition,
    onClose
}) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.15 }}
        className="w-[230px] bg-[#1a1a1a] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto"
        onMouseLeave={() => onHoverModel?.(null)}
    >
        {/* Provider Name Header */}
        <div className="px-3 py-2 bg-zinc-900/50">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                {selectedModel?.provider === 'gemini' ? 'Google Gemini' :
                    selectedModel?.provider === 'anthropic' ? 'Claude' :
                        selectedModel?.provider === 'openai' ? 'OpenAI' : 'Select Provider'}
            </span>
        </div>
        <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-1">
            {AI_MODELS.map((model, index) => {
                const isProviderConfigured = configuredProviders[model.provider];
                const prevModel = index > 0 ? AI_MODELS[index - 1] : null;
                const showDivider = prevModel && prevModel.provider !== model.provider;


                return (
                    <React.Fragment key={model.id}>
                        {/* Provider divider */}
                        {showDivider && (
                            <div className="my-1.5 mx-1 border-t border-zinc-700" />
                        )}

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isProviderConfigured) {
                                    onSelectModel(model);
                                    onClose();
                                } else {
                                    if (onApiKeysClick) {
                                        onClose();
                                        onApiKeysClick();
                                    }
                                }
                            }}
                            onMouseEnter={() => onHoverModel?.(model)}
                            className={`w-full px-2 py-1.5 flex items-center gap-2.5 transition-colors text-left relative group rounded-lg ${selectedModel?.id === model.id && isProviderConfigured
                                ? 'bg-zinc-800/80'
                                : 'hover:bg-zinc-800/50'
                                } ${!isProviderConfigured ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {/* Provider Logo */}
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${selectedModel?.id === model.id
                                ? 'bg-zinc-700'
                                : 'bg-zinc-900 group-hover:bg-zinc-800'
                                }`}>
                                <ProviderLogo provider={model.provider} size={14} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <span className={`text-sm font-medium truncate ${selectedModel?.id === model.id ? 'text-white' : 'text-zinc-300'
                                    }`}>
                                    {model.name}
                                </span>
                            </div>

                            {/* Right side: Active badge or Lock icon */}
                            {selectedModel?.id === model.id ? (
                                <span className="text-[9px] font-bold bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">
                                    ACTIVE
                                </span>
                            ) : !isProviderConfigured && (
                                <Icons.Lock size={12} className="text-zinc-600" />
                            )}
                        </button>
                    </React.Fragment>
                );
            })}
        </div>

        <div className="p-2 border-t border-zinc-800 bg-zinc-900/50">
            <button
                onClick={() => {
                    if (onApiKeysClick) {
                        onClose();
                        onApiKeysClick();
                    }
                }}
                className="w-full py-2.5 px-3 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-blue-500/50 hover:bg-zinc-700 text-xs text-zinc-200 font-medium hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm"
            >
                <Icons.Settings size={12} />
                <span>Configure Keys</span>
            </button>
        </div>
    </motion.div>
);

// ============== MAIN MODEL SELECTOR (Composed from above) ==============

interface ModelSelectorProps {
    selectedModel?: AIModel;
    onSelectModel: (model: AIModel) => void;
    configuredProviders: Record<AIProvider, boolean>;
    disabled?: boolean;
    onApiKeysClick?: () => void;
    showDetailsPanel?: boolean; // Show explanation card on hover
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
    selectedModel,
    onSelectModel,
    configuredProviders,
    disabled = false,
    onApiKeysClick,
    showDetailsPanel = true
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [hoveredModel, setHoveredModel] = useState<AIModel | null>(null);
    const [showDisabledTooltip, setShowDisabledTooltip] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

    // Calculate menu position to open upwards
    useEffect(() => {
        if (isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setMenuPosition({
                top: rect.top - 10, // Slight gap
                left: rect.left
            });
            // Reset hovered model when menu opens
            setHoveredModel(null);
        }
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                // Check if clicking inside the portal menu (which is not a child in DOM tree)
                const portalMenu = document.getElementById('model-selector-portal');
                if (portalMenu && !portalMenu.contains(event.target as Node)) {
                    setIsOpen(false);
                }
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative" ref={containerRef}>
            <div
                className="relative"
                onMouseEnter={() => disabled && setShowDisabledTooltip(true)}
                onMouseLeave={() => setShowDisabledTooltip(false)}
            >
                <button
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200 ${isOpen
                        ? 'bg-zinc-800 border-zinc-700 text-white'
                        : 'bg-zinc-900/50 border-transparent hover:border-zinc-700 text-zinc-300 hover:text-white'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {selectedModel && <ProviderLogo provider={selectedModel.provider} size={14} />}

                    <span className="text-sm font-medium">{selectedModel?.name || 'Select Model'}</span>
                    <Icons.ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Disabled Tooltip */}
                <AnimatePresence>
                    {showDisabledTooltip && disabled && (
                        <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            transition={{ duration: 0.15 }}
                            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl whitespace-nowrap z-50"
                        >
                            <span className="text-xs text-zinc-300">Model switching unavailable during generation</span>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                                <div className="w-2 h-2 bg-zinc-800 border-r border-b border-zinc-700 rotate-45 -translate-y-1"></div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Portal the menu to avoid clipping/z-index issues */}
            {isOpen && menuPosition && createPortal(
                <div
                    id="model-selector-portal"
                    className="fixed inset-0 z-[9999] pointer-events-none"
                    style={{ zIndex: 9999 }}
                >
                    <div className="absolute inset-0 pointer-events-auto" onClick={() => setIsOpen(false)} />

                    <div
                        className="absolute pointer-events-auto flex items-end gap-2"
                        style={{
                            top: menuPosition.top,
                            left: menuPosition.left,
                            transform: 'translateY(-100%)'
                        }}
                    >
                        {/* Model Dropdown */}
                        <ModelDropdown
                            selectedModel={selectedModel}
                            onSelectModel={onSelectModel}
                            configuredProviders={configuredProviders}
                            onApiKeysClick={onApiKeysClick}
                            onHoverModel={showDetailsPanel ? setHoveredModel : undefined}
                            menuPosition={menuPosition}
                            onClose={() => setIsOpen(false)}
                        />

                        {/* Details Panel - Only when showDetailsPanel is true */}
                        <AnimatePresence mode="wait">
                            {showDetailsPanel && hoveredModel && isOpen && (
                                <ModelDetailsCard
                                    model={hoveredModel}
                                    isConfigured={configuredProviders[hoveredModel.provider]}
                                />
                            )}
                        </AnimatePresence>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

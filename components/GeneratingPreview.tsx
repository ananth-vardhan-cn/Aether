import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from './ui/Logo';
import { Icons } from './ui/Icons';

const features = [
    {
        icon: 'sparkles',
        title: 'AI-Powered Generation',
        description: 'Describe your app in natural language and watch Aether bring it to life with clean, production-ready React code.'
    },
    {
        icon: 'code',
        title: 'Modern Tech Stack',
        description: 'Built with React, TypeScript, and Tailwind CSS. Your apps are fast, responsive, and follow best practices.'
    },
    {
        icon: 'zap',
        title: 'Instant Preview',
        description: 'See your changes in real-time with live preview. Iterate quickly and get instant feedback on your designs.'
    },
    {
        icon: 'logo',
        title: 'GitHub Integration',
        description: 'Sync your projects directly to GitHub with one click. Version control made simple.'
    },
    {
        icon: 'history',
        title: 'Version History',
        description: 'Never lose your work. Browse and restore any previous version of your project with ease.'
    },
    {
        icon: 'share',
        title: 'Share & Collaborate',
        description: 'Share your creations with a single link. Let others view and explore your work.'
    },
    {
        icon: 'download',
        title: 'Export Anywhere',
        description: 'Download your complete project as a ZIP file. Your code is yours to deploy and customize.'
    },
];

const getIcon = (iconType: string) => {
    const iconClass = "w-10 h-10 text-aether-lime drop-shadow-[0_0_8px_rgba(163,230,53,0.5)]";
    switch (iconType) {
        case 'code':
            return <Icons.Code className={iconClass} />;
        case 'sparkles':
            return <Icons.Sparkles className={iconClass} />;
        case 'zap':
            return <Icons.Zap className={iconClass} />;
        case 'history':
            return <Icons.History className={iconClass} />;
        case 'share':
            return <Icons.Share className={iconClass} />;
        case 'download':
            return <Icons.Download className={iconClass} />;
        default:
            return <Logo className="w-10 h-10" />;
    }
};

// Card positions in the fan/stack
const getCardStyle = (index: number, total: number, currentIndex: number) => {
    let relativePos = index - currentIndex;

    if (relativePos > total / 2) relativePos -= total;
    if (relativePos < -total / 2) relativePos += total;

    const isVisible = Math.abs(relativePos) <= 2;
    const rotation = relativePos * 8;
    const translateX = relativePos * 20;
    const scale = 1 - Math.abs(relativePos) * 0.08;
    const zIndex = 10 - Math.abs(relativePos);
    const opacity = relativePos === 0 ? 1 : Math.max(0.3, 0.7 - Math.abs(relativePos) * 0.2);

    return { rotation, translateX, scale, zIndex, opacity, isVisible, isFront: relativePos === 0 };
};

export const GeneratingPreview: React.FC = () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        if (isPaused) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % features.length);
        }, 6800); // Increased by 70% (4000 * 1.7)
        return () => clearInterval(interval);
    }, [isPaused]);

    const goNext = () => {
        setCurrentIndex((prev) => (prev + 1) % features.length);
    };

    const goPrev = () => {
        setCurrentIndex((prev) => (prev - 1 + features.length) % features.length);
    };

    const currentFeature = features[currentIndex];

    return (
        <div
            className="h-full flex flex-col items-center justify-center px-6"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Card Stack with Navigation */}
            <div className="relative flex items-center gap-4">
                {/* Left Arrow */}
                <button
                    onClick={goPrev}
                    className="w-10 h-10 rounded-full bg-zinc-800/50 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 hover:border-zinc-600 transition-all"
                >
                    <Icons.ChevronLeft size={20} />
                </button>

                {/* Card Stack Container */}
                <div className="relative w-72 h-64 flex items-center justify-center">
                    {features.map((feature, index) => {
                        const style = getCardStyle(index, features.length, currentIndex);

                        if (!style.isVisible) return null;

                        return (
                            <motion.div
                                key={index}
                                className="absolute w-56 h-56 rounded-2xl border bg-zinc-900 flex flex-col items-center justify-center p-6"
                                initial={false}
                                animate={{
                                    rotate: style.rotation,
                                    x: style.translateX,
                                    scale: style.scale,
                                    opacity: style.opacity,
                                    zIndex: style.zIndex,
                                    borderColor: style.isFront
                                        ? 'rgba(113, 113, 122, 0.8)'
                                        : 'rgba(113, 113, 122, 0.6)',
                                }}
                                transition={{
                                    type: 'spring',
                                    stiffness: 300,
                                    damping: 30,
                                }}
                                style={{ transformOrigin: 'bottom center', zIndex: style.zIndex }}
                            >
                                {style.isFront && (
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={currentIndex}
                                            className="flex flex-col items-center"
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            transition={{ duration: 0.3, delay: 0.15 }}
                                        >
                                            <div className="w-20 h-20 rounded-xl border border-aether-lime/20 bg-aether-lime/5 flex items-center justify-center shadow-[0_0_30px_rgba(163,230,53,0.1)]">
                                                {getIcon(feature.icon)}
                                            </div>
                                            <h3 className="text-lg font-bold text-white text-center mt-5">
                                                {feature.title}
                                            </h3>
                                        </motion.div>
                                    </AnimatePresence>
                                )}
                            </motion.div>
                        );
                    })}
                </div>

                {/* Right Arrow */}
                <button
                    onClick={goNext}
                    className="w-10 h-10 rounded-full bg-zinc-800/50 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 hover:border-zinc-600 transition-all"
                >
                    <Icons.ChevronRight size={20} />
                </button>
            </div>

            {/* Description text OUTSIDE the cards */}
            <div className="h-20 flex items-start justify-center mt-6">
                <AnimatePresence mode="wait">
                    <motion.p
                        key={currentIndex}
                        className="text-zinc-400 text-sm text-center max-w-sm leading-relaxed"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                    >
                        {currentFeature.description}
                    </motion.p>
                </AnimatePresence>
            </div>

            {/* Progress dots */}
            <div className="flex gap-2 mt-2">
                {features.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => setCurrentIndex(index)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${index === currentIndex ? 'bg-aether-lime w-4' : 'bg-zinc-700 w-1.5 hover:bg-zinc-600'
                            }`}
                    />
                ))}
            </div>
        </div>
    );
};

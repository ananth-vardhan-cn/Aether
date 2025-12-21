import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <defs>
                <linearGradient id="aether-gradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#D9F99D" /> {/* lime-200 */}
                    <stop offset="50%" stopColor="#84CC16" /> {/* lime-500 */}
                    <stop offset="100%" stopColor="#3F6212" /> {/* lime-800 */}
                </linearGradient>
            </defs>
            <path
                d="M12 2L2 19H7L12 10L17 19H22L12 2Z"
                fill="url(#aether-gradient)"
                className="drop-shadow-[0_0_8px_rgba(132,204,22,0.5)]"
            />
            <path
                d="M12 14L9 19H15L12 14Z"
                fill="#09090b" // Match bg-zinc-950
            />
        </svg>
    );
};

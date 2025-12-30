/**
 * File Utilities
 * Centralized utilities for file type detection and icon mapping
 */

import { GenerationStep } from '../types';

/**
 * Get emoji icon for a file based on its extension
 */
export const getFileIcon = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'tsx':
        case 'ts':
            return '📄';
        case 'jsx':
        case 'js':
            return '📜';
        case 'css':
            return '🎨';
        case 'json':
            return '⚙️';
        case 'html':
        case 'htm':
            return '📝';
        case 'md':
            return '📖';
        default:
            return '📁';
    }
};

/**
 * Get file type category for a file based on its extension
 */
export const getFileType = (filename: string): GenerationStep['fileType'] => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'tsx':
        case 'ts':
        case 'jsx':
        case 'js':
            return 'tsx';
        case 'css':
            return 'css';
        case 'json':
            return 'json';
        case 'html':
        case 'htm':
            return 'html';
        default:
            return 'other';
    }
};

/**
 * Get a display-friendly filename (basename only)
 */
export const getDisplayName = (filepath: string): string => {
    return filepath.split('/').pop() || filepath;
};

/**
 * Count lines in a string
 */
export const countLines = (content: string): number => {
    if (!content) return 0;
    return (content.match(/\n/g) || []).length + 1;
};

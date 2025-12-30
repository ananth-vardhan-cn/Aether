/**
 * Extracts npm package dependencies from source code by parsing import/require statements.
 * This enables Sandpack to dynamically install any packages used in AI-generated code.
 */

import { File } from '../types';

// Base dependencies that are always included (essential for React + Tailwind)
const BASE_DEPENDENCIES: Record<string, string> = {
    // Tailwind essentials
    "tailwindcss": "^3.3.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "tailwindcss-animate": "^1.0.7",
};

// Common React ecosystem packages with known stable versions
// These are suggested versions when detected - prevents version conflicts
const KNOWN_VERSIONS: Record<string, string> = {
    // Icons
    "lucide-react": "^0.263.1",
    "react-icons": "^4.12.0",
    "@heroicons/react": "^2.1.1",

    // Animation
    "framer-motion": "^10.18.0",
    "gsap": "^3.12.0",
    "@react-spring/web": "^9.7.0",

    // Utilities
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "class-variance-authority": "^0.7.0",
    "date-fns": "^3.0.0",
    "dayjs": "^1.11.0",
    "lodash": "^4.17.0",
    "uuid": "^9.0.0",

    // Routing
    "react-router-dom": "^6.21.0",

    // UI Libraries
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-tooltip": "^1.0.7",
    "@radix-ui/react-accordion": "^1.1.2",
    "@radix-ui/react-switch": "^1.0.3",
    "@radix-ui/react-slider": "^1.1.2",
    "@radix-ui/react-checkbox": "^1.0.4",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-popover": "^1.0.7",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-avatar": "^1.0.4",
    "@radix-ui/react-progress": "^1.0.3",
    "@radix-ui/react-scroll-area": "^1.0.5",
    "@radix-ui/react-separator": "^1.0.3",
    "@radix-ui/react-toggle": "^1.0.3",
    "@radix-ui/react-toggle-group": "^1.0.4",
    "@headlessui/react": "^1.7.0",

    // Charts & Visualization
    "recharts": "^2.10.0",
    "chart.js": "^4.4.0",
    "react-chartjs-2": "^5.2.0",
    "d3": "^7.8.0",
    "victory": "^36.0.0",

    // Forms
    "react-hook-form": "^7.49.0",
    "zod": "^3.22.0",
    "@hookform/resolvers": "^3.3.0",
    "formik": "^2.4.0",
    "yup": "^1.3.0",

    // HTTP & Data
    "axios": "^1.6.0",
    "swr": "^2.2.0",
    "@tanstack/react-query": "^5.17.0",
    "ky": "^1.2.0",

    // State Management
    "zustand": "^4.4.0",
    "jotai": "^2.6.0",
    "recoil": "^0.7.0",
    "@reduxjs/toolkit": "^2.0.0",
    "react-redux": "^9.0.0",

    // 3D & Graphics - Using React 19 compatible versions (alpha/canary)
    // IMPORTANT: Stable versions don't work with React 19, causes ReactCurrentOwner error
    "three": "^0.170.0",
    "@react-three/fiber": "^9.0.0-alpha.4",
    "@react-three/drei": "^9.120.0",
    "@react-three/postprocessing": "^2.16.0",
    "leva": "^0.9.0",

    // Maps
    "mapbox-gl": "^3.0.0",
    "react-map-gl": "^7.1.0",
    "leaflet": "^1.9.0",
    "react-leaflet": "^4.2.0",

    // Markdown & Rich Text
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0",
    "@tiptap/react": "^2.1.0",
    "@tiptap/starter-kit": "^2.1.0",

    // Media
    "react-player": "^2.14.0",
    "react-dropzone": "^14.2.0",

    // Misc
    "react-hot-toast": "^2.4.0",
    "sonner": "^1.3.0",
    "react-toastify": "^9.1.0",
    "embla-carousel-react": "^8.0.0",
    "swiper": "^11.0.0",
    "react-slick": "^0.29.0",
    "cmdk": "^0.2.0",
    "vaul": "^0.8.0",
    "input-otp": "^1.2.0",
    "next-themes": "^0.2.0",
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "react-beautiful-dnd": "^13.1.0",
};

// Packages that should never be included (built-in or cause issues)
const EXCLUDED_PACKAGES = new Set([
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react-dom/client',
    // Node built-ins
    'fs', 'path', 'http', 'https', 'url', 'crypto', 'stream', 'buffer', 'util',
    'os', 'child_process', 'events', 'querystring', 'assert', 'zlib',
]);

/**
 * Extracts package names from import statements in source code
 */
function extractImportsFromCode(code: string): Set<string> {
    const packages = new Set<string>();

    // Match ES6 imports: import X from 'package' or import 'package'
    const esImportRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g;

    // Match dynamic imports: import('package')
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    // Match require statements: require('package')
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    let match;

    // Extract ES6 imports
    while ((match = esImportRegex.exec(code)) !== null) {
        const importPath = match[1];
        const packageName = getPackageName(importPath);
        if (packageName) packages.add(packageName);
    }

    // Extract dynamic imports
    while ((match = dynamicImportRegex.exec(code)) !== null) {
        const importPath = match[1];
        const packageName = getPackageName(importPath);
        if (packageName) packages.add(packageName);
    }

    // Extract require statements
    while ((match = requireRegex.exec(code)) !== null) {
        const importPath = match[1];
        const packageName = getPackageName(importPath);
        if (packageName) packages.add(packageName);
    }

    return packages;
}

/**
 * Extracts the npm package name from an import path
 * Handles scoped packages (@org/package) and subpath imports
 */
function getPackageName(importPath: string): string | null {
    // Skip relative imports
    if (importPath.startsWith('.') || importPath.startsWith('/')) {
        return null;
    }

    // Skip excluded packages
    if (EXCLUDED_PACKAGES.has(importPath)) {
        return null;
    }

    // Handle scoped packages (@org/package)
    if (importPath.startsWith('@')) {
        const parts = importPath.split('/');
        if (parts.length >= 2) {
            const scopedName = `${parts[0]}/${parts[1]}`;
            return EXCLUDED_PACKAGES.has(scopedName) ? null : scopedName;
        }
        return null;
    }

    // Regular package - get the base package name
    const packageName = importPath.split('/')[0];
    return EXCLUDED_PACKAGES.has(packageName) ? null : packageName;
}

/**
 * Main function: Extracts all dependencies from an array of files
 * Returns a Record of package names to versions for Sandpack
 */
export function extractDependencies(files: File[]): Record<string, string> {
    const allPackages = new Set<string>();

    // Parse each file for imports
    for (const file of files) {
        // Only parse JS/TS files
        if (file.type === 'javascript' || file.type === 'typescript' ||
            file.name.endsWith('.js') || file.name.endsWith('.jsx') ||
            file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
            const packages = extractImportsFromCode(file.content);
            packages.forEach(pkg => allPackages.add(pkg));
        }
    }

    // Build the dependencies object
    const dependencies: Record<string, string> = { ...BASE_DEPENDENCIES };

    for (const pkg of allPackages) {
        // Use known version if available, otherwise use 'latest'
        dependencies[pkg] = KNOWN_VERSIONS[pkg] || 'latest';
    }

    return dependencies;
}

/**
 * Debug helper: logs what dependencies were detected
 */
export function logDetectedDependencies(files: File[]): void {
    const deps = extractDependencies(files);
    console.log('📦 Detected dependencies:', Object.keys(deps).length);
    console.table(deps);
}

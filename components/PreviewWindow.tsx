import React, { useState, useMemo } from 'react';
import { Icons } from './ui/Icons';
import { File } from '../types';
import { SandpackProvider, SandpackLayout, SandpackPreview, SandpackFileExplorer, SandpackCodeEditor, useSandpack, useSandpackNavigation } from "@codesandbox/sandpack-react";
import { amethyst } from "@codesandbox/sandpack-themes";

import { ProjectVersion } from '../hooks/useProjectVersions';

interface PreviewWindowProps {
  previewCode: string;
  files: File[];
  onToggleView: () => void;
  isCodeView: boolean;
  projectTitle: string;
  isLoading?: boolean;
  onPreviewError?: (error: string) => void;
  onShareClick?: () => void;
  isPublic?: boolean;
  onHistoryClick?: () => void;
  previewingVersion?: ProjectVersion | null;
  onRestoreVersion?: () => void;
  onBackToLatest?: () => void;
  isSidebarHidden?: boolean;
  onToggleSidebar?: () => void;
}

// Custom component to handle Sandpack content with useSandpack hook
const SandpackContent: React.FC<{ isCodeView: boolean }> = ({ isCodeView }) => {
  const { sandpack } = useSandpack();

  return (
    <SandpackLayout style={{ height: '100%', width: '100%', flex: 1, overflow: 'hidden' }}>
      {/* Code Editor - Always mounted, hidden with CSS when not in code view */}
      <div
        className={`${isCodeView ? 'flex' : 'hidden'} h-full overflow-hidden`}
        style={{ flex: isCodeView ? 1 : 0, minWidth: 0 }}
      >
        <SandpackFileExplorer style={{ height: '100%', minWidth: '180px', maxWidth: '200px', flexShrink: 0 }} />
        <SandpackCodeEditor
          showTabs
          showLineNumbers
          showInlineErrors
          wrapContent
          closableTabs
          style={{ height: '100%', flex: 1, minWidth: 0, overflow: 'hidden' }}
        />
      </div>

      {/* Preview - Always mounted, hidden with CSS when in code view */}
      <div
        className={`${!isCodeView ? 'flex flex-col' : 'hidden'} h-full w-full overflow-hidden`}
        style={{ flex: !isCodeView ? 1 : 0, minWidth: 0 }}
      >
        <SandpackPreview
          showNavigator={true}
          showOpenInCodeSandbox={false}
          showRefreshButton={true}
          style={{ height: '100%', flex: 1, minWidth: 0, width: '100%' }}
        />
      </div>
    </SandpackLayout>
  );
};

export const PreviewWindow: React.FC<PreviewWindowProps> = ({
  files,
  onToggleView,
  isCodeView,
  projectTitle,
  isLoading,
  onPreviewError,
  onShareClick,
  isPublic,
  onHistoryClick,
  previewingVersion,
  onRestoreVersion,
  onBackToLatest,
  isSidebarHidden,
  onToggleSidebar
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  // Viewport dimensions
  const viewportStyles = {
    desktop: { width: '100%', maxWidth: '100%' },
    tablet: { width: '768px', maxWidth: '768px' },
    mobile: { width: '375px', maxWidth: '375px' },
  };

  // Create a stable key based on project title to force remount when project changes
  const sandpackKey = useMemo(() => {
    return `${projectTitle}-${files.length}`;
  }, [projectTitle, files.length]);

  // Transform our File[] to Sandpack's file format Record<string, string>
  const sandpackFiles = useMemo(() => {
    return files.reduce((acc, file) => {
      let path = file.name;
      if (!path.startsWith('/')) {
        path = `/${path}`;
      }
      if (path.startsWith('/src/')) {
        path = path.replace('/src/', '/');
      }
      acc[path] = file.content;
      return acc;
    }, {} as Record<string, string>);
  }, [files]);

  // Essential configuration files for Tailwind support
  const tailwindConfig = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
      },
      borderRadius: { lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)" },
    },
  },
  plugins: [require("tailwindcss-animate")],
}`;

  const postcssConfig = `module.exports = {
  plugins: { tailwindcss: {}, autoprefixer: {} },
}`;

  const indexCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.16 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}`;

  // Create final files object with configs
  const finalSandpackFiles = useMemo(() => {
    const filesWithConfigs = { ...sandpackFiles };

    if (!filesWithConfigs['/tailwind.config.js']) filesWithConfigs['/tailwind.config.js'] = tailwindConfig;
    if (!filesWithConfigs['/postcss.config.js']) filesWithConfigs['/postcss.config.js'] = postcssConfig;
    if (!filesWithConfigs['/index.css']) filesWithConfigs['/index.css'] = indexCss;

    if (filesWithConfigs['/App.tsx'] && !filesWithConfigs['/App.tsx'].includes('index.css')) {
      filesWithConfigs['/App.tsx'] = `import './index.css';\n` + filesWithConfigs['/App.tsx'];
    }

    delete filesWithConfigs['/package.json'];
    return filesWithConfigs;
  }, [sandpackFiles]);

  const dependencies: Record<string, string> = {
    // Core UI
    "lucide-react": "^0.263.1",
    "framer-motion": "^10.12.16",

    // Utilities
    "clsx": "^2.0.0",
    "tailwind-merge": "^1.14.0",
    "class-variance-authority": "^0.7.0",
    "date-fns": "^2.30.0",
    "react-router-dom": "^6.14.1",

    // Radix UI Primitives
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

    // Data Visualization
    "recharts": "^2.8.0",

    // Forms
    "react-hook-form": "^7.46.1",
    "zod": "^3.22.2",
    "@hookform/resolvers": "^3.3.1",

    // Tailwind
    "tailwindcss": "^3.3.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "tailwindcss-animate": "^1.0.7",
  };

  const handleCopy = async () => {
    const textToCopy = "Code is available in the editor.";
    await navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505] relative overflow-hidden z-0 transition-all duration-300">
      {/* Top Bar - Changes based on whether viewing a version or current */}
      <div className={`h-14 border-b flex items-center justify-between px-4 sm:px-6 backdrop-blur-md z-20 shrink-0 relative ${previewingVersion ? 'border-aether-lime/30 bg-aether-lime/5' : 'border-zinc-900 bg-black/80'
        }`}>
        {previewingVersion ? (
          /* Version Preview Mode */
          <>
            <button
              onClick={onBackToLatest}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-medium transition-colors border border-zinc-700"
            >
              <Icons.ChevronRight className="rotate-180" size={14} />
              Back to latest
            </button>

            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
              <span className="text-sm text-zinc-500">Viewing:</span>
              <span className="px-3 py-1 bg-zinc-800 rounded-lg text-sm text-zinc-200 font-medium">
                {previewingVersion.prompt?.split(' ').slice(0, 5).join(' ')}{(previewingVersion.prompt?.split(' ').length || 0) > 5 ? '...' : ''}
              </span>
            </div>

            <button
              onClick={onRestoreVersion}
              className="px-4 py-2 bg-aether-lime text-black text-xs font-bold rounded-lg hover:bg-emerald-400 transition-colors"
            >
              Restore this version
            </button>
          </>
        ) : (
          /* Normal Mode */
          <>
            <div className="flex items-center gap-3 min-w-0">
              {onToggleSidebar && (
                <button
                  onClick={onToggleSidebar}
                  className={`p-1.5 rounded-lg transition-colors ${isSidebarHidden ? 'bg-aether-lime/10 text-aether-lime' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                  title={isSidebarHidden ? "Show Chat Panel" : "Hide Chat Panel"}
                >
                  {isSidebarHidden ? <Icons.PanelLeftOpen size={18} /> : <Icons.PanelLeftClose size={18} />}
                </button>
              )}
            </div>

            {/* Center: Device Preview Buttons - Only show when not in code view */}
            {!isCodeView && (
              <div className="absolute left-1/2 -translate-x-1/2 hidden sm:flex items-center bg-zinc-900 rounded-full p-1 border border-zinc-700">
                <button
                  onClick={() => setViewport('desktop')}
                  className={`p-1.5 rounded-md transition-all ${viewport === 'desktop' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  title="Desktop View"
                >
                  <Icons.Monitor size={14} />
                </button>
                <button
                  onClick={() => setViewport('tablet')}
                  className={`p-1.5 rounded-md transition-all ${viewport === 'tablet' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  title="Tablet View (768px)"
                >
                  <Icons.Tablet size={14} />
                </button>
                <button
                  onClick={() => setViewport('mobile')}
                  className={`p-1.5 rounded-md transition-all ${viewport === 'mobile' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                  title="Mobile View (375px)"
                >
                  <Icons.Smartphone size={14} />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
                <button
                  onClick={() => isCodeView ? onToggleView() : null}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${!isCodeView ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  Preview
                </button>
                <button
                  onClick={() => !isCodeView ? onToggleView() : null}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${isCodeView ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  Code
                </button>
              </div>

              {onHistoryClick && (
                <button
                  onClick={onHistoryClick}
                  className="p-1.5 text-zinc-400 hover:text-aether-lime hover:bg-zinc-800 transition-colors hidden sm:block rounded-lg"
                  title="Version History"
                >
                  <Icons.History size={16} />
                </button>
              )}

              {onShareClick && (
                <button
                  onClick={onShareClick}
                  className={`p-1.5 transition-colors hidden sm:flex items-center gap-1.5 rounded-lg ${isPublic ? 'text-aether-lime bg-aether-lime/10 hover:bg-aether-lime/20' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
                  title={isPublic ? "Shared publicly" : "Share project"}
                >
                  <Icons.Share size={16} />
                  {isPublic && <span className="text-xs font-medium">Shared</span>}
                </button>
              )}



              <button
                className="bg-white text-black px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-zinc-200 transition-colors flex items-center gap-2"
                onClick={() => alert("Downloading feature coming soon with Sandpack integration!")}
              >
                <Icons.Download size={14} />
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 relative flex overflow-hidden bg-zinc-950">
        {/* Viewport Container - centers the preview when using tablet/mobile */}
        <div
          className={`relative flex flex-col h-full transition-all duration-300 mx-auto ${viewport !== 'desktop' && !isCodeView ? 'border-x border-zinc-800 shadow-2xl' : ''
            }`}
          style={!isCodeView ? viewportStyles[viewport] : { width: '100%', maxWidth: '100%' }}
        >
          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#050505]/90 backdrop-blur-sm animate-in fade-in duration-500">
              <div className="flex flex-col items-center gap-6 p-8">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-zinc-800/50"></div>
                  <div className="absolute top-0 left-0 w-20 h-20 rounded-full border-4 border-t-aether-lime border-r-transparent border-b-transparent border-l-transparent animate-spin duration-1000"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Icons.Sparkles className="w-8 h-8 text-aether-lime animate-pulse" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold text-white tracking-tight">Generating application...</h3>
                  <p className="text-sm text-zinc-500 font-mono animate-pulse">Consulting the Aether</p>
                </div>
              </div>
            </div>
          )}

          <SandpackProvider
            key={sandpackKey}
            template="react-ts"
            theme={amethyst}
            files={finalSandpackFiles}
            options={{
              externalResources: ["https://cdn.tailwindcss.com"],
              recompileMode: "delayed",
              recompileDelay: 300,
              autoReload: true,
              visibleFiles: Object.keys(finalSandpackFiles).filter(f =>
                !f.startsWith('/public/') &&
                !f.endsWith('package.json') &&
                !f.endsWith('tsconfig.json') &&
                !f.endsWith('tailwind.config.js') &&
                !f.endsWith('postcss.config.js')
              ),
              activeFile: finalSandpackFiles['/App.tsx'] ? '/App.tsx' : undefined,
              classes: {
                "sp-wrapper": "!h-full !w-full",
                "sp-layout": "!h-full !w-full !flex !flex-1",
                "sp-stack": "!h-full !flex-1",
                "sp-preview": "!flex-1 !w-full",
                "sp-preview-container": "!h-full !w-full",
              },
            }}
            customSetup={{
              dependencies: dependencies
            }}
          >
            <SandpackContent isCodeView={isCodeView} />
          </SandpackProvider>
        </div>
      </div>
    </div>
  );
};

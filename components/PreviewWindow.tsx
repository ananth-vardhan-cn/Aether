import React, { useState, useMemo } from 'react';
import { Icons } from './ui/Icons';
import { Logo } from './ui/Logo';
import { GeneratingPreview } from './GeneratingPreview';
import { AnimatePresence, motion } from 'framer-motion';
import { File } from '../types';
import { SandpackProvider, SandpackLayout, SandpackPreview, SandpackFileExplorer, SandpackCodeEditor, useSandpack, useSandpackNavigation } from "@codesandbox/sandpack-react";
import { amethyst } from "@codesandbox/sandpack-themes";
import { extractDependencies } from '../lib/extractDependencies';
import { exportProjectAsZip } from '../lib/exportProject';

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
  onGitHubClick?: () => void;  // New: Open GitHub modal
  previewingVersion?: ProjectVersion | null;
  onRestoreVersion?: () => void;
  onBackToLatest?: () => void;
  isSidebarHidden?: boolean;
  onToggleSidebar?: () => void;
}

// Custom component to handle Sandpack content with useSandpack hook
const SandpackContent: React.FC<{ isCodeView: boolean; onError?: (error: string) => void }> = ({ isCodeView, onError }) => {
  const { sandpack } = useSandpack();

  // Detect and report errors
  React.useEffect(() => {
    if (sandpack.error && onError) {
      // Extract error message
      const errorMessage = sandpack.error.message || String(sandpack.error);
      onError(errorMessage);
    }
  }, [sandpack.error, onError]);

  return (
    <SandpackLayout style={{ height: '100%', width: '100%', flex: 1, overflow: 'hidden' }}>
      {/* Code Editor - Always mounted, hidden with CSS when not in code view */}
      <div
        className={`${isCodeView ? 'flex' : 'hidden'} h-full overflow-hidden relative`}
        style={{ flex: isCodeView ? 1 : 0, minWidth: 0 }}
      >
        <SandpackFileExplorer style={{ height: '100%', minWidth: '180px', maxWidth: '200px', flexShrink: 0 }} />
        <SandpackCodeEditor
          showTabs
          showLineNumbers
          showInlineErrors
          wrapContent
          closableTabs
          readOnly
          style={{ height: '100%', flex: 1, minWidth: 0, overflow: 'hidden' }}
        />
        {/* Read Only Indicator */}
        <div className="absolute bottom-4 right-4 z-10">
          <div className="px-3 py-1.5 bg-zinc-800/90 backdrop-blur-sm border border-zinc-600 rounded-full text-xs font-semibold text-zinc-300 flex items-center gap-2 shadow-lg">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Read Only
          </div>
        </div>
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
  onGitHubClick,
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

  // Dynamically extract dependencies from generated files
  // This detects all import statements and adds the packages to Sandpack
  const dependencies = useMemo(() => {
    const detected = extractDependencies(files);
    console.log('📦 Dynamic dependencies detected:', Object.keys(detected).length, detected);
    return detected;
  }, [files]);

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

              {onGitHubClick && (
                <button
                  onClick={onGitHubClick}
                  className="flex items-center justify-center hover:opacity-80 transition-opacity hidden sm:flex rounded-lg overflow-hidden"
                  title="Sync to GitHub"
                >
                  <div className="bg-zinc-800 rounded-lg p-2 flex items-center justify-center">
                    <Icons.Github size={16} className="text-white" />
                  </div>
                </button>
              )}
              <button
                className="bg-white text-black px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-zinc-200 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => exportProjectAsZip(projectTitle, files)}
                disabled={files.length === 0}
                title={files.length === 0 ? "Generate a project first" : "Export as ZIP"}
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
          {/* Loading Overlay - Animated Card Stack */}
          {isLoading && (
            <div className="absolute inset-0 z-50 bg-[#050505]/95 backdrop-blur-sm animate-in fade-in duration-500">
              <GeneratingPreview />
            </div>
          )}

          {/* Show placeholder when no project files exist */}
          {files.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-center p-8">
              <div className="w-24 h-24 rounded-3xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-center mb-6 shadow-2xl relative group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-aether-lime/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <Logo className="w-12 h-12" />
              </div>
              <h3 className="text-xl font-semibold text-zinc-300">Your preview will appear here</h3>
            </div>
          ) : (
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
              <SandpackContent isCodeView={isCodeView} onError={onPreviewError} />
            </SandpackProvider>
          )}
        </div>
      </div>
    </div>
  );
};

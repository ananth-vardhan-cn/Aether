import React, { useState, useEffect, useMemo } from 'react';
import { Icons } from './ui/Icons';
import { supabase } from '../lib/supabase';
import { SandpackProvider, SandpackLayout, SandpackPreview } from "@codesandbox/sandpack-react";
import { amethyst } from "@codesandbox/sandpack-themes";

interface SharedProject {
    id: string;
    name: string;
    files: Array<{ name: string; content: string; type: string }>;
    previewCode: string;
    createdAt: string;
}

interface SharedProjectViewProps {
    shareId: string;
    onBack: () => void;
}

export const SharedProjectView: React.FC<SharedProjectViewProps> = ({ shareId, onBack }) => {
    const [project, setProject] = useState<SharedProject | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProject = async () => {
            setLoading(true);
            setError(null);

            try {
                const { data, error: fetchError } = await supabase.functions.invoke('get-public-project', {
                    body: { shareId },
                });

                if (fetchError) throw fetchError;
                if (!data) throw new Error('Project not found');

                setProject(data);
            } catch (err: any) {
                setError(err.message || 'Failed to load project');
            } finally {
                setLoading(false);
            }
        };

        fetchProject();
    }, [shareId]);

    // Transform files to Sandpack format
    const sandpackFiles = useMemo(() => {
        if (!project?.files) return {};
        return project.files.reduce((acc, file) => {
            let path = file.name;
            if (!path.startsWith('/')) path = `/${path}`;
            if (path.startsWith('/src/')) path = path.replace('/src/', '/');
            acc[path] = file.content;
            return acc;
        }, {} as Record<string, string>);
    }, [project?.files]);

    // Tailwind config files
    const tailwindConfig = `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
}`;

    const indexCss = `@tailwind base;
@tailwind components;
@tailwind utilities;`;

    const finalSandpackFiles = useMemo(() => {
        const files = { ...sandpackFiles };
        if (!files['/tailwind.config.js']) files['/tailwind.config.js'] = tailwindConfig;
        if (!files['/index.css']) files['/index.css'] = indexCss;
        if (files['/App.tsx'] && !files['/App.tsx'].includes('index.css')) {
            files['/App.tsx'] = `import './index.css';\n` + files['/App.tsx'];
        }
        delete files['/package.json'];
        return files;
    }, [sandpackFiles]);

    const dependencies: Record<string, string> = {
        "lucide-react": "^0.263.1",
        "framer-motion": "^10.12.16",
        "clsx": "^2.0.0",
        "tailwind-merge": "^1.14.0",
        "tailwindcss": "^3.3.0",
        "postcss": "^8.4.0",
        "autoprefixer": "^10.4.0",
    };

    if (loading) {
        return (
            <div className="flex h-screen w-full bg-black text-white items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin w-10 h-10 border-2 border-aether-lime border-t-transparent rounded-full"></div>
                    <p className="text-zinc-400 font-mono text-sm">Loading shared project...</p>
                </div>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="flex h-screen w-full bg-black text-white items-center justify-center">
                <div className="flex flex-col items-center gap-6 max-w-md text-center p-8">
                    <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                        <Icons.X size={32} className="text-red-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold mb-2">Project Not Found</h2>
                        <p className="text-zinc-500">
                            {error || 'This project may have been removed or is no longer public.'}
                        </p>
                    </div>
                    <button
                        onClick={onBack}
                        className="px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-colors"
                    >
                        Go to Aether
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen w-full bg-black text-white">
            {/* Header */}
            <div className="h-16 border-b border-zinc-900 flex items-center justify-between px-6 bg-black/80 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <Icons.ChevronLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-white">{project.name}</h1>
                        <p className="text-xs text-zinc-500 font-mono flex items-center gap-1">
                            <Icons.Globe size={12} />
                            Shared project
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="group relative flex items-center gap-2 px-4 py-2 bg-zinc-900/80 rounded-xl border border-zinc-800 hover:border-aether-lime/30 transition-all duration-300 cursor-pointer" onClick={onBack}>
                        {/* Glow effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-aether-lime/10 to-aether-purple/10 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <Icons.Zap size={16} className="text-aether-lime relative z-10" />
                        <span className="text-xs font-medium text-zinc-400 relative z-10">Built with</span>
                        <span className="font-bold text-sm tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400 relative z-10">Aether</span>
                        <span className="text-[8px] bg-aether-lime text-black px-1 py-0.5 rounded font-mono font-bold uppercase relative z-10">Beta</span>
                    </div>
                </div>
            </div>

            {/* Preview Area */}
            <div className="flex-1 flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>
                {project.files && project.files.length > 0 ? (
                    <SandpackProvider
                        template="react-ts"
                        theme={amethyst}
                        files={finalSandpackFiles}
                        options={{
                            externalResources: ["https://cdn.tailwindcss.com"],
                            recompileMode: "delayed",
                            recompileDelay: 300,
                            classes: {
                                "sp-wrapper": "!h-full !w-full !flex-1",
                                "sp-layout": "!h-full !w-full !flex-1",
                                "sp-stack": "!h-full !flex-1",
                                "sp-preview": "!flex-1 !w-full !h-full",
                                "sp-preview-container": "!h-full !w-full",
                            },
                        }}
                        customSetup={{ dependencies }}
                    >
                        <SandpackLayout style={{ height: '100%', width: '100%', flex: 1 }}>
                            <SandpackPreview
                                showNavigator={false}
                                showOpenInCodeSandbox={false}
                                showRefreshButton={true}
                                style={{ height: '100%', flex: 1, width: '100%' }}
                            />
                        </SandpackLayout>
                    </SandpackProvider>
                ) : project.previewCode ? (
                    <iframe
                        srcDoc={project.previewCode}
                        className="w-full h-full border-none bg-white flex-1"
                        title={`Preview of ${project.name}`}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-zinc-600">
                        <p>No preview available</p>
                    </div>
                )}
            </div>
        </div>
    );
};

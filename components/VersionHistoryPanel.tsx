import React, { useState, useEffect, useMemo } from 'react';
import { Icons } from './ui/Icons';
import { ProjectVersion } from '../hooks/useProjectVersions';
import { File } from '../types';
import { SandpackProvider, SandpackLayout, SandpackPreview } from "@codesandbox/sandpack-react";
import { amethyst } from "@codesandbox/sandpack-themes";
import * as Diff from 'diff';

interface VersionHistoryPanelProps {
    isOpen: boolean;
    onClose: () => void;
    versions: ProjectVersion[];
    currentFiles: File[];
    currentPreviewCode: string;
    onRevert: (version: ProjectVersion) => void;
    loading: boolean;
}

type ModalView = 'none' | 'preview' | 'diff';

export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
    isOpen,
    onClose,
    versions,
    currentFiles,
    currentPreviewCode,
    onRevert,
    loading,
}) => {
    const [selectedVersion, setSelectedVersion] = useState<ProjectVersion | null>(null);
    const [modalView, setModalView] = useState<ModalView>('none');

    if (!isOpen) return null;

    const handlePreview = (version: ProjectVersion) => {
        setSelectedVersion(version);
        setModalView('preview');
    };

    const handleDiff = (version: ProjectVersion) => {
        setSelectedVersion(version);
        setModalView('diff');
    };

    const handleRevert = (version: ProjectVersion) => {
        if (confirm(`Revert to Version ${version.versionNumber}? This will replace your current code.`)) {
            onRevert(version);
            onClose();
        }
    };

    const closeModal = () => {
        setSelectedVersion(null);
        setModalView('none');
    };

    return (
        <>
            {/* Panel */}
            <div className="fixed inset-y-0 right-0 z-50 w-80 bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <Icons.History size={20} className="text-aether-lime" />
                        <h2 className="font-bold text-white">Version History</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                        <Icons.X size={18} />
                    </button>
                </div>

                {/* Version List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-10">
                            <div className="animate-spin w-6 h-6 border-2 border-aether-lime border-t-transparent rounded-full" />
                        </div>
                    ) : versions.length === 0 ? (
                        <div className="text-center py-10 text-zinc-600">
                            <Icons.History size={32} className="mx-auto mb-3 opacity-50" />
                            <p className="text-sm">No versions yet</p>
                            <p className="text-xs mt-1">Versions are saved after each generation</p>
                        </div>
                    ) : (
                        versions.map((version) => (
                            <div
                                key={version.id}
                                className="group p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <span className="text-xs font-mono text-aether-lime bg-aether-lime/10 px-2 py-0.5 rounded">
                                            v{version.versionNumber}
                                        </span>
                                        <p className="text-white text-sm font-medium mt-2 line-clamp-2">
                                            {version.prompt || 'Initial version'}
                                        </p>
                                    </div>
                                </div>

                                <p className="text-xs text-zinc-600 font-mono mb-3">
                                    {version.createdAt.toLocaleString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </p>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handlePreview(version)}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
                                        title="Visual Preview"
                                    >
                                        <Icons.Eye size={14} />
                                        Preview
                                    </button>
                                    <button
                                        onClick={() => handleDiff(version)}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
                                        title="View Code Changes"
                                    >
                                        <Icons.Code size={14} />
                                        Diff
                                    </button>
                                    <button
                                        onClick={() => handleRevert(version)}
                                        className="p-2 bg-zinc-800 hover:bg-aether-lime hover:text-black text-zinc-400 rounded-lg transition-colors"
                                        title="Revert to this version"
                                    >
                                        <Icons.Refresh size={14} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Preview Modal */}
            {modalView === 'preview' && selectedVersion && (
                <VersionPreviewModal
                    version={selectedVersion}
                    onClose={closeModal}
                />
            )}

            {/* Diff Modal */}
            {modalView === 'diff' && selectedVersion && (
                <VersionDiffModal
                    version={selectedVersion}
                    currentFiles={currentFiles}
                    onClose={closeModal}
                />
            )}
        </>
    );
};

// Preview Modal with Sandpack
const VersionPreviewModal: React.FC<{
    version: ProjectVersion;
    onClose: () => void;
}> = ({ version, onClose }) => {
    const sandpackFiles = useMemo(() => {
        if (!version.files) return {};
        return version.files.reduce((acc, file) => {
            let path = file.name;
            if (!path.startsWith('/')) path = `/${path}`;
            if (path.startsWith('/src/')) path = path.replace('/src/', '/');
            acc[path] = file.content;
            return acc;
        }, {} as Record<string, string>);
    }, [version.files]);

    const tailwindConfig = `module.exports = { content: ["./index.html", "./**/*.{js,ts,jsx,tsx}"], theme: { extend: {} }, plugins: [] }`;
    const indexCss = `@tailwind base;\n@tailwind components;\n@tailwind utilities;`;

    const finalFiles = useMemo(() => {
        const files = { ...sandpackFiles };
        if (!files['/tailwind.config.js']) files['/tailwind.config.js'] = tailwindConfig;
        if (!files['/index.css']) files['/index.css'] = indexCss;
        if (files['/App.tsx'] && !files['/App.tsx'].includes('index.css')) {
            files['/App.tsx'] = `import './index.css';\n` + files['/App.tsx'];
        }
        delete files['/package.json'];
        return files;
    }, [sandpackFiles]);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80" onClick={onClose} />
            <div className="relative z-10 w-full max-w-5xl h-[80vh] bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <Icons.Eye size={18} className="text-aether-lime" />
                        <span className="font-bold text-white">Version {version.versionNumber} Preview</span>
                    </div>
                    <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white">
                        <Icons.X size={18} />
                    </button>
                </div>
                <div className="flex-1 overflow-hidden">
                    <SandpackProvider
                        template="react-ts"
                        theme={amethyst}
                        files={finalFiles}
                        options={{
                            externalResources: ["https://cdn.tailwindcss.com"],
                        }}
                        customSetup={{
                            dependencies: {
                                "lucide-react": "^0.263.1",
                                "framer-motion": "^10.12.16",
                            }
                        }}
                    >
                        <SandpackLayout style={{ height: '100%' }}>
                            <SandpackPreview
                                showNavigator={false}
                                showOpenInCodeSandbox={false}
                                style={{ height: '100%', flex: 1 }}
                            />
                        </SandpackLayout>
                    </SandpackProvider>
                </div>
            </div>
        </div>
    );
};

// Diff Modal with red/green changes
const VersionDiffModal: React.FC<{
    version: ProjectVersion;
    currentFiles: File[];
    onClose: () => void;
}> = ({ version, currentFiles, onClose }) => {
    const [selectedFile, setSelectedFile] = useState<string | null>(null);

    // Get all file names from both versions
    const allFileNames = useMemo(() => {
        const names = new Set<string>();
        version.files.forEach(f => names.add(f.name));
        currentFiles.forEach(f => names.add(f.name));
        return Array.from(names).sort();
    }, [version.files, currentFiles]);

    useEffect(() => {
        if (allFileNames.length > 0 && !selectedFile) {
            setSelectedFile(allFileNames[0]);
        }
    }, [allFileNames, selectedFile]);

    const diffResult = useMemo(() => {
        if (!selectedFile) return [];
        const oldFile = version.files.find(f => f.name === selectedFile);
        const newFile = currentFiles.find(f => f.name === selectedFile);
        const oldContent = oldFile?.content || '';
        const newContent = newFile?.content || '';
        return Diff.diffLines(oldContent, newContent);
    }, [selectedFile, version.files, currentFiles]);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80" onClick={onClose} />
            <div className="relative z-10 w-full max-w-5xl h-[80vh] bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <Icons.Code size={18} className="text-aether-lime" />
                        <span className="font-bold text-white">
                            Changes from v{version.versionNumber} → Current
                        </span>
                    </div>
                    <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white">
                        <Icons.X size={18} />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* File list */}
                    <div className="w-48 border-r border-zinc-800 overflow-y-auto bg-zinc-900/50">
                        {allFileNames.map(name => (
                            <button
                                key={name}
                                onClick={() => setSelectedFile(name)}
                                className={`w-full text-left px-3 py-2 text-xs font-mono truncate transition-colors ${selectedFile === name
                                    ? 'bg-aether-lime/10 text-aether-lime border-l-2 border-aether-lime'
                                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                                    }`}
                            >
                                {name.split('/').pop()}
                            </button>
                        ))}
                    </div>

                    {/* Diff view */}
                    <div className="flex-1 overflow-auto p-4 font-mono text-sm">
                        {diffResult.map((part, index) => (
                            <div
                                key={index}
                                className={`whitespace-pre-wrap ${part.added
                                    ? 'bg-emerald-500/20 text-emerald-300 border-l-4 border-emerald-500 pl-2'
                                    : part.removed
                                        ? 'bg-red-500/20 text-red-300 border-l-4 border-red-500 pl-2'
                                        : 'text-zinc-500'
                                    }`}
                            >
                                {part.value}
                            </div>
                        ))}
                        {diffResult.length === 0 && (
                            <div className="text-zinc-600 text-center py-10">
                                No changes in this file
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

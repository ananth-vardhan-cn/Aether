import React, { useMemo } from 'react';
import { Project } from '../types';
import { Icons } from './ui/Icons';
import { Logo } from './ui/Logo';

interface ProjectsListProps {
    projects: Project[];
    currentProjectId: string | null;
    onSelectProject: (id: string) => void;
    onNewProject: () => void;
    onDeleteProject?: (id: string) => void;
    onClose: () => void;
}

export const ProjectsList: React.FC<ProjectsListProps> = ({
    projects,
    currentProjectId,
    onSelectProject,
    onNewProject,
    onDeleteProject,
    onClose,
}) => {
    // Sort projects by last modified (newest first)
    const sortedProjects = useMemo(() => {
        return [...projects].sort((a, b) =>
            new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
        );
    }, [projects]);

    return (
        <div className="flex flex-col h-full bg-black text-white animate-in slide-in-from-left-5 duration-300">
            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                <button
                    onClick={() => { onNewProject(); onClose(); }}
                    className="w-full flex items-center gap-3 p-3 mb-2 rounded-xl bg-gradient-to-r from-aether-lime/10 to-transparent border border-aether-lime/20 hover:border-aether-lime/40 text-left group transition-all"
                >
                    <div className="p-2 bg-aether-lime/10 rounded-lg text-aether-lime group-hover:scale-110 transition-transform">
                        <Icons.Plus size={18} />
                    </div>
                    <div>
                        <div className="font-bold text-sm text-aether-lime">New Project</div>
                        <div className="text-[10px] text-zinc-500">Start a fresh idea</div>
                    </div>
                </button>

                {sortedProjects.length === 0 ? (
                    <div className="text-center py-10 px-4">
                        <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-3 text-zinc-600">
                            <Icons.Layout size={24} />
                        </div>
                        <p className="text-zinc-500 text-sm">No projects yet.</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {sortedProjects.map((project) => (
                            <div
                                key={project.id}
                                onClick={() => { onSelectProject(project.id); onClose(); }}
                                className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${currentProjectId === project.id
                                    ? 'bg-zinc-900 border-zinc-800'
                                    : 'border-transparent hover:bg-zinc-900/50 hover:border-zinc-800/50'
                                    }`}
                            >
                                <div className={`p-2 rounded-lg border ${currentProjectId === project.id
                                    ? 'bg-zinc-950 border-zinc-800 text-aether-lime'
                                    : 'bg-zinc-950 border-zinc-900 text-zinc-600 group-hover:text-zinc-400 group-hover:border-zinc-800'
                                    }`}>
                                    <Icons.Layout size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className={`font-medium text-sm truncate ${currentProjectId === project.id ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'
                                        }`}>
                                        {project.name}
                                    </div>
                                    <div className="text-[10px] text-zinc-600 font-mono truncate">
                                        {new Date(project.lastModified).toLocaleDateString()}
                                    </div>
                                </div>

                                {currentProjectId === project.id && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-aether-lime shadow-[0_0_8px_rgba(132,204,22,0.8)]" />
                                )}

                                {onDeleteProject && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm('Delete this project?')) {
                                                onDeleteProject(project.id);
                                            }
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 rounded-lg transition-all"
                                    >
                                        <Icons.Trash size={14} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

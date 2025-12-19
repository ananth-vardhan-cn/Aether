import React from 'react';
import { Project } from '../types';
import { Icons } from './ui/Icons';

interface SidebarProps {
  projects: Project[];
  currentProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onDeleteProject?: (id: string) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  projects,
  currentProjectId,
  onSelectProject,
  onNewProject,
  onDeleteProject,
  isOpen,
  toggleSidebar
}) => {
  return (
    <div 
      className={`
        fixed left-0 top-0 h-full z-50 bg-black border-r border-zinc-900 
        transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] flex flex-col
        ${isOpen ? 'w-64 translate-x-0' : 'w-16 -translate-x-0'}
      `}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-center border-b border-zinc-900">
        <div className={`flex items-center gap-2 font-bold text-xl tracking-tighter transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500">Aether</span>
          <span className="text-[10px] bg-aether-lime text-black px-1.5 py-0.5 rounded font-mono font-bold uppercase">Beta</span>
        </div>
        {!isOpen && <Icons.Zap className="w-6 h-6 text-aether-lime" />}
      </div>

      {/* New Project Button */}
      <div className="p-4">
        <button
          onClick={onNewProject}
          className={`
            group flex items-center gap-3 w-full p-3 rounded-xl
            bg-white text-black font-semibold 
            hover:bg-aether-lime hover:scale-[1.02] active:scale-[0.98]
            transition-all duration-200 shadow-lg shadow-white/5
            ${!isOpen ? 'justify-center px-0' : ''}
          `}
          title="New Project"
        >
          <Icons.Plus className={`w-5 h-5 ${isOpen ? '' : 'mx-auto'}`} />
          {isOpen && <span>New Project</span>}
        </button>
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1 scrollbar-hide">
        <div className={`px-2 text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2 ${!isOpen && 'hidden'}`}>Recent</div>
        {projects.map((project) => (
          <div
            key={project.id}
            className={`
              w-full flex items-center gap-2 px-3 py-2.5 rounded-lg group relative
              ${currentProjectId === project.id 
                ? 'bg-zinc-900 text-white' 
                : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'}
            `}
          >
            <button 
                onClick={() => onSelectProject(project.id)}
                className="flex-1 flex items-center gap-3 overflow-hidden text-left"
                title={project.name}
            >
                <Icons.Layout className={`w-4 h-4 shrink-0 ${currentProjectId === project.id ? 'text-aether-lime' : 'group-hover:text-white'}`} />
                {isOpen && (
                <span className="text-sm font-medium truncate">
                    {project.name}
                </span>
                )}
            </button>
            
            {isOpen && onDeleteProject && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDeleteProject(project.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 rounded transition-all"
                    title="Delete Project"
                >
                    <Icons.Trash size={12} />
                </button>
            )}

            {currentProjectId === project.id && isOpen && (
              <span className="absolute right-1 w-1.5 h-1.5 rounded-full bg-aether-lime shadow-[0_0_8px_rgba(190,242,100,0.8)] pointer-events-none"></span>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-zinc-900 flex flex-col gap-2">
        <button 
          onClick={toggleSidebar} 
          className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors p-2 rounded-lg hover:bg-zinc-900 w-full"
        >
           {isOpen ? <><Icons.ChevronLeft size={18} /><span className="text-xs">Collapse</span></> : <Icons.ChevronRight size={18} className="mx-auto" />}
        </button>
      </div>
    </div>
  );
};
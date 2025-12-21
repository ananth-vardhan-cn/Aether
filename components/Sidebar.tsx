import React, { useState, useRef, useEffect } from 'react';
import { Project } from '../types';
import { Icons } from './ui/Icons';
import type { User } from '@supabase/supabase-js';
import { Logo } from './ui/Logo';

interface SidebarProps {
  projects: Project[];
  currentProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onDeleteProject?: (id: string) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
  user?: User | null;
  onAuthClick?: () => void;
  onSignOut?: () => void;
  onHome?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  projects,
  currentProjectId,
  onSelectProject,
  onNewProject,
  onDeleteProject,
  isOpen,
  toggleSidebar,
  user,
  onAuthClick,
  onSignOut,
  onHome,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node) && isOpen) {
        // Only close if the sidebar is open and the click is outside
        // This is for mobile/overlay behavior, but the current sidebar is fixed.
        // If we want to close on outside click, we'd need to adjust the CSS for overlay.
        // For now, this effect is not strictly necessary given the current CSS.
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  return (
    <aside
      ref={sidebarRef}
      className={`
        fixed left-0 top-0 h-full z-50 bg-black border-r border-zinc-900 
        transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] flex flex-col
        ${isOpen ? 'w-64 translate-x-0' : 'w-16 -translate-x-full'}
      `}
    >
      {/* Collapsed State Logo */}
      {!isOpen && (
        <div className="absolute top-4 left-4 z-50">
          <Logo className="w-6 h-6" />
        </div>
      )}

      {/* Header */}
      <div
        className="h-16 flex items-center justify-center border-b border-zinc-900 cursor-pointer hover:bg-zinc-900/50 transition-colors"
        onClick={onHome}
        title="Go to home"
      >
        <div className={`flex items-center gap-2 font-bold text-xl tracking-tighter transition-all duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-500">Aether</span>
          <span className="text-[10px] bg-aether-lime text-black px-1.5 py-0.5 rounded font-mono font-bold uppercase">Beta</span>
        </div>
      </div>

      {/* New Project + Collapse Button */}
      <div className="p-4 border-b border-zinc-900 flex items-center gap-2">
        {isOpen ? (
          <>
            <button
              onClick={onNewProject}
              className="flex-1 flex items-center gap-2 p-2.5 rounded-xl
                bg-gradient-to-r from-aether-lime/10 to-transparent
                border border-aether-lime/20 hover:border-aether-lime/40
                text-aether-lime transition-all text-sm font-medium"
            >
              <Icons.Plus size={18} />
              <span>New Project</span>
            </button>
            <button
              onClick={toggleSidebar}
              className="p-2.5 rounded-xl bg-zinc-900 text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Collapse sidebar"
            >
              <Icons.ChevronLeft size={18} />
            </button>
          </>
        ) : (
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center p-2.5 rounded-xl
              bg-zinc-900 text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Expand sidebar"
          >
            <Icons.ChevronRight size={18} />
          </button>
        )}
      </div>

      {/* Projects List */}
      <div className={`flex-1 p-2 ${isOpen ? 'overflow-y-auto scrollbar-none' : 'overflow-hidden'}`}>
        {projects.map((project) => (
          <div
            key={project.id}
            className={`
              group flex items-center gap-2 p-2.5 rounded-lg cursor-pointer
              transition-all text-sm mb-1
              ${currentProjectId === project.id
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-500 hover:text-white hover:bg-zinc-900/50'
              }
              ${!isOpen ? 'justify-center' : ''}
            `}
            onClick={() => onSelectProject(project.id)}
          >
            <Icons.Layout size={16} className="shrink-0" />
            {isOpen && (
              <>
                <span className="flex-1 truncate">{project.name}</span>
                {onDeleteProject && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Delete this project?')) {
                        onDeleteProject(project.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-800 rounded transition-all"
                  >
                    <Icons.Trash size={14} className="text-zinc-500 hover:text-red-400" />
                  </button>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-zinc-900 space-y-2">
        {/* Auth Section */}
        {user ? (
          <div className={`${isOpen ? 'block' : 'hidden'} relative`}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-full flex items-center gap-3 p-2 rounded-lg bg-zinc-900/50 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-aether-lime flex items-center justify-center text-black font-bold text-sm">
                {user.email?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs text-white truncate">{user.email}</p>
                <p className="text-[10px] text-zinc-500">Cloud synced</p>
              </div>
              <Icons.ChevronRight
                size={14}
                className={`text-zinc-500 transition-transform ${showProfileMenu ? 'rotate-90' : ''}`}
              />
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-xl">
                <button
                  onClick={() => {
                    alert('Settings coming soon!');
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <Icons.Layout size={14} />
                  Settings
                  <span className="ml-auto text-[10px] text-zinc-600">Coming soon</span>
                </button>
                <div className="border-t border-zinc-800" />
                <button
                  onClick={() => {
                    onSignOut?.();
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                >
                  <Icons.ChevronLeft size={14} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onAuthClick}
            className={`
              w-full flex items-center gap-2 p-2 rounded-lg
              bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white
              transition-colors text-sm font-medium
              ${!isOpen ? 'justify-center' : ''}
            `}
            title="Sign in to sync projects"
          >
            <Icons.Eye size={16} />
            {isOpen && <span>Sign In</span>}
          </button>
        )}

      </div>
    </aside>
  );
};
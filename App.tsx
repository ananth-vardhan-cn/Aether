import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { PreviewWindow } from './components/PreviewWindow';
import { AuthModal } from './components/AuthModal';
import { ShareModal } from './components/ShareModal';
import { SharedProjectView } from './components/SharedProjectView';
import { Message, MessageRole, Project, ViewState, GenerationStep, File } from './types';
import { generateAppCodeStream } from './services/gemini-proxy';
import { useAuth } from './hooks/useAuth';
import { useProjects } from './hooks/useProjects';

// Create a new project object
const createNewProject = (): Partial<Project> => ({
    name: 'Untitled Spark',
    files: [],
    previewCode: '',
    messages: [],
});

export default function App() {
    // Auth state
    const { user, loading: authLoading, signIn, signUp, signInWithGoogle, signOut, isAuthenticated } = useAuth();
    const [showAuthModal, setShowAuthModal] = useState(false);

    // Cloud projects (when authenticated)
    const {
        projects: cloudProjects,
        loading: projectsLoading,
        createProject: createCloudProject,
        updateProject: updateCloudProject,
        deleteProject: deleteCloudProject,
        shareProject: shareCloudProject,
        unshareProject: unshareCloudProject,
    } = useProjects(user?.id);

    // Local projects (when not authenticated)
    const [localProjects, setLocalProjects] = useState<Project[]>([]);

    // Use cloud or local projects based on auth state
    const projects = isAuthenticated ? cloudProjects : localProjects;

    // UI state
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [viewState, setViewState] = useState<ViewState>(ViewState.LANDING);
    const [isCodeView, setIsCodeView] = useState(false);
    const [isPreviewFullScreen, setIsPreviewFullScreen] = useState(false);
    const [autoFixCount, setAutoFixCount] = useState(0);
    const [generationSteps, setGenerationSteps] = useState<GenerationStep[]>([]);
    const [showShareModal, setShowShareModal] = useState(false);
    const [sharedProjectId, setSharedProjectId] = useState<string | null>(null);

    // Check URL for shared project on mount
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const shareId = urlParams.get('share');
        if (shareId) {
            setSharedProjectId(shareId);
        }
    }, []);

    // Load local projects from LocalStorage (for non-authenticated users)
    useEffect(() => {
        if (!isAuthenticated) {
            const savedProjects = localStorage.getItem('aether_projects');
            if (savedProjects) {
                try {
                    const parsed = JSON.parse(savedProjects);
                    if (Array.isArray(parsed)) {
                        setLocalProjects(parsed);
                    }
                } catch (e) {
                    console.error("Failed to parse projects from local storage");
                }
            }
        }
    }, [isAuthenticated]);

    // Save local projects to LocalStorage
    useEffect(() => {
        if (!isAuthenticated && localProjects.length >= 0) {
            localStorage.setItem('aether_projects', JSON.stringify(localProjects));
        }
    }, [localProjects, isAuthenticated]);

    const currentProject = projects.find(p => p.id === currentProjectId);

    // Project handlers
    const handleNewProject = useCallback(async () => {
        const newProjectData = createNewProject();

        if (isAuthenticated) {
            try {
                const created = await createCloudProject(newProjectData);
                setCurrentProjectId(created.id);
            } catch (error) {
                console.error('Failed to create project:', error);
            }
        } else {
            const newP: Project = {
                id: Date.now().toString(),
                name: newProjectData.name || 'Untitled Spark',
                lastModified: Date.now(),
                files: [],
                previewCode: '',
                messages: [],
            };
            setLocalProjects(prev => [newP, ...prev]);
            setCurrentProjectId(newP.id);
        }

        setViewState(ViewState.LANDING);
        setIsCodeView(false);
        setIsPreviewFullScreen(false);
        setAutoFixCount(0);
        if (window.innerWidth < 768) setSidebarOpen(false);
    }, [isAuthenticated, createCloudProject]);

    const handleSelectProject = useCallback((id: string) => {
        setCurrentProjectId(id);
        const project = projects.find(p => p.id === id);
        // Navigate to BUILDING if project has content (files or previewCode)
        if (project && (project.previewCode || project.files.length > 0)) {
            setViewState(ViewState.BUILDING);
        } else {
            setViewState(ViewState.LANDING);
        }
        setAutoFixCount(0);
        if (window.innerWidth < 768) setSidebarOpen(false);
    }, [projects]);

    const handleDeleteProject = useCallback(async (id: string) => {
        if (isAuthenticated) {
            try {
                await deleteCloudProject(id);
            } catch (error) {
                console.error('Failed to delete project:', error);
            }
        } else {
            setLocalProjects(prev => prev.filter(p => p.id !== id));
        }

        if (currentProjectId === id) {
            setCurrentProjectId(null);
            setViewState(ViewState.LANDING);
        }
    }, [isAuthenticated, deleteCloudProject, currentProjectId]);

    const updateProject = useCallback(async (id: string, updates: Partial<Project>) => {
        if (isAuthenticated) {
            try {
                await updateCloudProject(id, updates);
            } catch (error) {
                console.error('Failed to update project:', error);
            }
        } else {
            setLocalProjects(prev =>
                prev.map(p => p.id === id ? { ...p, ...updates, lastModified: Date.now() } : p)
            );
        }
    }, [isAuthenticated, updateCloudProject]);

    // Utility to merge new files with existing ones
    const mergeFiles = (currentFiles: File[], newFiles: File[]): File[] => {
        const normalizePath = (path: string) => {
            if (path.startsWith('./')) return path.slice(2);
            if (path.startsWith('/')) return path.slice(1);
            return path;
        };

        const fileMap = new Map(currentFiles.map(f => [normalizePath(f.name), f]));
        newFiles.forEach(f => {
            const normalizedName = normalizePath(f.name);
            fileMap.set(normalizedName, { ...f, name: normalizedName });
        });
        return Array.from(fileMap.values());
    };

    const handleSendMessage = async (content: string) => {
        // Require authentication to generate apps
        if (!isAuthenticated) {
            setShowAuthModal(true);
            return;
        }

        let projectId = currentProjectId;
        let project = currentProject;

        // If no project selected, create one
        if (!projectId || !project) {
            const newProjectData = {
                ...createNewProject(),
                name: content.slice(0, 30) + (content.length > 30 ? '...' : ''),
            };

            if (isAuthenticated) {
                try {
                    const created = await createCloudProject(newProjectData);
                    projectId = created.id;
                    project = created;
                    setCurrentProjectId(created.id);
                } catch (error) {
                    console.error('Failed to create project:', error);
                    return;
                }
            } else {
                const newP: Project = {
                    id: Date.now().toString(),
                    name: newProjectData.name || 'Untitled Spark',
                    lastModified: Date.now(),
                    files: [],
                    previewCode: '',
                    messages: [],
                };
                setLocalProjects(prev => [newP, ...prev]);
                setCurrentProjectId(newP.id);
                projectId = newP.id;
                project = newP;
            }
        }

        setAutoFixCount(0);
        setSidebarOpen(false);

        const userMsg: Message = {
            id: Date.now().toString(),
            role: MessageRole.USER,
            content,
            timestamp: Date.now()
        };

        const updatedMessages = [...(project?.messages || []), userMsg];

        await updateProject(projectId!, {
            messages: updatedMessages,
            name: project?.name === 'Untitled Spark' ? content.slice(0, 25) : project?.name
        });

        if (viewState === ViewState.LANDING) {
            setViewState(ViewState.BUILDING);
        }

        setIsLoading(true);
        setGenerationSteps([]);

        try {
            const generatedData = await generateAppCodeStream(
                content,
                project?.files || [],
                (steps) => setGenerationSteps(steps)
            );

            const mergedFiles = mergeFiles(project?.files || [], generatedData.files);

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: MessageRole.ASSISTANT,
                content: "I've updated the application. You can check the changes in the preview.",
                timestamp: Date.now()
            };

            await updateProject(projectId!, {
                messages: [...updatedMessages, aiMsg],
                files: mergedFiles,
                previewCode: generatedData.previewCode || project?.previewCode
            });

        } catch (error: any) {
            let errorMessage = "I encountered an issue connecting to the Aether. Please ensure your API key is valid.";

            if (error.message?.includes('429') || error.status === 429 || error.message?.includes('quota')) {
                errorMessage = "You have exceeded the API rate limit (429). Please try again in a minute or check your API key quota.";
            }

            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: MessageRole.ASSISTANT,
                content: errorMessage,
                timestamp: Date.now(),
                isError: true
            };

            await updateProject(projectId!, {
                messages: [...updatedMessages, errorMsg],
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAutoFixError = async (error: string) => {
        if (!currentProject || !currentProjectId) return;
        if (isLoading || autoFixCount >= 2) {
            console.warn("Auto-fix limit reached or already loading.");
            return;
        }

        console.log("Triggering Auto-Fix for error:", error);
        setAutoFixCount(prev => prev + 1);
        setIsLoading(true);
        setGenerationSteps([]);

        const sysMsg: Message = {
            id: Date.now().toString(),
            role: MessageRole.SYSTEM,
            content: `Runtime Error Detected: ${error}. Initiating targeted repair...`,
            timestamp: Date.now(),
            isError: true
        };

        const updatedMessages = [...currentProject.messages, sysMsg];
        await updateProject(currentProjectId, { messages: updatedMessages });

        try {
            const fixPrompt = `
        The previous code threw this runtime error: "${error}".
        
        1. Analyze the project files to identify the specific component causing this error.
        2. Return the CORRECTED content for ONLY the file(s) that need fixing.
        3. Return the updated <preview_html> that includes the fix.
        4. DO NOT return files that do not need changes.
      `;

            const generatedData = await generateAppCodeStream(
                fixPrompt,
                currentProject.files,
                (steps) => setGenerationSteps(steps)
            );

            const mergedFiles = mergeFiles(currentProject.files, generatedData.files);

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: MessageRole.ASSISTANT,
                content: "I've repaired the error by updating the affected component.",
                timestamp: Date.now()
            };

            await updateProject(currentProjectId, {
                messages: [...updatedMessages, aiMsg],
                files: mergedFiles,
                previewCode: generatedData.previewCode || currentProject.previewCode
            });

        } catch (error: any) {
            console.error("Auto-fix failed:", error);

            let errorMessage = "I could not auto-fix the error due to a connection issue.";
            if (error.message?.includes('429') || error.status === 429 || error.message?.includes('quota')) {
                errorMessage = "Auto-fix paused: API rate limit exceeded (429).";
            }

            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: MessageRole.ASSISTANT,
                content: errorMessage,
                timestamp: Date.now(),
                isError: true
            };

            await updateProject(currentProjectId, {
                messages: [...updatedMessages, errorMsg],
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Show loading state while checking auth
    if (authLoading) {
        return (
            <div className="flex h-screen w-full bg-black text-white items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-aether-lime border-t-transparent rounded-full"></div>
            </div>
        );
    }

    // Show shared project view if accessing via share link
    if (sharedProjectId) {
        return (
            <SharedProjectView
                shareId={sharedProjectId}
                onBack={() => {
                    setSharedProjectId(null);
                    // Clean up URL
                    window.history.replaceState({}, '', window.location.pathname);
                }}
            />
        );
    }

    return (
        <div className="flex h-screen w-full bg-black text-white overflow-hidden font-sans selection:bg-aether-lime selection:text-black">
            {/* Auth Modal */}
            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                onSignIn={signIn}
                onSignUp={signUp}
                onGoogleSignIn={signInWithGoogle}
            />

            {/* Share Modal */}
            {currentProject && (
                <ShareModal
                    isOpen={showShareModal}
                    onClose={() => setShowShareModal(false)}
                    projectName={currentProject.name}
                    shareId={currentProject.shareId}
                    isPublic={currentProject.isPublic || false}
                    onShare={async () => {
                        const shareId = await shareCloudProject(currentProject.id);
                        return shareId;
                    }}
                    onUnshare={async () => {
                        await unshareCloudProject(currentProject.id);
                    }}
                />
            )}

            <Sidebar
                projects={projects}
                currentProjectId={currentProjectId}
                onSelectProject={handleSelectProject}
                onNewProject={handleNewProject}
                onDeleteProject={handleDeleteProject}
                isOpen={sidebarOpen}
                toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                user={user}
                onAuthClick={() => setShowAuthModal(true)}
                onSignOut={signOut}
            />

            <div className={`
        flex-1 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]
        ${sidebarOpen ? 'md:ml-64' : 'md:ml-16'} 
        ml-0 h-full
      `}>

                {viewState === ViewState.LANDING ? (
                    <ChatInterface
                        messages={[]}
                        onSendMessage={handleSendMessage}
                        viewState={ViewState.LANDING}
                        isLoading={isLoading}
                        generationSteps={generationSteps}
                        projects={projects}
                        onSelectProject={handleSelectProject}
                        onDeleteProject={handleDeleteProject}
                    />
                ) : (
                    <div className="flex w-full h-full flex-col md:flex-row overflow-hidden">
                        <div className={`
              hidden md:block h-full shrink-0 border-r border-zinc-900 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]
              ${isPreviewFullScreen ? 'w-0 opacity-0 overflow-hidden' : 'w-[400px] opacity-100'}
            `}>
                            <ChatInterface
                                messages={currentProject?.messages || []}
                                onSendMessage={handleSendMessage}
                                viewState={ViewState.BUILDING}
                                isLoading={isLoading}
                                generationSteps={generationSteps}
                                projects={projects}
                                onSelectProject={handleSelectProject}
                                onDeleteProject={handleDeleteProject}
                            />
                        </div>

                        <div className="md:hidden h-1/2 border-b border-zinc-900 shrink-0">
                            <ChatInterface
                                messages={currentProject?.messages || []}
                                onSendMessage={handleSendMessage}
                                viewState={ViewState.BUILDING}
                                isLoading={isLoading}
                                generationSteps={generationSteps}
                                projects={projects}
                                onSelectProject={handleSelectProject}
                                onDeleteProject={handleDeleteProject}
                            />
                        </div>

                        <div className="flex-1 h-full min-w-0 overflow-hidden">
                            <PreviewWindow
                                previewCode={currentProject?.previewCode || ''}
                                files={currentProject?.files || []}
                                onToggleView={() => setIsCodeView(!isCodeView)}
                                isCodeView={isCodeView}
                                projectTitle={currentProject?.name || ''}
                                isLoading={isLoading}
                                isFullScreen={isPreviewFullScreen}
                                onToggleFullScreen={() => setIsPreviewFullScreen(!isPreviewFullScreen)}
                                onPreviewError={handleAutoFixError}
                                onShareClick={() => setShowShareModal(true)}
                                isPublic={currentProject?.isPublic}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
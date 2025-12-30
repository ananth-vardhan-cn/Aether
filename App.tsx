import React, { useState, useEffect, useCallback } from 'react';
import { HeaderBar } from './components/HeaderBar';
import { ChatInterface } from './components/ChatInterface';
import { PreviewWindow } from './components/PreviewWindow';
import { AuthModal } from './components/AuthModal';
import { ShareModal } from './components/ShareModal';
import { SharedProjectView } from './components/SharedProjectView';
import { ProjectsList } from './components/ProjectsList';
import { GitHubModal } from './components/GitHubModal';
import { ApiKeysModal } from './components/ApiKeysModal';
import { Message, MessageRole, Project, ViewState, GenerationStep, File, AIModel, AI_MODELS } from './types';
import { generateAppCodeStream } from './services/gemini-proxy';
import { useAuth } from './hooks/useAuth';
import { useProjects } from './hooks/useProjects';
import { useProjectVersions } from './hooks/useProjectVersions';
import { useApiKeys } from './hooks/useApiKeys';

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
        pinProject: pinCloudProject,
        unpinProject: unpinCloudProject,
    } = useProjects(user?.id);

    // Local projects (when not authenticated)
    const [localProjects, setLocalProjects] = useState<Project[]>([]);

    // Use cloud or local projects based on auth state
    const projects = isAuthenticated ? cloudProjects : localProjects;

    // UI state
    const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [viewState, setViewState] = useState<ViewState>(ViewState.LANDING);
    const [isCodeView, setIsCodeView] = useState(false);
    const [autoFixCount, setAutoFixCount] = useState(0);
    const [isSidebarHidden, setIsSidebarHidden] = useState(false);
    const [isAutoFixing, setIsAutoFixing] = useState(false);  // Flag to differentiate auto-fix from new builds
    const [generationSteps, setGenerationSteps] = useState<GenerationStep[]>([]);
    const [currentBuildPlan, setCurrentBuildPlan] = useState<string>('');
    const [currentBuildSummary, setCurrentBuildSummary] = useState<string>('');
    const [sessionTokenCount, setSessionTokenCount] = useState<number>(0);  // Cumulative tokens for current session
    const [showShareModal, setShowShareModal] = useState(false);
    const [sharedProjectId, setSharedProjectId] = useState<string | null>(null);
    const [showVersionHistory, setShowVersionHistory] = useState(false);
    const [showProjects, setShowProjects] = useState(false);
    const [showGitHubModal, setShowGitHubModal] = useState(false);
    const [previewingVersion, setPreviewingVersion] = useState<import('./hooks/useProjectVersions').ProjectVersion | null>(null);
    const [pendingError, setPendingError] = useState<string | null>(null);  // Error from Sandpack awaiting user action
    const [showApiKeysModal, setShowApiKeysModal] = useState(false);
    const [selectedModel, setSelectedModel] = useState<AIModel>(AI_MODELS[1]); // Default to Gemini 3 Flash

    // API Keys management
    const { configured: configuredProviders } = useApiKeys();

    // Version history
    const { versions, loading: versionsLoading, fetchVersions, saveVersion } = useProjectVersions();

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

        setViewState(ViewState.BUILDING);
        setIsCodeView(false);
        setAutoFixCount(0);
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

    const handlePinProject = useCallback(async (id: string, shouldPin: boolean) => {
        if (isAuthenticated) {
            try {
                if (shouldPin) {
                    await pinCloudProject(id);
                } else {
                    await unpinCloudProject(id);
                }
            } catch (error) {
                console.error('Failed to pin/unpin project:', error);
            }
        } else {
            // For local projects, toggle pin state
            setLocalProjects(prev =>
                prev.map(p =>
                    p.id === id
                        ? { ...p, isPinned: shouldPin, pinnedAt: shouldPin ? Date.now() : undefined }
                        : p
                )
            );
        }
    }, [isAuthenticated, pinCloudProject, unpinCloudProject]);

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

        const userMsg: Message = {
            id: Date.now().toString(),
            role: MessageRole.USER,
            content,
            timestamp: Date.now()
        };

        const updatedMessages = [...(project?.messages || []), userMsg];

        await updateProject(projectId!, {
            messages: updatedMessages
        });

        if (viewState === ViewState.LANDING) {
            setViewState(ViewState.BUILDING);
        }

        setIsLoading(true);
        setGenerationSteps([]);
        setCurrentBuildPlan('');
        setCurrentBuildSummary('');
        setSessionTokenCount(0);  // Reset for new user prompt

        const generationStartTime = Date.now();  // Track generation start time

        try {
            const generatedData = await generateAppCodeStream(
                content,
                project?.files || [],
                (steps) => setGenerationSteps(steps),
                (buildPlan) => setCurrentBuildPlan(buildPlan),
                selectedModel
            );

            // Update build plan and summary for display
            if (generatedData.buildPlan) {
                setCurrentBuildPlan(generatedData.buildPlan);
            }
            if (generatedData.buildSummary) {
                setCurrentBuildSummary(generatedData.buildSummary);
            }

            // Set session token count (initial generation starts fresh)
            const newSessionTokens = generatedData.tokenCount || 0;
            setSessionTokenCount(newSessionTokens);

            const mergedFiles = mergeFiles(project?.files || [], generatedData.files);

            // Calculate thinking time in seconds
            const thinkingTime = Math.round((Date.now() - generationStartTime) / 1000);

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: MessageRole.ASSISTANT,
                content: generatedData.buildPlan || "I've updated the application. You can check the changes in the preview.",
                timestamp: Date.now(),
                buildSummary: generatedData.buildSummary,
                actions: generatedData.files.map(f => {
                    // Get line count from generationSteps if available
                    const step = generationSteps.find(s => s.id === f.name);
                    const lineCount = step?.lineCount || (f.content.match(/\n/g) || []).length + 1;
                    return { fileName: f.name, lineCount };
                }),
                tokenCount: newSessionTokens,
                thinkingTime,
            };

            await updateProject(projectId!, {
                messages: [...updatedMessages, aiMsg],
                files: mergedFiles,
                previewCode: generatedData.previewCode || project?.previewCode
            });

            // Auto-save version after successful generation
            if (isAuthenticated && projectId) {
                saveVersion(
                    projectId,
                    mergedFiles,
                    generatedData.previewCode || project?.previewCode || '',
                    content
                );
            }

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

    // Handle editing a user message - deletes all messages after it and resends with new content
    const handleEditMessage = async (messageId: string, newContent: string) => {
        if (!currentProject || !currentProjectId) return;
        if (isLoading) return;

        // Find the index of the message being edited
        const messageIndex = currentProject.messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) return;

        // Keep only messages up to (but not including) the edited message
        const messagesBeforeEdit = currentProject.messages.slice(0, messageIndex);

        // Update the project with truncated messages
        await updateProject(currentProjectId, {
            messages: messagesBeforeEdit
        });

        // Send the new message (this will trigger a new generation)
        handleSendMessage(newContent);
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
        setIsAutoFixing(true);  // Mark as auto-fix to hide Aether label
        setGenerationSteps([]);
        setCurrentBuildPlan('');     // Clear previous build plan
        setCurrentBuildSummary('');  // Clear previous build summary

        const generationStartTime = Date.now();  // Track generation start time

        const sysMsg: Message = {
            id: Date.now().toString(),
            role: MessageRole.SYSTEM,
            content: error,
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
                (steps) => setGenerationSteps(steps),
                undefined, // no build plan callback for auto-fix
                selectedModel
            );

            // Accumulate tokens to session total for auto-fixes
            const fixTokens = generatedData.tokenCount || 0;
            const cumulativeTokens = sessionTokenCount + fixTokens;
            setSessionTokenCount(cumulativeTokens);

            const mergedFiles = mergeFiles(currentProject.files, generatedData.files);

            // Calculate thinking time in seconds
            const thinkingTime = Math.round((Date.now() - generationStartTime) / 1000);

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: MessageRole.ASSISTANT,
                content: "I've repaired the error by updating the affected component.",
                timestamp: Date.now(),
                // Persist the actions taken during fix
                actions: generatedData.files.map(f => {
                    const step = generationSteps.find(s => s.id === f.name);
                    const lineCount = step?.lineCount || (f.content.match(/\n/g) || []).length + 1;
                    return { fileName: f.name, lineCount };
                }),
                tokenCount: cumulativeTokens,  // Show cumulative session total
                thinkingTime,
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
            setIsAutoFixing(false);
        }
    };

    // Capture error from Sandpack preview
    const handleCaptureError = useCallback((error: string) => {
        // Don't capture errors while we're fixing one or if same error
        if (isLoading || pendingError === error) return;
        setPendingError(error);
    }, [isLoading, pendingError]);

    // Dismiss error without fixing
    const handleDismissError = useCallback(() => {
        setPendingError(null);
    }, []);

    // Auto-fix and clear pending error
    const handleAutoFixWithClear = useCallback((error: string) => {
        setPendingError(null);
        handleAutoFixError(error);
    }, [handleAutoFixError]);

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

            {/* API Keys Modal */}
            <ApiKeysModal
                isOpen={showApiKeysModal}
                onClose={() => setShowApiKeysModal(false)}
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

            {/* GitHub Modal */}
            {currentProject && (
                <GitHubModal
                    isOpen={showGitHubModal}
                    onClose={() => setShowGitHubModal(false)}
                    projectId={currentProject.id}
                    projectName={currentProject.name}
                    files={currentProject.files}
                />
            )}

            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

                {viewState === ViewState.LANDING ? (
                    <div className="flex flex-col w-full h-full">
                        <HeaderBar
                            projects={projects}
                            currentProjectId={currentProjectId}
                            onSelectProject={handleSelectProject}
                            onNewProject={handleNewProject}
                            onDeleteProject={handleDeleteProject}
                            user={user}
                            onAuthClick={() => setShowAuthModal(true)}
                            onSignOut={signOut}
                            onApiKeysClick={() => setShowApiKeysModal(true)}
                            onHome={() => {
                                setCurrentProjectId(null);
                                setViewState(ViewState.LANDING);
                                setPreviewingVersion(null);
                                setShowVersionHistory(false);
                            }}
                            transparent={true}
                        />
                        <ChatInterface
                            messages={[]}
                            onSendMessage={handleSendMessage}
                            viewState={ViewState.LANDING}
                            isLoading={isLoading}
                            generationSteps={generationSteps}
                            buildPlan={currentBuildPlan}
                            buildSummary={currentBuildSummary}
                            projects={projects}
                            onSelectProject={handleSelectProject}
                            onDeleteProject={handleDeleteProject}
                            onPinProject={handlePinProject}
                            selectedModel={selectedModel}
                            onSelectModel={setSelectedModel}
                            configuredProviders={configuredProviders}
                            onApiKeysClick={() => setShowApiKeysModal(true)}
                        />
                    </div>
                ) : (
                    <>
                        {/* Left Column: Header + Chat */}
                        <div
                            className={`
                                h-full shrink-0 overflow-hidden
                            `}
                            style={{
                                maxWidth: isSidebarHidden ? '0px' : '477px',
                                opacity: isSidebarHidden ? 0 : 1,
                            }}
                        >
                            <div className="flex flex-col h-full w-[38vw] min-w-[333px] max-w-[477px] border-r border-zinc-900">
                                <HeaderBar
                                    projects={projects}
                                    currentProjectId={currentProjectId}
                                    onSelectProject={handleSelectProject}
                                    onNewProject={handleNewProject}
                                    onDeleteProject={handleDeleteProject}
                                    user={user}
                                    onAuthClick={() => setShowAuthModal(true)}
                                    onSignOut={signOut}
                                    onApiKeysClick={() => setShowApiKeysModal(true)}
                                    onHome={() => {
                                        setCurrentProjectId(null);
                                        setViewState(ViewState.LANDING);
                                        setPreviewingVersion(null);
                                        setShowVersionHistory(false);
                                    }}
                                    isLoading={isLoading}
                                    showVersionHistory={showVersionHistory}
                                    onVersionHistoryClick={() => {
                                        if (currentProjectId) {
                                            fetchVersions(currentProjectId);
                                            setShowVersionHistory(true);
                                            setShowProjects(false);
                                        }
                                    }}
                                    onCloseVersionHistory={() => setShowVersionHistory(false)}
                                    onToggleProjects={() => {
                                        setShowProjects(!showProjects);
                                        if (showVersionHistory) setShowVersionHistory(false);
                                    }}
                                    showProjects={showProjects}
                                />
                                {showProjects ? (
                                    <ProjectsList
                                        projects={projects}
                                        currentProjectId={currentProjectId}
                                        onSelectProject={handleSelectProject}
                                        onNewProject={handleNewProject}
                                        onDeleteProject={handleDeleteProject}
                                        onPinProject={handlePinProject}
                                        onClose={() => setShowProjects(false)}
                                    />
                                ) : (
                                    <ChatInterface
                                        messages={currentProject?.messages || []}
                                        onSendMessage={handleSendMessage}
                                        viewState={ViewState.BUILDING}
                                        isLoading={isLoading}
                                        generationSteps={generationSteps}
                                        buildPlan={currentBuildPlan}
                                        buildSummary={currentBuildSummary}
                                        projects={projects}
                                        onSelectProject={handleSelectProject}
                                        onDeleteProject={handleDeleteProject}
                                        onPinProject={handlePinProject}
                                        versions={versions}
                                        versionsLoading={versionsLoading}
                                        currentFiles={currentProject?.files || []}
                                        showVersionHistory={showVersionHistory}
                                        onHistoryClick={() => {
                                            if (currentProjectId) {
                                                fetchVersions(currentProjectId);
                                                setShowVersionHistory(true);
                                            }
                                        }}
                                        onCloseVersionHistory={() => setShowVersionHistory(false)}
                                        onRevert={async (version) => {
                                            await updateProject(currentProject!.id, {
                                                files: version.files,
                                                previewCode: version.previewCode,
                                            });
                                            setShowVersionHistory(false);
                                            setPreviewingVersion(null);
                                        }}
                                        onPreviewVersion={setPreviewingVersion}
                                        previewingVersionId={previewingVersion?.id || null}
                                        userEmail={user?.email}
                                        pendingError={pendingError}
                                        onAutoFix={handleAutoFixWithClear}
                                        onDismissError={handleDismissError}
                                        isAutoFixing={isAutoFixing}
                                        selectedModel={selectedModel}
                                        onSelectModel={setSelectedModel}
                                        configuredProviders={configuredProviders}
                                        onApiKeysClick={() => setShowApiKeysModal(true)}
                                        onEditMessage={handleEditMessage}
                                    />
                                )}
                            </div>
                        </div>

                        <div className="md:hidden h-1/2 border-b border-zinc-900 shrink-0">
                            <ChatInterface
                                messages={currentProject?.messages || []}
                                onSendMessage={handleSendMessage}
                                viewState={ViewState.BUILDING}
                                isLoading={isLoading}
                                generationSteps={generationSteps}
                                buildPlan={currentBuildPlan}
                                buildSummary={currentBuildSummary}
                                projects={projects}
                                onSelectProject={handleSelectProject}
                                onDeleteProject={handleDeleteProject}
                                onPinProject={handlePinProject}
                                versions={versions}
                                versionsLoading={versionsLoading}
                                currentFiles={currentProject?.files || []}
                                showVersionHistory={showVersionHistory}
                                onHistoryClick={() => {
                                    if (currentProjectId) {
                                        fetchVersions(currentProjectId);
                                        setShowVersionHistory(true);
                                    }
                                }}
                                onCloseVersionHistory={() => setShowVersionHistory(false)}
                                onRevert={async (version) => {
                                    await updateProject(currentProject!.id, {
                                        files: version.files,
                                        previewCode: version.previewCode,
                                    });
                                    setShowVersionHistory(false);
                                    setPreviewingVersion(null);
                                }}
                                onPreviewVersion={setPreviewingVersion}
                                previewingVersionId={previewingVersion?.id || null}
                                userEmail={user?.email}
                                pendingError={pendingError}
                                onAutoFix={handleAutoFixWithClear}
                                onDismissError={handleDismissError}
                                isAutoFixing={isAutoFixing}
                                selectedModel={selectedModel}
                                onSelectModel={setSelectedModel}
                                configuredProviders={configuredProviders}
                                onApiKeysClick={() => setShowApiKeysModal(true)}
                                onEditMessage={handleEditMessage}
                            />
                        </div>

                        <div className="flex-1 h-full min-w-0 overflow-hidden">
                            <PreviewWindow
                                previewCode={previewingVersion?.previewCode || currentProject?.previewCode || ''}
                                files={previewingVersion?.files || currentProject?.files || []}
                                onToggleView={() => setIsCodeView(!isCodeView)}
                                isCodeView={isCodeView}
                                projectTitle={currentProject?.name || ''}
                                isLoading={isLoading}
                                onPreviewError={handleCaptureError}
                                onShareClick={() => setShowShareModal(true)}
                                onGitHubClick={() => setShowGitHubModal(true)}
                                isPublic={currentProject?.isPublic}
                                previewingVersion={previewingVersion}
                                onRestoreVersion={async () => {
                                    if (previewingVersion && currentProject) {
                                        await updateProject(currentProject.id, {
                                            files: previewingVersion.files,
                                            previewCode: previewingVersion.previewCode,
                                        });
                                        setPreviewingVersion(null);
                                        setShowVersionHistory(false);
                                    }
                                }}
                                onBackToLatest={() => setPreviewingVersion(null)}
                                isSidebarHidden={isSidebarHidden}
                                onToggleSidebar={() => setIsSidebarHidden(!isSidebarHidden)}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
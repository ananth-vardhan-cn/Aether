import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatInterface } from './components/ChatInterface';
import { PreviewWindow } from './components/PreviewWindow';
import { Message, MessageRole, Project, ViewState, GenerationStep, File } from './types';
import { generateAppCodeStream } from './services/gemini';

// Mock initial project for empty state
const createNewProject = (): Project => ({
  id: Date.now().toString(),
  name: 'Untitled Spark',
  lastModified: Date.now(),
  files: [],
  previewCode: '',
  messages: [],
});

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [viewState, setViewState] = useState<ViewState>(ViewState.LANDING);
  const [isCodeView, setIsCodeView] = useState(false);
  const [isPreviewFullScreen, setIsPreviewFullScreen] = useState(false);

  // Auto-fix tracking
  const [autoFixCount, setAutoFixCount] = useState(0);

  // New state for tracking generation steps
  const [generationSteps, setGenerationSteps] = useState<GenerationStep[]>([]);

  // Load from LocalStorage on mount
  useEffect(() => {
    const savedProjects = localStorage.getItem('aether_projects');
    if (savedProjects) {
      try {
        const parsed = JSON.parse(savedProjects);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProjects(parsed);
          // Don't automatically select a project, stay on landing
          return;
        }
      } catch (e) {
        console.error("Failed to parse projects from local storage");
      }
    }
  }, []);

  // Save to LocalStorage whenever projects change
  useEffect(() => {
    if (projects.length >= 0) {
      localStorage.setItem('aether_projects', JSON.stringify(projects));
    }
  }, [projects]);

  const currentProject = projects.find(p => p.id === currentProjectId);

  const handleNewProject = () => {
    const newP = createNewProject();
    setProjects(prev => [newP, ...prev]);
    setCurrentProjectId(newP.id);
    setViewState(ViewState.LANDING);
    setIsCodeView(false);
    setIsPreviewFullScreen(false);
    setAutoFixCount(0);
    // Close sidebar on mobile when new project starts for better focus
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleSelectProject = (id: string) => {
    setCurrentProjectId(id);
    const project = projects.find(p => p.id === id);
    if (project && project.previewCode) {
      setViewState(ViewState.BUILDING);
    } else {
      setViewState(ViewState.LANDING);
    }
    setAutoFixCount(0);
    // Close sidebar on mobile when selecting
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleDeleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (currentProjectId === id) {
      setCurrentProjectId(null);
      setViewState(ViewState.LANDING);
    }
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates, lastModified: Date.now() } : p));
  };

  // Utility to merge new files with existing ones using path normalization
  const mergeFiles = (currentFiles: File[], newFiles: File[]): File[] => {
    // Helper to normalize paths
    const normalizePath = (path: string) => {
      if (path.startsWith('./')) return path.slice(2);
      if (path.startsWith('/')) return path.slice(1);
      return path;
    };

    const fileMap = new Map(currentFiles.map(f => [normalizePath(f.name), f]));
    newFiles.forEach(f => {
      const normalizedName = normalizePath(f.name);
      // Ensure name is stored normalized
      fileMap.set(normalizedName, { ...f, name: normalizedName });
    });
    return Array.from(fileMap.values());
  };

  const handleSendMessage = async (content: string) => {
    let projectId = currentProjectId;
    let project = currentProject;

    // If no project selected or exists, create one
    if (!projectId || !project) {
      const newP = createNewProject();
      // Name it after the prompt initially
      newP.name = content.slice(0, 30) + (content.length > 30 ? '...' : '');
      setProjects(prev => [newP, ...prev]);
      setCurrentProjectId(newP.id);
      projectId = newP.id;
      project = newP;
    }

    // Reset auto-fix count on new user input
    setAutoFixCount(0);

    // Auto-collapse sidebar for focus
    setSidebarOpen(false);

    // 1. Add user message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      content,
      timestamp: Date.now()
    };

    // We need to use the project reference we have (either existing or new)
    // Note: state updates are async, so we construct the new state manually for the API call
    const updatedMessages = [...project.messages, userMsg];

    // Optimistic update
    updateProject(projectId, {
      messages: updatedMessages,
      // If name is still default, update it
      name: project.name === 'Untitled Spark' ? content.slice(0, 25) : project.name
    });

    // Switch to building view immediately if not already
    if (viewState === ViewState.LANDING) {
      setViewState(ViewState.BUILDING);
    }

    setIsLoading(true);
    setGenerationSteps([]); // Reset steps for new generation

    try {
      // 2. Call Gemini with Streaming
      const generatedData = await generateAppCodeStream(
        content,
        project.files,
        (steps) => setGenerationSteps(steps) // Update UI with steps as they happen
      );

      // 3. Merge new files with existing files
      const mergedFiles = mergeFiles(project.files, generatedData.files);

      // 4. Add assistant message
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: MessageRole.ASSISTANT,
        content: "I've updated the application. You can check the changes in the preview.",
        timestamp: Date.now()
      };

      updateProject(projectId, {
        messages: [...updatedMessages, aiMsg],
        files: mergedFiles,
        previewCode: generatedData.previewCode || project.previewCode
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
      updateProject(projectId, {
        messages: [...updatedMessages, errorMsg],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoFixError = async (error: string) => {
    if (!currentProject) return;

    // Safety mechanism: prevent infinite loops
    if (isLoading || autoFixCount >= 2) {
      console.warn("Auto-fix limit reached or already loading.");
      return;
    }

    console.log("Triggering Auto-Fix for error:", error);
    setAutoFixCount(prev => prev + 1);
    setIsLoading(true);
    setGenerationSteps([]);

    // 1. Add SYSTEM message to show error detected
    const sysMsg: Message = {
      id: Date.now().toString(),
      role: MessageRole.SYSTEM,
      content: `Runtime Error Detected: ${error}. Initiating targeted repair...`,
      timestamp: Date.now(),
      isError: true
    };

    const updatedMessages = [...currentProject.messages, sysMsg];
    updateProject(currentProject.id, { messages: updatedMessages });

    try {
      // 2. Call Gemini to Fix
      // Explicitly ask for targeted fixes to avoid full regeneration
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

      // 3. Merge updates
      const mergedFiles = mergeFiles(currentProject.files, generatedData.files);

      // 4. Add success message
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: MessageRole.ASSISTANT,
        content: "I've repaired the error by updating the affected component.",
        timestamp: Date.now()
      };

      updateProject(currentProject.id, {
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

      updateProject(currentProject.id, {
        messages: [...updatedMessages, errorMsg],
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-black text-white overflow-hidden font-sans selection:bg-aether-lime selection:text-black">
      <Sidebar
        projects={projects}
        currentProjectId={currentProjectId}
        onSelectProject={handleSelectProject}
        onNewProject={handleNewProject}
        onDeleteProject={handleDeleteProject}
        isOpen={sidebarOpen}
        toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Content Wrapper */}
      <div className={`
        flex-1 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]
        ${sidebarOpen ? 'md:ml-64' : 'md:ml-16'} 
        ml-0 h-full
      `}>

        {/* Conditional Layout based on State */}
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
            {/* Left Chat Panel - Hidden if Full Screen Preview is active */}
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

            {/* Mobile Chat Toggle */}
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

            {/* Right Preview Panel */}
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
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
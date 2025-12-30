import { supabase } from '../lib/supabase';
import { File, GenerationStep, GeneratedProject, AIModel } from '../types';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Get file type for icon display
 */
const getFileType = (filename: string): GenerationStep['fileType'] => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'tsx' || ext === 'ts' || ext === 'jsx' || ext === 'js') return 'tsx';
    if (ext === 'css') return 'css';
    if (ext === 'json') return 'json';
    if (ext === 'html' || ext === 'htm') return 'html';
    return 'other';
};

export const generateAppCodeStream = async (
    prompt: string,
    currentFiles: File[],
    onStepChange: (steps: GenerationStep[]) => void,
    onBuildPlanChange?: (buildPlan: string) => void,
    selectedModel?: AIModel
): Promise<GeneratedProject> => {

    // Get current session for auth token
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        throw new Error("You must be signed in to generate apps");
    }

    const userId = session.user.id;

    // Default to Gemini 3 Flash if no model selected
    const provider = selectedModel?.provider || 'gemini';
    const modelId = selectedModel?.id || 'gemini-3-flash-preview';

    // Create generation session for real-time updates
    const { data: sessionData, error: sessionError } = await supabase
        .from('generation_sessions')
        .insert({
            user_id: userId,
            status: 'pending',
            steps: []
        })
        .select()
        .single();

    if (sessionError) {
        console.error('Failed to create generation session:', sessionError);
        // Fallback to non-realtime mode
        return generateWithoutRealtime(prompt, currentFiles, onStepChange, provider, modelId);
    }

    const generationSessionId = sessionData.id;
    let channel: RealtimeChannel | null = null;

    // Show initial step
    const initialSteps: GenerationStep[] = [{
        id: 'init',
        label: 'Analyzing requirements',
        status: 'in-progress'
    }];
    onStepChange(initialSteps);

    try {
        // Subscribe to real-time updates
        channel = supabase
            .channel(`generation_${generationSessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'generation_sessions',
                    filter: `id=eq.${generationSessionId}`
                },
                (payload) => {
                    const newData = payload.new as any;
                    if (newData.steps && Array.isArray(newData.steps)) {
                        onStepChange(newData.steps);
                    }
                    // Stream build plan as soon as it's available
                    if (newData.build_plan && onBuildPlanChange) {
                        onBuildPlanChange(newData.build_plan);
                    }
                }
            )
            .subscribe();

        // Call the Edge Function with session ID, provider, and model
        const { data, error } = await supabase.functions.invoke('generate-app', {
            body: {
                prompt,
                sessionId: generationSessionId,
                provider,
                modelId,
                currentFiles: currentFiles.map(f => ({
                    name: f.name,
                    content: f.content,
                    type: f.type,
                })),
            },
        });

        if (error) {
            throw new Error(error.message || 'Failed to generate app');
        }

        // Check for API key errors from the response
        if (data.error) {
            throw new Error(data.error);
        }

        // Parse files
        const files: File[] = (data.files || []).map((f: { name: string; content: string; type: string }) => ({
            name: f.name,
            content: f.content,
            type: f.type as File['type'],
        }));

        return {
            files,
            previewCode: data.previewCode || '',
            buildPlan: data.buildPlan || '',
            buildSummary: data.buildSummary || '',
            tokenCount: data.tokenCount || 0,
        };

    } catch (error: unknown) {
        throw error;
    } finally {
        // Cleanup
        if (channel) {
            supabase.removeChannel(channel);
        }

        // Delete session after completion
        await supabase
            .from('generation_sessions')
            .delete()
            .eq('id', generationSessionId);
    }
};

/**
 * Fallback for when real-time session creation fails
 */
async function generateWithoutRealtime(
    prompt: string,
    currentFiles: File[],
    onStepChange: (steps: GenerationStep[]) => void,
    provider: string = 'gemini',
    modelId: string = 'gemini-3-flash-preview'
): Promise<GeneratedProject> {
    const existingFileNames = new Set(currentFiles.map(f => f.name));

    const steps: GenerationStep[] = [{
        id: 'init',
        label: 'Analyzing requirements',
        status: 'in-progress'
    }];
    onStepChange(steps);

    const { data, error } = await supabase.functions.invoke('generate-app', {
        body: {
            prompt,
            provider,
            modelId,
            currentFiles: currentFiles.map(f => ({
                name: f.name,
                content: f.content,
                type: f.type,
            })),
        },
    });

    if (error) {
        throw new Error(error.message || 'Failed to generate app');
    }

    // Check for API key errors from the response
    if (data.error) {
        throw new Error(data.error);
    }

    steps[0].status = 'completed';
    onStepChange([...steps]);

    const files: File[] = (data.files || []).map((f: { name: string; content: string; type: string }) => ({
        name: f.name,
        content: f.content,
        type: f.type as File['type'],
    }));

    // Show files after completion
    for (const file of files) {
        const action = existingFileNames.has(file.name) ? 'Updating' : 'Creating';
        steps.push({
            id: file.name,
            label: `${action} ${file.name}`,
            status: 'completed',
            fileType: getFileType(file.name),
            lineCount: (file.content.match(/\n/g) || []).length + 1
        });
        onStepChange([...steps]);
    }

    return {
        files,
        previewCode: data.previewCode || '',
        buildPlan: data.buildPlan || '',
        buildSummary: data.buildSummary || '',
        tokenCount: data.tokenCount || 0,
    };
}

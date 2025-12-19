import { supabase } from '../lib/supabase';
import { File, GenerationStep } from '../types';

interface GeneratedProject {
    files: File[];
    previewCode: string;
}

export const generateAppCodeStream = async (
    prompt: string,
    currentFiles: File[],
    onStepChange: (steps: GenerationStep[]) => void
): Promise<GeneratedProject> => {

    // Get current session for auth token
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        throw new Error("You must be signed in to generate apps");
    }

    // Show initial step
    const steps: GenerationStep[] = [{
        id: '1',
        label: 'Connecting to Aether...',
        status: 'in-progress'
    }];
    onStepChange(steps);

    try {
        // Call the Edge Function
        const { data, error } = await supabase.functions.invoke('generate-app', {
            body: {
                prompt,
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

        // Update step
        steps[0].status = 'completed';
        steps.push({ id: '2', label: 'Generating application...', status: 'completed' });
        onStepChange([...steps]);

        // Parse the response
        const project: GeneratedProject = {
            files: (data.files || []).map((f: { name: string; content: string; type: string }) => ({
                name: f.name,
                content: f.content,
                type: f.type as File['type'],
            })),
            previewCode: data.previewCode || '',
        };

        return project;

    } catch (error: unknown) {
        steps[0].status = 'completed';
        onStepChange([...steps]);
        throw error;
    }
};

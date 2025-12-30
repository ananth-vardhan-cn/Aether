import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { GenerationStep } from '../types';
import { RealtimeChannel } from '@supabase/supabase-js';

interface GenerationSession {
    id: string;
    status: 'pending' | 'generating' | 'completed' | 'error';
    steps: GenerationStep[];
    errorMessage?: string;
}

/**
 * Hook to manage real-time generation progress via Supabase Realtime
 */
export function useGenerationSession(userId: string | undefined) {
    const [session, setSession] = useState<GenerationSession | null>(null);
    const [steps, setSteps] = useState<GenerationStep[]>([]);
    const channelRef = useRef<RealtimeChannel | null>(null);

    /**
     * Create a new generation session
     */
    const createSession = useCallback(async (): Promise<string | null> => {
        if (!userId) return null;

        try {
            const { data, error } = await supabase
                .from('generation_sessions')
                .insert({
                    user_id: userId,
                    status: 'pending',
                    steps: []
                })
                .select()
                .single();

            if (error) throw error;

            setSession({
                id: data.id,
                status: data.status,
                steps: data.steps || [],
            });
            setSteps([]);

            return data.id;
        } catch (err) {
            console.error('Failed to create generation session:', err);
            return null;
        }
    }, [userId]);

    /**
     * Subscribe to real-time updates for a session
     */
    const subscribeToSession = useCallback((sessionId: string) => {
        // Clean up existing subscription
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }

        // Create new subscription
        const channel = supabase
            .channel(`generation_session_${sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'generation_sessions',
                    filter: `id=eq.${sessionId}`
                },
                (payload) => {
                    const newData = payload.new as any;

                    setSession({
                        id: newData.id,
                        status: newData.status,
                        steps: newData.steps || [],
                        errorMessage: newData.error_message,
                    });

                    // Update steps for UI
                    setSteps(newData.steps || []);
                }
            )
            .subscribe();

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    /**
     * Clean up session after completion
     */
    const cleanupSession = useCallback(async (sessionId: string) => {
        try {
            await supabase
                .from('generation_sessions')
                .delete()
                .eq('id', sessionId);
        } catch (err) {
            console.error('Failed to cleanup session:', err);
        }

        setSession(null);
        setSteps([]);

        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, []);

    return {
        session,
        steps,
        createSession,
        subscribeToSession,
        cleanupSession,
        isGenerating: session?.status === 'generating',
        isCompleted: session?.status === 'completed',
        hasError: session?.status === 'error',
    };
}

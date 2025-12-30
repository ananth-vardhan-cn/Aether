import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export type AIProvider = 'gemini' | 'anthropic' | 'openai';

interface ApiKeysState {
    gemini: boolean;
    anthropic: boolean;
    openai: boolean;
}

interface UseApiKeysReturn {
    configured: ApiKeysState;
    loading: boolean;
    error: string | null;
    saveApiKey: (provider: AIProvider, apiKey: string) => Promise<boolean>;
    deleteApiKey: (provider: AIProvider) => Promise<boolean>;
    refreshStatus: () => Promise<void>;
}

export function useApiKeys(): UseApiKeysReturn {
    const [configured, setConfigured] = useState<ApiKeysState>({
        gemini: false,
        anthropic: false,
        openai: false,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check which providers have API keys configured
    const refreshStatus = useCallback(async () => {
        try {
            const { data, error: funcError } = await supabase.functions.invoke('manage-api-keys', {
                body: { action: 'check', provider: 'gemini' }, // provider is ignored for check
            });

            if (funcError) throw funcError;

            if (data.configured) {
                setConfigured(data.configured);
            }
        } catch (err: unknown) {
            console.error('Error checking API keys:', err);
        }
    }, []);

    // Load status on mount
    useEffect(() => {
        refreshStatus();
    }, [refreshStatus]);

    // Save an API key
    const saveApiKey = useCallback(async (provider: AIProvider, apiKey: string): Promise<boolean> => {
        setLoading(true);
        setError(null);

        try {
            const { data, error: funcError } = await supabase.functions.invoke('manage-api-keys', {
                body: { action: 'save', provider, apiKey },
            });

            if (funcError) throw funcError;
            if (data.error) throw new Error(data.error);

            // Update local state
            setConfigured(prev => ({ ...prev, [provider]: true }));
            return true;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to save API key';
            setError(message);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    // Delete an API key
    const deleteApiKey = useCallback(async (provider: AIProvider): Promise<boolean> => {
        setLoading(true);
        setError(null);

        try {
            const { data, error: funcError } = await supabase.functions.invoke('manage-api-keys', {
                body: { action: 'delete', provider },
            });

            if (funcError) throw funcError;
            if (data.error) throw new Error(data.error);

            // Update local state
            setConfigured(prev => ({ ...prev, [provider]: false }));
            return true;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to delete API key';
            setError(message);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        configured,
        loading,
        error,
        saveApiKey,
        deleteApiKey,
        refreshStatus,
    };
}

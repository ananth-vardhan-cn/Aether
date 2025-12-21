import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials not found. Cloud features disabled.');
}

export const supabase = createClient(
    supabaseUrl || '',
    supabaseAnonKey || ''
);

// Type definitions for database tables
export interface Profile {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
    created_at: string;
    updated_at: string;
}

export interface ProjectRow {
    id: string;
    user_id: string;
    name: string;
    files: Array<{ name: string; content: string; type: string }>;
    preview_code: string;
    messages: Array<{
        id: string;
        role: 'user' | 'assistant' | 'system';
        content: string;
        timestamp: number;
        isError?: boolean;
    }>;
    share_id: string | null;            // Unique ID for public sharing
    is_public: boolean;                 // Whether project is publicly accessible
    created_at: string;
    updated_at: string;
}

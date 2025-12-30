-- Migration: Add Supabase Vault for API Key Storage
-- Deploy with: npx supabase db push

-- Enable the vault extension (for encrypted secrets storage)
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- Create a table to track which users have which API keys configured
-- (The actual keys are stored in vault.secrets, this just tracks metadata)
CREATE TABLE IF NOT EXISTS public.user_api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('gemini', 'anthropic', 'openai')),
    secret_id UUID NOT NULL,  -- Reference to vault.secrets
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, provider)
);

-- Enable RLS
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own API keys metadata" 
    ON public.user_api_keys FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own API keys" 
    ON public.user_api_keys FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys" 
    ON public.user_api_keys FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys" 
    ON public.user_api_keys FOR DELETE 
    USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_user_api_keys_user_provider ON public.user_api_keys(user_id, provider);

-- Auto-update timestamps
CREATE TRIGGER update_user_api_keys_updated_at 
    BEFORE UPDATE ON public.user_api_keys
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Note: The vault extension provides vault.decrypted_secrets view
-- Edge Functions use SUPABASE_SERVICE_ROLE_KEY which has access to:
--   - vault.create_secret(secret, name) -> returns secret_id
--   - vault.update_secret(secret_id, new_secret, new_name)
--   - vault.delete_secret(secret_id)
--   - vault.decrypted_secrets (view with decrypted_secret column)

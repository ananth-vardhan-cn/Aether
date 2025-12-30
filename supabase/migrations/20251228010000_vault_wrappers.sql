-- Migration: Add Vault wrapper functions for API key management
-- The vault extension functions are in the 'vault' schema, 
-- but supabase.rpc() only accesses 'public' schema by default.
-- These wrappers allow Edge Functions to call vault operations.

-- Wrapper to create a secret in vault
CREATE OR REPLACE FUNCTION public.create_vault_secret(secret text, name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault
AS $$
DECLARE
    secret_id uuid;
BEGIN
    INSERT INTO vault.secrets (secret, name)
    VALUES (create_vault_secret.secret, create_vault_secret.name)
    RETURNING id INTO secret_id;
    
    RETURN secret_id;
END;
$$;

-- Wrapper to update a secret in vault
CREATE OR REPLACE FUNCTION public.update_vault_secret(
    secret_id uuid, 
    new_secret text, 
    new_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault
AS $$
BEGIN
    UPDATE vault.secrets 
    SET 
        secret = update_vault_secret.new_secret,
        name = COALESCE(update_vault_secret.new_name, vault.secrets.name),
        updated_at = now()
    WHERE id = update_vault_secret.secret_id;
END;
$$;

-- Wrapper to delete a secret from vault
CREATE OR REPLACE FUNCTION public.delete_vault_secret(secret_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault
AS $$
BEGIN
    DELETE FROM vault.secrets WHERE id = delete_vault_secret.secret_id;
END;
$$;

-- Wrapper to read a decrypted secret from vault
CREATE OR REPLACE FUNCTION public.read_vault_secret(secret_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault
AS $$
DECLARE
    decrypted text;
BEGIN
    SELECT decrypted_secret INTO decrypted
    FROM vault.decrypted_secrets
    WHERE id = read_vault_secret.secret_id;
    
    RETURN decrypted;
END;
$$;

-- Revoke public access (only service role should call these)
REVOKE EXECUTE ON FUNCTION public.create_vault_secret(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_vault_secret(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_vault_secret(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_vault_secret(uuid) FROM PUBLIC;

-- Grant to service role (Edge Functions use this)
GRANT EXECUTE ON FUNCTION public.create_vault_secret(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_vault_secret(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_vault_secret(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_vault_secret(uuid) TO service_role;

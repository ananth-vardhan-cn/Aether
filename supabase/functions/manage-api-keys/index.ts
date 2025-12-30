// Supabase Edge Function: Manage API Keys (RLS-protected table)
// Deploy with: npx supabase functions deploy manage-api-keys

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
    action: 'save' | 'delete' | 'check';
    provider: 'gemini' | 'anthropic' | 'openai';
    apiKey?: string;
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // Verify user is authenticated
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Initialize Supabase client with service role for bypassing RLS
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get user from JWT
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: "Invalid token" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const userId = user.id;
        const { action, provider, apiKey } = await req.json() as RequestBody;

        // Validate provider
        if (!['gemini', 'anthropic', 'openai'].includes(provider)) {
            return new Response(
                JSON.stringify({ error: "Invalid provider" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        switch (action) {
            case 'save': {
                if (!apiKey || apiKey.trim().length < 10) {
                    return new Response(
                        JSON.stringify({ error: "Invalid API key" }),
                        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }

                // Check if user already has a key for this provider
                const { data: existing } = await supabase
                    .from('api_keys')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('provider', provider)
                    .single();

                if (existing) {
                    // Update existing key
                    const { error: updateError } = await supabase
                        .from('api_keys')
                        .update({
                            api_key: apiKey,
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', userId)
                        .eq('provider', provider);

                    if (updateError) throw updateError;
                } else {
                    // Insert new key
                    const { error: insertError } = await supabase
                        .from('api_keys')
                        .insert({
                            user_id: userId,
                            provider,
                            api_key: apiKey,
                        });

                    if (insertError) throw insertError;
                }

                return new Response(
                    JSON.stringify({ success: true, message: `${provider} API key saved` }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            case 'delete': {
                const { error: deleteError } = await supabase
                    .from('api_keys')
                    .delete()
                    .eq('user_id', userId)
                    .eq('provider', provider);

                if (deleteError) throw deleteError;

                return new Response(
                    JSON.stringify({ success: true, message: `${provider} API key deleted` }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            case 'check': {
                // Check which providers have keys configured
                const { data: keys } = await supabase
                    .from('api_keys')
                    .select('provider')
                    .eq('user_id', userId);

                const configuredProviders = (keys || []).map(k => k.provider);

                return new Response(
                    JSON.stringify({
                        configured: {
                            gemini: configuredProviders.includes('gemini'),
                            anthropic: configuredProviders.includes('anthropic'),
                            openai: configuredProviders.includes('openai'),
                        }
                    }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            default:
                return new Response(
                    JSON.stringify({ error: "Invalid action" }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
        }

    } catch (error: unknown) {
        console.error("Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

// Supabase Edge Function: Get Public Project
// Deploy with: npx supabase functions deploy get-public-project

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { shareId } = await req.json();

        if (!shareId) {
            return new Response(
                JSON.stringify({ error: "shareId is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Create Supabase client with service role for bypassing RLS
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Fetch project by share_id where is_public is true
        const { data: project, error } = await supabase
            .from("projects")
            .select("id, name, files, preview_code, is_public, created_at")
            .eq("share_id", shareId)
            .eq("is_public", true)
            .single();

        if (error || !project) {
            return new Response(
                JSON.stringify({ error: "Project not found or not public" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Return project data (without messages for privacy)
        return new Response(
            JSON.stringify({
                id: project.id,
                name: project.name,
                files: project.files,
                previewCode: project.preview_code,
                createdAt: project.created_at,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: unknown) {
        console.error("Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

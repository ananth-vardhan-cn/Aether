// Supabase Edge Function: GitHub OAuth Handler
// Deploy with: npx supabase functions deploy github-oauth

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
        // Verify user is authenticated
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { code } = await req.json();

        if (!code) {
            return new Response(
                JSON.stringify({ error: "Authorization code is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get GitHub OAuth secrets
        const clientId = Deno.env.get("GITHUB_CLIENT_ID");
        const clientSecret = Deno.env.get("GITHUB_CLIENT_SECRET");

        if (!clientId || !clientSecret) {
            return new Response(
                JSON.stringify({ error: "GitHub OAuth not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Exchange code for access token
        const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code,
            }),
        });

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            return new Response(
                JSON.stringify({ error: tokenData.error_description || tokenData.error }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const accessToken = tokenData.access_token;

        // Get GitHub user info to verify token works
        const userResponse = await fetch("https://api.github.com/user", {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        });

        if (!userResponse.ok) {
            return new Response(
                JSON.stringify({ error: "Failed to verify GitHub token" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const githubUser = await userResponse.json();

        // Store the access token in the user's profile
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Extract user ID from JWT
        const jwt = authHeader.replace("Bearer ", "");
        const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);

        if (userError || !user) {
            return new Response(
                JSON.stringify({ error: "Invalid user session" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Update profile with GitHub token
        const { error: updateError } = await supabase
            .from("profiles")
            .update({ github_access_token: accessToken })
            .eq("id", user.id);

        if (updateError) {
            return new Response(
                JSON.stringify({ error: "Failed to save GitHub token" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                username: githubUser.login,
                name: githubUser.name,
                avatar: githubUser.avatar_url,
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

// Supabase Edge Function: Get GitHub Status for Project
// Deploy with: npx supabase functions deploy github-get-status

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GitHubRepoInfo {
    owner: string;
    name: string;
    branch: string;
    lastCommitSha: string;
    url: string;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { projectId } = await req.json();

        if (!projectId) {
            return new Response(
                JSON.stringify({ error: "Project ID is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const jwt = authHeader.replace("Bearer ", "");
        const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);

        if (userError || !user) {
            return new Response(
                JSON.stringify({ error: "Invalid user session" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Check if user has GitHub connected
        const { data: profile } = await supabase
            .from("profiles")
            .select("github_access_token")
            .eq("id", user.id)
            .single();

        const isGitHubConnected = !!profile?.github_access_token;

        // Get project repo info
        const { data: project } = await supabase
            .from("projects")
            .select("github_repo")
            .eq("id", projectId)
            .eq("user_id", user.id)
            .single();

        const repoInfo = project?.github_repo as GitHubRepoInfo | null;

        // Get GitHub username if connected
        let githubUsername = null;
        if (isGitHubConnected && profile?.github_access_token) {
            try {
                const userResponse = await fetch("https://api.github.com/user", {
                    headers: {
                        "Authorization": `Bearer ${profile.github_access_token}`,
                        "Accept": "application/vnd.github+json",
                        "X-GitHub-Api-Version": "2022-11-28",
                    },
                });
                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    githubUsername = userData.login;
                }
            } catch {
                // Ignore errors fetching username
            }
        }

        return new Response(
            JSON.stringify({
                isConnected: isGitHubConnected,
                hasRepo: !!repoInfo,
                repoInfo: repoInfo ? {
                    owner: repoInfo.owner,
                    name: repoInfo.name,
                    branch: repoInfo.branch,
                    url: repoInfo.url,
                } : null,
                githubUsername,
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

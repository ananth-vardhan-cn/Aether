// Supabase Edge Function: Create GitHub Repository
// Deploy with: npx supabase functions deploy github-create-repo

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FileInput {
    name: string;
    content: string;
}

function toBase64(str: string): string {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
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

        const { projectId, repoName, description, isPrivate, files } = await req.json();

        if (!projectId || !repoName || !files) {
            return new Response(
                JSON.stringify({ error: "Missing required fields" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get user and their GitHub token
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

        // Get GitHub token from profile
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("github_access_token")
            .eq("id", user.id)
            .single();

        if (profileError || !profile?.github_access_token) {
            return new Response(
                JSON.stringify({ error: "GitHub not connected. Please connect your GitHub account first." }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const githubToken = profile.github_access_token;

        // 1. Create the repository
        // Note: auto_init: true creates an initial commit with README, which makes the repo ready for file uploads
        const createRepoResponse = await fetch("https://api.github.com/user/repos", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${githubToken}`,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: repoName,
                description: description || `Created with Aether AI`,
                private: isPrivate !== false,
                auto_init: true, // IMPORTANT: Initialize so we can use Contents API
            }),
        });

        if (!createRepoResponse.ok) {
            const errorData = await createRepoResponse.json();
            return new Response(
                JSON.stringify({ error: errorData.message || "Failed to create repository" }),
                { status: createRepoResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const repoData = await createRepoResponse.json();
        const owner = repoData.owner.login;
        const repo = repoData.name;

        // Wait a moment for repo to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 2. Upload files using Contents API
        // This is slower but more robust than Git Data API for initial creation
        let lastCommitSha = "";

        for (const file of files as FileInput[]) {
            // Encode content to base64 using safe method
            const base64Content = toBase64(file.content);

            const putResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${file.name}`, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${githubToken}`,
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: `Add ${file.name}`,
                    content: base64Content,
                    branch: "main"
                }),
            });

            if (!putResponse.ok) {
                const errorData = await putResponse.json();
                console.error(`Failed to upload ${file.name}:`, errorData);
                // Continue with other files instead of failing completely
                continue;
            }

            const putData = await putResponse.json();
            if (putData.commit && putData.commit.sha) {
                lastCommitSha = putData.commit.sha;
            }
        }

        // If simple put didn't give us a SHA (rare), fetch the branch
        if (!lastCommitSha) {
            const branchResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches/main`, {
                headers: {
                    "Authorization": `Bearer ${githubToken}`,
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            });
            if (branchResponse.ok) {
                const branchData = await branchResponse.json();
                lastCommitSha = branchData.commit.sha;
            }
        }

        // Save repo info to projects table
        const githubRepoInfo = {
            owner,
            name: repo,
            branch: "main",
            lastCommitSha: lastCommitSha || "initial",
            url: repoData.html_url,
        };

        const { error: updateError } = await supabase
            .from("projects")
            .update({ github_repo: githubRepoInfo })
            .eq("id", projectId)
            .eq("user_id", user.id);

        if (updateError) {
            console.error("Failed to update project:", updateError);
        }

        return new Response(
            JSON.stringify({
                success: true,
                repoUrl: repoData.html_url,
                owner,
                name: repo,
                branch: "main",
                sha: lastCommitSha || "initial",
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

// Supabase Edge Function: Commit to GitHub Repository
// Deploy with: npx supabase functions deploy github-commit

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

        const { projectId, message, files } = await req.json();

        if (!projectId || !message || !files) {
            return new Response(
                JSON.stringify({ error: "Missing required fields" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get user and their GitHub token + project repo info
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

        // Get GitHub token
        const { data: profile } = await supabase
            .from("profiles")
            .select("github_access_token")
            .eq("id", user.id)
            .single();

        if (!profile?.github_access_token) {
            return new Response(
                JSON.stringify({ error: "GitHub not connected" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get project repo info
        const { data: project } = await supabase
            .from("projects")
            .select("github_repo")
            .eq("id", projectId)
            .eq("user_id", user.id)
            .single();

        if (!project?.github_repo) {
            return new Response(
                JSON.stringify({ error: "Project not connected to a GitHub repository" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const githubToken = profile.github_access_token;
        const repoInfo = project.github_repo as GitHubRepoInfo;
        const { owner, name: repo, branch, lastCommitSha } = repoInfo;

        // Get the current commit to use as parent
        const parentSha = lastCommitSha;

        // Create blobs for each file
        const blobs: { path: string; sha: string }[] = [];

        for (const file of files as FileInput[]) {
            // Encode file content as base64
            const base64Content = toBase64(file.content);

            const blobResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${githubToken}`,
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    content: base64Content,
                    encoding: "base64",
                }),
            });

            if (!blobResponse.ok) {
                const errorData = await blobResponse.json();
                console.error(`Failed to create blob for ${file.name}:`, errorData.message || errorData);
                continue;
            }

            const blobData = await blobResponse.json();
            blobs.push({ path: file.name, sha: blobData.sha });
        }

        // Create a new tree
        const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${githubToken}`,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                base_tree: parentSha, // Use parent commit as base
                tree: blobs.map(b => ({
                    path: b.path,
                    mode: "100644",
                    type: "blob",
                    sha: b.sha,
                })),
            }),
        });

        if (!treeResponse.ok) {
            const error = await treeResponse.json();
            return new Response(
                JSON.stringify({ error: error.message || "Failed to create tree" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const treeData = await treeResponse.json();

        // Create commit with parent
        const commitResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${githubToken}`,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message,
                tree: treeData.sha,
                parents: [parentSha],
            }),
        });

        if (!commitResponse.ok) {
            const error = await commitResponse.json();
            return new Response(
                JSON.stringify({ error: error.message || "Failed to create commit" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const commitData = await commitResponse.json();

        // Update branch reference
        const refResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${githubToken}`,
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                sha: commitData.sha,
            }),
        });

        if (!refResponse.ok) {
            const error = await refResponse.json();
            return new Response(
                JSON.stringify({ error: error.message || "Failed to update branch" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Update project with new commit SHA
        const updatedRepoInfo = {
            ...repoInfo,
            lastCommitSha: commitData.sha,
        };

        await supabase
            .from("projects")
            .update({ github_repo: updatedRepoInfo })
            .eq("id", projectId)
            .eq("user_id", user.id);

        return new Response(
            JSON.stringify({
                success: true,
                sha: commitData.sha,
                url: commitData.html_url,
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

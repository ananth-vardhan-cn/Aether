// Supabase Edge Function: Gemini API Proxy
// Deploy with: npx supabase functions deploy generate-app

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI } from "npm:@google/genai@^1.0.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_INSTRUCTION = `
You are Aether, an expert frontend engineer and UI/UX designer. Your goal is to build beautiful, functional, and production-ready web applications.

*** AVAILABLE LIBRARIES (PRE-INSTALLED) ***
You have access to these libraries - use whatever best fits the user's request:

**UI & Components:**
- React 18+ (functional components, hooks)
- Tailwind CSS (utility-first styling)
- Framer Motion (animations: motion, AnimatePresence, useScroll, useTransform)
- Lucide React (icons: import { IconName } from 'lucide-react')
- Radix UI primitives (@radix-ui/react-dialog, @radix-ui/react-dropdown-menu, @radix-ui/react-tabs, @radix-ui/react-tooltip, @radix-ui/react-accordion, @radix-ui/react-switch, @radix-ui/react-slider, @radix-ui/react-checkbox, @radix-ui/react-select, @radix-ui/react-popover)

**Utilities:**
- clsx (conditional classes)
- tailwind-merge (merge Tailwind classes)
- class-variance-authority (component variants)
- date-fns (date formatting)
- react-router-dom (routing, if multi-page)

**Data Visualization:**
- recharts (charts: LineChart, BarChart, PieChart, AreaChart, etc.)

**Forms:**
- react-hook-form (form handling)
- zod (validation, with @hookform/resolvers)

*** DESIGN FREEDOM ***
- You decide the best design approach based on the user's request
- Light mode, dark mode, or both - whatever fits
- Any color palette that looks professional and matches the vibe
- Simple or complex layouts based on what's appropriate
- Use your expertise to make it look amazing

*** OUTPUT FORMAT ***
Return code in this XML format:

<project>
  <file name="src/components/ComponentName.tsx">...</file>
  <file name="src/App.tsx">...</file>
  <file name="src/index.css">...</file>
</project>

*** RULES ***
1. Use Tailwind CSS for all styling
2. Break UI into logical components (as many or few as makes sense)
3. Use realistic placeholder content and Unsplash images (https://images.unsplash.com/photo-...)
4. For icons: import { IconName } from 'lucide-react'
5. For animations: import { motion } from 'framer-motion'

*** UPDATES & FIXES ***
When updating existing code or fixing errors:
1. ONLY return the files that changed
2. Analyze errors carefully and fix the root cause
3. Do NOT regenerate unchanged files
`;

interface RequestBody {
    prompt: string;
    currentFiles: Array<{ name: string; content: string; type: string }>;
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

        // Get API key from Supabase secrets
        const apiKey = Deno.env.get("GEMINI_API_KEY");
        if (!apiKey) {
            return new Response(
                JSON.stringify({ error: "API key not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Parse request body
        const { prompt, currentFiles } = await req.json() as RequestBody;

        if (!prompt) {
            return new Response(
                JSON.stringify({ error: "Prompt is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Initialize Gemini
        const ai = new GoogleGenAI({ apiKey });

        // Build prompt with file context
        let finalPrompt = prompt;
        if (currentFiles && currentFiles.length > 0) {
            const fileContext = currentFiles.map(f => `FILE: ${f.name}\n${f.content}`).join('\n\n');
            finalPrompt = `
      CURRENT PROJECT FILES:
      ${fileContext}

      USER REQUEST:
      ${prompt}

      INSTRUCTIONS:
      1. Update the project files to meet the user's request.
      2. IF this is a fix or update, ONLY return the files that need modification.
      3. Follow the XML format.
      `;
        }

        // Call Gemini API
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: finalPrompt,
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                temperature: 0.6,
                maxOutputTokens: 65536,
            },
        });

        const text = response.text || "";

        // Parse the response
        const project = parseXmlResponse(text);

        return new Response(
            JSON.stringify(project),
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

function parseXmlResponse(text: string) {
    const project = {
        files: [] as Array<{ name: string; content: string; type: string }>,
        previewCode: ''
    };

    // Extract Preview HTML
    const previewMatch = text.match(/<preview_html>([\s\S]*?)<\/preview_html>/);
    if (previewMatch) {
        project.previewCode = previewMatch[1].trim();
    }

    // Extract Files
    const fileRegex = /<file name="(.*?)">([\s\S]*?)<\/file>/g;
    let match;
    while ((match = fileRegex.exec(text)) !== null) {
        const name = match[1];
        const content = match[2].trim();

        let type = 'javascript';
        if (name.endsWith('.html')) type = 'html';
        else if (name.endsWith('.css')) type = 'css';
        else if (name.endsWith('.ts') || name.endsWith('.tsx')) type = 'typescript';
        else if (name.endsWith('.json')) type = 'json';

        project.files.push({ name, content, type });
    }

    // Fallback
    if (!project.previewCode && project.files.length > 0) {
        const indexHtml = project.files.find(f => f.name === 'index.html');
        if (indexHtml) {
            project.previewCode = indexHtml.content;
        }
    }

    return project;
}

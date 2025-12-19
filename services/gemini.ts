import { GoogleGenAI } from "@google/genai";
import { File, GenerationStep } from "../types";

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

interface GeneratedProject {
  files: File[];
  previewCode: string;
}

const parseXmlResponse = (text: string): GeneratedProject => {
  const project: GeneratedProject = {
    files: [],
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

    let type: File['type'] = 'javascript';
    if (name.endsWith('.html')) type = 'html';
    else if (name.endsWith('.css')) type = 'css';
    else if (name.endsWith('.ts') || name.endsWith('.tsx')) type = 'typescript';
    else if (name.endsWith('.json')) type = 'json';

    project.files.push({ name, content, type });
  }

  // FALLBACK: If no preview_html tag, try to find index.html in the files
  if (!project.previewCode && project.files.length > 0) {
    const indexHtml = project.files.find(f => f.name === 'index.html' || f.name === 'index.htm');
    if (indexHtml) {
      project.previewCode = indexHtml.content;
    }
  }

  // FALLBACK: If parsing fails but we have text, assume it's a single HTML file
  if (!project.previewCode && !project.files.length && text) {
    project.previewCode = text;
    project.files.push({ name: 'index.html', content: text, type: 'html' });
  }

  return project;
};

export const generateAppCodeStream = async (
  prompt: string,
  currentFiles: File[],
  onStepChange: (steps: GenerationStep[]) => void
): Promise<GeneratedProject> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  let finalPrompt = prompt;
  const existingFileNames = new Set(currentFiles.map(f => f.name));

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

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: finalPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.6,
        maxOutputTokens: 65536,
      },
    });

    let fullText = '';
    const steps: GenerationStep[] = [{
      id: 'init',
      label: 'Analyzing requirements',
      status: 'completed'
    }];

    // Track files to update UI
    const seenFiles = new Set<string>();

    for await (const chunk of responseStream) {
      const chunkText = chunk.text || '';
      fullText += chunkText;

      // Find all file names
      const fileMatches = [...fullText.matchAll(/<file name="(.*?)">/g)];
      const previewMatch = fullText.match(/<preview_html>/);

      // Update steps based on what we found
      fileMatches.forEach((match, index) => {
        const fileName = match[1];
        if (!seenFiles.has(fileName)) {
          seenFiles.add(fileName);

          // Determine if creating or updating
          const action = existingFileNames.has(fileName) ? 'Updating' : 'Creating';

          steps.push({
            id: fileName,
            label: `${action} ${fileName}`,
            status: 'in-progress'
          });
        }
      });

      // Check for file completions
      seenFiles.forEach(fileName => {
        // Basic check for closing tag of specific file
        if (fullText.includes(`</file>`) && fullText.includes(fileName)) {
          const fileBlockRegex = new RegExp(`<file name="${fileName}">[\\s\\S]*?<\\/file>`);
          if (fileBlockRegex.test(fullText)) {
            const step = steps.find(s => s.id === fileName);
            if (step && step.status !== 'completed') step.status = 'completed';
          }
        }
      });

      if (previewMatch && !steps.find(s => s.id === 'preview')) {
        steps.push({
          id: 'preview',
          label: 'Generating Live Preview',
          status: 'in-progress'
        });
      }

      if (fullText.includes('</preview_html>')) {
        const step = steps.find(s => s.id === 'preview');
        if (step) step.status = 'completed';
      }

      onStepChange([...steps]); // Emit copy
    }

    return parseXmlResponse(fullText);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
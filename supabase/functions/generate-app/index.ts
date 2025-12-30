// Supabase Edge Function: Multi-Provider AI Code Generation (BYOK)
// Deploy with: npx supabase functions deploy generate-app

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI } from "npm:@google/genai@^1.0.0";
import Anthropic from "npm:@anthropic-ai/sdk@^0.39.0";
import OpenAI from "npm:openai@^4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_INSTRUCTION = `
You are Aether, an ELITE frontend engineer. You build stunning, premium web applications that are FULLY FUNCTIONAL.

=== CRITICAL: MAKE EVERYTHING WORK ===

Every button, link, and form MUST be functional. Follow these rules:

1. NAVIGATION BUTTONS must scroll to sections using IDs:
   <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
     Features
   </button>
   
   <section id="features">...</section>

2. FORMS must capture input and show feedback:
   const [email, setEmail] = useState('');
   const [submitted, setSubmitted] = useState(false);
   
   const handleSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     setSubmitted(true);
     setEmail('');
   };
   
   {submitted ? (
     <p className="text-green-500">Thanks for subscribing!</p>
   ) : (
     <form onSubmit={handleSubmit}>
       <input value={email} onChange={(e) => setEmail(e.target.value)} />
       <button type="submit">Subscribe</button>
     </form>
   )}

3. MOBILE MENU must toggle open/close:
   const [menuOpen, setMenuOpen] = useState(false);
   
   <button onClick={() => setMenuOpen(!menuOpen)}>Menu</button>
   {menuOpen && <nav>...</nav>}

4. TABS/ACCORDIONS must switch content:
   const [activeTab, setActiveTab] = useState('tab1');
   
   <button onClick={() => setActiveTab('tab1')}>Tab 1</button>
   {activeTab === 'tab1' && <div>Content 1</div>}

5. MODALS must open and close:
   const [showModal, setShowModal] = useState(false);
   
   <button onClick={() => setShowModal(true)}>Open</button>
   {showModal && (
     <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
       <div className="bg-white p-6 rounded-lg">
         <button onClick={() => setShowModal(false)}>Close</button>
       </div>
     </div>
   )}

6. COUNTERS/CARTS must update values:
   const [count, setCount] = useState(0);
   <button onClick={() => setCount(count + 1)}>Add ({count})</button>

7. CHECKOUT PAGES must have multi-step flow:
   const [step, setStep] = useState(1);
   const [orderComplete, setOrderComplete] = useState(false);
   
   {step === 1 && <CartSummary onNext={() => setStep(2)} />}
   {step === 2 && <ShippingForm onNext={() => setStep(3)} />}
   {step === 3 && <PaymentForm onComplete={() => setOrderComplete(true)} />}
   {orderComplete && <OrderConfirmation />}

8. PAYMENT FORMS must validate and show success:
   const [cardNumber, setCardNumber] = useState('');
   const [processing, setProcessing] = useState(false);
   const [paid, setPaid] = useState(false);
   
   const handlePayment = (e: React.FormEvent) => {
     e.preventDefault();
     setProcessing(true);
     setTimeout(() => {
       setProcessing(false);
       setPaid(true);
     }, 2000);
   };
   
   {paid ? (
     <div className="text-green-500">Payment successful! Order confirmed.</div>
   ) : (
     <form onSubmit={handlePayment}>
       <input placeholder="Card Number" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} />
       <button type="submit" disabled={processing}>
         {processing ? 'Processing...' : 'Pay Now'}
       </button>
     </form>
   )}

=== TECH STACK ===
- React with TypeScript
- Tailwind CSS (always use)
- Framer Motion for animations (ALWAYS import AnimatePresence when animating mount/unmount)
- Lucide React for icons

=== 3D APPS ===
ONLY use Three.js when the user explicitly says "3D", "three.js", or "WebGL".
For 3D: Use @react-three/fiber and @react-three/drei.

=== OUTPUT FORMAT ===
<project>
  <build_plan>A brief, conversational sentence starting with a verb about what you're building. Example: "Building a bold landing page with dark palette, dramatic typography, and premium animations."</build_plan>
  <file name="App.tsx">...</file>
  <file name="components/Header.tsx">...</file>
  <file name="index.css">...</file>
  <build_summary>Start with a brief "Done!" sentence, then list key features as bullet points using "• ". Example:
"Done! Your premium landing page is live.
• Hero section with animated gradient background
• Feature cards with hover effects
• Newsletter signup form with validation
• Fully responsive mobile design"</build_summary>
</project>

=== DESIGN RULES ===
1. Create stunning, modern, premium designs
2. Use gradients, glassmorphism, animations
3. Make pages scrollable
4. Mobile-responsive layouts
5. Every button and link MUST work!
`;

type AIProvider = 'gemini' | 'anthropic' | 'openai';

interface RequestBody {
  prompt: string;
  currentFiles: Array<{ name: string; content: string; type: string }>;
  sessionId?: string;
  provider: AIProvider;
  modelId: string;
}

interface GenerationStep {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed';
  fileType?: 'tsx' | 'ts' | 'css' | 'json' | 'html' | 'other';
  lineCount?: number;
}

/**
 * Get file type for display
 */
function getFileType(filename: string): GenerationStep['fileType'] {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'tsx' || ext === 'ts' || ext === 'jsx' || ext === 'js') return 'tsx';
  if (ext === 'css') return 'css';
  if (ext === 'json') return 'json';
  if (ext === 'html' || ext === 'htm') return 'html';
  return 'other';
}

/**
 * Update session progress in database
 */
async function updateSessionProgress(
  supabase: ReturnType<typeof createClient>,
  sessionId: string,
  status: string,
  steps: GenerationStep[],
  errorMessage?: string,
  buildPlan?: string
) {
  try {
    const updateData: Record<string, unknown> = {
      status,
      steps,
      error_message: errorMessage,
      updated_at: new Date().toISOString()
    };

    if (buildPlan) {
      updateData.build_plan = buildPlan;
    }

    await supabase
      .from('generation_sessions')
      .update(updateData)
      .eq('id', sessionId);
  } catch (err) {
    console.error('Failed to update session progress:', err);
  }
}

/**
 * Get user's API key from database
 */
async function getUserApiKey(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  provider: AIProvider
): Promise<string | null> {
  try {
    // Get the API key from api_keys table
    const { data: keyRecord, error: keyError } = await supabase
      .from('api_keys')
      .select('api_key')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single();

    if (keyError || !keyRecord) {
      return null;
    }

    return keyRecord.api_key;
  } catch (err) {
    console.error('Error getting API key:', err);
    return null;
  }
}

/**
 * Generate content with Gemini
 */
async function generateWithGemini(
  apiKey: string,
  modelId: string,
  prompt: string,
  systemInstruction: string,
  onChunk: (text: string, usageMetadata?: { candidatesTokenCount?: number }) => void
): Promise<void> {
  const ai = new GoogleGenAI({ apiKey });

  const responseStream = await ai.models.generateContentStream({
    model: modelId,
    contents: prompt,
    config: {
      systemInstruction,
      temperature: 0.6,
      maxOutputTokens: 65536,
    },
  });

  for await (const chunk of responseStream) {
    onChunk(chunk.text || '', chunk.usageMetadata);
  }
}

/**
 * Generate content with Claude
 */
async function generateWithClaude(
  apiKey: string,
  modelId: string,
  prompt: string,
  systemInstruction: string,
  onChunk: (text: string, usageMetadata?: { candidatesTokenCount?: number }) => void
): Promise<void> {
  const anthropic = new Anthropic({ apiKey });

  const stream = await anthropic.messages.stream({
    model: modelId,
    max_tokens: 16384,
    system: systemInstruction,
    messages: [{ role: 'user', content: prompt }],
  });

  let totalTokens = 0;
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      onChunk(event.delta.text, { candidatesTokenCount: totalTokens });
    }
    if (event.type === 'message_delta' && event.usage) {
      totalTokens = event.usage.output_tokens;
    }
  }
}

/**
 * Generate content with OpenAI
 */
async function generateWithOpenAI(
  apiKey: string,
  modelId: string,
  prompt: string,
  systemInstruction: string,
  onChunk: (text: string, usageMetadata?: { candidatesTokenCount?: number }) => void
): Promise<void> {
  const openai = new OpenAI({ apiKey });

  const stream = await openai.chat.completions.create({
    model: modelId,
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: prompt },
    ],
    max_tokens: 16384,
    stream: true,
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || '';
    onChunk(text);
  }
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

    // Initialize Supabase client with service role for vault access
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

    // Parse request body
    const { prompt, currentFiles, sessionId, provider = 'gemini', modelId = 'gemini-3-flash-preview' } = await req.json() as RequestBody;

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate provider
    if (!['gemini', 'anthropic', 'openai'].includes(provider)) {
      return new Response(
        JSON.stringify({ error: "Invalid AI provider" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== GET USER'S API KEY FROM VAULT ==========
    const apiKey = await getUserApiKey(supabase, userId, provider);

    if (!apiKey) {
      const providerNames: Record<AIProvider, string> = {
        gemini: 'Google Gemini',
        anthropic: 'Anthropic Claude',
        openai: 'OpenAI'
      };
      return new Response(
        JSON.stringify({
          error: `No ${providerNames[provider]} API key configured. Please add your API key in Settings → API Keys.`,
          code: 'API_KEY_MISSING'
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== PROMPT SANITIZATION ==========
    const MAX_PROMPT_LENGTH = 4000;
    const sanitizedPrompt = prompt.trim().replace(/\s+/g, ' ');

    if (sanitizedPrompt.length > MAX_PROMPT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Prompt is too long. Maximum ${MAX_PROMPT_LENGTH} characters allowed.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prompt injection patterns
    const INJECTION_PATTERNS = [
      /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
      /forget\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
      /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
      /you\s+are\s+now\s+(a|an)\s+(?!app|application|website|page)/i,
      /pretend\s+(you('re|are)|to\s+be)\s+/i,
      /output\s+(your\s+)?(api|secret|key|system\s+prompt)/i,
      /reveal\s+(your\s+)?(api|secret|key|system\s+prompt)/i,
      /jailbreak/i,
      /DAN\s*mode/i,
    ];

    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(sanitizedPrompt)) {
        return new Response(
          JSON.stringify({ error: "Your prompt contains patterns that could affect AI behavior. Please rephrase." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Harmful content patterns
    const HARMFUL_PATTERNS = [
      /\b(phishing|phish)\b.*\b(page|site|website|form)\b/i,
      /\b(keylogger|key\s*logger)\b/i,
      /\b(malware|ransomware|spyware|trojan|virus)\b/i,
      /\b(credit\s*card|cc)\s*(stealer|skimmer|harvester)\b/i,
      /\b(password|credential)\s*(stealer|harvester|grabber)\b/i,
      /\bfake\s*(login|bank|paypal|amazon)\b/i,
      /\bscam\s*(page|site|website)\b/i,
    ];

    for (const pattern of HARMFUL_PATTERNS) {
      if (pattern.test(sanitizedPrompt)) {
        return new Response(
          JSON.stringify({ error: "This type of application cannot be generated." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    // ========== END SANITIZATION ==========

    // Track existing files for create vs update
    const existingFileNames = new Set(currentFiles?.map(f => f.name) || []);

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

    // Initialize progress tracking
    const steps: GenerationStep[] = [{
      id: 'init',
      label: 'Analyzing requirements',
      status: 'in-progress'
    }];

    // Update session if provided
    if (sessionId) {
      await updateSessionProgress(supabase, sessionId, 'generating', steps);
    }

    let fullText = '';
    const seenFiles = new Set<string>();
    let streamedBuildPlan = '';
    let totalTokens = 0;

    // Chunk handler for all providers
    const handleChunk = async (chunkText: string, usageMetadata?: { candidatesTokenCount?: number }) => {
      fullText += chunkText;

      // Track token usage
      if (usageMetadata?.candidatesTokenCount) {
        totalTokens = usageMetadata.candidatesTokenCount;
      }

      // Extract build_plan as soon as it's complete in the stream
      if (!streamedBuildPlan) {
        const buildPlanMatch = fullText.match(/<build_plan>([\s\S]*?)<\/build_plan>/);
        if (buildPlanMatch) {
          streamedBuildPlan = buildPlanMatch[1].trim();
          if (sessionId) {
            await updateSessionProgress(supabase, sessionId, 'generating', steps, undefined, streamedBuildPlan);
          }
        }
      }

      // Mark init as completed after first chunk
      if (steps[0].status === 'in-progress' && fullText.length > 50) {
        steps[0].status = 'completed';
        if (sessionId) {
          await updateSessionProgress(supabase, sessionId, 'generating', steps, undefined, streamedBuildPlan);
        }
      }

      // Find file names in the stream
      const fileMatches = [...fullText.matchAll(/<file name="(.*?)">/g)];

      for (const match of fileMatches) {
        const fileName = match[1];
        if (!seenFiles.has(fileName)) {
          seenFiles.add(fileName);

          const action = existingFileNames.has(fileName) ? 'Updating' : 'Creating';

          steps.push({
            id: fileName,
            label: `${action} ${fileName}`,
            status: 'in-progress',
            fileType: getFileType(fileName)
          });

          if (sessionId) {
            await updateSessionProgress(supabase, sessionId, 'generating', steps);
          }
        }
      }

      // Check for file completions
      for (const fileName of seenFiles) {
        const fileBlockRegex = new RegExp(`<file name="${fileName}">[\\s\\S]*?<\\/file>`);
        if (fileBlockRegex.test(fullText)) {
          const step = steps.find(s => s.id === fileName);
          if (step && step.status !== 'completed') {
            step.status = 'completed';

            // Count lines in completed file
            const fileMatch = fullText.match(new RegExp(`<file name="${fileName}">([\\s\\S]*?)<\\/file>`));
            if (fileMatch) {
              step.lineCount = (fileMatch[1].match(/\n/g) || []).length + 1;
            }

            if (sessionId) {
              await updateSessionProgress(supabase, sessionId, 'generating', steps);
            }
          }
        }
      }
    };

    // Call the appropriate AI provider
    switch (provider) {
      case 'gemini':
        await generateWithGemini(apiKey, modelId, finalPrompt, SYSTEM_INSTRUCTION, handleChunk);
        break;
      case 'anthropic':
        await generateWithClaude(apiKey, modelId, finalPrompt, SYSTEM_INSTRUCTION, handleChunk);
        break;
      case 'openai':
        await generateWithOpenAI(apiKey, modelId, finalPrompt, SYSTEM_INSTRUCTION, handleChunk);
        break;
    }

    // Parse the final response
    const project = parseXmlResponse(fullText);

    // Add preview step
    if (project.previewCode) {
      steps.push({
        id: 'preview',
        label: 'Generating live preview',
        status: 'completed'
      });
    }

    // Mark session as completed
    if (sessionId) {
      await updateSessionProgress(supabase, sessionId, 'completed', steps);
    }

    return new Response(
      JSON.stringify({ ...project, tokenCount: totalTokens }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Check for common API errors
    if (errorMessage.includes('401') || errorMessage.includes('invalid_api_key') || errorMessage.includes('Unauthorized')) {
      return new Response(
        JSON.stringify({ error: "Invalid API key. Please check your API key in Settings → API Keys.", code: 'INVALID_API_KEY' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (errorMessage.includes('429') || errorMessage.includes('rate_limit') || errorMessage.includes('quota')) {
      return new Response(
        JSON.stringify({ error: "API rate limit exceeded. Please try again later or check your API usage.", code: 'RATE_LIMIT' }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseXmlResponse(text: string) {
  const project = {
    files: [] as Array<{ name: string; content: string; type: string }>,
    previewCode: '',
    buildPlan: '',
    buildSummary: ''
  };

  // Extract Build Plan
  const buildPlanMatch = text.match(/<build_plan>([\s\S]*?)<\/build_plan>/);
  if (buildPlanMatch) {
    project.buildPlan = buildPlanMatch[1].trim();
  }

  // Extract Build Summary
  const buildSummaryMatch = text.match(/<build_summary>([\s\S]*?)<\/build_summary>/);
  if (buildSummaryMatch) {
    project.buildSummary = buildSummaryMatch[1].trim();
  }

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

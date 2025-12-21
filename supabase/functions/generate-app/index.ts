// Supabase Edge Function: Gemini API Proxy
// Deploy with: npx supabase functions deploy generate-app

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI } from "npm:@google/genai@^1.0.0";

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
  <file name="App.tsx">...</file>
  <file name="components/Header.tsx">...</file>
  <file name="index.css">...</file>
</project>

=== DESIGN RULES ===
1. Create stunning, modern, premium designs
2. Use gradients, glassmorphism, animations
3. Make pages scrollable
4. Mobile-responsive layouts
5. Every button and link MUST work!
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

    // ========== PROMPT SANITIZATION ==========
    const MAX_PROMPT_LENGTH = 4000;

    // Normalize and trim
    const sanitizedPrompt = prompt.trim().replace(/\s+/g, ' ');

    // Check length
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

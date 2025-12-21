import { GoogleGenAI } from "@google/genai";
import { File, GenerationStep } from "../types";

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
    const fileContext = currentFiles.map(f => `FILE: ${f.name} \n${f.content} `).join('\n\n');
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
            label: `${action} ${fileName} `,
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
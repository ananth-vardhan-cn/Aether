export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system'
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  isError?: boolean;
  buildSummary?: string;  // Summary shown after generation completes
  actions?: { fileName: string; lineCount: number }[];  // List of files with line counts
  tokenCount?: number;  // Total tokens used for this generation
  thinkingTime?: number;  // Time in seconds the AI spent generating
}

export interface File {
  name: string;
  content: string;
  type: 'html' | 'css' | 'javascript' | 'typescript' | 'json';
}

export interface Project {
  id: string;
  name: string;
  lastModified: number;
  files: File[];
  previewCode: string; // The self-contained HTML for the iframe
  messages: Message[];
  shareId?: string | null;    // Unique ID for public sharing
  isPublic?: boolean;         // Whether project is publicly accessible
  isPinned?: boolean;         // Whether project is pinned to top
  pinnedAt?: number;          // Timestamp when pinned (for sorting)
}

export enum ViewState {
  LANDING = 'LANDING',
  BUILDING = 'BUILDING'
}

export interface GenerationStep {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed';
  lineCount?: number;  // Lines written so far
  fileType?: 'tsx' | 'ts' | 'css' | 'json' | 'html' | 'other';
}

export interface GeneratedProject {
  files: File[];
  previewCode: string;
  buildPlan?: string;      // Brief overview of what's being built
  buildSummary?: string;   // Detailed report of features/design
  tokenCount?: number;     // Total tokens used for generation
}

// AI Provider types for multi-model support
export type AIProvider = 'gemini' | 'anthropic' | 'openai';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  description?: string;
  capabilities?: string[];
  metrics?: {
    speed: number;       // 1-5 opacity levels
    intelligence: number; // 1-5 opacity levels
    context: number;      // 1-5 opacity levels (replaces "Token Usage" for clarity in UI)
  };
  isNew?: boolean;
}

// Available AI models configuration
export const AI_MODELS: AIModel[] = [
  // Gemini
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro',
    provider: 'gemini',
    description: 'Most intelligent model',
    capabilities: [
      'Top-tier reasoning and coding',
      'Massive context window',
      'Best for complex architectures'
    ],
    metrics: { speed: 3, intelligence: 5, context: 5 },
    isNew: true
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash',
    provider: 'gemini',
    description: 'Fast + intelligent',
    capabilities: [
      'Extremely low latency response',
      'Great for rapid iterations',
      'Balanced performance'
    ],
    metrics: { speed: 5, intelligence: 4, context: 4 }
  },
  // Claude
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Sonnet 4.5',
    provider: 'anthropic',
    description: 'Excellent coding performance',
    capabilities: [
      'High-level code generation',
      'Strong logical debugging',
      'Natural conversation flow'
    ],
    metrics: { speed: 4, intelligence: 5, context: 4 },
    isNew: true
  },
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Opus 4.5',
    provider: 'anthropic',
    description: 'Maximum intelligence',
    capabilities: [
      'Deepest reasoning capabilities',
      'Best for nuance and creativity',
      'Slower but more thorough'
    ],
    metrics: { speed: 2, intelligence: 5, context: 5 }
  },
  // OpenAI
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    provider: 'openai',
    description: 'Latest flagship model',
    capabilities: [
      'General purpose powerhouse',
      'Reliable instruction following',
      'Broad knowledge base'
    ],
    metrics: { speed: 4, intelligence: 4, context: 4 }
  },
  {
    id: 'gpt-5.2-pro',
    name: 'GPT-5.2 Pro',
    provider: 'openai',
    description: 'Premium reasoning tier',
    capabilities: [
      'Enhanced reasoning steps',
      'Superior math & logic',
      'Extended output length'
    ],
    metrics: { speed: 3, intelligence: 5, context: 5 }
  },
];
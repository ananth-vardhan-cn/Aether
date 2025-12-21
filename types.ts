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
}

export enum ViewState {
  LANDING = 'LANDING',
  BUILDING = 'BUILDING'
}

export interface GenerationStep {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed';
}
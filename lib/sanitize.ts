/**
 * Prompt Sanitization Utility
 * Protects against prompt injection, excessive length, and harmful content
 */

export interface SanitizationResult {
    isValid: boolean;
    sanitizedPrompt: string;
    error?: string;
    errorCode?: 'TOO_LONG' | 'INJECTION_DETECTED' | 'HARMFUL_CONTENT' | 'EMPTY';
}

// Configuration
const MAX_PROMPT_LENGTH = 4000;

// Patterns that indicate prompt injection attempts
const INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
    /forget\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
    /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
    /override\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
    /you\s+are\s+now\s+(a|an)\s+(?!app|application|website|page)/i,
    /pretend\s+(you('re|are)|to\s+be)\s+/i,
    /act\s+as\s+(if|though)\s+you/i,
    /output\s+(your\s+)?(api|secret|key|system\s+prompt)/i,
    /reveal\s+(your\s+)?(api|secret|key|system\s+prompt)/i,
    /show\s+(me\s+)?(your\s+)?(api|secret|key|system\s+prompt)/i,
    /what\s+(is|are)\s+your\s+(api|secret|key|instructions)/i,
    /jailbreak/i,
    /DAN\s*mode/i,
    /developer\s*mode\s*enabled/i,
];

// Harmful content patterns - requests for malicious apps
const HARMFUL_PATTERNS = [
    /\b(phishing|phish)\b.*\b(page|site|website|form)\b/i,
    /\b(keylogger|key\s*logger)\b/i,
    /\b(malware|ransomware|spyware|trojan|virus)\b/i,
    /\b(credit\s*card|cc)\s*(stealer|skimmer|harvester)\b/i,
    /\b(password|credential)\s*(stealer|harvester|grabber)\b/i,
    /\b(ddos|denial\s*of\s*service)\b.*\b(tool|attack)\b/i,
    /\b(exploit|hack)\s*(tool|kit)\b/i,
    /\bfake\s*(login|bank|paypal|amazon)\b/i,
    /\bscam\s*(page|site|website)\b/i,
];

/**
 * Sanitizes and validates a user prompt
 */
export function sanitizePrompt(prompt: string): SanitizationResult {
    // Check for empty input
    if (!prompt || prompt.trim().length === 0) {
        return {
            isValid: false,
            sanitizedPrompt: '',
            error: 'Please enter a prompt to generate an app.',
            errorCode: 'EMPTY',
        };
    }

    // Normalize whitespace
    let sanitized = prompt.trim().replace(/\s+/g, ' ');

    // Check length
    if (sanitized.length > MAX_PROMPT_LENGTH) {
        return {
            isValid: false,
            sanitizedPrompt: sanitized.substring(0, MAX_PROMPT_LENGTH),
            error: `Prompt is too long. Maximum ${MAX_PROMPT_LENGTH} characters allowed.`,
            errorCode: 'TOO_LONG',
        };
    }

    // Check for injection attempts
    for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(sanitized)) {
            return {
                isValid: false,
                sanitizedPrompt: sanitized,
                error: 'Your prompt contains patterns that could affect AI behavior. Please rephrase your request.',
                errorCode: 'INJECTION_DETECTED',
            };
        }
    }

    // Check for harmful content
    for (const pattern of HARMFUL_PATTERNS) {
        if (pattern.test(sanitized)) {
            return {
                isValid: false,
                sanitizedPrompt: sanitized,
                error: 'This type of application cannot be generated. Please request something else.',
                errorCode: 'HARMFUL_CONTENT',
            };
        }
    }

    return {
        isValid: true,
        sanitizedPrompt: sanitized,
    };
}

/**
 * Quick validation check (for client-side pre-validation)
 */
export function isPromptValid(prompt: string): boolean {
    return sanitizePrompt(prompt).isValid;
}

/**
 * Get character count and limit info
 */
export function getPromptLimits() {
    return {
        maxLength: MAX_PROMPT_LENGTH,
    };
}

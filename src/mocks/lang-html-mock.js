/**
 * Mock implementation of @codemirror/lang-html module
 * This prevents errors related to the deserialize method
 */

export const html = () => [];
export const htmlLanguage = { parser: { configure: () => ({}) } };
export const htmlCompletion = { html: () => [] };

// Export any other functions that might be called
export const htmlCompletionSource = () => null;
export const htmlCompletionRules = {}; 
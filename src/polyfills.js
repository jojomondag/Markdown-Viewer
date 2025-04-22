/**
 * Polyfills for fixing CodeMirror/Lezer dependency issues
 * 
 * This file adds minimal fixes for common errors that occur with the CodeMirror and Lezer libraries
 * related to the deserialize method.
 */

// Patch the LRParser.deserialize method to handle undefined values
export function applyLezerFixes() {
  // Only run in browser context
  if (typeof window === 'undefined') return;
  
  console.log("Applying Lezer polyfills...");
  
  // Create minimal mock API if window.api is undefined
  if (typeof window.api === 'undefined') {
    console.warn('window.api is undefined. Creating mock API for browser environment.');
    window.api = {
      openFileDialog: () => Promise.resolve(['/mock/folder/path']),
      scanDirectory: () => Promise.resolve({ 
        files: [{ name: 'README.md', path: '/mock/folder/path/README.md', type: 'file' }], 
        folders: [] 
      }),
      readMarkdownFile: () => Promise.resolve('# Mock Markdown Content\n\nElectron API is not available.'),
      writeMarkdownFile: () => Promise.resolve(),
      openExternalLink: (url) => {
        const newWindow = window.open(url, '_blank');
        if (newWindow) newWindow.opener = null;
        return Promise.resolve({ success: true });
      }
    };
  }
  
  // Try to patch @lezer/lr module if it exists
  setTimeout(() => {
    try {
      const lezerLR = window.require && window.require('@lezer/lr');
      if (lezerLR && lezerLR.LRParser) {
        const originalDeserialize = lezerLR.LRParser.deserialize;
        if (originalDeserialize) {
          lezerLR.LRParser.deserialize = function(value) {
            if (value === undefined || value === null) {
              return new lezerLR.LRParser({});
            }
            return originalDeserialize.call(this, value);
          };
        } else {
          lezerLR.LRParser.deserialize = function(value) {
            return new lezerLR.LRParser(value || {});
          };
        }
      }
    } catch (e) {
      console.warn('Error applying Lezer polyfills:', e);
    }
  }, 0);
}
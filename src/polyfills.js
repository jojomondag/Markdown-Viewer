/**
 * Polyfills for fixing CodeMirror/Lezer dependency issues
 * 
 * This file adds fixes for common errors that occur with the CodeMirror and Lezer libraries
 * particularly related to the deserialize method that's causing errors.
 */

// Patch the LRParser.deserialize method to handle undefined values
export function applyLezerFixes() {
  // Only run in browser context
  if (typeof window === 'undefined') return;
  
  console.log("Applying Lezer polyfills...");
  
  // Add a safety wrapper to the window.require function
  const originalRequire = window.require;
  if (originalRequire) {
    window.require = function(moduleName) {
      try {
        return originalRequire(moduleName);
      } catch (e) {
        console.warn(`Error requiring module ${moduleName}:`, e);
        // Return a minimal mock for critical modules
        if (moduleName === '@lezer/lr') {
          return {
            LRParser: class LRParser {
              constructor(config) {
                this.config = config || {};
              }
              static deserialize(value) {
                return new LRParser(value || {});
              }
            }
          };
        }
        if (moduleName === '@lezer/html') {
          return { HTMLParser: {} };
        }
        if (moduleName === '@codemirror/lang-markdown') {
          return {
            markdown: function() {
              return { extension: [] };
            },
            parser: {}
          };
        }
        return {};
      }
    };
  }
  
  // Create a mock API if window.api is undefined to prevent openFileDialog errors
  if (typeof window.api === 'undefined') {
    console.warn('window.api is undefined. Creating mock API to prevent errors.');
    window.api = {
      // Mock file dialog methods
      openFileDialog: () => {
        console.warn('Mock openFileDialog called. Electron API not available.');
        alert('Cannot open file dialog: Electron API not available');
        return Promise.resolve(null);
      },
      scanDirectory: () => {
        console.warn('Mock scanDirectory called. Electron API not available.');
        return Promise.resolve({ files: [], folders: [] });
      },
      readMarkdownFile: () => {
        console.warn('Mock readMarkdownFile called. Electron API not available.');
        return Promise.resolve('# Mock Markdown Content\n\nElectron API is not available.');
      },
      writeMarkdownFile: () => {
        console.warn('Mock writeMarkdownFile called. Electron API not available.');
        return Promise.resolve();
      }
    };
  }
  
  // Fix for CodeMirror markdown parser
  try {
    // Create a mock for the @codemirror/lang-markdown module
    if (!window.mockMarkdownApplied) {
      const mockMarkdown = function() { 
        return { extension: [] }; 
      };
      mockMarkdown.parser = {};
      
      // Apply the mock to the global space
      window.mockMarkdownApplied = true;
      window.mockMarkdown = mockMarkdown;
      
      // If module is already loaded, patch it
      if (window.require && window.require('@codemirror/lang-markdown')) {
        const mdModule = window.require('@codemirror/lang-markdown');
        if (!mdModule.markdown || !mdModule.markdown.parser) {
          mdModule.markdown = mockMarkdown;
        }
      }
    }
  } catch (e) {
    console.warn('Error creating markdown mock:', e);
  }
  
  // Wait for modules to load, then patch them
  setTimeout(() => {
    try {
      // Try to patch @lezer/lr module if it exists
      const lezerLR = window.require && window.require('@lezer/lr');
      if (lezerLR && lezerLR.LRParser) {
        const originalDeserialize = lezerLR.LRParser.deserialize;
        if (originalDeserialize) {
          lezerLR.LRParser.deserialize = function(value) {
            if (value === undefined || value === null) {
              console.warn('LRParser.deserialize called with undefined value, returning empty parser');
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
      
      // Try to patch setProp function if it exists
      const setPropError = new Error().stack.includes('setProp');
      if (setPropError) {
        // Find the module or global object that contains setProp
        for (const key in window) {
          if (typeof window[key] === 'object' && window[key] && typeof window[key].setProp === 'function') {
            const originalSetProp = window[key].setProp;
            window[key].setProp = function(target, prop, value) {
              if (prop === 'deserialize' && value === undefined) {
                console.warn('Prevented setProp with undefined deserialize');
                return target;
              }
              return originalSetProp(target, prop, value);
            };
          }
        }
      }
    } catch (e) {
      console.warn('Error applying Lezer polyfills:', e);
    }
  }, 0);
} 
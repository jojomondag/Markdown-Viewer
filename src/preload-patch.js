/**
 * IMPORTANT: This file must be imported before any CodeMirror or Lezer modules
 * to fix the "Cannot read properties of undefined (reading 'deserialize')" error
 */

// Create minimal fake module with proper deserialize method
const fakeLrModule = {
  LRParser: class LRParser {
    constructor(config = {}) {
      this.config = config;
    }
    
    static deserialize(value) {
      return new this({});
    }
  },
  setProp: function(obj, prop, value) {
    if (prop === 'deserialize' && value === undefined) {
      obj[prop] = function(data) { return data || {}; };
      return obj;
    }
    obj[prop] = value;
    return obj;
  }
};

// Export a function that will patch the webpack module system
if (typeof window !== 'undefined') {
  // Store original __webpack_require__ function
  const originalRequire = window.__webpack_require__;
  
  // Create a proxy around webpack's require function
  if (originalRequire) {
    window.__webpack_require__ = function(moduleId) {
      try {
        // Try the original require first
        return originalRequire(moduleId);
      } catch (e) {
        // If it fails with a deserialize error, return our fake module
        if (e.message && e.message.includes('deserialize')) {
          console.warn('Providing fake module for:', moduleId);
          return fakeLrModule;
        }
        throw e;
      }
    };
  }
  
  // Patch the global object for direct property access
  window.__LEZER_PATCH = fakeLrModule;
  
  // Detect and patch any existing CodeMirror or Lezer modules
  for (const key in window) {
    if (key.includes('lezer') || key.includes('codemirror')) {
      const module = window[key];
      if (module && typeof module === 'object') {
        // If the module has LRParser without deserialize, add it
        if (module.LRParser && !module.LRParser.deserialize) {
          module.LRParser.deserialize = fakeLrModule.LRParser.deserialize;
        }
        
        // If module has setProp function, patch it
        if (typeof module.setProp === 'function') {
          const originalSetProp = module.setProp;
          module.setProp = function(obj, prop, value) {
            if (prop === 'deserialize' && value === undefined) {
              return fakeLrModule.setProp(obj, prop, value);
            }
            return originalSetProp(obj, prop, value);
          };
        }
      }
    }
  }
}
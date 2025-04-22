// This file provides local versions of the @lezer/highlight exports and aggressive browser fixes
// for the "Cannot read properties of undefined (reading 'parser')" error

// Default highlight styles that match what's in @lezer/highlight
export const defaultHighlightStyle = {
  "comment": { color: "#999" },
  "string": { color: "#a11" },
  "documentString": { color: "#a11" },
  "regexp": { color: "#a11" },
  "name": { color: "#000" },
  "propertyName": { color: "#00c" },
  "attribute": { color: "#00c" },
  "function": { color: "#00c" },
  "standard": { color: "#00c" },
  "local": { color: "#00c" },
  "standard(heading, strong, emphasis, processingInstruction, inserted)": { color: "#00c", fontWeight: "bold" },
  "keyword": { color: "#708" },
  "atom": { color: "#708" },
  "bool": { color: "#708" },
  "labelName": { color: "#708" },
  "inserted": { color: "#708" },
  "method": { color: "#708" },
  "heading": { fontWeight: "bold" },
  "contentSeparator": { color: "#444" },
  "link, meta, invalid, deleted": { textDecoration: "underline" }
};

// Simplified version of the highlighter
export function syntaxHighlighting(style) {
  return [];
}

// Export only essential functions with minimal implementations
export function highlightTree() { /* placeholder */ }
export function tags() { /* placeholder */ }
export function styleTags() { /* placeholder */ }
export function tagHighlighter() { /* placeholder */ }
export function getStyleTags() { /* placeholder */ }
export const highlightStyle = { style: defaultHighlightStyle }; 

// Add the missing deserialize function
export function deserialize(value) { 
  if (typeof value === 'undefined') {
    return { 
      style: defaultHighlightStyle,
      deserialize: () => ({ style: defaultHighlightStyle })
    }; 
  }
  return value;
}

export function serialize(highlighter) {
  return highlighter;
}

export function classHighlighter() {
  return { style: defaultHighlightStyle };
}
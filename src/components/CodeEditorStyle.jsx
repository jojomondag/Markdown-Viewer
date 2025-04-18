import React from 'react';

/**
 * Component to handle CodeMirror styles without React DOM warnings
 * This avoids warnings about non-boolean attributes like 'jsx' and 'global'
 */
const CodeEditorStyle = ({ isDarkMode }) => {
  return (
    <style dangerouslySetInnerHTML={{
      __html: `
        .cm-editor {
          height: 100%;
          background-color: ${isDarkMode ? '#1a1a1a' : '#e5e7eb'};
        }
        .cm-scroller {
          overflow: auto; 
          font-family: monospace;
        }
        .cm-content { 
          padding: 10px;
          color: ${isDarkMode ? '#f8f8f2' : '#1f2937'};
        }
        .cm-line {
          padding: 0 3px;
          line-height: 1.6;
          font-family: monospace;
          color: ${isDarkMode ? '#f8f8f2' : '#1f2937'};
        }
        .cm-foldPlaceholder {
          background-color: ${isDarkMode ? '#334155' : '#d1d5db'};
          color: ${isDarkMode ? '#f8f8f2' : '#4b5563'};
          border: none;
          border-radius: 4px;
          padding: 0 4px;
          margin: 0 2px;
          cursor: pointer;
        }
        .cm-gutterElement {
          cursor: pointer;
        }
        .cm-gutters {
          background-color: ${isDarkMode ? '#1a1a1a' : '#d1d5db'};
          color: ${isDarkMode ? '#94a3b8' : '#4b5563'};
          border: none;
        }
        .cm-activeLineGutter {
          background-color: ${isDarkMode ? '#334155' : '#cccccc'};
        }
        .cm-activeLine {
          background-color: ${isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(209, 213, 219, 0.5)'};
        }
        .cm-foldGutter span {
          color: ${isDarkMode ? '#f8f8f2' : '#4b5563'};
        }
        .cm-foldGutter .cm-gutterElement:hover {
          color: ${isDarkMode ? '#ffffff' : '#1f2937'};
        }
        
        /* Syntax highlighting colors with better contrast */
        .cm-comment { color: ${isDarkMode ? '#6a9955' : '#6a9955'}; }
        .cm-string, .cm-string-2 { color: ${isDarkMode ? '#ce9178' : '#a31515'}; }
        .cm-number { color: ${isDarkMode ? '#b5cea8' : '#098658'}; }
        .cm-keyword { color: ${isDarkMode ? '#569cd6' : '#0000ff'}; }
        .cm-def { color: ${isDarkMode ? '#dcdcaa' : '#795e26'}; }
        .cm-operator { color: ${isDarkMode ? '#d4d4d4' : '#000000'}; }
        .cm-variable { color: ${isDarkMode ? '#9cdcfe' : '#001080'}; }
        .cm-variable-2 { color: ${isDarkMode ? '#9cdcfe' : '#001080'}; }
        .cm-property { color: ${isDarkMode ? '#9cdcfe' : '#001080'}; }
        .cm-atom { color: ${isDarkMode ? '#569cd6' : '#0000ff'}; }
      `
    }} />
  );
};

export default CodeEditorStyle; 
import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { EditorState, EditorSelection, Text } from '@codemirror/state';
import { 
  EditorView, 
  keymap, 
  lineNumbers, 
  highlightActiveLine, 
  drawSelection,
  highlightSpecialChars,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLineGutter
} from '@codemirror/view';
import { 
  defaultKeymap, 
  history, 
  historyKeymap, 
  indentWithTab
} from '@codemirror/commands';

// Import commands from the new module
import {
  undoCommand,
  redoCommand,
  applyBold,
  applyItalic,
  applyCode,
  applyHeading,
  applyUnorderedList,
  applyOrderedList,
  applyLink,
  applyImage,
  applyCodeBlock,
  applyBlockquote,
  applyTable
} from '../utils/editorMenu';

// REPLACED: We won't use the actual markdown parser since it's causing errors
// import { markdown as originalMarkdown } from '@codemirror/lang-markdown';

// Create a complete mock implementation of the markdown extension
// This avoids the "Cannot read properties of undefined (reading 'parser')" error
const createMockMarkdownExtension = () => {
  // Create a simple token for highlighting markdown syntax
  const createToken = (name) => ({
    id: name,
    name: name,
    props: [],
    children: [],
    parser: {
      parse: () => ({ type: name })
    }
  });

  // Simple basic language support with no actual parser
  return {
    // Mock language data
    language: {
      name: "markdown",
      load: () => Promise.resolve({}),
      grammar: {},
      topNode: "document",
      parser: {
        parse: () => ({ type: "document" }),
        configure: () => ({ parse: () => ({ type: "document" }) })
      },
      languageData: {
        commentTokens: { line: "#" }
      }
    },
    // Extension factory function
    extension: [],
    // Simple syntax highlighting rules - fallback to basic styles
    tokenTable: {
      "heading": createToken("heading"),
      "strong": createToken("strong"),
      "emphasis": createToken("emphasis"),
      "link": createToken("link"),
      "code": createToken("code"),
      "codeBlock": createToken("codeBlock")
    },
    // Mock config method
    configure: () => createMockMarkdownExtension()
  };
};

// A safe function that won't try to use the real markdown parser at all
const safeMarkdown = () => createMockMarkdownExtension();

import { 
  search, 
  SearchQuery, 
  setSearchQuery, 
  openSearchPanel, 
  closeSearchPanel, 
  findNext, 
  findPrevious, 
  replaceNext, 
  replaceAll, 
  searchKeymap 
} from '@codemirror/search';
import { 
  foldGutter, 
  codeFolding, 
  foldCode, 
  unfoldCode, 
  foldKeymap 
} from '@codemirror/language';
import { 
  syntaxTree,
  bracketMatching
} from '@codemirror/language';
import { 
  syntaxHighlighting, 
  defaultHighlightStyle
} from './highlightFix';
import SearchReplaceDialog from './SearchReplaceDialog';
import { IconSearch, IconCornerDownRight } from '@tabler/icons-react';
import { useAppState } from '../context/AppStateContext';
import CodeEditorStyle from './CodeEditorStyle';

// Helper function to determine if a line is a heading
const isHeadingLine = (line) => {
  return /^#{1,6}\s.+$/.test(line);
};

// Helper function to determine if a line starts a code block
const isCodeBlockStart = (line) => {
  return /^```\w*$/.test(line);
};

// Simple custom fold extension that doesn't rely on the markdown parser
const simpleMarkdownFolding = () => {
  try {
    // Create a very basic folding extension that uses regex patterns instead of the syntax tree
    return codeFolding({
      // Override the language's fold service
      foldNodeProp: {
        // For markdown, we want to fold heading sections and code blocks
        marker: (node) => {
          try {
            // Simple fallback with minimal reliance on node structure
            return "...";
          } catch (error) {
            console.warn('Error in fold marker:', error);
            return null;
          }
        }
      }
    });
  } catch (error) {
    console.warn('Error setting up markdown folding:', error);
    return [];
  }
};

// Wrap component in forwardRef to expose editor methods to parent components
const MarkdownEditor = forwardRef(({
  content,
  onChange,
  onScroll,
  onCursorChange,
  extensions = [],
  inScrollSync = false,
  scrollSource = null,
  scrollTo,
  className = '',
  ...props
}, ref) => {
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const initializedRef = useRef(false);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const { setCursorPosition: setAppCursorPosition } = useAppState();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef(null);
  
  // Basic cursor position tracking
  const trackCursorPosition = useCallback((view) => {
    if (!view) return;
    
    try {
      const doc = view.state.doc;
      const selection = view.state.selection.main;
      const cursor = selection.head;
      
      // Calculate line and column from cursor position
      let line = 1;
      let lineStart = 0;
      
      // Find the line containing this position
      for (let i = 1; i <= doc.lines; i++) {
        const lineEnd = doc.line(i).to;
        if (cursor <= lineEnd) {
          line = i;
          lineStart = doc.line(i).from;
          break;
        }
      }
      
      // Calculate column (1-based, accounting for tabs)
      const lineText = doc.sliceString(lineStart, cursor);
      const column = lineText.length + 1;
      
      // Update local state
      setCursorPosition({ line, column });
      
      // Notify parent component if callback is provided
      if (onCursorChange) {
        onCursorChange({ line, column });
      }
      
      // Also update app-wide state for cursor position
      if (setAppCursorPosition) {
        setAppCursorPosition({ line, column });
      }
    } catch (err) {
      console.error("Error tracking cursor:", err);
    }
  }, [onCursorChange, setAppCursorPosition]);
  
  // Expose methods for parent components
  useImperativeHandle(ref, () => ({
    // Scroll to a specific percentage of the content
    scrollToPosition: (scrollPercentage) => {
      if (!viewRef.current || !viewRef.current.scrollDOM) return;
      
      try {
        const { scrollDOM } = viewRef.current;
        const totalHeight = scrollDOM.scrollHeight - scrollDOM.clientHeight;
        const targetPosition = Math.max(0, Math.min(totalHeight, totalHeight * scrollPercentage));
        
        // Set flag to indicate we're in a programmatic scroll
        setIsScrolling(true);
        
        // Scroll to position
        scrollDOM.scrollTop = targetPosition;
        
        // After a delay, release the scrolling lock
        setTimeout(() => {
          setIsScrolling(false);
        }, 100);
      } catch (error) {
        console.error('Error scrolling editor:', error);
        setIsScrolling(false);
      }
    },
    
    // Get current scroll information
    getScrollInfo: () => {
      if (!viewRef.current || !viewRef.current.scrollDOM) return null;
      
      try {
        const { scrollDOM } = viewRef.current;
        const { scrollTop, scrollHeight, clientHeight } = scrollDOM;
        const maxScrollTop = scrollHeight - clientHeight;
        const scrollPercentage = maxScrollTop > 0 ? scrollTop / maxScrollTop : 0;
        
        return { scrollTop, scrollHeight, clientHeight, scrollPercentage };
      } catch (error) {
        console.error('Error getting scroll info:', error);
        return null;
      }
    },
    
    // Check if editor is currently in scroll sync mode
    isInScrollSync: () => inScrollSync,
    
    // Get editor DOM element
    getElement: () => viewRef.current ? viewRef.current.scrollDOM : null,
    
    // Get current editor view
    getView: () => viewRef.current,
    
    // Get editor content
    getContent: () => viewRef.current ? viewRef.current.state.doc.toString() : content,
    
    // Fold a specific heading or code block at the current cursor position
    foldCurrent: () => {
      if (viewRef.current) {
        foldCode(viewRef.current);
      }
    },
    
    // Unfold a specific heading or code block at the current cursor position
    unfoldCurrent: () => {
      if (viewRef.current) {
        unfoldCode(viewRef.current);
      }
    },

    // Expose undo/redo functions (calling imported commands)
    undo: () => {
      undoCommand(viewRef.current);
    },
    redo: () => {
      redoCommand(viewRef.current);
    },

    // --- Formatting Actions (calling imported commands) ---
    applyBold: () => {
      applyBold(viewRef.current);
    },
    applyItalic: () => {
      applyItalic(viewRef.current);
    },
    applyHeading: (level = 2) => { 
       applyHeading(viewRef.current, level);
     },
    applyUnorderedList: () => {
      applyUnorderedList(viewRef.current);
    },
    applyOrderedList: () => {
      applyOrderedList(viewRef.current);
    },
    applyLink: () => {
      applyLink(viewRef.current);
    },
    applyImage: () => {
      applyImage(viewRef.current);
    },
    applyCodeBlock: () => {
      applyCodeBlock(viewRef.current);
    },
    applyBlockquote: () => {
      applyBlockquote(viewRef.current);
    },
    applyTable: () => {
      applyTable(viewRef.current);
    },
    applyCode: () => {
       applyCode(viewRef.current);
    },

  }));
  
  // Check if dark mode is enabled
  const isDarkMode = () => {
    return true; // Always return true since we're forcing dark mode with the 'dark' class
  };

  // Handle search and replace actions
  const handleSearch = (searchTerm, options) => {
    if (!viewRef.current) return;
    
    try {
      const view = viewRef.current;
      const { direction, matchCase, useRegex } = options;
      
      // Create search query
      const query = new SearchQuery({
        search: searchTerm,
        caseSensitive: matchCase,
        regexp: useRegex
      });
      
      // Set the search query in the editor
      view.dispatch({
        effects: setSearchQuery.of(query)
      });
      
      // Find next/previous match
      if (direction === 'next') {
        findNext(view);
      } else {
        findPrevious(view);
      }
    } catch (error) {
      console.error('Error during search:', error);
    }
  };
  
  const handleReplace = (searchTerm, replaceTerm, options) => {
    if (!viewRef.current) return;
    
    try {
      const view = viewRef.current;
      const { matchCase, useRegex } = options;
      
      // Create search query
      const query = new SearchQuery({
        search: searchTerm,
        replace: replaceTerm,
        caseSensitive: matchCase,
        regexp: useRegex
      });
      
      // Set the search query in the editor
      view.dispatch({
        effects: setSearchQuery.of(query)
      });
      
      // Replace the current match
      replaceNext(view);
    } catch (error) {
      console.error('Error during replace:', error);
    }
  };
  
  const handleReplaceAll = (searchTerm, replaceTerm, options) => {
    if (!viewRef.current) return;
    
    try {
      const view = viewRef.current;
      const { matchCase, useRegex } = options;
      
      // Create search query
      const query = new SearchQuery({
        search: searchTerm,
        replace: replaceTerm,
        caseSensitive: matchCase,
        regexp: useRegex
      });
      
      // Set the search query in the editor
      view.dispatch({
        effects: setSearchQuery.of(query)
      });
      
      // Replace all matches
      replaceAll(view);
    } catch (error) {
      console.error('Error during replace all:', error);
    }
  };

  // Create editor only once when component mounts
  useEffect(() => {
    // Skip if already initialized or ref not ready
    if (initializedRef.current || !editorRef.current) return;
    
    // Set flag to prevent multiple initializations
    initializedRef.current = true;
    
    try {
      console.log('Creating editor with content:', content);
      
      // Clear any existing child nodes
      while (editorRef.current.firstChild) {
        editorRef.current.removeChild(editorRef.current.firstChild);
      }
      
      // Create the editor with ONLY essential extensions
      const view = new EditorView({
        state: EditorState.create({
          doc: content || '',
          extensions: [
            // Critical keyboard handling (this is key for cursor movement)
            keymap.of(defaultKeymap),
            keymap.of(historyKeymap),
            keymap.of([indentWithTab]),
            
            // Basic editor functionality
            history(),
            drawSelection(),
            dropCursor(),
            EditorState.allowMultipleSelections.of(true),
            
            // Visual aids
            lineNumbers(),
            highlightActiveLine(),
            
            // Basic styling
            EditorView.theme({
              "&": { height: "100%" },
              ".cm-scroller": { overflow: "auto" },
              ".cm-content": { 
                whiteSpace: "pre-wrap",
                caretColor: "white" // Make cursor visible
              },
              ".cm-cursor": {
                borderLeftWidth: "2px",
                borderLeftStyle: "solid",
                borderLeftColor: "white"
              },
              "&.cm-editor.cm-focused": { outline: "none" }
            }),
            
            // Listen for document and selection changes
            EditorView.updateListener.of((update) => {
              // Handle document changes
              if (update.docChanged && onChange) {
                onChange(update.state.doc.toString());
              }
              
              // Track cursor position
              if (update.selectionSet) {
                trackCursorPosition(update.view);
              }
            }),
            
            // Handle scroll events
            EditorView.domEventHandlers({
              scroll: (event, view) => {
                if (!view || !view.scrollDOM || isScrolling) return;
                
                if (onScroll) {
                  const { scrollDOM } = view;
                  const { scrollTop, scrollHeight, clientHeight } = scrollDOM;
                  const maxScroll = scrollHeight - clientHeight;
                  const scrollPercentage = maxScroll > 0 ? scrollTop / maxScroll : 0;
                  
                  onScroll(scrollPercentage);
                }
              }
            })
          ]
        }),
        parent: editorRef.current
      });
      
      // Store the view reference
      viewRef.current = view;
      
      // Focus the editor after creation
      setTimeout(() => {
        if (view) {
          view.focus();
        }
      }, 50);
      
      // Cleanup on unmount
      return () => {
        view.destroy();
        
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    } catch (error) {
      console.error('Error creating editor:', error);
      initializedRef.current = false;
    }
  }, []); // Empty dependency array - only run once on mount

  // Update content when it changes externally
  useEffect(() => {
    // Skip if not initialized
    if (!viewRef.current) return;
    
    try {
      // Get current content from editor
      const currentDoc = viewRef.current.state.doc.toString();
      
      // Only update if content is different
      if (content !== currentDoc) {
        // Save current cursor position
        const selection = viewRef.current.state.selection;
        
        // Create a transaction to update the document
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: viewRef.current.state.doc.length,
            insert: content || ''
          },
          // Preserve cursor position if possible
          selection
        });
      }
    } catch (error) {
      console.error('Error updating editor content:', error);
    }
  }, [content]);

  // Handle programmatic scroll requests
  useEffect(() => {
    if (!viewRef.current || !scrollTo || isScrolling) return;
    
    setIsScrolling(true);
    
    if (scrollTo.type === 'percent') {
      const scrollDOM = viewRef.current.scrollDOM;
      const maxScroll = scrollDOM.scrollHeight - scrollDOM.clientHeight;
      const targetPosition = Math.max(0, Math.min(maxScroll, maxScroll * scrollTo.value));
      scrollDOM.scrollTop = targetPosition;
    }
    
    // Clear the scrolling flag after a short delay
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 100);
    
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [scrollTo, isScrolling]);

  return (
    <div className={`h-full flex flex-col relative ${className} dark`}>
      {/* Add direct styling to fix cursor appearance */}
      <style>{`
        .cm-editor { height: 100%; }
        .cm-content { caret-color: white !important; }
        .cm-cursor { border-left: 2px solid white !important; }
      `}</style>
      
      <div 
        ref={editorRef} 
        className="flex-grow overflow-auto border border-surface-300 dark:border-surface-700 rounded" 
        style={{ position: "relative", zIndex: 40 }}
      />
      
      {/* Cursor position indicator */}
      <div className="absolute bottom-2 right-10 bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-300 px-2 py-1 rounded text-xs flex items-center z-50">
        <IconCornerDownRight size={12} className="mr-1" />
        Ln {cursorPosition.line}, Col {cursorPosition.column}
      </div>
      
      <button 
        className="absolute top-2 right-2 p-1.5 rounded-full bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600 z-50"
        onClick={() => setIsSearchOpen(true)}
        title="Search (Ctrl+F)"
      >
        <IconSearch size={16} className="text-surface-700 dark:text-surface-300" />
      </button>

      {isSearchOpen && (
        <SearchReplaceDialog
          onClose={() => setIsSearchOpen(false)}
          onSearch={handleSearch}
          onReplace={handleReplace}
          onReplaceAll={handleReplaceAll}
        />
      )}
    </div>
  );
});

MarkdownEditor.displayName = 'MarkdownEditor';

export default MarkdownEditor; 
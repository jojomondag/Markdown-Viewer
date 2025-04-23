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

// Import commands from the editor menu utility
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
import SearchReplaceDialog from './SearchReplaceDialog';
import { IconSearch } from '@tabler/icons-react';
import { useAppState } from '../context/AppStateContext';

// Helper functions for folding
const isHeadingLine = (line) => /^#{1,6}\s.+$/.test(line);
const isCodeBlockStart = (line) => /^```\w*$/.test(line);

// Simple custom fold extension
const simpleMarkdownFolding = () => {
  try {
    return codeFolding({
      foldNodeProp: {
        marker: () => "..."
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
    // Cursor position info
    getCurrentCursorPosition: () => {
      return cursorPosition;
    },
    
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
    
    // Scroll info
    getScrollInfo: () => {
      if (viewRef.current) {
        const scrollDOM = viewRef.current.scrollDOM;
        const scrollPercentage = scrollDOM.scrollTop / (scrollDOM.scrollHeight - scrollDOM.clientHeight);
        return {
          scrollPercentage: isNaN(scrollPercentage) ? 0 : scrollPercentage,
          scrollTop: scrollDOM.scrollTop,
          scrollHeight: scrollDOM.scrollHeight,
          clientHeight: scrollDOM.clientHeight
        };
      }
      return { scrollPercentage: 0, scrollTop: 0, scrollHeight: 0, clientHeight: 0 };
    },
    
    // Check if editor is currently in scroll sync mode
    isInScrollSync: () => inScrollSync,
    
    // Force editor to recalculate its layout
    refreshLayout: () => {
      if (viewRef.current) {
        try {
          // Request a measurement update from CodeMirror
          viewRef.current.requestMeasure();
          
          // Force a DOM measurement and layout update
          setTimeout(() => {
            if (viewRef.current) {
              viewRef.current.dispatch({type: "layout"});
            }
          }, 10);
        } catch (error) {
          console.error('Error refreshing editor layout:', error);
        }
      }
    },
    
    // Get editor DOM element
    getElement: () => viewRef.current ? viewRef.current.scrollDOM : null,
    
    // Get editor view
    getView: () => viewRef.current,
    
    // Text operations
    getText: () => content,
    setText: (text) => {
      if (onChange) onChange(text);
    },
    
    // Folding operations
    foldCurrent: () => {
      if (viewRef.current) foldCode(viewRef.current);
    },
    unfoldCurrent: () => {
      if (viewRef.current) unfoldCode(viewRef.current);
    },

    // Undo/redo functions
    undo: () => undoCommand(viewRef.current),
    redo: () => redoCommand(viewRef.current),

    // Formatting actions
    applyBold: () => applyBold(viewRef.current),
    applyItalic: () => applyItalic(viewRef.current),
    applyHeading: (level = 2) => applyHeading(viewRef.current, level),
    applyUnorderedList: () => applyUnorderedList(viewRef.current),
    applyOrderedList: () => applyOrderedList(viewRef.current),
    applyLink: () => applyLink(viewRef.current),
    applyImage: () => applyImage(viewRef.current),
    applyCodeBlock: () => applyCodeBlock(viewRef.current),
    applyBlockquote: () => applyBlockquote(viewRef.current),
    applyTable: () => applyTable(viewRef.current),
    applyCode: () => applyCode(viewRef.current),
    
    // Search and replace functions
    handleSearch: (searchTerm, options) => {
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
    },
    
    handleReplace: (searchTerm, replaceTerm, options) => {
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
    },
    
    handleReplaceAll: (searchTerm, replaceTerm, options) => {
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
    }
  }));

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
      
      // Create the editor with essential extensions
      const view = new EditorView({
        state: EditorState.create({
          doc: content || '',
          extensions: [
            // Critical keyboard handling
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
        // Check if the document state is valid before attempting to update
        if (!viewRef.current.state || !viewRef.current.state.doc) {
          console.warn('Editor state or document is undefined, skipping update');
          return;
        }

        const docLength = viewRef.current.state.doc.length;
        
        // Create a transaction to update the document
        const transaction = {
          changes: {
            from: 0,
            to: docLength || 0,
            insert: content || ''
          }
        };
        
        // Create a fresh selection at the start to avoid "Selection points outside of document" errors
        transaction.selection = EditorSelection.single(0);
        
        try {
          // Apply the transaction
          viewRef.current.dispatch(viewRef.current.state.update(transaction));
          
          // After updating, re-focus the editor to prevent it from getting "stuck"
          setTimeout(() => {
            if (viewRef.current) {
              viewRef.current.focus();
            }
          }, 10);
        } catch (transactionError) {
          console.error('Error applying transaction:', transactionError);
          
          // If transaction fails, try to recreate the editor state
          try {
            const newState = EditorState.create({
              doc: content || '',
              selection: EditorSelection.single(0)
            });
            
            viewRef.current.setState(newState);
          } catch (stateError) {
            console.error('Failed to recreate editor state:', stateError);
          }
        }
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
        className="flex-grow overflow-auto"
        style={{ position: "relative" }}
        ref={editorRef}
      />
    </div>
  );
});

MarkdownEditor.displayName = 'MarkdownEditor';

export default MarkdownEditor;
import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { EditorState } from '@codemirror/state';
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
  foldAll, 
  unfoldAll,
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
import { IconSearch, IconCornerDownRight, IconFold, IconChevronDown } from '@tabler/icons-react';
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
  const [isContentChanged, setIsContentChanged] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const { setCursorPosition: setAppCursorPosition } = useAppState();
  const [isFolded, setIsFolded] = useState(false);
  
  // Expose methods for parent components
  useImperativeHandle(ref, () => ({
    // Scroll to a specific percentage of the content
    scrollToPosition: (scrollPercentage) => {
      if (!viewRef.current || !viewRef.current.scrollDOM) {
        console.log('Cannot scroll, editor not initialized');
        return;
      }
      
      try {
        console.log('Scrolling editor to position:', scrollPercentage);
        
        const { scrollDOM } = viewRef.current;
        const totalHeight = scrollDOM.scrollHeight - scrollDOM.clientHeight;
        const targetPosition = Math.max(0, Math.min(totalHeight, totalHeight * scrollPercentage));
        
        // Set flag to indicate we're in a programmatic scroll
        setIsScrolling(true);
        
        // Store the target position to maintain it
        viewRef.current._lastScrollPosition = targetPosition;
        
        // Scroll to position
        scrollDOM.scrollTop = targetPosition;
        console.log('Editor scrolled to:', targetPosition);
        
        // Clear any existing timeout
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        
        // After a delay, release the scrolling lock
        scrollTimeoutRef.current = setTimeout(() => {
          // Double-check the scroll position before releasing the lock
          if (viewRef.current && viewRef.current.scrollDOM) {
            const currentPos = viewRef.current.scrollDOM.scrollTop;
            if (Math.abs(currentPos - targetPosition) > 5) {
              // Try one more time if the position drifted
              viewRef.current.scrollDOM.scrollTop = targetPosition;
            }
          }
          
          setIsScrolling(false);
          console.log('Editor scroll lock released');
        }, 300);
      } catch (error) {
        console.error('Error scrolling editor:', error);
        setIsScrolling(false);
      }
    },
    
    // Get current scroll information
    getScrollInfo: () => {
      if (!viewRef.current || !viewRef.current.scrollDOM) {
        console.log('Cannot get scroll info, editor not initialized');
        return null;
      }
      
      try {
        const { scrollDOM } = viewRef.current;
        const { scrollTop, scrollHeight, clientHeight } = scrollDOM;
        const maxScrollTop = scrollHeight - clientHeight;
        const scrollPercentage = maxScrollTop > 0 ? scrollTop / maxScrollTop : 0;
        
        return {
          scrollTop,
          scrollHeight,
          clientHeight,
          scrollPercentage
        };
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
    
    // Fold controls
    foldAll: () => {
      if (viewRef.current) {
        foldAll(viewRef.current);
        setIsFolded(true);
      }
    },
    
    unfoldAll: () => {
      if (viewRef.current) {
        unfoldAll(viewRef.current);
        setIsFolded(false);
      }
    },
    
    toggleFolding: () => {
      if (viewRef.current) {
        if (isFolded) {
          unfoldAll(viewRef.current);
          setIsFolded(false);
        } else {
          foldAll(viewRef.current);
          setIsFolded(true);
        }
      }
    },
    
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

  // Track cursor position when it changes
  const trackCursorPosition = useCallback((view) => {
    if (!view) return;
    
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
  }, [onCursorChange, setAppCursorPosition]);
  
  // Handle scroll events in the editor
  const handleEditorScroll = () => {
    if (viewRef.current && onScroll && !isScrolling) {
      const { scrollDOM } = viewRef.current;
      const { scrollTop, scrollHeight, clientHeight } = scrollDOM;
      const maxScrollTop = scrollHeight - clientHeight;
      const scrollPercentage = maxScrollTop > 0 ? scrollTop / maxScrollTop : 0;
      
      // Track the scroll position
      viewRef.current._lastScrollPosition = scrollTop;
      
      onScroll(scrollPercentage);
    }
  };
  
  // Toggle folding all sections
  const toggleFolding = () => {
    if (viewRef.current) {
      if (isFolded) {
        unfoldAll(viewRef.current);
        setIsFolded(false);
      } else {
        foldAll(viewRef.current);
        setIsFolded(true);
      }
    }
  };

  // Create a new editor instance when the component mounts or when extensions change
  useEffect(() => {
    if (!editorRef.current) {
      console.log('Editor ref not available');
      return;
    }
    
    // DEBUG: Log DOM element properties to ensure it can receive input
    console.log('Editor DOM element:', {
      element: editorRef.current,
      style: window.getComputedStyle(editorRef.current),
      parentElement: editorRef.current.parentElement,
      offsetParent: editorRef.current.offsetParent,
      visibility: window.getComputedStyle(editorRef.current).visibility,
      display: window.getComputedStyle(editorRef.current).display,
      pointerEvents: window.getComputedStyle(editorRef.current).pointerEvents,
    });
    
    try {
      console.log('Creating editor with content:', content);
      
      // WORKAROUND: Clear any existing child nodes that might interfere
      while (editorRef.current.firstChild) {
        editorRef.current.removeChild(editorRef.current.firstChild);
      }
      
      // Define standard editor extensions
      const standardExtensions = [
        // Basic editor features
        EditorView.editable.of(true), // MOVED to top to ensure it's applied first
        EditorState.readOnly.of(false), // Ensure editor is not in read-only mode
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        // Keyboard input handling - these are crucial for editing!
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab
        ]),
        // Explicit navigation key handling
        EditorView.domEventHandlers({
          keydown: (event, view) => {
            // Ensure arrow keys and navigation keys are handled
            if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", 
                 "Home", "End", "PageUp", "PageDown"].includes(event.key)) {
              // Don't return true - let the default handlers work
              console.log(`Navigation key pressed: ${event.key}`);
            }
            return false;
          },
          mousedown: (event, view) => {
            // Force focus on mouse clicks
            view.focus();
            console.log("Mouse down on editor");
            return false; // Don't prevent default behavior
          }
        }),
        // Line numbers and gutter features
        lineNumbers(),
        foldGutter(),
        // Styling
        syntaxHighlighting(defaultHighlightStyle),
        // Matching brackets
        bracketMatching(),
        // Search
        search({
          top: true
        }),
        // Theme and styling - minimal setup to avoid duplication with CodeEditorStyle
        EditorView.theme({
          "&": { 
            height: "100%", 
            overflow: "auto"
          },
          ".cm-scroller": { 
            overflow: "auto" 
          },
          ".cm-content": { 
            whiteSpace: "pre-wrap"
          },
          "&.cm-focused .cm-cursor": {
            borderLeftWidth: "2px",
            borderLeftStyle: "solid"
          },
          "&.cm-editor.cm-focused": {
            outline: "none"
          }
        }),
        // Update listener for content changes
        EditorView.updateListener.of((update) => {
          if (update.docChanged && onChange) {
            // Only trigger onChange for actual document changes
            setIsContentChanged(true);
            onChange(update.state.doc.toString());
          }
          
          // Track cursor position on selection changes or document changes
          if (update.selectionSet || update.docChanged) {
            trackCursorPosition(update.view);
          }
        }),
        // Add our custom scroll handling
        handleScrollEvents()
      ];
      
      // Create editor state with all extensions
      const state = EditorState.create({
        doc: content || '',
        extensions: [
          ...standardExtensions,
          ...extensions // User-provided custom extensions
        ]
      });

      // Create the editor view
      const view = new EditorView({
        state,
        parent: editorRef.current,
        dispatchTransactions: (trs) => {
          // Default transaction handling
          let newState = view.state;
          for (const tr of trs) {
            newState = newState.update(tr);
          }
          view.update([...trs]);
          
          // Track cursor position on selection changes
          if (trs.some(tr => tr.selection)) {
            trackCursorPosition(view);
          }
        },
      });

      viewRef.current = view;
      console.log('Editor view created successfully');

      // DIRECT DOM MANIPULATION: Ensure the editor is properly initialized
      // Get the ContentEditable div within the editor
      if (view.dom) {
        const cmContentEditable = view.dom.querySelector('.cm-content');
        if (cmContentEditable) {
          console.log('Found content editable element:', cmContentEditable);
          
          // Force contentEditable attribute to ensure it can be edited
          cmContentEditable.setAttribute('contenteditable', 'true');
          
          // Remove any pointer-events restrictions
          cmContentEditable.style.pointerEvents = 'auto';
          
          // Only set cursor style, leave color to CodeEditorStyle
          cmContentEditable.style.cursor = 'text';
          
          // Apply critical styles to direct parent
          view.dom.style.pointerEvents = 'auto';
          view.dom.style.zIndex = '25'; // Higher than other elements
          
          // Add a click event to force focus
          view.dom.addEventListener('click', () => {
            cmContentEditable.focus();
            console.log('Forced focus on content editable');
          });
        } else {
          console.warn('Could not find .cm-content element in editor');
        }
      }

      // Focus the editor after creation to ensure it's ready for input
      setTimeout(() => {
        if (view && view.dom) {
          view.focus();
          console.log('Editor focused');
        }
      }, 100);

      // Store initial scroll position
      if (view.scrollDOM) {
        view._lastScrollPosition = view.scrollDOM.scrollTop;
      }

      return () => {
        console.log('Cleaning up editor view');
        view.destroy();
        
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    } catch (error) {
      console.error('Error creating editor:', error);
    }
  }, [extensions, content, onChange, handleScrollEvents, trackCursorPosition]);

  // Update content when it changes externally
  useEffect(() => {
    // Skip if no view or if content change originated from our component
    if (!viewRef.current || isContentChanged) {
      // Reset the content changed flag if it was set
      if (isContentChanged) {
        setIsContentChanged(false);
      }
      return;
    }
    
    try {
      console.log('External content change detected, updating editor');
      
      // Get current content from editor
      const currentDoc = viewRef.current.state.doc.toString();
      
      // Only update if content is different
      if (content !== currentDoc) {
        console.log('Content different, updating from:', currentDoc.substring(0, 20), 'to:', (content || '').substring(0, 20));
        
        // Save current cursor position
        const currentPos = viewRef.current.state.selection.main.head;
        
        // Create a transaction to update the document
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: viewRef.current.state.doc.length,
            insert: content || ''
          },
          // Try to preserve cursor position
          selection: { anchor: Math.min(currentPos, (content || '').length) }
        });
        
        console.log('Editor content updated successfully');
      }
    } catch (error) {
      console.error('Error updating editor content:', error);
    }
  }, [content, isContentChanged]);

  // Add explicit event debugging
  useEffect(() => {
    // Skip if no view ref
    if (!viewRef.current || !viewRef.current.dom) return;
    
    console.log("Setting up event debugging for editor");
    
    // List of events to monitor
    const eventTypes = [
      'click', 'mousedown', 'mouseup', 'mousemove',
      'keydown', 'keyup', 'keypress', 
      'focus', 'blur', 'input'
    ];
    
    // Create event listeners
    const listeners = {};
    
    eventTypes.forEach(eventType => {
      listeners[eventType] = (event) => {
        console.log(`DEBUG [${eventType}] on editor:`, {
          target: event.target,
          currentTarget: event.currentTarget,
          eventPhase: event.eventPhase,
          path: event.composedPath ? event.composedPath() : null,
          bubbles: event.bubbles,
          cancelable: event.cancelable,
          defaultPrevented: event.defaultPrevented,
          key: event.key,
          code: event.code
        });
      };
      
      // Add listener to the editor DOM element
      viewRef.current.dom.addEventListener(eventType, listeners[eventType], true);
    });
    
    // Cleanup
    return () => {
      if (viewRef.current && viewRef.current.dom) {
        eventTypes.forEach(eventType => {
          viewRef.current.dom.removeEventListener(eventType, listeners[eventType], true);
        });
      }
    };
  }, [viewRef.current]);

  // Keyboard shortcut for folding
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check if the editor is focused or if no modal/dialog is active
      if (!editorRef.current || !viewRef.current || isSearchOpen) return;
      
      // Fold/unfold on Alt+[ and Alt+]
      if (e.altKey && e.key === '[') {
        e.preventDefault();
        foldCode(viewRef.current);
      } else if (e.altKey && e.key === ']') {
        e.preventDefault();
        unfoldCode(viewRef.current);
      }
      
      // Fold/unfold all on Ctrl+Alt+[ and Ctrl+Alt+]
      if (e.ctrlKey && e.altKey && e.key === '[') {
        e.preventDefault();
        foldAll(viewRef.current);
        setIsFolded(true);
      } else if (e.ctrlKey && e.altKey && e.key === ']') {
        e.preventDefault();
        unfoldAll(viewRef.current);
        setIsFolded(false);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSearchOpen]);

  // Add an effect to maintain the scroll position
  useEffect(() => {
    // Restore scroll position on content or editor refresh
    if (viewRef.current && viewRef.current._lastScrollPosition) {
      const scrollPosition = viewRef.current._lastScrollPosition;
      
      // Verify it's needed (might be a scroll reset)
      if (scrollPosition > 10) { // Only restore if we were scrolled down
        // Use setTimeout to allow the editor to render first
        setTimeout(() => {
          if (viewRef.current && viewRef.current.scrollDOM) {
            viewRef.current.scrollDOM.scrollTop = scrollPosition;
          }
        }, 50);
      }
    }
  }, [viewRef.current]);

  // Add a MutationObserver to watch for changes that might affect scroll position
  useEffect(() => {
    if (!viewRef.current || !editorRef.current) return;
    
    // Create a MutationObserver to watch for changes to the editor
    const observer = new MutationObserver(() => {
      // Only maintain position during programmatic scrolling, not during user scrolling
      // AND only when we have a meaningful non-zero position
      if (inScrollSync && isScrolling && viewRef.current && viewRef.current._lastScrollPosition > 5) {
        const lastPos = viewRef.current._lastScrollPosition;
        // Use requestAnimationFrame to ensure this happens after the browser's rendering
        requestAnimationFrame(() => {
          if (viewRef.current && viewRef.current.scrollDOM) {
            viewRef.current.scrollDOM.scrollTop = lastPos;
          }
        });
      }
    });
    
    // Start observing the editor
    observer.observe(editorRef.current, {
      childList: true,
      subtree: true,
      attributes: true
    });
    
    return () => observer.disconnect();
  }, [inScrollSync, isScrolling, viewRef.current, editorRef.current]);

  /**
   * Handle scroll events for the editor
   * This is crucial for synchronizing scroll positions
   */
  const handleScrollEvents = useCallback(() => {
    // Create a custom extension to handle scroll events
    return EditorView.domEventHandlers({
      scroll: (event, view) => {
        if (!view || !view.scrollDOM) return;
        
        const scrollDOM = view.scrollDOM;
        const currentScrollTop = scrollDOM.scrollTop;
        
        // Don't process scroll events if we're in a programmatic scroll
        if (isScrolling) {
          // Store the last scroll position (if it's not a reset to 0)
          if (view._lastScrollPosition !== undefined && currentScrollTop > 5) {
            const drift = Math.abs(currentScrollTop - view._lastScrollPosition);
            
            // If the scroll position has drifted significantly, restore it
            if (drift > 5) {
              console.log('Correcting scroll drift:', drift);
              scrollDOM.scrollTop = view._lastScrollPosition;
            }
          }
          return;
        }
        
        // BUGFIX: Remove the block that's preventing independent scrolling
        // This was preventing any scrolling when inScrollSync was true
        // Instead, allow scrolling and just track position
        
        // For natural user scrolling, emit scroll events
        if (onScroll && !isScrolling) {
          const scrollHeight = scrollDOM.scrollHeight;
          const clientHeight = scrollDOM.clientHeight;
          const maxScroll = scrollHeight - clientHeight;
          const scrollPercentage = maxScroll > 0 ? currentScrollTop / maxScroll : 0;
            
          // Only track meaningful scroll positions (not reset to 0)
          // This prevents the editor from resetting to 0 when there are conflicts
          if (currentScrollTop > 5 || (scrollPercentage > 0.01 && scrollHeight > 100)) {
            // Store the last scroll position for reference
            view._lastScrollPosition = currentScrollTop;
            
            // Emit scroll event with all relevant info
            onScroll({
              scrollTop: currentScrollTop,
              scrollHeight,
              clientHeight,
              scrollPercentage
            });
          }
        }
      }
    });
  }, [onScroll, isScrolling, inScrollSync, scrollSource]);

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

  // Component cleanup
  useEffect(() => {
    return () => {
      // Clean up any remaining timeouts on unmount
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div 
      className={`h-full flex flex-col relative ${className} dark`}
      onClick={(e) => {
        if (viewRef.current) {
          // Force focus when clicking anywhere in the editor container
          viewRef.current.focus();
          
          // Attempt to position cursor at click location if possible
          try {
            const editorRect = viewRef.current.dom.getBoundingClientRect();
            const pos = viewRef.current.posAtCoords({
              x: e.clientX - editorRect.left,
              y: e.clientY - editorRect.top
            });
            
            if (pos !== null) {
              // Set the selection to the clicked position
              viewRef.current.dispatch({
                selection: {anchor: pos, head: pos}
              });
              console.log("Cursor positioned at:", pos);
            }
          } catch (err) {
            console.error("Error positioning cursor:", err);
          }
        }
      }}
      onMouseMove={() => {
        // Focus editor on mouse movement if it's not already focused
        if (viewRef.current && document.activeElement !== viewRef.current.dom) {
          viewRef.current.focus();
        }
      }}
    >
      <CodeEditorStyle isDarkMode={isDarkMode()} />
      <div 
        ref={editorRef} 
        className="flex-grow overflow-auto border border-surface-300 dark:border-surface-700 rounded" 
        style={{ 
          position: "relative", 
          zIndex: 15, 
          pointerEvents: "auto",
          cursor: "text",
          // Cursor styling variables
          "--cursor-width": "2px",
          "--cursor-color": "#f8f8f2" // Always use light cursor
        }}
      />
      
      {/* Folding controls */}
      <div className="absolute top-2 left-2 flex space-x-2 z-10">
        <button 
          className="p-1.5 rounded-full bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600"
          onClick={toggleFolding}
          title={isFolded ? "Unfold All (Ctrl+Alt+])" : "Fold All (Ctrl+Alt+[)"}
        >
          {isFolded 
            ? <IconChevronDown size={16} className="text-surface-700 dark:text-surface-300" /> 
            : <IconFold size={16} className="text-surface-700 dark:text-surface-300" />
          }
        </button>
      </div>
      
      {/* Cursor position indicator */}
      <div className="absolute bottom-2 right-10 bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-300 px-2 py-1 rounded text-xs flex items-center z-10">
        <IconCornerDownRight size={12} className="mr-1" />
        Ln {cursorPosition.line}, Col {cursorPosition.column}
      </div>
      
      <button 
        className="absolute top-2 right-2 p-1.5 rounded-full bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600"
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
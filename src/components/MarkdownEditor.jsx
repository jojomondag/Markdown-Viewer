import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { EditorState, EditorSelection, Text, Compartment } from '@codemirror/state';
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

// Create a compartment for the theme so it can be changed dynamically
const themeCompartment = new Compartment();

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
  const { 
    state: appState, 
    setCursorPosition: setAppCursorPosition, 
    setEditorFontSize
  } = useAppState();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef(null);
  const fontSize = appState.editor.fontSize;
  
  // Function to create the theme extension based on font size
  const createThemeExtension = (currentFontSize) => {
    const lineHeight = 1.5; // Define a consistent line height
    return EditorView.theme({
      "&": { height: "100%" },
      ".cm-scroller": { overflow: "auto" },
      ".cm-content": { 
        whiteSpace: "pre", // Changed back to "pre" to disable wrapping
        fontSize: `${currentFontSize}px`, // Use dynamic font size
        lineHeight: lineHeight // Apply consistent line height
      },
      ".cm-gutters": { // Styles for the main gutter container
        fontSize: `${currentFontSize}px`,
        lineHeight: lineHeight,
        // Add background/border if desired for the whole gutter area
        // backgroundColor: "#f0f0f0", 
        // borderRight: "1px solid #ccc",
      },
      ".cm-lineNumbers": { // Specific styles for the line number gutter
         width: "3.5em !important",    // Ensure FIXED width (adjust value as needed)
         paddingRight: "1em", // Add space to the right of the numbers
         textAlign: "right",  // Align numbers to the right
         color: "#888"       // Optional: Set a specific color for line numbers
      },
      ".cm-gutterElement": { // Ensure individual gutter elements inherit line height correctly
        lineHeight: `${lineHeight}em` // Use em to ensure it scales with font size if needed
      },
      ".cm-cursor": {
        borderLeftWidth: "2px",
        borderLeftStyle: "solid",
      },
      "&.cm-editor.cm-focused": { outline: "none" }
    });
  };

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

    // Zoom functions
    zoomIn: () => setEditorFontSize(prevSize => Math.min(prevSize + 1, 36)),
    zoomOut: () => setEditorFontSize(prevSize => Math.max(prevSize - 1, 8)),
    setFontSize: (newSize) => setEditorFontSize(Math.max(8, Math.min(newSize, 36))),
    getFontSize: () => appState.editor.fontSize,

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
      const initialTheme = createThemeExtension(appState.editor.fontSize); // Create initial theme
      
      const view = new EditorView({
        state: EditorState.create({
          doc: content || '',
          extensions: [
            // Critical keyboard handling
            keymap.of(defaultKeymap),
            keymap.of(historyKeymap),
            keymap.of([indentWithTab]),
            keymap.of(foldKeymap), // Add fold keymap
            keymap.of(searchKeymap), // Add search keymap
            // Add zoom keymap
            keymap.of([
              { key: "Ctrl-=+", run: () => { setEditorFontSize(s => Math.min(s + 1, 36)); return true; } },
              { key: "Ctrl--", run: () => { setEditorFontSize(s => Math.max(s - 1, 8)); return true; } },
              { key: "Ctrl-0", run: () => { setEditorFontSize(14); return true; } }, // Reset zoom to default 14
            ]),
            
            // Basic editor functionality
            history(),
            drawSelection(),
            dropCursor(),
            EditorState.allowMultipleSelections.of(true),
            
            // Visual aids
            lineNumbers(),
            highlightActiveLine(),
            highlightActiveLineGutter(), // Highlight active line in gutter
            highlightSpecialChars(), // Show special characters
            bracketMatching(), // Highlight matching brackets
            rectangularSelection(), // Enable rectangular selection
            crosshairCursor(), // Show crosshair cursor
            codeFolding(), // Enable code folding
            foldGutter(), // Add fold gutter
            search({ top: true }), // Enable search panel at the top
            
            // Configure the theme compartment initially
            themeCompartment.of(initialTheme), 
            
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
              },
              // Add mousedown handler for line number clicks
              mousedown: (event, view) => {
                console.log('[Line Number Click] mousedown event triggered'); // Log: Handler triggered
                const target = event.target;
                console.log('[Line Number Click] Target element:', target);
                // More specific check: Is the clicked element a gutter element inside the line number container?
                if (target.classList.contains('cm-gutterElement') && target.closest('.cm-lineNumbers')) {
                  console.log('[Line Number Click] Click detected on a gutter element inside line numbers.');
                  // Try getting position using coordinates first
                  let pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
                  console.log('[Line Number Click] Calculated position via posAtCoords:', pos);

                  // If posAtCoords fails (e.g., returns null), try getting the line block by height
                  if (pos == null) {
                    try {
                      const lineBlock = view.lineBlockAtHeight(event.clientY);
                      console.log('[Line Number Click] Trying lineBlockAtHeight:', lineBlock);
                      if (lineBlock) {
                        pos = lineBlock.from; // Use the start of the line block
                        console.log('[Line Number Click] Position set from lineBlock.from:', pos);
                      }
                    } catch (e) {
                       console.error('[Line Number Click] Error using lineBlockAtHeight:', e);
                    }
                  }

                  if (pos != null) {
                    const line = view.state.doc.lineAt(pos);
                    console.log('[Line Number Click] Line object:', line);
                    view.dispatch({
                      selection: EditorSelection.range(line.from, line.to),
                      scrollIntoView: { y: "nearest", x: "never" }
                    });
                    console.log('[Line Number Click] Selection dispatched for line:', line.number);
                    event.preventDefault(); 
                  } else {
                    console.log('[Line Number Click] Could not determine position for the click.');
                  }
                } else {
                   console.log('[Line Number Click] Click was not on a cm-gutterElement inside cm-lineNumbers.');
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Depend on initial context values indirectly via appState read

  // Update editor theme when font size changes using the compartment
  useEffect(() => {
    if (!viewRef.current) return;

    // Create the new theme extension
    const newTheme = createThemeExtension(appState.editor.fontSize);

    console.log(`[ThemeEffect] Font size changed to ${appState.editor.fontSize}. Dispatching theme reconfigure.`); // Log dispatch
    // Dispatch the reconfiguration effect for the theme compartment
    viewRef.current.dispatch({
      effects: themeCompartment.reconfigure(newTheme)
    });

  }, [appState.editor.fontSize]); // Depend on context font size

  // Add Ctrl+MouseWheel zoom listener
  useEffect(() => {
    const editorElement = viewRef.current?.dom;
    if (!editorElement) return;
    console.log('[WheelEffect] Setting up wheel listener.'); // Log setup

    const handleWheel = (event) => {
      if (event.ctrlKey) {
        event.preventDefault();
        const currentSize = appState.editor.fontSize; // Read current size from fresh state closure
        
        // Determine zoom direction
        let newSize;
        if (event.deltaY < 0) {
          // Zoom In (wheel up)
          newSize = Math.min(currentSize + 1, 36);
        } else {
          // Zoom Out (wheel down)
          newSize = Math.max(currentSize - 1, 8);
        }
        
        if (newSize !== currentSize) { // Only dispatch if size changes
          console.log(`[WheelEvent] Ctrl+Wheel detected. Setting font size from ${currentSize} to ${newSize}`); // Log state update call
          setEditorFontSize(newSize); // Call context setter
        }
      }
    };

    // Add listener with passive: false to allow preventDefault
    editorElement.addEventListener('wheel', handleWheel, { passive: false });

    // Cleanup listener on unmount or when view changes
    return () => {
      console.log('[WheelEffect] Cleaning up wheel listener.'); // Log cleanup
      editorElement.removeEventListener('wheel', handleWheel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewRef.current, setEditorFontSize, appState.editor.fontSize]); // Add appState.editor.fontSize dependency

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
  
  // Add direct click handler for line numbers
  useEffect(() => {
    if (!viewRef.current) return;
    
    let startLineNumber = null;
    let isDragging = false;
    let initialScrollLeft = 0; // Store initial horizontal scroll position
    let autoScrollInterval = null; // For auto-scrolling timer
    let lastMouseY = 0; // Track last mouse Y position
    let lastMouseTime = 0; // Track time of last mouse move
    let mouseVelocity = 0; // Track vertical mouse velocity
    let selectionOrigin = null; // Store the start position for selection
    let rafId = null; // For requestAnimationFrame ID
    
    // Function for continuous scrolling using requestAnimationFrame
    const continuousScroll = () => {
      if (!isDragging || !viewRef.current || !viewRef.current.scrollDOM) {
        // Cancel animation if no longer dragging
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        return;
      }
      
      // Get mouse position relative to editor
      const editorRect = viewRef.current.dom.getBoundingClientRect();
      
      // Calculate scroll speed based on distance from edges
      let scrollSpeed = 0;
      
      if (lastMouseY < editorRect.top) {
        // Above editor - scroll up
        const distanceAbove = editorRect.top - lastMouseY;
        scrollSpeed = -Math.min(50, Math.max(5, distanceAbove / 2));
      } else if (lastMouseY > editorRect.bottom) {
        // Below editor - scroll down
        const distanceBelow = lastMouseY - editorRect.bottom;
        scrollSpeed = Math.min(50, Math.max(5, distanceBelow / 2));
      }
      
      // If we need to scroll, apply it
      if (scrollSpeed !== 0) {
        // Apply scroll
        viewRef.current.scrollDOM.scrollTop += scrollSpeed;
        
        // Restore horizontal scroll position
        viewRef.current.scrollDOM.scrollLeft = initialScrollLeft;
        
        // Update selection based on new scroll position
        try {
          // Attempt to get a position at current mouse X and adjusted Y within editor
          const adjustedY = Math.max(editorRect.top, Math.min(editorRect.bottom, lastMouseY));
          const adjustedPos = viewRef.current.posAtCoords({ x: lastMouseY, y: adjustedY });
          
          if (adjustedPos !== null) {
            // Get line at this position
            const lineAtPos = viewRef.current.state.doc.lineAt(adjustedPos);
            
            // Ensure we select full lines
            const from = Math.min(selectionOrigin, lineAtPos.from);
            const to = Math.max(selectionOrigin, lineAtPos.to);
            
            // Update selection
            viewRef.current.dispatch({
              selection: EditorSelection.range(from, to),
              scrollIntoView: false // Don't cause additional scrolling
            });
          }
        } catch (error) {
          console.error('Error updating selection during continuous scroll:', error);
        }
      }
      
      // Continue the animation
      rafId = requestAnimationFrame(continuousScroll);
    };
    
    // Function to handle document mousemove (replaces gutter mousemove)
    const handleDocumentMouseMove = (event) => {
      if (!isDragging || startLineNumber === null || selectionOrigin === null) return;
      
      // Get the current mouse position
      const mouseY = event.clientY;
      const mouseX = event.clientX;
      
      // Update last known position
      lastMouseY = mouseY;
      
      // Check if we need to start/stop continuous scrolling
      const editorRect = viewRef.current.dom.getBoundingClientRect();
      
      // If mouse is outside editor vertically, ensure continuous scrolling is active
      if (mouseY < editorRect.top || mouseY > editorRect.bottom) {
        if (!rafId) {
          rafId = requestAnimationFrame(continuousScroll);
        }
      } else {
        // Mouse is inside editor, stop continuous scrolling if active
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        
        // Handle normal selection within editor
        try {
          const view = viewRef.current;
          // Get position at mouse coordinates
          const pos = view.posAtCoords({ x: mouseX, y: mouseY });
          if (pos === null) return;
          
          // Get line at position
          const currentLine = view.state.doc.lineAt(pos);
          
          // Get the starting line object (using the line number stored on mousedown)
          const startLine = view.state.doc.line(startLineNumber); 
          
          // Determine the full range from the start line to the current line
          const selectionFrom = Math.min(startLine.from, currentLine.from);
          const selectionTo = Math.max(startLine.to, currentLine.to);
          
          // Update selection to cover the full lines
          view.dispatch({
            selection: EditorSelection.range(selectionFrom, selectionTo),
            scrollIntoView: false // Let continuousScroll handle scrolling if needed
          });
          
          // Restore horizontal scroll
          setTimeout(() => {
            if (viewRef.current && viewRef.current.scrollDOM) {
              viewRef.current.scrollDOM.scrollLeft = initialScrollLeft;
            }
          }, 0);
        } catch (error) {
          console.error('Error during in-editor selection:', error);
        }
      }
    };
    
    // Function to handle gutter mousedown
    const handleGutterMouseDown = (event) => {
      // Check if mousedown is on a gutter element
      if (event.target.classList.contains('cm-gutterElement')) {
        // Store initial horizontal scroll position
        initialScrollLeft = viewRef.current.scrollDOM.scrollLeft;
        
        // Get the line number from the element's text content
        const lineNumber = parseInt(event.target.textContent, 10);
        if (isNaN(lineNumber)) return;
        
        console.log(`Gutter mousedown: Line ${lineNumber}`);
        
        // Store the starting line number for potential drag selection
        startLineNumber = lineNumber;
        isDragging = true;
        
        try {
          // Get the line from the document (lines are 1-indexed in CodeMirror)
          const line = viewRef.current.state.doc.line(lineNumber);
          
          // Store the selection origin (from position)
          // For first line, use the line start position
          selectionOrigin = line.from;
          
          // Force CM to recognize that we're starting a selection 
          // This helps especially with row 1 selections
          viewRef.current.focus();
          
          // Select the entire line
          viewRef.current.dispatch({
            selection: EditorSelection.range(line.from, line.to),
            scrollIntoView: { y: "nearest", x: "never" }
          });
          
          // Restore horizontal scroll position after a small delay
          setTimeout(() => {
            if (viewRef.current && viewRef.current.scrollDOM) {
              viewRef.current.scrollDOM.scrollLeft = initialScrollLeft;
            }
          }, 0);
          
          // Prevent default behavior
          event.preventDefault();
        } catch (error) {
          console.error('Error selecting line:', error);
        }
      }
    };
    
    // Function to handle gutter mouseup
    const handleGutterMouseUp = () => {
      isDragging = false;
      selectionOrigin = null;
      
      // Ensure horizontal scroll position is restored one final time
      if (viewRef.current && viewRef.current.scrollDOM) {
        viewRef.current.scrollDOM.scrollLeft = initialScrollLeft;
      }
      
      // Clear animation frame if active
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      
      // Clear any auto-scroll interval
      if (autoScrollInterval) {
        clearInterval(autoScrollInterval);
        autoScrollInterval = null;
      }
    };
    
    // Function to handle document mouseup (for when mouse is released outside the gutter)
    const handleDocumentMouseUp = () => {
      isDragging = false;
      selectionOrigin = null;
      
      // Ensure horizontal scroll position is restored one final time
      if (viewRef.current && viewRef.current.scrollDOM) {
        viewRef.current.scrollDOM.scrollLeft = initialScrollLeft;
      }
      
      // Clear animation frame if active
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      
      // Clear any auto-scroll interval
      if (autoScrollInterval) {
        clearInterval(autoScrollInterval);
        autoScrollInterval = null;
      }
    };
    
    // Find the gutter element
    const gutterElement = viewRef.current.dom.querySelector('.cm-gutters');
    if (gutterElement) {
      // Add event listeners
      gutterElement.addEventListener('mousedown', handleGutterMouseDown);
      document.addEventListener('mousemove', handleDocumentMouseMove);
      gutterElement.addEventListener('mouseup', handleGutterMouseUp);
      document.addEventListener('mouseup', handleDocumentMouseUp);
      
      // Return cleanup function
      return () => {
        gutterElement.removeEventListener('mousedown', handleGutterMouseDown);
        document.removeEventListener('mousemove', handleDocumentMouseMove);
        gutterElement.removeEventListener('mouseup', handleGutterMouseUp);
        document.removeEventListener('mouseup', handleDocumentMouseUp);
        
        // Clean up any active animation frame
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        
        // Clear any auto-scroll interval
        if (autoScrollInterval) {
          clearInterval(autoScrollInterval);
          autoScrollInterval = null;
        }
      };
    }
  }, [viewRef.current]);

  return (
    <div className={`h-full flex flex-col relative ${className}`}>
      {/* Add direct styling to fix cursor appearance */}
      <style>{`
        .cm-editor { height: 100%; }
        
        /* Default cursor for light mode (not inside .dark) */
        .cm-content { caret-color: #000 !important; }
        .cm-cursor { border-left: 3px solid #000 !important; }
        
        /* Dark mode cursor styles */
        .dark .cm-content { caret-color: white !important; }
        .dark .cm-cursor { border-left: 3px solid white !important; }
        
        /* Make gutters and line numbers clickable */
        .cm-gutters { pointer-events: auto !important; }
        .cm-gutter { pointer-events: auto !important; }
        .cm-lineNumbers { pointer-events: auto !important; }
        .cm-gutterElement { 
          pointer-events: auto !important; 
          cursor: pointer; 
          user-select: none; 
          -webkit-user-select: none;
        }
        
        /* Custom scrollbar styling for CodeMirror */
        .cm-scroller::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        
        .cm-scroller::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .cm-scroller::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.3);
          border-radius: 3px;
        }
        
        .cm-scroller::-webkit-scrollbar-thumb:hover {
          background-color: rgba(156, 163, 175, 0.5);
        }
        
        /* Dark mode scrollbars */
        .dark .cm-scroller::-webkit-scrollbar-thumb {
          background-color: rgba(75, 85, 99, 0.3);
        }
        
        .dark .cm-scroller::-webkit-scrollbar-thumb:hover {
          background-color: rgba(75, 85, 99, 0.5);
        }
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
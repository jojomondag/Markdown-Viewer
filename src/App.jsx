import React, { useState, useEffect, useRef, useReducer, useCallback, useMemo, useLayoutEffect } from 'react';
import { 
  IconFolderOpen, 
  IconFolderPlus,
  IconFilePlus,
  IconDeviceFloppy, 
  IconSettings, 
  IconSearch,
  IconFiles,
  IconHistory,
  IconFolderOff,
  IconEyeOff, // <-- Add IconEyeOff
  IconEye,    // <-- Add IconEye (likely needed too)
  IconLink,   // <-- Add IconLink
  IconUnlink, // <-- Add IconUnlink
  IconZoomIn, // <-- Add IconZoomIn
  IconZoomOut,// <-- Add IconZoomOut
  IconZoomReset, // <-- Add IconZoomReset
  IconPrinter, // <-- Add IconPrinter
  IconEraser // <-- NEW: Icon for Clear Workspace
} from '@tabler/icons-react';
import Split from 'react-split';
import FileExplorer from './components/ArboristFileExplorer'; // Use Arborist explorer
import FileHistory from './components/FileHistory';
import MarkdownEditor from './components/MarkdownEditor'; // Revert to static import
import MarkdownPreview from './components/MarkdownPreview'; // Revert to static import
import SidebarTabs from './components/SidebarTabs';
import ThemeToggle from './components/ThemeToggle';
import StatusBar from './components/StatusBar';
import MarkdownToolbar from './components/MarkdownToolbar';
import LoadingOverlay from './components/LoadingOverlay';
import LoadingSpinner from './components/LoadingSpinner';
import SettingsPanel from './components/SettingsPanel';
import { NotificationProvider } from './context/NotificationContext';
import { SettingsProvider } from './context/SettingsContext';
import { AppStateProvider, useAppState } from './context/AppStateContext';
import useFiles from './hooks/useFiles';
import { registerGlobalShortcuts } from './utils/keyboardShortcuts';
import useNotification from './hooks/useNotification';
import { useSettings } from './context/SettingsContext';
import EditorTabs from './components/EditorTabs';
import FileSearch from './components/FileSearch';
import SaveStateDialog from './components/SaveStateDialog'; // <-- Import the new dialog
import path from 'path-browserify'; // Use browser-compatible path
import { getDirname, getBasename } from './utils/pathUtils'; // Import path utils
import { arrayMove } from '@dnd-kit/sortable'; // <-- Import arrayMove

import WorkspaceStateTabs from './components/WorkspaceStateTabs'; // <-- Import the new component

function App() {
  console.log('[App] Component rendering');
  const editorRef = useRef(null);
  const editorContainerRef = useRef(null);
  const previewRef = useRef(null);
  const previousContentRef = useRef('');
  const prevLoadingRef = useRef(false);
  const prevCurrentFileRef = useRef(null);
  const initialLoadPerformedRef = useRef(false); // <-- ADDED: Ref to track initial auto-load attempt

  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [previewVisible, setPreviewVisible] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isEditorContainerVisible, setIsEditorContainerVisible] = useState(true);
  const [isSaveStateDialogOpen, setIsSaveStateDialogOpen] = useState(false);
  // isProjectOpen will be derived from context state later
  const [isProjectOpen, setIsProjectOpen] = useState(false); 

  const {
    files,
    folders,
    directories,
    currentFile,
    content,
    loading,
    error,
    openAndScanFolder: originalOpenAndScanFolder,
    openFile: originalOpenFile,
    saveFile: originalSaveFile,
    clearFolders: originalClearFolders,
    updateContent,
    setFiles,
    setFolders,
    setCurrentFile
  } = useFiles();
  
  // Get the notification functions
  const { showSuccess, showError, showInfo, showWarning } = useNotification();
  
  // Get settings
  const { settings, updateSetting } = useSettings();
  
  // Get app state (THIS MUST COME BEFORE useState hooks that depend on `state.ui`)
  const { 
    state,
    dispatch,
    setLoading: setAppLoading, // This is app state loading, distinct from useFiles loading
    setUnsavedChanges,
    setSidebarTab,
    addToHistory,
    addOpenFile,
    removeOpenFile,
    updateOpenFile,
    setFileDirty,
    clearOpenFiles, 
    reorderOpenFiles, 
    updatePreferences, // Keep this for general preferences if any are left
    // Action creators for state now managed by context
    setActiveRootFolders,     // For bulk setting (e.g., loading workspace)
    setActiveExpandedNodes,   // For bulk setting
    setItemOrder,             // For bulk setting or initializing
    updateItemOrderForParent, // For specific DND updates
    removeFromItemOrder,      // For deletions
    addRootFolder,            // For adding a single root folder
    removeRootFolder,         // For removing a single root folder
    toggleExpandedNode,       // For tree view interaction
    setExplorerSort,          // For sort changes
    // Active named workspace actions <-- NEW
    setActiveNamedWorkspace,
    clearActiveNamedWorkspace,
  } = useAppState();
  
  // Get open files from app state for convenience
  const openFiles = state.openFiles;
  // Get explorer-related UI state from context
  const { 
    activeRootFolders, 
    activeExpandedNodes, 
    itemOrder, 
    preferences: { explorerSortBy, explorerSortDirection }
  } = state.ui;

  // Ref to track previous file loading state for order initialization
  const prevFileLoadingRef = useRef(true);
  const [isOrderInitialized, setIsOrderInitialized] = useState(false);
  
  
  // Update sidebar and preview visibility from settings
  useEffect(() => {
    setSidebarVisible(settings.ui.sidebarVisible);
    setPreviewVisible(settings.ui.previewVisible);
  }, [settings.ui.sidebarVisible, settings.ui.previewVisible]);
  
  // Show error notification when API error occurs
  useEffect(() => {
    if (error) {
      showError(`Error: ${error}`);
    }
  }, [error, showError]);
  
  // Wrap the saveFile function
  const saveFile = (content) => {
    try {
      originalSaveFile(content);
      
      // Clear dirty flag for the saved file
      if (currentFile) {
        setFileDirty(currentFile, false);
      }
    } catch (error) {
      console.error(`Failed to save file: ${error.message}`);
    }
  };
  
  // Wrap the openFile function to handle tabs
  const openFile = (file) => {
    console.log('[App] openFile called with:', file);
    try {
      // Check if file is already open
      const isAlreadyOpen = openFiles.some(f => f.path === file.path);
      console.log(`[App] openFile - isAlreadyOpen: ${isAlreadyOpen}`);
      
      if (!isAlreadyOpen) {
        // Add file to open files
        console.log(`[App] openFile - adding file to openFiles state`);
        addOpenFile(file);
      }
      
      // Actually open the file
      console.log(`[App] openFile - calling originalOpenFile`);
      originalOpenFile(file);
      
      // Add file to history
      console.log(`[App] openFile - adding file to history`);
      addToHistory(file);
      
      // Focus the editor after opening the file
      setTimeout(() => {
        if (editorRef.current && editorRef.current.focus) {
          console.log(`[App] openFile - focusing editor`);
          editorRef.current.focus();
        }
      }, 300);
    } catch (error) {
      console.error(`[App] Error in openFile: ${error.message}`);
    }
  };
  
  // Wrap the openAndScanFolder function
  const openAndScanFolder = async () => {
    console.log('[App] openAndScanFolder called'); // Log entry
    try {
      // Calls the original function (which shows the dialog)
      const result = await originalOpenAndScanFolder(); 
      console.log('[App] originalOpenAndScanFolder result:', result); // Log hook result
      
      // If the user selected folder(s)...
      if (result && result.folderPaths && result.folderPaths.length > 0) {
        console.log('[App] Folders selected:', result.folderPaths);
        
        // Update the list of root folders in context
        result.folderPaths.forEach(folderPath => {
          const normalizedPath = folderPath.replace(/\\/g, '/');
          // Dispatch action to add each new root folder
          addRootFolder(normalizedPath); 
          // Auto-expand newly added root folders (dispatching for each)
          // NOTE: setActiveExpandedNodes might be better if adding many, but toggle is fine for one-by-one
          if (!activeExpandedNodes[normalizedPath]) {
             toggleExpandedNode(normalizedPath);
          }
        });
        
        // Scan each added folder 
        console.log('[App] Calling scanFolder for each added path...');
        for (const folderPath of result.folderPaths) {
          await scanFolder(folderPath, true); // Call scanFolder in add mode
        }
        console.log('[App] Finished calling scanFolder for all added paths.');
        // --- End Scan --- 
        
        // isProjectOpen will be updated by useEffect hook watching activeRootFolders
        
        return result; // Keep returning the result
      } else {
        console.log('[App] No folders selected or dialog cancelled.');
      }
    } catch (error) {
      console.error(`[App] Error in openAndScanFolder: ${error.message}`); // Log errors
    }
  };
  
  // Scan a folder and update files/folders state
  const scanFolder = async (folderPath, addMode = false) => {
    console.log(`[scanFolder] Called with path: ${folderPath}, addMode: ${addMode}`); // Log entry
    try {
      if (!folderPath) return;
      
      setAppLoading({ files: true });
      
      // Use the utility function from fileSystem.js to scan the directory
      const { scanDirectory } = await import('./utils/fileSystem');
      const result = await scanDirectory(folderPath);
      console.log('[scanFolder] Scan result:', result); // Log scan result
      
      if (result) {
        // Normalize the root folder path for consistency
        const normalizedRootPath = folderPath.replace(/\\/g, '/');
        console.log(`[scanFolder] Normalized root path: ${normalizedRootPath}`); // Log normalized path
        
        // Create a root folder object to ensure the folder itself is included
        const rootFolder = {
          path: normalizedRootPath,
          name: path.basename(normalizedRootPath),
          type: 'folder'
        };
        console.log('[scanFolder] Created root folder object:', rootFolder); // Log root folder object
        
        // Process files and folders to ensure proper paths
        const processedFolders = [];
        if (result.folders && result.folders.length > 0) {
          // First include the root folder
          processedFolders.push(rootFolder);
          
          // Then add all subfolders ensuring they have proper paths
          result.folders.forEach(folder => {
            if (!folder.path.startsWith(normalizedRootPath)) {
              // Fix the path if needed - this ensures subfolders have the correct parent path
              const folderName = path.basename(folder.path);
              const fixedPath = `${normalizedRootPath}/${folderName}`;
              processedFolders.push({
                ...folder,
                path: fixedPath,
                name: folderName
              });
            } else {
              processedFolders.push(folder);
            }
          });
        } else {
          // Even if there are no subfolders, still include the root folder
          processedFolders.push(rootFolder);
        }
        
        // Process files to ensure they have proper paths
        const processedFiles = [];
        if (result.files && result.files.length > 0) {
          result.files.forEach(file => {
            if (!file.path.startsWith(normalizedRootPath)) {
              // Fix the path if needed
              const fileName = path.basename(file.path);
              const fixedPath = `${normalizedRootPath}/${fileName}`;
              processedFiles.push({
                ...file,
                path: fixedPath,
                name: fileName
              });
            } else {
              processedFiles.push(file);
            }
          });
        }
        
        console.log('[scanFolder] Processed files:', processedFiles); // Log processed files
        console.log('[scanFolder] Processed folders (incl. root):', processedFolders); // Log processed folders
        
        if (addMode) {
          console.log('[scanFolder] Entering addMode'); // Log entering addMode
          // In add mode, preserve existing files/folders and add new ones
          setFiles(prevFiles => {
            console.log('[scanFolder] setFiles: Previous files count:', prevFiles.length); // Log prev files count
            // Filter out duplicates based on path
            const uniqueFiles = processedFiles.filter(newFile => 
              !prevFiles.some(existingFile => existingFile.path === newFile.path)
            );
            console.log('[scanFolder] setFiles: Adding unique files:', uniqueFiles); // Log unique files to add
            const newState = [...prevFiles, ...uniqueFiles];
            console.log('[scanFolder] setFiles: New state count:', newState.length); // Log new files count
            return newState;
          });
          
          setFolders(prevFolders => {
            console.log('[scanFolder] setFolders: Previous folders count:', prevFolders.length); // Log prev folders count
            // Filter out duplicates based on path for subfolders ONLY
            const uniqueSubFolders = processedFolders.filter(newFolder => 
              newFolder.path !== normalizedRootPath && // Exclude the root folder from duplicate check
              !prevFolders.some(existingFolder => existingFolder.path === newFolder.path) // Use prevFolders here
            );
            console.log('[scanFolder] setFolders: Adding root folder:', rootFolder); // Log root folder to add
            console.log('[scanFolder] setFolders: Adding unique subfolders:', uniqueSubFolders); // Log unique subfolders to add
            // Always include the root folder + unique subfolders
            const newFoldersState = [...prevFolders, rootFolder, ...uniqueSubFolders]; 
            console.log('[scanFolder] setFolders: New state count:', newFoldersState.length); // Log new folders count
            return newFoldersState;
          });
        } else {
          console.log('[scanFolder] Entering replace/refresh mode'); // Log entering replace mode
          // In replace/refresh mode, update files and folders for this path only
          setFiles(prevFiles => {
            // Remove files from this folder, then add the new ones
            const remainingFiles = prevFiles.filter(file => 
              !file.path.startsWith(normalizedRootPath + '/') && file.path !== normalizedRootPath
            );
            return [...remainingFiles, ...processedFiles];
          });
          
          setFolders(prevFolders => {
            // Remove folders from this folder, then add the new ones
            const remainingFolders = prevFolders.filter(folder => 
              !folder.path.startsWith(normalizedRootPath + '/') && folder.path !== normalizedRootPath
            );
            return [...remainingFolders, ...processedFolders];
          });
        }
        
        return {
          ...result,
          folders: processedFolders,
          files: processedFiles
        };
      }
    } catch (error) {
      console.error(`[scanFolder] Error: ${error.message}`); // Log errors
      showError(`Failed to scan folder: ${error.message}`);
    } finally {
      setAppLoading({ files: false });
      console.log('[scanFolder] Finished.'); // Log finish
    }
  };

  // Auto-save when content changes
  useEffect(() => {
    if (!settings.editor.autoSave) return;
    
    const autoSaveTimer = setTimeout(() => {
      if (currentFile && content) {
        saveFile(content);
      }
    }, settings.editor.autoSaveInterval);

    return () => clearTimeout(autoSaveTimer);
  }, [content, currentFile, settings.editor.autoSave, settings.editor.autoSaveInterval]);

  // Handle toolbar formatting actions
  const handleToolbarAction = (action) => {
    if (!editorRef.current) return;

    switch (action) {
      case 'heading':
        editorRef.current.applyHeading?.(2); // Using optional chaining
        break;
      case 'bold':
        editorRef.current.applyBold?.();
        break;
      case 'italic':
        editorRef.current.applyItalic?.();
        break;
      case 'unordered-list':
        editorRef.current.applyUnorderedList?.();
        break;
      case 'ordered-list':
        editorRef.current.applyOrderedList?.();
        break;
      case 'link':
        editorRef.current.applyLink?.();
        break;
      case 'image':
        editorRef.current.applyImage?.();
        break;
      case 'code': // Assuming this is for inline code based on toolbar icon
        editorRef.current.applyCode?.(); 
        break;
      case 'code-block': // Add a case if you want a dedicated code block button
        editorRef.current.applyCodeBlock?.(); 
        break;
      case 'blockquote':
        editorRef.current.applyBlockquote?.();
        break;
      case 'table':
        editorRef.current.applyTable?.();
        break;
      default:
        console.warn(`Unknown toolbar action: ${action}`);
    }
  };

  // Add Undo/Redo handlers
  const handleUndo = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.undo();
    }
  }, []);

  const handleRedo = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.redo();
    }
  }, []);

  // Register keyboard shortcuts
  useEffect(() => {
    const unregister = registerGlobalShortcuts({
      // File operations
      OPEN_FILE: () => openAndScanFolder(),
      SAVE_FILE: () => {
        if (currentFile) {
          saveFile(content);
        }
      },
      
      // Formatting operations
      BOLD: () => handleToolbarAction('bold'),
      ITALIC: () => handleToolbarAction('italic'),
      HEADING: () => handleToolbarAction('heading'),
      LINK: () => handleToolbarAction('link'),
      CODE: () => handleToolbarAction('code'),
      LIST: () => handleToolbarAction('unordered-list'),
      ORDERED_LIST: () => handleToolbarAction('ordered-list'),
      
      // View operations
      TOGGLE_SIDEBAR: () => setSidebarVisible(prev => !prev),
      TOGGLE_PREVIEW: () => setPreviewVisible(prev => !prev),
      
      // Explorer operations: Now dispatches to context
      TOGGLE_SORT_DIRECTION: () => {
        const newDirection = explorerSortDirection === 'asc' ? 'desc' : 'asc';
        // Dispatch action to update sort settings in context
        setExplorerSort(explorerSortBy, newDirection);
      },

      // Add Undo/Redo shortcuts
      UNDO: handleUndo,
      REDO: handleRedo,
    });
    
    return unregister;
  }, [
    content, 
    currentFile, 
    saveFile, 
    openAndScanFolder, 
    explorerSortBy, 
    explorerSortDirection, 
    setExplorerSort,
    handleUndo,
    handleRedo
  ]);

  // Update isMobile state when window size changes
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      
      // Force re-render of split panes when window resizes
      if (editorRef.current && previewRef.current) {
        // Small delay to ensure DOM has updated
        setTimeout(() => {
          // If elements are mounted, refresh their layouts
          if (editorRef.current && typeof editorRef.current.refreshLayout === 'function') {
            editorRef.current.refreshLayout();
          }
          
          if (previewRef.current && typeof previewRef.current.refreshLayout === 'function') {
            previewRef.current.refreshLayout();
          }
        }, 50);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // For mobile view, ensure sidebar is closed by default
  useEffect(() => {
    if (isMobile) {
      setSidebarVisible(false);
    } else {
      setSidebarVisible(settings.ui.sidebarVisible);
    }
  }, [isMobile, settings.ui.sidebarVisible]);
  
  // Calculate split sizes based on visibility and settings
  const getSplitSizes = () => {
    const sidebarW = settings.ui.sidebarWidth;
    const remainingW = 100 - sidebarW;
    // Default editor/preview split when both are visible (e.g., 50/50 of remaining space)
    const editorW = remainingW / 2; 
    const previewW = remainingW / 2;

    if (!sidebarVisible && !isEditorContainerVisible && !previewVisible) return [0, 0, 0]; // Should not happen
    if (!sidebarVisible && !isEditorContainerVisible) return [0, 0, 100]; // Only Preview
    if (!sidebarVisible && !previewVisible) return [0, 100, 0]; // Only Editor
    if (!isEditorContainerVisible && !previewVisible) return [100, 0, 0]; // Only Sidebar (adjust if needed)

    if (!sidebarVisible) return [0, previewVisible ? 50 : 100, previewVisible ? 50 : 0]; // No Sidebar
    if (!isEditorContainerVisible) return [sidebarW, 0, 100 - sidebarW]; // No Editor
    if (!previewVisible) return [sidebarW, 100 - sidebarW, 0]; // No Preview

    // All visible: Use calculated widths
    return [sidebarW, editorW, previewW];
  };

  // Update loading states
  useEffect(() => {
    // Skip loading state update if nothing changed
    if (prevLoadingRef.current === loading && prevCurrentFileRef.current === currentFile) {
      return;
    }
    
    // Always update app state when loading changes from true to false (loading complete)
    // Only conditionally update when loading starts to prevent losing selection
    if (!loading || !currentFile || (loading && !prevLoadingRef.current)) {
      setAppLoading('files', loading);
      setAppLoading('content', loading && !!currentFile);
    }
    
    prevCurrentFileRef.current = currentFile;
    prevLoadingRef.current = loading;
  }, [loading, currentFile, setAppLoading]);
  
  // Track unsaved changes in app state
  useEffect(() => {
    // Skip effect if loading
    if (loading) return;
    
    if (currentFile && content) {
      // Only update state if content has actually changed
      if (content !== previousContentRef.current) {
        setUnsavedChanges(true);
        previousContentRef.current = content;
        
        // When auto-saving, we'd set unsavedChanges to false after the interval
        if (settings.editor.autoSave) {
          const timer = setTimeout(() => {
            setUnsavedChanges(false);
          }, settings.editor.autoSaveInterval + 100);
          
          return () => clearTimeout(timer);
        }
      }
    } else if (previousContentRef.current !== '') {
      // Only reset when necessary to avoid unnecessary state updates
      setUnsavedChanges(false);
      previousContentRef.current = '';
    }
  }, [content, currentFile, loading, settings.editor.autoSave, settings.editor.autoSaveInterval, setUnsavedChanges]);
  
  // Update app state with sidebar tab changes
  const handleSidebarTabChange = (tabId) => {
    setSidebarTab(tabId);
  };

  // Use sidebar tab from app state
  const activeTab = state.ui.preferences.selectedSidebarTab;

  // Inside the App function, add the following refs and state
  const [scrollSyncEnabled, setScrollSyncEnabled] = useState(false);
  const [scrollSource, setScrollSource] = useState(null);
  const scrollSyncTimeoutRef = useRef(null);
  const lastEditorScrollRef = useRef(0);
  const lastPreviewScrollRef = useRef(0);

  // Add a flag to track if any component is forcing scroll position
  const forcingScrollRef = useRef(false);

  // Add an effect to maintain scroll position when scroll sync is toggled
  useEffect(() => {
    // Only run this effect when scrollSyncEnabled changes to true
    if (scrollSyncEnabled && editorRef.current && previewRef.current) {
      // When enabling scroll sync, determine which scroll position to use
      // Use the most recently scrolled component as the source of truth
      const useEditor = scrollSource === 'editor' || 
        (lastEditorScrollRef.current > 0.02 && (!scrollSource || lastEditorScrollRef.current > lastPreviewScrollRef.current));
        
      const usePreview = scrollSource === 'preview' || 
        (lastPreviewScrollRef.current > 0.02 && (!scrollSource || lastPreviewScrollRef.current > lastEditorScrollRef.current));
        
      // Apply the synchronization based on the determined source
      if (useEditor && lastEditorScrollRef.current > 0.02) {
        // Delay the scroll to avoid conflicts with other effects
        setTimeout(() => {
          if (previewRef.current) {
            previewRef.current.scrollToPosition(lastEditorScrollRef.current);
          }
        }, 50);
      } else if (usePreview && lastPreviewScrollRef.current > 0.02) {
        // Delay the scroll to avoid conflicts with other effects
        setTimeout(() => {
          if (editorRef.current) {
            editorRef.current.scrollToPosition(lastPreviewScrollRef.current);
          }
        }, 50);
      }
      // If neither has a meaningful position, don't sync at all
    }
  }, [scrollSyncEnabled]);

  // Toggle scroll sync
  const toggleScrollSync = () => {
    // Store current positions before toggling
    try {
      if (!scrollSyncEnabled && editorRef.current && previewRef.current) {
        // When enabling, capture current positions to maintain them
        const editorInfo = editorRef.current.getScrollInfo?.();
        if (editorInfo && editorInfo.scrollPercentage > 0) {
          lastEditorScrollRef.current = editorInfo.scrollPercentage;
        }
      }
    } catch (error) {
      console.error("Error capturing scroll position:", error);
    }
    
    // Toggle the state
    setScrollSyncEnabled(!scrollSyncEnabled);
  };

  // Handle scroll synchronization
  const handleEditorScroll = (scrollPercentage) => {
    // Skip tiny scroll amounts or resets to 0
    if (scrollPercentage < 0.01 && lastEditorScrollRef.current > 0) {
      return; // Skip syncing when we detect reset to near-zero
    }
    
    // Update our stored position for the editor
    lastEditorScrollRef.current = scrollPercentage;
    
    if (scrollSyncEnabled && previewRef.current && scrollSource !== 'preview') {
      // Set forcing scroll flag
      forcingScrollRef.current = true;
      
      setScrollSource('editor');
      previewRef.current.scrollToPosition(scrollPercentage);
      
      // Reset scroll source after a delay
      if (scrollSyncTimeoutRef.current) {
        clearTimeout(scrollSyncTimeoutRef.current);
      }
      
      scrollSyncTimeoutRef.current = setTimeout(() => {
        // Clear the scroll source after a delay
        setScrollSource(null);
        forcingScrollRef.current = false;
      }, 250);
    }
  };
  
  const handlePreviewScroll = (scrollPercentage) => {
    // Skip tiny scroll amounts or resets to 0
    if (scrollPercentage < 0.01 && lastPreviewScrollRef.current > 0) {
      return; // Skip syncing when we detect reset to near-zero
    }
    
    // Update our stored position for the preview
    lastPreviewScrollRef.current = scrollPercentage;
    
    if (scrollSyncEnabled && editorRef.current && scrollSource !== 'editor') {
      // Set forcing scroll flag
      forcingScrollRef.current = true;
      
      setScrollSource('preview');
      editorRef.current.scrollToPosition(scrollPercentage);
      
      // Reset scroll source after a delay
      if (scrollSyncTimeoutRef.current) {
        clearTimeout(scrollSyncTimeoutRef.current);
      }
      
      scrollSyncTimeoutRef.current = setTimeout(() => {
        // Clear the scroll source after a delay
        setScrollSource(null);
        forcingScrollRef.current = false;
      }, 250);
    }
  };
  
  // Handle cursor position changes
  const handleCursorChange = (position) => {
    // Optional: Update app state or perform actions based on cursor position
    console.log('Cursor position:', position);
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollSyncTimeoutRef.current) {
        clearTimeout(scrollSyncTimeoutRef.current);
      }
    };
  }, []);

  // Inside the App function, add this additional state:
  const [previewZoom, setPreviewZoom] = useState(100);

  // Replace the zoom control handlers with memoized functions
  const handleZoomIn = useCallback(() => {
    if (previewRef.current) {
      const newZoom = previewRef.current.zoomIn();
      setPreviewZoom(newZoom);
    }
  }, [previewRef]);
  
  const handleZoomOut = useCallback(() => {
    if (previewRef.current) {
      const newZoom = previewRef.current.zoomOut();
      setPreviewZoom(newZoom);
    }
  }, [previewRef]);
  
  const handleZoomReset = useCallback(() => {
    if (previewRef.current) {
      const newZoom = previewRef.current.resetZoom();
      setPreviewZoom(newZoom);
    }
  }, [previewRef]);

  // Add keyboard event handler for zoom controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle if preview is visible
      if (!previewVisible) return;
      
      // Zoom in: Ctrl/Cmd + Plus
      if ((e.ctrlKey || e.metaKey) && e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      }
      
      // Zoom out: Ctrl/Cmd + Minus
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      }
      
      // Reset zoom: Ctrl/Cmd + 0
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        handleZoomReset();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [previewVisible, handleZoomIn, handleZoomOut, handleZoomReset]);

  // Handle tab change
  const handleTabChange = (file) => {
    // Only proceed if the clicked tab's file is different from the current one
    if (file.path !== currentFile?.path) {
      // Directly open the selected file, bypassing the unsaved changes check for now
      console.log(`[App] handleTabChange: Bypassing unsaved check, preparing to call originalOpenFile for ${file.path}`); // <-- Modify log
      originalOpenFile(file);
    }
  };
  
  // Handle tab close
  const handleTabClose = (file) => {
    // If the file has unsaved changes, confirm before closing
    if (file.isDirty) {
      const confirmed = window.confirm(`You have unsaved changes in ${file.name}. Close anyway?`);
      if (!confirmed) return;
    }
    
    // Remove from open files
    removeOpenFile(file);
    
    // If closing the current file, open another one if available
    if (currentFile && file.path === currentFile.path) {
      const remainingFiles = openFiles.filter(f => f.path !== file.path);
      if (remainingFiles.length > 0) {
        // Open the previous file in the list, or the next one if closing the first file
        const currentIndex = openFiles.findIndex(f => f.path === file.path);
        const nextIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        originalOpenFile(remainingFiles[nextIndex]);
      } else {
        // No files left open, clear the editor
        updateContent('');
      }
    }
  };
  
  // Handle new tab
  const handleNewTab = () => {
    // For now, just a placeholder - in a real app this would open a new blank file
    console.log('Select a file from the explorer to open it');
  };

  // Update content and mark file as dirty
  const handleContentChange = (newContent) => {
    updateContent(newContent);
    
    // Mark file as dirty (unsaved changes)
    if (currentFile) {
      setFileDirty(currentFile, true);
    }
  };
  
  // Handler for print preview
  const handlePrintPreview = () => {
    if (!previewVisible) {
      setPreviewVisible(true);
      // Wait for the preview to be rendered
      setTimeout(() => {
        window.print();
      }, 500);
    } else {
      window.print();
    }
  };

  // Add after other state variables
  const [fileOperationStatus, setFileOperationStatus] = useState(null);

  // *** NEW: Handler for moving files/folders via Drag and Drop ***
  const handleMoveItem = async (sourceItems, targetNode, dropPosition) => {
    // sourceItems is now an array of {path: string, type: string}
    if (!Array.isArray(sourceItems) || sourceItems.length === 0 || !targetNode) {
      console.error('[App] Invalid move operation data. Source items:', sourceItems, 'Target:', targetNode);
      showError("Invalid data for move operation.");
      return;
    }

    console.log(`[App] handleMoveItem called for ${sourceItems.length} items.`);

    setAppLoading({ files: true }); // Indicate loading for the whole operation

    // Determine the actual target folder based on drop position
    let effectiveTargetFolder;
    if (dropPosition === 'top' || dropPosition === 'bottom') {
        // Dropping between items means moving into the PARENT of the target node
        const parentPath = getDirname(targetNode.path);
        // Find the parent folder object from our state
        effectiveTargetFolder = folders.find(f => f.path === parentPath);
        // If parentPath is a root or not found, handle appropriately (e.g., disallow or use root)
        if (!effectiveTargetFolder) {
            // This might happen if dropping relative to a root item
            // For now, let's find the root folder object if the parent path matches a root
             effectiveTargetFolder = folders.find(f => f.path === parentPath && activeRootFolders.includes(f.path));
             if (!effectiveTargetFolder) {
                 console.error(`[App] Could not find parent folder object for path: ${parentPath}`);
                 showError("Cannot determine target folder for drop.");
                 return;
             }
        }
    } else if (dropPosition === 'middle' && targetNode.type === 'folder') {
        // Dropping onto a folder means moving into that folder
        effectiveTargetFolder = targetNode;
    } else {
        // Invalid drop position (e.g., middle of a file)
        console.warn(`[App] Invalid drop position '${dropPosition}' onto target type '${targetNode.type}'`);
        return;
    }

    // *** Check for Multi-Item Reorder case first ***
    const firstItem = sourceItems[0];
    const firstItemOldParentPath = getDirname(firstItem.path) || '.';
    const isMultiReorder = 
        (dropPosition === 'top' || dropPosition === 'bottom') &&
        firstItemOldParentPath === effectiveTargetFolder.path && // Target folder is the same as original parent
        sourceItems.every(item => (getDirname(item.path) || '.') === firstItemOldParentPath); // All items share the same original parent

    if (isMultiReorder) {
        console.log(`[App] Multi-Reordering ${sourceItems.length} items within ${firstItemOldParentPath}`);
        setItemOrder(prevOrder => {
            const currentParentOrder = [...(prevOrder[firstItemOldParentPath] || [])];
            const targetIndex = currentParentOrder.indexOf(targetNode.path);
            
            if (targetIndex === -1) {
                console.warn('[App] Multi-Reorder target node not found in order map. Appending.');
                // Remove all source items and append them
                const sourcePaths = sourceItems.map(item => item.path);
                const sourceRemoved = currentParentOrder.filter(p => !sourcePaths.includes(p));
                return { ...prevOrder, [firstItemOldParentPath]: [...sourceRemoved, ...sourcePaths] };
            }

            // Remove all source items first
            const sourcePaths = sourceItems.map(item => item.path);
            const sourceRemovedOrder = currentParentOrder.filter(p => !sourcePaths.includes(p));

            // Calculate insertion index based on the target's position *after* removal
            const newTargetIndex = sourceRemovedOrder.indexOf(targetNode.path);
            const insertIndex = dropPosition === 'top' ? newTargetIndex : newTargetIndex + 1;

            // Insert all source items at the calculated position
            sourceRemovedOrder.splice(insertIndex, 0, ...sourcePaths);
            
            console.log(`[App Reorder] Parent order AFTER multi-reorder for [${firstItemOldParentPath}]:`, JSON.stringify(sourceRemovedOrder));
            return { ...prevOrder, [firstItemOldParentPath]: sourceRemovedOrder };
        });

        showSuccess(`Reordered ${sourceItems.length} items`);
        setAppLoading({ files: false }); // Turn off loading
        return; // End execution here for multi-reorder
    }

    // --- Proceed with Move or Single-Item Reorder --- 
        let allSuccess = true;
        let errors = [];
        let successfulMoves = 0;
    
        // Use a temporary state for updates to avoid issues with async loops
        let currentFilesState = [...files];
        let currentFoldersState = [...folders];
        let currentOpenFilesState = [...openFiles];
        let currentItemOrderState = { ...itemOrder };
        let currentCurrentFileState = currentFile ? { ...currentFile } : null;

    // Process each source item
    for (const sourceItem of sourceItems) {
        const oldPath = sourceItem.path;
        // Resolve item type if it was unknown (might need full node info from explorer)
        let itemType = sourceItem.type;
        if (itemType === 'unknown') {
            // Look in the *current* temporary state being built within the loop
            const fullItem = currentFilesState.find(f => f.path === oldPath) || currentFoldersState.find(f => f.path === oldPath);
            if (fullItem) {
                itemType = fullItem.type;
            } else {
                console.warn(`[App] Could not resolve type for dragged item: ${oldPath}`);
                errors.push(`Could not find info for ${getBasename(oldPath)}.`);
                allSuccess = false;
                continue; // Skip this item
            }
        }
        const isDirectory = itemType === 'folder';
        const itemName = getBasename(oldPath);
        const oldParentPath = getDirname(oldPath) || '.';
        const newParentPath = effectiveTargetFolder.path;

        // --- Determine if it's a reorder within the same parent or a move between parents ---
        const isReorder = oldParentPath === newParentPath && (dropPosition === 'top' || dropPosition === 'bottom');

        if (isReorder && sourceItems.length === 1) {
            // --- Handle Reorder (only for single item drags for simplicity) ---
            console.log(`[App] Reordering item: ${itemName} within ${oldParentPath}`);

            console.log(`[App Reorder] Current Target Node: ${targetNode.path}, Drop Position: ${dropPosition}`);
            const currentParentOrder = [...(currentItemOrderState[oldParentPath] || [])];
            const targetIndex = currentParentOrder.indexOf(targetNode.path);

            if (targetIndex === -1) {
                console.warn('[App] Reorder target node not found in order map. Appending.');
                const sourceRemoved = currentParentOrder.filter(p => p !== oldPath);
                currentItemOrderState[oldParentPath] = [...sourceRemoved, oldPath];
            } else {
                const sourceRemovedOrder = currentParentOrder.filter(p => p !== oldPath);
                const newTargetIndex = sourceRemovedOrder.indexOf(targetNode.path);
                const insertIndex = dropPosition === 'top' ? newTargetIndex : newTargetIndex + 1;
                sourceRemovedOrder.splice(insertIndex, 0, oldPath);
                currentItemOrderState[oldParentPath] = sourceRemovedOrder;
            }
            console.log(`[App Reorder] Parent order AFTER reorder for [${oldParentPath}]:`, JSON.stringify(currentItemOrderState[oldParentPath]));
            // No backend call needed for pure reorder
            successfulMoves++;
        } else {
            // --- Handle Move (between folders or dropping onto folder, or multi-item reorder treated as move) ---
            let newPath = path.join(effectiveTargetFolder.path, itemName).replace(/\\/g, '/');
            console.log(`[App] Moving ${isDirectory ? 'folder' : 'file'}: ${oldPath} -> ${newPath}`);

            // Prevent moving into self
            if (newPath === oldPath || (isDirectory && newPath.startsWith(oldPath + '/'))) {
                console.warn(`[App] Attempted to move item ${oldPath} into itself or descendant. Skipping.`);
                errors.push(`Cannot move ${itemName} into itself.`);
                allSuccess = false;
                continue; // Skip this item
            }

            // Check for naming conflicts based on *current* temporary state
            let finalNewPath = newPath;
            let counter = 0;
            const siblings = isDirectory
                ? currentFoldersState.filter(f => getDirname(f.path) === effectiveTargetFolder.path)
                : currentFilesState.filter(f => getDirname(f.path) === effectiveTargetFolder.path);

            while (siblings.some(s => s.path === finalNewPath)) {
                counter++;
                const extension = !isDirectory ? path.extname(itemName) : '';
                const nameWithoutExt = !isDirectory ? itemName.slice(0, -extension.length) : itemName;
                const newName = `${nameWithoutExt} (${counter})${extension}`;
                finalNewPath = path.join(effectiveTargetFolder.path, newName).replace(/\\/g, '/');
                console.log(`[App] Naming conflict found for ${itemName}, trying new path: ${finalNewPath}`);
            }

            try {
                // Only call the backend API if the path is actually changing
                if (oldPath !== finalNewPath) {
                  const result = await window.api.moveItem(oldPath, finalNewPath, isDirectory);
                  if (!result || !result.success) {
                    throw new Error(result?.message || `Unknown error moving ${itemName}`);
                  }
                } else {
                  console.log(`[App] Skipping backend move for ${oldPath} as path is unchanged (likely reorder).`);
                }

                // --- Update Temporary State for this item --- 
                const newItemName = getBasename(finalNewPath);
                const oldPathPrefix = oldPath + '/';
                const newPathPrefix = finalNewPath + '/';

                if (isDirectory) {
                    // Update the folder itself
                    currentFoldersState = currentFoldersState.map(f => f.path === oldPath ? { ...f, path: finalNewPath, name: newItemName } : f);
                    // Update descendant folders
                    currentFoldersState = currentFoldersState.map(f => {
                        if (f.path.startsWith(oldPathPrefix)) {
                            const relativePath = f.path.substring(oldPathPrefix.length);
                            const updatedPath = newPathPrefix + relativePath;
                            return { ...f, path: updatedPath, name: getBasename(updatedPath) };
                        }
                        return f;
                    });
                    // Update descendant files
                    currentFilesState = currentFilesState.map(f => {
                        if (f.path.startsWith(oldPathPrefix)) {
                            const relativePath = f.path.substring(oldPathPrefix.length);
                            const updatedPath = newPathPrefix + relativePath;
                            return { ...f, path: updatedPath, name: getBasename(updatedPath) };
                        }
                        return f;
                    });
                    // Update open files
                    currentOpenFilesState = currentOpenFilesState.map(openFile => {
                        if (openFile.path.startsWith(oldPathPrefix)) {
                            const relativePath = openFile.path.substring(oldPathPrefix.length);
                            const updatedPath = newPathPrefix + relativePath;
                            // Update current file state if necessary
                            if(currentCurrentFileState?.path === openFile.path) {
                                currentCurrentFileState = { ...currentCurrentFileState, path: updatedPath, name: getBasename(updatedPath) };
                            }
                            return { ...openFile, path: updatedPath, name: getBasename(updatedPath) };
                        }
                        return openFile;
                    });
                } else { // File
                    currentFilesState = currentFilesState.map(f => f.path === oldPath ? { ...f, path: finalNewPath, name: newItemName } : f);
                    // Update open file
                    const openFileIndex = currentOpenFilesState.findIndex(f => f.path === oldPath);
                    if (openFileIndex > -1) {
                        const updatedOpenFile = { ...currentOpenFilesState[openFileIndex], path: finalNewPath, name: newItemName };
                        if (currentCurrentFileState?.path === oldPath) {
                           currentCurrentFileState = updatedOpenFile;
                        }
                        currentOpenFilesState[openFileIndex] = updatedOpenFile;
                    }
                }

                // --- Update itemOrder state --- 
                // Remove from old parent order
                if (oldParentPath in currentItemOrderState) {
                    currentItemOrderState[oldParentPath] = currentItemOrderState[oldParentPath].filter(p => p !== oldPath);
                    if (currentItemOrderState[oldParentPath].length === 0) {
                        delete currentItemOrderState[oldParentPath];
                    }
                }
                // Add to new parent order (append)
                const currentNewParentOrder = currentItemOrderState[newParentPath] || [];
                if (!currentNewParentOrder.includes(finalNewPath)) {
                    currentItemOrderState[newParentPath] = [...currentNewParentOrder, finalNewPath];
                }
                // Update keys if a folder was moved
                if (isDirectory) {
                    const keysToUpdate = Object.keys(currentItemOrderState).filter(key => key === oldPath || key.startsWith(oldPathPrefix));
                    keysToUpdate.forEach(oldKey => {
                        const relativeKeyPath = oldKey.substring(oldPath.length);
                        const newKey = finalNewPath + relativeKeyPath;
                        const updatedChildPaths = (currentItemOrderState[oldKey] || []).map(childPath => {
                            const relativeChildPath = childPath.substring(oldKey.length);
                            return newKey + relativeChildPath;
                        });
                        currentItemOrderState[newKey] = updatedChildPaths;
                        delete currentItemOrderState[oldKey];
                    });
                }
                successfulMoves++;
            } catch (error) {
                console.error(`[App] Error moving item ${oldPath}:`, error);
                errors.push(`Failed to move ${itemName}: ${error.message}`);
                allSuccess = false;
                // Continue to next item even if one fails
            }
        } // End of Move/Reorder block
    } // End of loop through sourceItems

    // --- Final State Updates --- 
    setFiles(currentFilesState);
    setFolders(currentFoldersState);
    setItemOrder(currentItemOrderState);
    // Update open files using the context dispatchers based on the final state
    // This is complex because dispatch is async; a full refresh might be safer
    // For now, let's just update the current file if it changed
    if (currentFile && currentCurrentFileState && currentFile.path !== currentCurrentFileState.path) {
      setCurrentFile(currentCurrentFileState);
    }
    // We also need to update the openFiles array in the context state
    // Easiest way might be to remove old ones and add new ones if paths changed
    const originalPaths = sourceItems.map(i => i.path);
    const finalOpenFiles = openFiles
        .filter(f => !originalPaths.includes(f.path)) // Remove old moved files
        .concat(currentOpenFilesState.filter(f => originalPaths.includes(f.path))); // Add back the updated ones
    // TODO: This isn't quite right. Needs proper dispatching. Replace openFiles state entirely?
    // clearOpenFiles(); 
    // finalOpenFiles.forEach(f => addOpenFile(f)); // Risky due to async dispatches
    console.warn("[App] Open file state update after multi-move might be incomplete.");

    // --- Show Feedback --- 
    if (allSuccess && successfulMoves > 0) {
        const msg = successfulMoves === 1 ? `Moved ${getBasename(sourceItems[0].path)}` : `Moved ${successfulMoves} items`;
        showSuccess(`${msg} to ${getBasename(effectiveTargetFolder.path)}`);
    } else if (successfulMoves > 0) {
        showWarning(`Moved ${successfulMoves} items, but some failed: ${errors.join('; ')}`);
    } else if (errors.length > 0) {
        showError(`Failed to move items: ${errors.join('; ')}`);
    } else {
        // No moves happened (e.g., invalid drop)
    }

    setAppLoading({ files: false }); // Turn off loading indicator
  };

  // Add handler for creating new folders
  const handleCreateFolder = async (parentFolderPath) => {
    console.log(`[App] Creating new folder in: ${parentFolderPath}`);
    let newFolderPath = null;
    try {
      // Determine a unique folder name
      let counter = 0;
      let baseName = "New Folder";
      let potentialName = baseName;
      // Ensure parentFolderPath is valid; if creating in a root, it might be a root path itself
      const effectiveParentPath = parentFolderPath || '.'; // Use '.' if parent is effectively the list of roots
      newFolderPath = path.join(effectiveParentPath, potentialName);

      // Check existing folders (from useFiles state, which is the source of truth for actual FS items)
      const siblingFolders = folders.filter(f => (getDirname(f.path) || '.') === effectiveParentPath);
      
      while (siblingFolders.some(f => f.name === potentialName)) {
        counter++;
        potentialName = `${baseName} (${counter})`;
        newFolderPath = path.join(effectiveParentPath, potentialName);
      }

      console.log(`[App] Attempting to create folder at: ${newFolderPath}`);
      const createdFolder = await window.api.createFolder(newFolderPath);

      if (!createdFolder || !createdFolder.path) {
          throw new Error('Folder creation API did not return a valid folder object.');
      }
      
      const normalizedPath = createdFolder.path.replace(/\\/g, '/');
      const newFolderObject = { ...createdFolder, path: normalizedPath, name: getBasename(normalizedPath), type: 'folder' };
      
      // Update useFiles state (source of truth for FS items)
      setFolders(prev => [...prev, newFolderObject]); 
      showSuccess(`Created folder: ${getBasename(normalizedPath)}`);
      
      // Update itemOrder in context
      const parentDirForOrder = getDirname(normalizedPath) || '.';
      const currentOrderForParent = itemOrder[parentDirForOrder] || [];
      updateItemOrderForParent(parentDirForOrder, [...currentOrderForParent, normalizedPath]);
      // Also initialize an empty order for the new folder itself in context
      updateItemOrderForParent(normalizedPath, []);

      return normalizedPath;

    } catch (error) {
        console.error(`[App] Error creating folder: ${error.message}`);
        showError(`Failed to create folder: ${error.message}`);
        return null; 
    }
  };

  // *** NEW: Handler for creating a new file ***
  const handleCreateFile = async (parentFolderPath) => {
    console.log(`[App] Creating new file in: ${parentFolderPath}`);
    let newFilePath = null;
    try {
      let counter = 0;
      let baseName = "Untitled";
      const extension = ".md";
      let potentialName = `${baseName}${extension}`;
      const effectiveParentPath = parentFolderPath || '.';
      newFilePath = path.join(effectiveParentPath, potentialName);
      
      const siblingFiles = files.filter(f => (getDirname(f.path) || '.') === effectiveParentPath);

      while (siblingFiles.some(f => f.name === potentialName)) {
        counter++;
        potentialName = `${baseName} (${counter})${extension}`;
        newFilePath = path.join(effectiveParentPath, potentialName);
      }
      
      const createdFile = await window.api.createFile(newFilePath);
      
      if (!createdFile || !createdFile.path) {
        throw new Error('File creation API did not return a valid file object.');
      }
      
      const normalizedPath = createdFile.path.replace(/\\/g, '/');
      const newFileObject = { ...createdFile, path: normalizedPath, name: getBasename(normalizedPath), type: 'file' };

      // Update useFiles state
      setFiles(prev => [...prev, newFileObject]);
      showSuccess(`Created file: ${getBasename(normalizedPath)}`);
      
      // Update itemOrder in context
      const parentDirForOrder = getDirname(normalizedPath) || '.';
      const currentOrderForParent = itemOrder[parentDirForOrder] || [];
      updateItemOrderForParent(parentDirForOrder, [...currentOrderForParent, normalizedPath]);

      return normalizedPath;
      
    } catch (error) {
      console.error(`[App] Error creating file: ${error.message}`);
      showError(`Failed to create file: ${error.message}`);
      return null; 
    }
  };

  // Add handler for sort changes - memoize it with useCallback to prevent infinite loop
  const handleExplorerSortChange = useCallback((sortBy, direction) => {
    // Dispatch to context
    setExplorerSort(sortBy, direction);
    // updatePreferences from context is still used for persisting this to localStorage via the context's useEffect
    // However, we are now directly using explorerSortBy, explorerSortDirection from context state for the FileExplorer
  }, [setExplorerSort]);

  // Add a wrapper for clearFolders
  const clearAllFolders = () => {
    originalClearFolders(); // From useFiles
    // Dispatch actions to clear relevant context state
    setActiveRootFolders([]);
    setActiveExpandedNodes({});
    setItemOrder({});
  };

  // Add a new state for editor visibility
  const [isEditorVisible, setIsEditorVisible] = useState(true);

  // Add handler for search and replace
  const handleSearch = (searchTerm, options) => {
    if (editorRef.current) {
      editorRef.current.handleSearch?.(searchTerm, options);
    }
  };

  const handleReplace = (searchTerm, replaceTerm, options) => {
    if (editorRef.current) {
      editorRef.current.handleReplace?.(searchTerm, replaceTerm, options);
    }
  };

  const handleReplaceAll = (searchTerm, replaceTerm, options) => {
    if (editorRef.current) {
      editorRef.current.handleReplaceAll?.(searchTerm, replaceTerm, options);
    }
  };

  // Update toggle functions to match user expectations
  const toggleEditorEye = () => {
    // The editor's eye controls the preview panel
    setPreviewVisible(!previewVisible);
  };

  const togglePreviewEye = () => {
    // The preview's eye should control the entire editor container
    setIsEditorContainerVisible(!isEditorContainerVisible);
  };

  // Add effect to recalculate split sizes when visibility changes
  useEffect(() => {
    // Force a window resize event to make the Split component recalculate
    // Add a small delay to ensure the DOM has updated first
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 10);
    
    return () => clearTimeout(timer);
  }, [isEditorContainerVisible, previewVisible]);
  
  const handleDeleteFolder = async (path) => {
    try {
      // Confirm deletion
      const folderName = path.split('/').pop().split('\\').pop();
      const confirmed = window.confirm(`Are you sure you want to delete the folder "${folderName}" and all its contents? This cannot be undone.`);
      
      if (!confirmed) return;
      
      setAppLoading(true);
      const result = await window.api.deleteFolder(path);
      
      if (result.success) {
        showSuccess(`Folder deleted: ${folderName}`);
        
        // Refresh folders
        const refreshResult = await window.api.listFolders(activeRootFolders);
        if (refreshResult.success) {
          setFolders(refreshResult.folders);
        }
      } else {
        showError(`Failed to delete folder: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
      showError(`Error deleting folder: ${error.message}`);
    } finally {
      setAppLoading(false);
    }
  };
  
  const handleMoveFolder = async (sourcePath, targetPath) => {
    try {
      if (!targetPath) return;
      
      setAppLoading(true);
      const result = await window.api.moveFolder(sourcePath, targetPath);
      
      if (result.success) {
        const folderName = sourcePath.split('/').pop().split('\\').pop();
        showSuccess(`Folder moved: ${folderName}`);
        
        // Refresh folders
        const refreshResult = await window.api.listFolders(activeRootFolders);
        if (refreshResult.success) {
          setFolders(refreshResult.folders);
        }
        
        // Refresh files
        const filesResult = await window.api.listFiles(activeRootFolders);
        if (filesResult.success) {
          setFiles(filesResult.files);
        }
      } else {
        showError(`Failed to move folder: ${result.error}`);
      }
    } catch (error) {
      console.error('Error moving folder:', error);
      showError(`Error moving folder: ${error.message}`);
    } finally {
      setAppLoading(false);
    }
  };
  
  const handleCopyFile = async (path) => {
    try {
      setAppLoading(true);
      const result = await window.api.copyFile(path);
      
      if (result.success) {
        const fileName = path.split('/').pop().split('\\').pop();
        showSuccess(`File copied: ${fileName}`);
        
        // Refresh files
        const filesResult = await window.api.listFiles(activeRootFolders);
        if (filesResult.success) {
          setFiles(filesResult.files);
        }
      } else {
        showError(`Failed to copy file: ${result.error}`);
      }
    } catch (error) {
      console.error('Error copying file:', error);
      showError(`Error copying file: ${error.message}`);
    } finally {
      setAppLoading(false);
    }
  };
  
  const handleCopyFolder = async (path) => {
    try {
      setAppLoading(true);
      const result = await window.api.copyFolder(path);
      
      if (result.success) {
        const folderName = path.split('/').pop().split('\\').pop();
        showSuccess(`Folder copied: ${folderName}`);
        
        // Refresh folders
        const refreshResult = await window.api.listFolders(activeRootFolders);
        if (refreshResult.success) {
          setFolders(refreshResult.folders);
        }
        
        // Refresh files
        const filesResult = await window.api.listFiles(activeRootFolders);
        if (filesResult.success) {
          setFiles(filesResult.files);
        }
      } else {
        showError(`Failed to copy folder: ${result.error}`);
      }
    } catch (error) {
      console.error('Error copying folder:', error);
      showError(`Error copying folder: ${error.message}`);
    } finally {
      setAppLoading(false);
    }
  };

  // *** NEW: Handler for renaming files/folders ***
  const handleRenameItem = async (oldPath, newPath, isDirectory) => {
    console.log(`[App] Renaming item: ${oldPath} -> ${newPath}, isDirectory: ${isDirectory}`);
    setAppLoading({ files: true });
    try {
      const result = await window.api.moveItem(oldPath, newPath, isDirectory);
      if (!result || !result.success) {
        throw new Error(result?.message || 'Unknown error during rename/move');
      }

      const newName = getBasename(newPath);
      const oldParentPath = getDirname(oldPath) || '.';
      const newParentPath = getDirname(newPath) || '.';

      // 1. Update useFiles state (source of truth for file system items)
      if (isDirectory) {
        setFolders(prev => prev.map(f => f.path === oldPath ? { ...f, path: newPath, name: newName } : f));
        // TODO: If backend doesn't update children paths, we might need to rescan or manually update children in useFiles state.
        // For now, assuming backend handles children if it's a true rename/move, or we rescan parent later.
      } else {
        setFiles(prev => prev.map(f => f.path === oldPath ? { ...f, path: newPath, name: newName } : f));
      }

      // 2. Update open file tabs if the renamed file was open
      if (!isDirectory) {
        const openFileIndex = openFiles.findIndex(f => f.path === oldPath);
        if (openFileIndex > -1) {
          updateOpenFile(oldPath, { path: newPath, name: newName }); // Dispatch to context
          if (currentFile?.path === oldPath) {
            setCurrentFile({ ...openFiles[openFileIndex], path: newPath, name: newName }); // This is useFiles setCurrentFile
          }
        }
      }
      // If a folder is renamed and it's an open file's ancestor, its path in openFiles also needs update (more complex).
      // For simplicity, we are not handling recursive path updates in openFiles for renamed folders here yet.

      // 3. Update itemOrder in context (this is the tricky part)
      const newOrderMap = { ...(itemOrder || {}) }; // Get current itemOrder from context state

      // If parent changed (move between different folders)
      if (oldParentPath !== newParentPath) {
        // Remove from old parent's order
        if (newOrderMap[oldParentPath]) {
          newOrderMap[oldParentPath] = newOrderMap[oldParentPath].filter(p => p !== oldPath);
          if (newOrderMap[oldParentPath].length === 0) delete newOrderMap[oldParentPath];
        }
        // Add to new parent's order (append for now, could be smarter)
        newOrderMap[newParentPath] = [...(newOrderMap[newParentPath] || []), newPath];
      } else { // Renamed within the same parent
        if (newOrderMap[oldParentPath]) {
          newOrderMap[oldParentPath] = newOrderMap[oldParentPath].map(p => p === oldPath ? newPath : p);
        }
      }

      if (isDirectory) {
        // If a folder is renamed, its key in itemOrder and paths of its children must be updated.
        const keysToUpdate = Object.keys(newOrderMap).filter(key => key === oldPath || key.startsWith(oldPath + '/'));
        const updatesToBatch = {};
        keysToUpdate.forEach(currentKey => {
          const relativeKeyPath = currentKey.substring(oldPath.length);
          const newKeyForMap = newPath + relativeKeyPath;
          updatesToBatch[newKeyForMap] = (newOrderMap[currentKey] || []).map(childPath => {
            const relativeChildPath = childPath.substring(currentKey.length);
            return newKeyForMap + relativeChildPath;
          });
          if (currentKey !== newKeyForMap) delete newOrderMap[currentKey]; // remove old key before adding new
        });
        // Apply batched updates for renamed folder and its children orders
        for (const key in updatesToBatch) {
          newOrderMap[key] = updatesToBatch[key];
        }
      }
      setItemOrder(newOrderMap); // Dispatch bulk update to context

      // 4. Update activeRootFolders if a root folder was renamed
      if (activeRootFolders.includes(oldPath)) {
        removeRootFolder(oldPath); // Dispatch
        addRootFolder(newPath);    // Dispatch
      }

      // 5. Update activeExpandedNodes if a renamed folder (or its ancestor) was expanded
      const newExpandedNodes = { ...activeExpandedNodes };
      let changedExpansion = false;
      Object.keys(activeExpandedNodes).forEach(expandedPath => {
        if (expandedPath === oldPath) {
          delete newExpandedNodes[expandedPath];
          newExpandedNodes[newPath] = true;
          changedExpansion = true;
        } else if (expandedPath.startsWith(oldPath + '/')) {
          delete newExpandedNodes[expandedPath];
          const relative = expandedPath.substring(oldPath.length);
          newExpandedNodes[newPath + relative] = true;
          changedExpansion = true;
        }
      });
      if (changedExpansion) {
        setActiveExpandedNodes(newExpandedNodes); // Dispatch bulk update
      }

      showSuccess(`Renamed to ${newName}`);
    } catch (error) {
      console.error(`[App] Error renaming item: ${error.message}`);
      showError(`Failed to rename: ${error.message}`);
    } finally {
      setAppLoading({ files: false });
    }
  };

  // *** NEW: Handler for deleting files/folders ***
  const handleDeleteItem = async (itemPath, isDirectory) => {
    const itemName = getBasename(itemPath);
    const itemType = isDirectory ? 'folder' : 'file';
    
    const confirmMessage = isDirectory
      ? `Are you sure you want to remove the folder "${itemName}" and its contents from the view? This will NOT delete files from your disk.`
      : `Are you sure you want to delete the file "${itemName}"? This cannot be undone.`;
      
    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) return;

    setAppLoading({ files: true });
    try {
      if (!isDirectory) { // File deletion (API call)
        const result = await window.api.deleteFile(itemPath);
        if (!result || !result.success) {
          throw new Error(result?.error || `Unknown error deleting ${itemType}`);
        }
        // Update useFiles state
        setFiles(prev => prev.filter(f => f.path !== itemPath));
      } else { // Folder removal (from view only)
        const pathPrefix = itemPath.endsWith('/') ? itemPath : itemPath + '/';
        // Update useFiles state
        setFolders(prev => prev.filter(f => f.path !== itemPath && !f.path.startsWith(pathPrefix)));
        setFiles(prev => prev.filter(f => !f.path.startsWith(pathPrefix)));

        // If the removed folder was a root folder, update context
        if (activeRootFolders.includes(itemPath)) {
          removeRootFolder(itemPath); // Dispatch to context
        }
      }

      // Update itemOrder in context
      const parentDirForOrder = getDirname(itemPath) || '.';
      removeFromItemOrder(itemPath, parentDirForOrder, isDirectory); // Dispatch to context
      
      // Close tabs for deleted/removed items
      const pathPrefixToRemove = itemPath + (isDirectory ? '/' : '');
      const openFilesToRemove = openFiles.filter(f => 
        isDirectory ? f.path.startsWith(pathPrefixToRemove) : f.path === itemPath
      );
      openFilesToRemove.forEach(file => removeOpenFile(file)); // removeOpenFile is from AppStateContext
      
      if (currentFile && (isDirectory ? currentFile.path.startsWith(pathPrefixToRemove) : currentFile.path === itemPath)) {
        const remainingOpen = openFiles.filter(f => !openFilesToRemove.some(removed => removed.path === f.path));
        if (remainingOpen.length > 0) {
          const currentIndex = openFiles.findIndex(f => f.path === currentFile.path); // Original index
          let nextFileToOpen = null;
          if (currentIndex > 0 && remainingOpen.find(f => f.path === openFiles[currentIndex -1]?.path)) {
            nextFileToOpen = openFiles[currentIndex - 1];
          } else if (remainingOpen.length > 0) {
            nextFileToOpen = remainingOpen[0];
          }
          if (nextFileToOpen) originalOpenFile(nextFileToOpen);
          else {
            setCurrentFile(null); updateContent('');
          }
        } else {
          setCurrentFile(null); updateContent('');
        }
      }

      const successMessage = isDirectory ? `Removed folder from view: ${itemName}` : `Deleted file: ${itemName}`;
      showSuccess(successMessage);

    } catch (error) {
        console.error(`[App] Error ${isDirectory ? 'removing' : 'deleting'} ${itemType}: ${error.message}`);
        showError(`Failed to ${isDirectory ? 'remove' : 'delete'} ${itemType}: ${error.message}`);
    } finally {
       setAppLoading({ files: false });
    }
  };

  // Effect to initialize itemOrder after initial file/folder loading if not already populated in context
  useEffect(() => {
    if (!state.loading.files && !isOrderInitialized && (files.length > 0 || folders.length > 0)) {
      // Check if itemOrder in context is empty or only has empty arrays (which can happen from new folder creation)
      const contextItemOrder = state.ui.itemOrder || {};
      const isContextOrderEffectivelyEmpty = Object.keys(contextItemOrder).length === 0 || 
                                            Object.values(contextItemOrder).every(arr => arr.length === 0);

      if (isContextOrderEffectivelyEmpty) {
        console.log('[App itemOrder Effect] Context itemOrder is empty. Initializing based on current files/folders.');
        const initialOrderMap = {};
        const allItems = [...files, ...folders];
        const itemsByParent = allItems.reduce((acc, item) => {
          const parentPath = getDirname(item.path) || '.';
          if (!acc[parentPath]) acc[parentPath] = [];
          acc[parentPath].push(item);
          return acc;
        }, {});

        for (const parentPath in itemsByParent) {
          const children = itemsByParent[parentPath];
          children.sort((a, b) => {
            if (a.type === 'folder' && b.type !== 'folder') return -1;
            if (a.type !== 'folder' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
          });
          initialOrderMap[parentPath] = children.map(child => child.path);
        }
        setItemOrder(initialOrderMap); // Dispatch to context
      }
      setIsOrderInitialized(true); // Mark App.jsx's local init flag
    }
    prevFileLoadingRef.current = state.loading.files; // Keep tracking loading state
  }, [state.loading.files, state.ui.itemOrder, isOrderInitialized, files, folders, setItemOrder]);

  // Memoize files and folders arrays to prevent unnecessary re-renders of FileExplorer
  const memoizedFiles = useMemo(() => files, [files]);
  const memoizedFolders = useMemo(() => folders, [folders]);

  // Add back the wheel handler, using the ref's zoom methods
  const handlePreviewWheel = useCallback((event) => {
    // Check if Ctrl key is pressed and the preview element exists
    if (event.ctrlKey && previewRef.current) {
      event.preventDefault(); // Prevent default page scroll
      let newZoomLevel = null;

      // Determine zoom direction based on wheel delta
      if (event.deltaY < 0) {
        // Wheel up, zoom in - Call the zoomIn method and capture its return value
        newZoomLevel = previewRef.current.zoomIn?.(); 
      } else {
        // Wheel down, zoom out - Call the zoomOut method and capture its return value
        newZoomLevel = previewRef.current.zoomOut?.();
      }
      
      // Update the zoom display state variable with the returned level
      if (newZoomLevel !== null) {
        setPreviewZoom(newZoomLevel);
      }
    }
  }, [previewRef, setPreviewZoom]); // Dependency is the ref and setPreviewZoom

  // --- State for Saved Workspace States is now managed by AppStateContext ---
  // const [savedWorkspaceStates, setSavedWorkspaceStates] = useState({}); 
  
  // Load saved projects from localStorage on mount - Now handled by AppStateProvider
  // useEffect(() => { ... }); 

  // Get savedWorkspaceStates and related actions from context
  const { 
    savedWorkspaceStates, 
    pendingWorkspaceLoad,
    activeNamedWorkspaceName // <-- NEW: Get current active named workspace name
  } = state; // Get state parts
  const { 
    saveNamedWorkspace, 
    removeNamedWorkspace, 
    loadNamedWorkspace, 
    clearPendingWorkspaceLoad
  } = useAppState(); // Get action creators

  // --- BEGIN: useEffect to load last active workspace state on startup (REVISED) ---
  useEffect(() => {
    if (!initialLoadPerformedRef.current) {
      initialLoadPerformedRef.current = true;

      const performInitialScan = async (foldersToScan) => {
        if (foldersToScan && foldersToScan.length > 0) {
          console.log("[App Startup] Performing initial scan for restored folders:", foldersToScan);
          setAppLoading({ files: true }); // Indicate loading
          try {
            for (const folderPath of foldersToScan) {
              await scanFolder(folderPath, true); // Use addMode = true to populate files/folders state
            }
            console.log("[App Startup] Initial scan complete for AppState-restored folders.");
            // File re-opening is handled by AppStateProvider restoring state.openFiles and currentFile
          } catch (error) {
            console.error("[App Startup] Error during initial scan of AppState-restored folders:", error);
            showError(`Error during initial scan: ${error.message}`);
          } finally {
            setAppLoading({ files: false });
          }
        }
      };

      const loadLastSession = async () => {
        if (state.ui.activeRootFolders && state.ui.activeRootFolders.length > 0) {
          console.log("[App Startup] AppStateProvider restored session with root folders. Prioritizing this session:", state.ui.activeRootFolders);
          await performInitialScan(state.ui.activeRootFolders);

          // After scanning, if AppStateProvider restored a currentFile, try to open it.
          if (state.currentFile && state.currentFile.path) {
            console.log("[App Startup] AppStateProvider restored currentFile. Attempting to load its content directly:", state.currentFile);
            // originalOpenFile loads content and sets currentFile in useFiles hook.
            // EditorTabs component will use state.currentFile from AppStateContext for active tab.
            originalOpenFile(state.currentFile);
          } else if (state.openFiles && state.openFiles.length > 0 && state.openFiles[0]?.path) {
            // Fallback: If no currentFile, but openFiles were restored, open the first one.
            // Assuming state.openFiles[0] is a complete file object if it exists.
            const firstRestoredOpenFile = state.openFiles[0];
            console.log("[App Startup] No currentFile restored by AppState. Attempting to open first of restored openFiles:", firstRestoredOpenFile);
            originalOpenFile(firstRestoredOpenFile);
          } else {
            console.log("[App Startup] No currentFile or openFiles with paths restored by AppStateProvider to auto-open after folder scan.");
          }
        } else {
          // If no root folders were restored by AppStateProvider (e.g., fresh session or cleared state),
          // then try to load the "last active named workspace state" as a fallback.
          const lastActiveStateName = localStorage.getItem('lastActiveMdViewerWorkspaceName');
          if (lastActiveStateName && savedWorkspaceStates && savedWorkspaceStates[lastActiveStateName]) {
            console.log(`[App Startup] No session folders from AppState. Found last active NAMED workspace: '${lastActiveStateName}'. Attempting to load.`);
            // Dispatch action to load this workspace state
            loadNamedWorkspace(savedWorkspaceStates[lastActiveStateName]); // Dispatch action
          } else if (lastActiveStateName) {
            console.log(`[App Startup] Last active NAMED workspace '${lastActiveStateName}' not found or invalid. Clearing from localStorage.`);
            localStorage.removeItem('lastActiveMdViewerWorkspaceName');
          } else {
            console.log("[App Startup] No active session from AppState or last named workspace found. Starting fresh or with empty state.");
          }
        }
      };

      loadLastSession();
    }
    // Dependencies ensure this runs when the necessary data is available and on initial mount.
  }, [
    state.ui.activeRootFolders, 
    state.currentFile, // React to restored currentFile from AppState
    state.openFiles,   // React to restored openFiles for fallback
    savedWorkspaceStates, 
    loadNamedWorkspace, // Added: Effect logic uses this action creator
    scanFolder, 
    setAppLoading, 
    showError, 
    originalOpenFile 
  ]);
  // --- END: useEffect to load last active workspace state on startup (REVISED) ---

  // --- BEGIN: useEffects to sync App.jsx local convenience state (like isProjectOpen) --- 
  // --- These were previously syncing local state *to* context, now App.jsx primarily *reads* from context --- 

  // Effect to update isProjectOpen when activeRootFolders from context changes
  useEffect(() => {
    setIsProjectOpen(activeRootFolders.length > 0);
  }, [activeRootFolders]);

  // Placeholder for Save Project functionality - now just opens the dialog
  const handleSaveProject = async () => {
    console.log('[App] handleSaveProject called - opening dialog');
    
    // Use activeRootFolders from context for check
    if (activeRootFolders.length === 0) { 
      showError("Cannot save project state: No folder is open.");
      return;
    }
    
    // Open the dialog instead of prompting directly
    setIsSaveStateDialogOpen(true);
  };
  
  // New handler called by the SaveStateDialog
  const confirmSaveState = (stateName) => {
    console.log(`[App] confirmSaveState called with name: ${stateName}`);
    
    if (!stateName) {
      console.error("[App] confirmSaveState called without a name.");
      return; // Should not happen if dialog validation works
    }
    
    // Get project path (should still be available)
    if (activeRootFolders.length === 0) {
      showError("Cannot save project state: Folder context lost.");
      return;
    }
    // REMOVED incorrect prompt logic below

    const projectData = {
      name: stateName, // Use the user-provided name from the dialog parameter
      timestamp: Date.now(), // Use timestamp to identify this state
      // Gather current state from context for saving
      rootFolders: activeRootFolders, 
      expandedNodes: activeExpandedNodes, 
      openFiles: openFiles.map(file => file.path), 
      itemOrder: itemOrder, 
      explorerSortBy: explorerSortBy, 
      explorerSortDirection: explorerSortDirection,
      activeFilePath: currentFile?.path // <-- NEW: Save the active file's path
    };
    
    console.log('[App] Saving workspace state via context:', projectData);
    
    try {
      // Dispatch action to save the named workspace state in context
      saveNamedWorkspace(stateName, projectData);
      
      // No longer switching header mode
      showSuccess(`Workspace state \'${stateName}\' saved!`); 
      
    } catch (error) {
      console.error("Failed to dispatch save workspace state:", error); // Error likely in dispatch/reducer
      showError("Failed to save project state.");
    }
  };
  
  // --- NEW: Function to auto-save the current workspace state ---
  const autoSaveWorkspace = (workspaceNameToSave) => {
    console.log(`[App] autoSaveWorkspace called for name: ${workspaceNameToSave}`);
    
    if (!workspaceNameToSave) {
      console.warn("[App] autoSaveWorkspace called without a workspace name. Aborting.");
      return;
    }

    // Ensure there's something to save (active root folders)
    // This check uses the current state.ui.activeRootFolders from context
    if (state.ui.activeRootFolders.length === 0) {
      console.warn("[App] autoSaveWorkspace: No active root folders to save. Aborting.");
      // Optionally, we could remove the named state if it becomes empty.
      // For now, just don't save an empty state over a potentially valid one.
      return;
    }

    const projectData = {
      name: workspaceNameToSave, // Use the provided name
      timestamp: Date.now(),
      // Gather current state from context for saving
      rootFolders: state.ui.activeRootFolders, 
      expandedNodes: state.ui.activeExpandedNodes, 
      openFiles: state.openFiles.map(file => file.path), // Use state.openFiles from context
      itemOrder: state.ui.itemOrder, 
      explorerSortBy: state.ui.preferences.explorerSortBy, 
      explorerSortDirection: state.ui.preferences.explorerSortDirection,
      activeFilePath: currentFile?.path // <-- NEW: Save the active file's path (currentFile from useFiles)
    };
    
    console.log('[App] Auto-saving workspace state via context:', projectData);
    
    try {
      // Dispatch action to save the named workspace state in context
      saveNamedWorkspace(workspaceNameToSave, projectData); // saveNamedWorkspace is from useAppState()
      showInfo(`Workspace '${workspaceNameToSave}' auto-saved.`); // Use showInfo for less intrusive notification
    } catch (error) {
      console.error(`[App] Failed to dispatch auto-save for workspace state '${workspaceNameToSave}':`, error);
      showError(`Failed to auto-save workspace state '${workspaceNameToSave}'.`);
    }
  };
  // --- END: autoSaveWorkspace ---
  
  // Function to trigger loading a saved workspace state via context action
  const triggerLoadWorkspaceState = (stateNameToLoad) => {
    console.log(`[App] triggerLoadWorkspaceState called for: '${stateNameToLoad}'`);

    // Auto-save the current active named workspace before switching, if applicable
    if (activeNamedWorkspaceName && activeNamedWorkspaceName !== stateNameToLoad) {
      console.log(`[App] Auto-saving current workspace '${activeNamedWorkspaceName}' before switching to '${stateNameToLoad}'.`);
      autoSaveWorkspace(activeNamedWorkspaceName);
    }

    const stateData = savedWorkspaceStates[stateNameToLoad];
    if (!stateData) {
      showError(`Workspace state "${stateNameToLoad}" not found.`);
      console.error(`[App] Could not find state data for name: ${stateNameToLoad}`);
      return;
    }
    // Dispatch the action to signal the intent to load this state
    // The actual loading process will be handled by the useEffect watching pendingWorkspaceLoad
    loadNamedWorkspace(stateData);
  };
  
  // --- BEGIN: useEffect to handle the actual loading process for a named workspace ---
  useEffect(() => {
    if (!pendingWorkspaceLoad) return; // Do nothing if no state is pending load

    const performLoad = async () => {
      console.log('[App Load Effect] Starting load for pending workspace:', pendingWorkspaceLoad.name);
      showInfo(`Loading workspace state '${pendingWorkspaceLoad.name}'...`);
      setAppLoading(true); // Use the specific key if available, e.g., { workspace: true }

      try {
        // 1. Clear current workspace state (dispatch actions, call useFiles clear)
        console.log("[App Load Effect] Clearing current workspace state...");
        clearOpenFiles(); 
        if (originalClearFolders) { 
          originalClearFolders(); 
        } else {
          setCurrentFile(null); 
          updateContent('');
          setFiles([]);
          setFolders([]);
          console.warn("[App Load Effect] originalClearFolders was not available. Used individual setters.");
        }
        // Clear context states related to structure (bulk actions)
        setActiveRootFolders([]);
        setActiveExpandedNodes({});
        setItemOrder({});
        clearActiveNamedWorkspace(); // <-- NEW: Clear active named workspace

        // 2. Set state from loaded data (dispatch actions using data from pendingWorkspaceLoad)
        const { 
          name: loadedName, 
          rootFolders: loadedRootFolders = [], 
          expandedNodes: loadedExpandedNodes = {}, 
          openFiles: loadedOpenFilesPaths = [],
          itemOrder: loadedItemOrder = {}, 
          explorerSortBy: loadedSortBy = 'name', 
          explorerSortDirection: loadedSortDir = 'asc',
          activeFilePath: loadedActiveFilePath = null // <-- NEW: Get the saved active file path
        } = pendingWorkspaceLoad;

        console.log(`[App Load Effect] Setting state for workspace: '${loadedName}'. Folders: ${loadedRootFolders.length}, Files: ${loadedOpenFilesPaths.length}, ActiveFile: ${loadedActiveFilePath}`);
        setActiveRootFolders(loadedRootFolders);
        setActiveExpandedNodes(loadedExpandedNodes);
        setItemOrder(loadedItemOrder);
        setExplorerSort(loadedSortBy, loadedSortDir);
        // isProjectOpen will update via its own useEffect

        // 3. Scan all folders from the loaded state
        if (loadedRootFolders.length > 0) {
          console.log("[App Load Effect] Scanning folders for loaded state...");
          let allScannedFiles = []; // Accumulate all files scanned from all roots
          for (const folderPath of loadedRootFolders) {
            try {
              const scanResult = await scanFolder(folderPath, true); 
              if (scanResult && scanResult.files) {
                allScannedFiles = allScannedFiles.concat(scanResult.files);
              }
            } catch (scanError) {
              console.error(`[App Load Effect] Error scanning folder ${folderPath}:`, scanError);
              showError(`Error scanning folder ${folderPath} while loading workspace.`);
              // Decide if we should continue or abort if a folder scan fails
            }
          }
          // Deduplicate allScannedFiles in case of overlapping scans or identical files from different roots
          // This simple deduplication assumes file paths are unique identifiers.
          const uniqueScannedFilesMap = new Map();
          allScannedFiles.forEach(file => uniqueScannedFilesMap.set(file.path, file));
          const uniqueScannedFiles = Array.from(uniqueScannedFilesMap.values());

          console.log("[App Load Effect] Finished scanning all folders. Total unique files found:", uniqueScannedFiles.length);
          
          // 4. Re-open files after scan is complete
          if (loadedOpenFilesPaths.length > 0) {
            console.log("[App Load Effect] Attempting to re-open files:", loadedOpenFilesPaths);
            
            const filesToOpenObjects = loadedOpenFilesPaths.map(filePath => 
              uniqueScannedFiles.find(f => f.path === filePath)
            ).filter(Boolean); 

            console.log("[App Load Effect] Found file objects to re-open:", filesToOpenObjects);

            if (filesToOpenObjects.length > 0) {
              // Add files to openFiles state in context first
              filesToOpenObjects.forEach(fileObj => addOpenFile(fileObj));
              
              // Determine which file to make current
              let fileToMakeCurrent = null;
              if (loadedActiveFilePath) {
                fileToMakeCurrent = filesToOpenObjects.find(f => f.path === loadedActiveFilePath);
              }
              
              // Fallback if the specific active file wasn't found or not specified
              if (!fileToMakeCurrent && filesToOpenObjects.length > 0) {
                fileToMakeCurrent = filesToOpenObjects[0]; // Fallback to the first available tab
                console.log("[App Load Effect] Saved active file not found or not specified, falling back to first tab:", fileToMakeCurrent);
              }

              if (fileToMakeCurrent) {
                console.log("[App Load Effect] Setting current file to load content:", fileToMakeCurrent);
                originalOpenFile(fileToMakeCurrent); // Load content
              } else {
                console.warn("[App Load Effect] No file found to make current after attempting to restore active/fallback.");
                // If no files are to be made current, ensure editor is clear
                setCurrentFile(null);
                updateContent('');
              }
            } else {
              console.warn("[App Load Effect] No valid file objects found to re-open from saved state.");
            }
          }
        } else {
           console.log("[App Load Effect] Loaded workspace has no root folders.");
           // Ensure editor is cleared if loading an empty workspace
           setCurrentFile(null);
           updateContent('');
        }

        showSuccess(`Workspace state '${loadedName}' loaded.`);
        setActiveNamedWorkspace(loadedName); // <-- NEW: Set active named workspace
        // Store this loaded state as the last active one
        try {
          localStorage.setItem('lastActiveMdViewerWorkspaceName', loadedName);
        } catch (e) {
          console.error("[App Load Effect] Failed to save last active workspace name:", e);
        }

      } catch (error) {
        console.error(`[App Load Effect] Error loading workspace state '${pendingWorkspaceLoad?.name}':`, error);
        showError(`Error loading workspace state '${pendingWorkspaceLoad?.name}': ${error.message}`);
        // Attempt to revert to a clean state on error?
        if (originalClearFolders) originalClearFolders();
        clearOpenFiles(); 
        setActiveRootFolders([]);
        setActiveExpandedNodes({});
        setItemOrder({});
        setExplorerSort('name', 'asc');
        clearActiveNamedWorkspace(); // <-- NEW: Clear active named workspace on error too
      } finally {
        // 5. Clear the pending state regardless of success or failure
        console.log("[App Load Effect] Clearing pending workspace load state.");
        clearPendingWorkspaceLoad(); // Dispatch action to clear the trigger
        setAppLoading(false); // Clear general loading indicator
      }
    };

    performLoad();
  }, [ 
      pendingWorkspaceLoad, 
      // Include dependencies needed for the loading process
      clearOpenFiles, 
      originalClearFolders, 
      setActiveRootFolders, 
      setActiveExpandedNodes, 
      setItemOrder, 
      setExplorerSort, 
      scanFolder, 
      addOpenFile,
      originalOpenFile, 
      files, // Need current files list to find objects to re-open
      setCurrentFile, updateContent, setFiles, setFolders, // For fallback clearing
      clearPendingWorkspaceLoad,
      setAppLoading, 
      showInfo, 
      showSuccess, 
      showError,
      clearActiveNamedWorkspace,
  ]);
  // --- END: useEffect to handle the actual loading process ---

  // Placeholder for loading a saved workspace state (REMOVED - Replaced by triggerLoadWorkspaceState and useEffect)
  // const handleLoadWorkspaceState = async (stateData) => { ... };

  // --- NEW: Handler to Remove a Saved Workspace State (uses context action) ---
  const handleRemoveWorkspaceState = (stateName) => {
    console.log(`[App] handleRemoveWorkspaceState called for name: ${stateName}`);
    if (!savedWorkspaceStates[stateName]) {
      console.warn(`[App] Cannot remove state '${stateName}', it does not exist.`);
      return;
    }
    
    const confirmed = window.confirm(`Are you sure you want to remove the saved state '${stateName}'?`);
    if (!confirmed) return;
    
    try {
      // Dispatch action to remove the state from context
      removeNamedWorkspace(stateName);
      showSuccess(`Workspace state '${stateName}' removed.`);
    } catch (error) {
      console.error(`Failed to dispatch remove workspace state '${stateName}':`, error);
      showError(`Failed to remove workspace state '${stateName}'.`);
    }
  };
  // --- End New Handler ---

  // Handler to toggle folder expansion state (passed down to explorer)
  const handleFolderToggle = useCallback((path) => {
    // Dispatch action to context
    toggleExpandedNode(path);
  }, [toggleExpandedNode]);

  // --- NEW: Handler for Reordering Saved Workspace States ---
  const handleStateReorder = useCallback((oldIndex, newIndex) => {
    console.log(`[App] handleStateReorder called: ${oldIndex} -> ${newIndex}`);
    
    // We need to reorder based on the current visual order, which is derived from Object.values()
    const orderedStates = Object.values(savedWorkspaceStates);
    
    // Perform the move on the ordered array
    const reorderedArray = arrayMove(orderedStates, oldIndex, newIndex);
    
    // Convert the reordered array back into an object keyed by name
    const newStatesObject = reorderedArray.reduce((acc, state) => {
      acc[state.name] = state;
      return acc;
    }, {});
    
    // Update the state and localStorage
    setSavedWorkspaceStates(newStatesObject);
    try {
      localStorage.setItem('savedMdViewerWorkspaceStates', JSON.stringify(newStatesObject));
    } catch (error) {
      console.error("Failed to save reordered workspace states to localStorage:", error);
      showError("Failed to save the new state order.");
      // Optionally revert state update if localStorage fails?
      // setSavedWorkspaceStates(savedWorkspaceStates); 
    }
  }, [savedWorkspaceStates, showError]); // Dependency: need current states to reorder
  // --- End New Handler ---

  // --- NEW: Handler for Reordering Editor Tabs ---
  const handleTabReorder = useCallback((oldIndex, newIndex) => {
    console.log(`[App] handleTabReorder called: ${oldIndex} -> ${newIndex}`);
    // Call the action creator from the context
    reorderOpenFiles(oldIndex, newIndex);
  }, [reorderOpenFiles]); // Dependency on the action creator function
  // --- End New Handler ---

  // --- NEW: Handler to clear the current workspace ---
  const handleClearWorkspace = () => {
    console.log("[App] handleClearWorkspace called.");

    // Auto-save the current active named workspace before clearing, if applicable
    if (activeNamedWorkspaceName) {
      console.log(`[App] Auto-saving current workspace '${activeNamedWorkspaceName}' before clearing.`);
      autoSaveWorkspace(activeNamedWorkspaceName);
    }

    // Clear open files in context and editor content
    clearOpenFiles(); // From AppStateContext
    setCurrentFile(null); // From useFiles
    updateContent('');    // From useFiles

    // Clear folders from useFiles and context
    if (originalClearFolders) {
      originalClearFolders(); // From useFiles (clears files, folders, currentFile, content)
    } else {
      // Fallback if originalClearFolders is not available (should be, but good practice)
      setFiles([]);
      setFolders([]);
    }
    setActiveRootFolders([]);   // From AppStateContext
    setActiveExpandedNodes({}); // From AppStateContext
    setItemOrder({});           // From AppStateContext

    // Clear any active named workspace context
    clearActiveNamedWorkspace(); // From AppStateContext

    // Clear file history in context
    // Consider if this is desired for a "clean" state. Let's include it for now.
    if (dispatch) { // Ensure dispatch is available (it should be if useAppState is used)
        dispatch({ type: 'CLEAR_HISTORY' }); // Assuming 'CLEAR_HISTORY' is an existing ActionType
    }

    showSuccess("Workspace cleared. Ready for a fresh start!");
    setIsProjectOpen(false); // Explicitly set project as not open
  };
  // --- END: handleClearWorkspace ---

  return (
    <div className="app-container h-full flex flex-col bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100">
      {/* <AccessibilityHelper /> */}
      
      <header className="bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-surface-100 p-2 border-b border-surface-200 dark:border-surface-700" role="banner">
         {/* Main flex container spanning full width, with responsive gap */}
         <div className="w-full flex items-center justify-between gap-2 md:gap-4"> {/* Changed container to w-full, responsive gap */}

           {/* 1. Saved State Tabs Container (Takes remaining space, scrolls) */}
           <WorkspaceStateTabs
             savedWorkspaceStates={savedWorkspaceStates} // Pass from context state
             onLoadState={triggerLoadWorkspaceState} // Pass the trigger function
             onRemoveState={handleRemoveWorkspaceState} // Pass the context-dispatching handler
             onStateReorder={handleStateReorder} // <-- Pass the new handler
           />

           {/* 2. Settings Container (Takes required width) */}
           <div className="flex-shrink-0 flex items-center justify-end space-x-2">
             <ThemeToggle />
             <button
               className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300"
               onClick={() => setIsSettingsOpen(true)}
               title="Settings"
             >
               <IconSettings size={isMobile ? 16 : 18} />
             </button>
           </div>

         </div>
      </header>
      
      <main id="main-content" className="flex-grow flex flex-col overflow-hidden" role="main">
        <Split 
          className="flex-grow flex overflow-hidden" // Main Split now handles 3 panes
          sizes={getSplitSizes()}
          minSize={
             // Adjust min sizes based on visibility, rough example:
             [
               sidebarVisible ? (isMobile ? 150 : 150) : 0, // Sidebar Min
               isEditorContainerVisible ? 200 : 0, // Editor Min
               previewVisible ? 200 : 0 // Preview Min
             ]
          }
          expandToMin={true}
          gutterSize={5} // Use consistent gutter size
          gutterAlign="center"
          snapOffset={30}
          dragInterval={1}
          direction="horizontal"
          cursor="col-resize"
          elementStyle={(dimension, size, gutterSize) => ({
            'flex-basis': `calc(${size}% - ${gutterSize * 2 / 3}px)`, // Adjust gutter math for 3 panes
          })}
          gutterStyle={(dimension, gutterSize) => ({
            'flex-basis': `${gutterSize}px`,
          })}
          // onDragEnd - maybe keep this for layout refresh?
           onDragEnd={() => {
             // Force layout recalculation after resize
             window.dispatchEvent(new Event('resize'));
           }}
        >
          {/* Pane 1: Sidebar */}
          <aside className={`bg-surface-100 dark:bg-surface-800 border-r border-surface-300 dark:border-surface-700 overflow-hidden flex-shrink-0 flex flex-col ${!sidebarVisible ? 'hidden' : ''}`} role="complementary" aria-label="Sidebar">
            
            {/* --- START: Add Save State Button to Sidebar Top --- */}
            {isProjectOpen && (
              <div className="flex-shrink-0 p-2 border-b border-surface-200 dark:border-surface-700"> {/* Container with padding and border */}
                <button
                  onClick={handleSaveProject} 
                  className={`btn btn-primary flex items-center justify-center gap-2 w-full`} // Use full width of sidebar column 
                  title={`Save Current Project State`}
                  disabled={!isProjectOpen || activeRootFolders.length === 0 || loading} 
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" color="white" className="mr-1" />
                      {!isMobile && "Saving..."}
                    </>
                  ) : (
                    <>
                      <IconDeviceFloppy size={20} className="mr-1" /> 
                      {isMobile ? "Save" : "Save State"} 
                    </>
                  )}
                </button>
              </div>
            )}
            {/* --- END: Add Save State Button --- */}
            
             {/* Make SidebarTabs grow */}
             <div className="flex-grow min-h-0 overflow-y-auto"> {/* Allow tabs content to scroll if needed */} 
               <SidebarTabs activeTab={activeTab} onTabChange={handleSidebarTabChange}>
                 <SidebarTabs.Pane id="files">
                   {/* Wrap FileHistory and FileExplorer in a flex container that fills height */}
                   <div className="flex flex-col h-full"> {/* This inner div ensures explorer fills the pane space */}
                     <LoadingOverlay isLoading={state.loading.files} message="Loading files..." transparent preserveChildren={true}>
                       {error && (
                         <div className="p-4 text-sm text-error-500 bg-error-100 dark:bg-error-900/20 border-l-4 border-error-500 mb-2">
                           Error: {error}
                         </div>
                       )}
                       
                       {/* Add file history (does not grow) */}
                       {state.fileHistory.length > 0 && (
                         <div className="flex-shrink-0">
                           <FileHistory onFileSelect={openFile} />
                         </div>
                       )}
                       
                       {/* FileExplorer takes remaining space */}
                       <div className="flex-grow min-h-0"> {/* Container allows explorer to grow/shrink */}
                         <FileExplorer 
                           files={memoizedFiles} 
                           folders={memoizedFolders}
                           currentFolders={activeRootFolders} // <-- Use from context
                           currentFilePath={currentFile?.path}
                           onFileSelect={openFile} 
                           onDeleteItem={handleDeleteItem} 
                           onCreateFile={handleCreateFile}
                           onCreateFolder={handleCreateFolder}
                           onMoveItemProp={handleMoveItem}
                           onScanFolder={scanFolder} 
                           onRenameItem={handleRenameItem}
                           // Pass itemOrder from context
                           itemOrder={itemOrder} 
                           // Pass expandedNodes from context
                           expandedNodes={activeExpandedNodes} 
                           // Pass onFolderToggle (which now dispatches to context)
                           onFolderToggle={handleFolderToggle} 
                           // Pass addRootFolder (which now dispatches to context) directly
                           onAddFolderProp={openAndScanFolder} 
                         />
                       </div>
                     </LoadingOverlay>
                   </div>
                 </SidebarTabs.Pane>
                 <SidebarTabs.Pane id="search">
                   <FileSearch 
                     files={files} 
                     folders={folders} 
                     onFileSelect={openFile} 
                   />
                 </SidebarTabs.Pane>
               </SidebarTabs>
             </div>
             
             {/* Add Folder Button Footer (Outside SidebarTabs) */}
             <div className="flex-shrink-0 bg-surface-100 dark:bg-surface-800 p-2 border-t border-surface-200 dark:border-surface-700 space-y-2">
               <button
                 onClick={handleClearWorkspace} // Attach handler
                 className="w-full px-3 py-1 border border-surface-300 dark:border-surface-600 rounded text-sm hover:bg-error-100 dark:hover:bg-error-700 text-error-700 dark:text-error-300 flex items-center justify-center gap-2"
                 title="Clear Current Workspace"
               >
                 <IconEraser size={16} />
                 New Workspace
               </button>
               <button
                 onClick={openAndScanFolder} // Use the existing handler from App
                 className="w-full px-3 py-1 border border-surface-300 dark:border-surface-600 rounded text-sm hover:bg-surface-200 dark:hover:bg-surface-700 flex items-center justify-center gap-2"
               >
                 <IconFolderPlus size={16} />
                 Add Folder
               </button>
             </div>
          </aside>
          
          {/* Pane 2: Editor - Moved from nested split */}
          <div 
             className={`editor-pane flex flex-col h-full overflow-auto ${!isEditorContainerVisible ? 'hidden' : ''}`} // ADDED overflow-auto
             role="region" 
             aria-label="Editor"
          >
            {/* Editor Tabs */}
            <div className="editor-tabs-container flex-shrink-0"> {/* Ensure tabs don't grow */}
              <EditorTabs 
                currentFile={currentFile}
                openFiles={openFiles} // This comes from useAppState
                onTabChange={handleTabChange}
                onTabClose={handleTabClose}
                onNewTab={handleNewTab}
                onTabReorder={handleTabReorder} // <-- Pass the new handler
                onToggleEditorVisibility={toggleEditorEye} // <-- ADDED: This controls preview
                isPreviewVisible={previewVisible} // <-- ADDED: State for preview visibility
              />
            </div>
            
            {/* Toolbar */}
            <div className="toolbar-container flex-shrink-0"> {/* Ensure toolbar doesn't grow */}
              <MarkdownToolbar 
                onAction={handleToolbarAction} 
                onUndo={handleUndo}
                onRedo={handleRedo}
                // onToggleEditorVisibility, isEditorVisible, onTogglePreviewVisibility, isPreviewVisible REMOVED
                onSearch={handleSearch}
                onReplace={handleReplace}
                onReplaceAll={handleReplaceAll}
              />
            </div>
            
            {/* EDITOR Component Container */}
            <div 
              className={`editor-component-container flex-grow relative min-h-0 ${!isEditorVisible ? 'hidden' : ''}`} // Use flex-grow for editor itself
            >
              {state.loading.content && !forcingScrollRef.current && (
                 <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-surface-900/70 backdrop-blur-sm z-50 pointer-events-none">
                   <div className="pointer-events-none">
                     <LoadingSpinner />
                     <p className="mt-4 text-surface-700 dark:text-surface-300 font-medium">Loading content...</p>
                   </div>
                 </div>
               )}
              <MarkdownEditor
                ref={editorRef}
                content={content}
                onChange={handleContentChange}
                onCursorChange={handleCursorChange}
                onScroll={handleEditorScroll} // This scroll handler is now on the correct element
                inScrollSync={scrollSyncEnabled}
                scrollSource={scrollSource}
                className="w-full h-full absolute inset-0" // Make editor fill container
              />
            </div>
          </div>

          {/* Pane 3: Preview - Moved from nested split */}
          <div 
            className={`preview-pane flex flex-col h-full overflow-auto ${!previewVisible ? 'hidden' : ''}`} // ADDED overflow-auto
            role="region" 
            aria-label="Preview"
           >
             {/* Preview Header */}
             <div className="preview-header flex justify-between items-center p-2 border-b border-surface-300 dark:border-surface-700 bg-surface-100 dark:bg-surface-800 flex-shrink-0 overflow-hidden"> {/* Keep header fixed */}
               <div className="flex items-center space-x-2">
                 <button
                   className="p-1 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600 rounded"
                   onClick={togglePreviewEye} // Might need adjustment
                   title={isEditorContainerVisible ? "Hide Editor" : "Show Editor"} // Title might be wrong now
                 >
                   {isEditorContainerVisible ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                 </button>
                 <h3 className="text-sm font-medium flex-shrink-0">Preview</h3>
               </div>
               <div className="flex items-center space-x-2 flex-shrink min-w-0"> 
                 {/* Zoom Controls */}
                 <div className="flex items-center space-x-1 mr-2 flex-shrink-0"> 
                   <button
                     className="p-1 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600 rounded"
                     onClick={handleZoomOut}
                     title="Zoom Out (Ctrl+-)"
                   >
                     <IconZoomOut size={16} />
                   </button>
                   <span className="text-xs text-surface-600 dark:text-surface-400 w-12 text-center">
                     {previewZoom}%
                   </span>
                   <button
                     className="p-1 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600 rounded"
                     onClick={handleZoomIn}
                     title="Zoom In (Ctrl++)"
                   >
                     <IconZoomIn size={16} />
                   </button>
                   <button
                     className="p-1 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600 rounded"
                     onClick={handleZoomReset}
                     title="Reset Zoom (Ctrl+0)"
                   >
                     <IconZoomReset size={16} />
                   </button>
                 </div>
                 {/* Print Button */}
                 <button
                   className="p-1 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600 rounded flex-shrink-0"
                   onClick={handlePrintPreview}
                   title="Print Preview"
                 >
                   <IconPrinter size={16} />
                 </button>
                 {/* Scroll Sync Toggle */}
                 <button
                   className={`p-1 rounded flex-shrink-0 ${
                     scrollSyncEnabled
                       ? 'text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-900'
                       : 'text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600'
                   }`}
                   onClick={toggleScrollSync}
                   title={`${scrollSyncEnabled ? 'Disable' : 'Enable'} Scroll Sync`}
                 >
                   {scrollSyncEnabled ? <IconLink size={16} /> : <IconUnlink size={16} />}
                 </button>
               </div>
             </div>
             {/* PREVIEW Component Container */}
             <div 
               className="preview-component-container flex-grow relative min-h-0" // Use flex-grow for preview itself
               onScroll={handlePreviewScroll} // This scroll handler is now on the correct element
               onWheel={handlePreviewWheel} 
             >
               <LoadingOverlay isLoading={state.loading.content} message="Generating preview..." transparent preserveChildren={true}>
                  <MarkdownPreview 
                   ref={previewRef}
                   content={content}
                   onScroll={handlePreviewScroll} // This scroll handler is now on the correct element
                   inScrollSync={scrollSyncEnabled}
                   scrollSource={scrollSource}
                   currentFilePath={currentFile?.path}
                 />
               </LoadingOverlay>
             </div>
          </div>

          {/* REMOVED the wrapper div and the nested Split component */}
          
        </Split>
      </main>
      
      <footer role="contentinfo">
        <StatusBar 
          currentFile={currentFile} 
          content={content} 
          isMobile={isMobile}
          unsavedChanges={state.editor.unsavedChanges} 
        />
      </footer>
      
      {/* Settings Panel */}
      <SettingsPanel 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
      />
      
      {/* --- Add the Save State Dialog --- */}
      <SaveStateDialog 
        isOpen={isSaveStateDialogOpen} 
        onClose={() => setIsSaveStateDialogOpen(false)} 
        onSubmit={confirmSaveState} 
        defaultName={`Saved State - ${new Date().toLocaleString()}`} // Pass default name
      />
    </div>
  );
}

// Wrap the App component with providers
const AppWithProviders = () => (
  <AppStateProvider>
    <SettingsProvider>
      <NotificationProvider>
        <App />
      </NotificationProvider>
    </SettingsProvider>
  </AppStateProvider>
);

export default AppWithProviders;
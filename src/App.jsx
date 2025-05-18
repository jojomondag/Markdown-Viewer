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
  IconEyeOff,
  IconEye,
  IconLink,
  IconUnlink,
  IconZoomIn,
  IconZoomOut,
  IconZoomReset,
  IconPrinter,
  IconEraser,
  IconArrowsMaximize, // For fullscreen
  IconArrowsMinimize, // For exit fullscreen
  IconExternalLink, // Add this for detach button
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
import './detachedEditor.css'; // Import detached editor styling

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
  const [itemOrderVersion, setItemOrderVersion] = useState(0); // Add this state
  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false); // Fullscreen state
  const [isEditorVisible, setIsEditorVisible] = useState(true); // This is the correct declaration for editor component visibility

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
    setCurrentFile: setAppCurrentFile, // Rename to avoid conflict
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
    saveNamedWorkspace,      // Ensure saveNamedWorkspace is from useAppState()
    removeNamedWorkspace,    // Ensure removeNamedWorkspace is from useAppState()
    loadNamedWorkspace,       // Ensure loadNamedWorkspace is from useAppState()
    clearPendingWorkspaceLoad, // <-- ENSURE THIS IS PRESENT HERE
    renameWorkspace,          // NEW: Add renameWorkspace action creator
    reorderSavedWorkspaceStates, // <-- ADD this new action creator
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
      
      // Also update the current file in AppStateContext
      setAppCurrentFile(file);
      
      // Add file to history
      console.log(`[App] openFile - adding file to history`);
      addToHistory(file);
      
      // Focus the editor after opening the file, UNLESS it's a new file being created (which will be renamed)
      if (!file.isNew) { // Check the isNew flag
        setTimeout(() => {
          if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur(); // Try to release current focus
          }
          if (editorRef.current && editorRef.current.focus) {
            console.log(`[App] openFile - focusing editor for existing file`);
            editorRef.current.focus();
          }
        }, 300);
      } else {
        console.log(`[App] openFile - new file detected (path: ${file.path}), skipping editor focus to allow rename input focus.`);
      }
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
  
  // Modify getSplitSizes to use the state value
  const getSplitSizes = () => {
    // If splitSizes state exists and is valid, use it as a starting point
    let sizes = [25, 37.5, 37.5]; // Default fallback sizes
    
    if (splitSizes && splitSizes.length === 3 && splitSizes.every(size => !isNaN(size))) {
      sizes = [...splitSizes]; // Make a copy of the stored sizes
    }
    
    // Special cases for visibility - handle each possible combination
    if (!sidebarVisible && !isEditorContainerVisible && !previewVisible) {
      return [0, 0, 0]; // Should not happen but handle anyway
    }
    
    // Only one component visible - it gets 100%
    if (sidebarVisible && !isEditorContainerVisible && !previewVisible) {
      return [100, 0, 0];
    }
    if (!sidebarVisible && isEditorContainerVisible && !previewVisible) {
      return [0, 100, 0];
    }
    if (!sidebarVisible && !isEditorContainerVisible && previewVisible) {
      return [0, 0, 100];
    }
    
    // Two components visible - they share space proportionally
    if (!sidebarVisible) {
      // Editor and Preview visible - distribute space based on their relative proportions
      const totalEditorPreviewSize = sizes[1] + sizes[2];
      if (totalEditorPreviewSize > 0) {
        const editorRatio = sizes[1] / totalEditorPreviewSize;
        const previewRatio = sizes[2] / totalEditorPreviewSize;
        return [0, editorRatio * 100, previewRatio * 100];
      }
      return [0, 50, 50]; // Fallback to even split
    }
    
    if (!isEditorContainerVisible) {
      // Sidebar and Preview visible - distribute space based on their relative proportions
      const totalSidebarPreviewSize = sizes[0] + sizes[2];
      if (totalSidebarPreviewSize > 0) {
        const sidebarRatio = sizes[0] / totalSidebarPreviewSize;
        const previewRatio = sizes[2] / totalSidebarPreviewSize;
        return [sidebarRatio * 100, 0, previewRatio * 100];
      }
      return [25, 0, 75]; // Fallback to 1/4 sidebar, 3/4 preview
    }
    
    if (!previewVisible) {
      // Sidebar and Editor visible - distribute space based on their relative proportions
      const totalSidebarEditorSize = sizes[0] + sizes[1];
      if (totalSidebarEditorSize > 0) {
        const sidebarRatio = sizes[0] / totalSidebarEditorSize;
        const editorRatio = sizes[1] / totalSidebarEditorSize;
        return [sidebarRatio * 100, editorRatio * 100, 0];
      }
      return [25, 75, 0]; // Fallback to 1/4 sidebar, 3/4 editor
    }
    
    // All components visible - normalize to ensure they add up to 100%
    const total = sizes.reduce((sum, size) => sum + size, 0);
    if (total > 0) {
      return sizes.map(size => (size / total) * 100);
    }
    
    // Fallback if anything goes wrong
    return [25, 37.5, 37.5];
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
  // Add state to track cursor position at the application level
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  
  // Update cursor position state when it changes
  const handleCursorChange = (position) => {
    // Update the cursor position state
    setCursorPosition(position);
    // Optional: Log for debugging
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
    console.log(
      `[App] handleTabChange STARTED for: ${file?.path}, ` +
      `currentFile: ${currentFile?.path}`
    );
    
    if (!file || !file.path) {
      console.error('[App] handleTabChange called with invalid file', file);
      return;
    }
    
    // Set loading state
    console.log(`[App] Setting loading state to true`);
    setAppLoading({ content: true });
    
    try {
      // This is the most direct approach - force the editor to clear and reload
      
      // 2. Force a small delay so the editor can re-render
      console.log(`[App] Scheduling file read with timeout`);
      setTimeout(() => {
        console.log(`[App] Timeout triggered, reading file: ${file.path}`);
        
        // 3. Read the file directly from the filesystem
        window.api.readMarkdownFile(file.path)
          .then(fileContent => {
            console.log(
              `[App] File content loaded successfully! ` +
              `Length: ${fileContent?.length || 0}, ` + 
              `First 20 chars: "${(fileContent || '').substring(0, 20)}..."`
            );
            
            // 4. Update both content and currentFile states in correct order
            console.log(`[App] Setting content state`);
            updateContent(fileContent || '');
            
            console.log(`[App] Setting currentFile state to:`, file);
            setCurrentFile(file);
            // Also update the AppStateContext current file
            setAppCurrentFile(file);
            
            // 5. Focus editor after content is loaded
            console.log(`[App] Focusing editor and clearing loading state`);
            if (editorRef.current && editorRef.current.focus) {
              setTimeout(() => {
                console.log(`[App] Editor focus timeout triggered`);
                editorRef.current.focus();
                setAppLoading({ content: false });
                console.log(`[App] Tab change complete! Editor focused and ready.`);
              }, 50);
            } else {
              console.log(`[App] No editor ref available for focus`);
              setAppLoading({ content: false });
              console.log(`[App] Tab change complete! (No editor focus)`);
            }
          })
          .catch(err => {
            console.error(`[App] Error reading file directly: ${err.message}`);
            console.log(`[App] Trying fallback method with originalOpenFile...`);
            
            // Try the original approach as fallback
            try {
              originalOpenFile(file)
                .then(() => {
                  console.log(`[App] Fallback success! File loaded via originalOpenFile`);
                  setAppLoading({ content: false });
                })
                .catch(fallbackErr => {
                  console.error(`[App] Fallback also failed: ${fallbackErr.message}`);
                  showError(`Failed to open file: ${fallbackErr.message}`);
                  setAppLoading({ content: false });
                });
            } catch (fallbackErr) {
              console.error(`[App] Error in fallback: ${fallbackErr.message}`);
              showError(`Failed to open file: ${err.message}`);
              setAppLoading({ content: false });
            }
          });
      }, 10);
    } catch (err) {
      console.error(`[App] Error in handleTabChange: ${err.message}`);
      setAppLoading({ content: false });
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
        const nextFile = remainingFiles[nextIndex];
        originalOpenFile(nextFile);
        // Update AppStateContext currentFile as well
        setAppCurrentFile(nextFile);
      } else {
        // No files left open, clear the editor
        updateContent('');
        // Clear both currentFile states
        setCurrentFile(null);
        setAppCurrentFile(null);
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
    // Always update local content state first
    updateContent(newContent);
    
    // Mark file as dirty (unsaved changes)
    if (currentFile) {
      setFileDirty(currentFile, true);
    }
    
    // If we're in a detached window, sync back to main
    if (window.detachedAPI && window.detachedAPI.isDetachedWindow()) {
      const contentId = window.detachedAPI.getContentId();
      
      // Get cursor position safely
      let cursorPosition = null;
      try {
        if (editorRef.current && typeof editorRef.current.getCursorPosition === 'function') {
          cursorPosition = editorRef.current.getCursorPosition();
        } else if (editorRef.current && typeof editorRef.current.getCurrentCursorPosition === 'function') {
          // Fallback to getCurrentCursorPosition if getCursorPosition is not available
          cursorPosition = editorRef.current.getCurrentCursorPosition();
        }
      } catch (error) {
        console.error('Error getting cursor position in detached window:', error);
      }
      
      // Send the update to the main window
      console.log(`[Detached Window] Sending content update to main. Content length: ${newContent?.length}`);
      
      // Try both update methods for redundancy
      // 1. Update the detached content record in main process (for any future windows)
      window.api.updateDetachedContent(contentId, newContent, cursorPosition)
        .then(result => {
          if (!result.success) {
            console.error(`[Detached Window] Failed to send updateDetachedContent: ${result.error}`);
          }
        })
        .catch(err => {
          console.error(`[Detached Window] Error sending updateDetachedContent:`, err);
        });
        
      // 2. Send update directly to main window (for immediate sync)
      window.api.updateMainContent(contentId, newContent, cursorPosition)
        .then(result => {
          if (!result.success) {
            console.error(`[Detached Window] Failed to send updateMainContent: ${result.error}`);
          }
        })
        .catch(err => {
          console.error(`[Detached Window] Error sending updateMainContent:`, err);
        });
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
    console.log('[App] handleMoveItem', { sourceItems, targetNode, dropPosition });
    
    if (!sourceItems || sourceItems.length === 0) {
      console.warn('[App] No source items provided for move operation');
      return;
    }

    // Create local copies of state for this operation
    let currentFilesState = [...files];
    let currentFoldersState = [...folders];
    let currentItemOrderState = { ...itemOrder };
    let currentCurrentFileState = currentFile;
    
    // Keep track of success for UI feedback
    let allSuccess = true;
    const errors = [];

    // Determine if this is a multi-reorder operation
    const firstItemOldParentPath = getDirname(sourceItems[0].path) || '.';
    const isMultiReorder = dropPosition !== 'middle' && 
        sourceItems.length > 0 && 
        sourceItems.every(item => getDirname(item.path) === firstItemOldParentPath) &&
        getDirname(targetNode.path) === firstItemOldParentPath;

    // Multi-reordering of items within the same folder
    if (isMultiReorder) {
        console.log(`[App] Multi-Reordering ${sourceItems.length} items within ${firstItemOldParentPath}`);
        setAppLoading({ files: true }); // Set loading state for UI feedback

        // Update the itemOrder for this parent
        const parentPath = firstItemOldParentPath;
        const currentParentOrder = [...(currentItemOrderState[parentPath] || [])];
        const targetIndex = currentParentOrder.indexOf(targetNode.path);
        
        if (targetIndex === -1) {
            console.warn('[App] Multi-Reorder target node not found in order map. Appending.');
            
            // Remove all source items from the current order
            const sourcePaths = sourceItems.map(item => item.path);
            const newOrder = currentParentOrder.filter(path => !sourcePaths.includes(path));
            
            // Append all source items at the end
            newOrder.push(...sourcePaths);
            currentItemOrderState[parentPath] = newOrder;
        } else {
            // Remove all source items from the current order
            const sourcePaths = sourceItems.map(item => item.path);
            const newOrder = currentParentOrder.filter(path => !sourcePaths.includes(path));
            
            // Calculate insert index (before or after target)
            let insertIndex = targetIndex;
            // If dropping after, and target still exists in newOrder, adjust index
            if (dropPosition === 'bottom') {
                const adjustedTargetIndex = newOrder.indexOf(targetNode.path);
                if (adjustedTargetIndex !== -1) {
                    insertIndex = adjustedTargetIndex + 1;
                }
            }
            
            // Insert all source items at the calculated position
            newOrder.splice(insertIndex, 0, ...sourcePaths);
            currentItemOrderState[parentPath] = newOrder;
        }
        
        setItemOrder(currentItemOrderState);
        setAppLoading({ files: false });
        
        // Force UI update
        setItemOrderVersion(prevVersion => prevVersion + 1);
        return;
    }

    // --- Moving Items Between Folders ---
    setAppLoading({ files: true }); // Set loading state for UI feedback
    
    // Determine target folder path
    let effectiveTargetFolder;
    
    if (targetNode.type === 'folder') {
        // If dropping directly onto a folder
        if (dropPosition === 'middle') {
            effectiveTargetFolder = targetNode; // Inside the folder
        } else {
            // If dropping before/after a folder, place in parent folder
            effectiveTargetFolder = {
                path: getDirname(targetNode.path) || '.',
                type: 'folder'
            };
        }
    } else {
        // If dropping near a file, place in same folder as that file
        effectiveTargetFolder = {
            path: getDirname(targetNode.path) || '.',
            type: 'folder'
        };
    }
    
    console.log(`[App] Move target folder: ${effectiveTargetFolder.path}`);

    // Process each item to be moved
    for (const item of sourceItems) {
        try {
            const oldPath = item.path;
            const isDirectory = item.type === 'folder';
            const itemName = getBasename(oldPath);
            
            // --- Handle Move (between folders or dropping onto folder, or multi-item reorder treated as move) ---
            let newPath = path.join(effectiveTargetFolder.path, itemName).replace(/\\\\/g, '/');
            console.log(`[App] Moving ${isDirectory ? 'folder' : 'file'}: ${oldPath} -> ${newPath}`);

            // Prevent moving into self
            if (newPath === oldPath || (isDirectory && newPath.startsWith(oldPath + '/'))) {
                console.warn(`[App] Attempted to move item ${oldPath} into itself or descendant. Skipping.`);
                errors.push(`Cannot move ${itemName} into itself.`);
                allSuccess = false;
                continue; // Skip this item
            }

            // Check for naming conflicts based on *current* temporary state
            let fileExists = false;
            let renamed = false;
            let uniqueSuffix = 1;
            
            // Function to check if a path exists in our current state
            const pathExistsInCurrentState = (pathToCheck) => {
                const pathLower = pathToCheck.toLowerCase();
                return currentFilesState.some(f => f.path.toLowerCase() === pathLower) || 
                       currentFoldersState.some(f => f.path.toLowerCase() === pathLower);
            };
            
            // Generate unique name if needed
            while (pathExistsInCurrentState(newPath)) {
                fileExists = true;
                const ext = getExtension(itemName);
                const baseName = ext ? itemName.slice(0, -(ext.length + 1)) : itemName;
                const newName = `${baseName} (${uniqueSuffix})${ext ? '.' + ext : ''}`;
                newPath = path.join(effectiveTargetFolder.path, newName).replace(/\\\\/g, '/');
                uniqueSuffix++;
                renamed = true;
            }
            
            if (fileExists) {
                console.log(`[App] Target path exists, using: ${newPath}`);
            }

            // Now attempt to perform the move operation via IPC
            try {
                await window.api.moveItem(oldPath, newPath, isDirectory);
                console.log(`[App] Move successful: ${oldPath} -> ${newPath}`);
                
                // Update state based on item type
                if (isDirectory) {
                    // Update folders state with new path for this folder
                    currentFoldersState = currentFoldersState.filter(f => f.path !== oldPath);
                    currentFoldersState.push({
                        ...item,
                        path: newPath
                    });
                    
                    // Also update paths for all descendant files and folders
                    const descendantPrefix = oldPath + '/';
                    
                    // Update descendant folders
                    currentFoldersState = currentFoldersState.map(f => {
                        if (f.path.startsWith(descendantPrefix)) {
                            return {
                                ...f,
                                path: newPath + '/' + f.path.substring(descendantPrefix.length)
                            };
                        }
                        return f;
                    });
                    
                    // Update descendant files
                    currentFilesState = currentFilesState.map(f => {
                        if (f.path.startsWith(descendantPrefix)) {
                            const newFilePath = newPath + '/' + f.path.substring(descendantPrefix.length);
                            
                            // If this is the current file, update currentFile reference
                            if (currentCurrentFileState && f.path === currentCurrentFileState.path) {
                                currentCurrentFileState = {
                                    ...currentCurrentFileState,
                                    path: newFilePath
                                };
                            }
                            
                            return {
                                ...f,
                                path: newFilePath
                            };
                        }
                        return f;
                    });
                    
                    // Update item order for all affected folders
                    const oldOrderEntry = currentItemOrderState[oldPath];
                    if (oldOrderEntry) {
                        currentItemOrderState[newPath] = oldOrderEntry;
                        delete currentItemOrderState[oldPath];
                    }
                    
                    // Update parent folders' order
                    const oldParent = getDirname(oldPath) || '.';
                    const newParent = getDirname(newPath) || '.';
                    
                    if (oldParent in currentItemOrderState) {
                        currentItemOrderState[oldParent] = currentItemOrderState[oldParent]
                            .filter(p => p !== oldPath);
                    }
                    
                    if (newParent in currentItemOrderState) {
                        if (!currentItemOrderState[newParent].includes(newPath)) {
                            currentItemOrderState[newParent].push(newPath);
                        }
                    } else {
                        currentItemOrderState[newParent] = [newPath];
                    }
                } else {
                    // Handle file move
                    currentFilesState = currentFilesState.filter(f => f.path !== oldPath);
                    currentFilesState.push({
                        ...item,
                        path: newPath
                    });
                    
                    // Update currentFile reference if needed
                    if (currentCurrentFileState && currentCurrentFileState.path === oldPath) {
                        currentCurrentFileState = {
                            ...currentCurrentFileState,
                            path: newPath
                        };
                    }
                    
                    // Update parent folders' order
                    const oldParent = getDirname(oldPath) || '.';
                    const newParent = getDirname(newPath) || '.';
                    
                    if (oldParent in currentItemOrderState) {
                        currentItemOrderState[oldParent] = currentItemOrderState[oldParent]
                            .filter(p => p !== oldPath);
                    }
                    
                    if (newParent in currentItemOrderState) {
                        if (!currentItemOrderState[newParent].includes(newPath)) {
                            currentItemOrderState[newParent].push(newPath);
                        }
                    } else {
                        currentItemOrderState[newParent] = [newPath];
                    }
                }
            } catch (err) {
                console.error(`[App] Error moving ${oldPath} to ${newPath}:`, err);
                errors.push(`Failed to move ${itemName}: ${err.message}`);
                allSuccess = false;
            }
        } catch (err) {
            console.error('[App] Unexpected error in handleMoveItem:', err);
            errors.push(`Error: ${err.message}`);
            allSuccess = false;
        }
    }

    // --- Final State Updates --- 
    setFiles(currentFilesState);
    setFolders(currentFoldersState);
    setItemOrder(currentItemOrderState);
    
    // Increment the version to force re-render of the explorer
    setItemOrderVersion(prevVersion => prevVersion + 1);
    
    // Update open files using the context dispatchers based on the final state
    // This is complex because dispatch is async; a full refresh might be safer
    // For now, let's just update the current file if it changed
    if (currentFile && currentCurrentFileState && currentFile.path !== currentCurrentFileState.path) {
      setCurrentFile(currentCurrentFileState);
    }
    
    // Clear loading state
    setAppLoading({ files: false });

    // Show feedback to user for multi-item operations
    if (sourceItems.length > 1) {
        if (allSuccess) {
            showSuccess(`Successfully moved ${sourceItems.length} items.`);
        } else {
            showError(`Some items could not be moved. Check console for details.`);
            console.error('[App] Move errors:', errors);
        }
    } else if (!allSuccess) {
        showError(errors[0] || 'Failed to move item.');
    }
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

      return { path: normalizedPath, name: newFileObject.name, type: 'file', isNew: true }; // Return object with isNew flag
      
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
    
    // Force layout recalculation
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      // Give the Split component time to update
      setTimeout(() => {
        if (editorRef.current && typeof editorRef.current.refreshLayout === 'function') {
          editorRef.current.refreshLayout();
        }
      }, 50);
    }, 10);
  };

  const togglePreviewEye = () => {
    // The preview's eye should control the entire editor container
    setIsEditorContainerVisible(!isEditorContainerVisible);
    
    // Force layout recalculation
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      // Give the Split component time to update
      setTimeout(() => {
        if (previewRef.current && typeof previewRef.current.refreshLayout === 'function') {
          previewRef.current.refreshLayout();
        }
      }, 50);
    }, 10);
  };

  // Add effect to recalculate split sizes when visibility changes
  useEffect(() => {
    // Short delay to allow React to update the DOM
    const timer = setTimeout(() => {
      if (!window._isDraggingSplitPane) { // Don't interfere with active dragging
        window.dispatchEvent(new Event('resize'));
        // Try to refresh layouts of editor and preview components
        if (editorRef.current && typeof editorRef.current.refreshLayout === 'function') {
          editorRef.current.refreshLayout();
        }
        if (previewRef.current && typeof previewRef.current.refreshLayout === 'function') {
          previewRef.current.refreshLayout();
        }
      }
    }, 50);
    
    return () => clearTimeout(timer);
  }, [sidebarVisible, isEditorContainerVisible, previewVisible]);
  
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

          console.log(`[App HandleRenameItem] Focus Check: currentFile.path = "${currentFile?.path}", oldPath = "${oldPath}"`);
          if (currentFile?.path === oldPath) {
            console.log(`[App HandleRenameItem] Focus Check Passed: currentFile.path === oldPath. Updating currentFile and scheduling editor focus.`);
            setCurrentFile({ ...openFiles[openFileIndex], path: newPath, name: newName }); // This is useFiles setCurrentFile
            // After renaming the current file and updating its state, focus the editor
            setTimeout(() => {
              // Check if editorRef and its focus method are available
              const editorInstance = editorRef.current;
              if (editorInstance && typeof editorInstance.focus === 'function') {
                // Add a micro-delay to allow editor to re-render if filePath prop change caused it
                setTimeout(() => {
                  if (editorRef.current && typeof editorRef.current.focus === 'function') { // Re-check, just in case
                    console.log('[App] Focusing editor after rename of current file (after micro-delay)');
                    editorRef.current.focus();
                  } else {
                    console.log('[App] Editor became non-focusable during micro-delay after rename.', {
                        editorRefCurrent: editorRef.current,
                        focusType: typeof editorRef.current?.focus
                    });
                  }
                }, 0); // 0ms micro-delay
              } else {
                console.log('[App] Editor not focusable after rename (main check). Details:', {
                  editorRefCurrent: editorInstance, // Log the captured instance
                  focusType: typeof editorInstance?.focus
                });
              }
            }, 150); // Main delay remains 150ms
          } else {
            console.log(`[App HandleRenameItem] Focus Check Failed: currentFile.path !== oldPath. Not focusing editor.`);
          }
        } else {
          console.log(`[App HandleRenameItem] File to rename (oldPath: "${oldPath}") not found in openFiles. Index: ${openFileIndex}`);
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
  const handleDeleteItem = async (itemsToDelete) => { // itemsToDelete is Array<{path: string, type: string}>
    if (!itemsToDelete || itemsToDelete.length === 0) return;

    // Confirmation
    let confirmMessage = "";
    const fileCount = itemsToDelete.filter(item => item.type === 'file').length;
    const folderCount = itemsToDelete.filter(item => item.type === 'folder').length;

    if (itemsToDelete.length === 1) {
      const item = itemsToDelete[0];
      const itemName = getBasename(item.path);
      confirmMessage = item.type === 'folder'
        ? `Are you sure you want to remove the folder \"${itemName}\" and its contents from the view? This will NOT delete files from your disk.`
        : `Are you sure you want to delete the file \"${itemName}\"? This cannot be undone.`;
    } else {
      let parts = [];
      if (fileCount > 0) parts.push(`${fileCount} file(s)`);
      if (folderCount > 0) parts.push(`${folderCount} folder(s)`);
      confirmMessage = `Are you sure you want to delete/remove ${parts.join(' and ')}? Files will be deleted from disk; folders will be removed from view. This cannot be undone for files.`;
    }

    const confirmed = window.confirm(confirmMessage);
    if (!confirmed) return;

    // --- Optimistic Update ---
    const previousFiles = [...files];
    const previousFolders = [...folders];
    const previousOpenFiles = [...openFiles];
    const previousCurrentFile = currentFile ? { ...currentFile } : null;
    const previousContent = content;

    let overallSuccess = true;
    let errors = [];

    const itemsByParent = itemsToDelete.reduce((acc, item) => {
      const parentDir = getDirname(item.path) || '.';
      if (!acc[parentDir]) acc[parentDir] = [];
      acc[parentDir].push(item);
      return acc;
    }, {});
    
    const previousItemOrdersByParent = {};
    for (const parentDir in itemsByParent) {
      previousItemOrdersByParent[parentDir] = [...(state.ui.itemOrder[parentDir] || [])];
    }

    let optimisticallyRemovedOpenFiles = [];
    let optimisticallyClosedFileToReopenPath = null; 

    let nextFilesState = [...files];
    let nextFoldersState = [...folders];
    
    itemsToDelete.forEach(item => {
      const { path: itemPath, type } = item;
      const isDirectory = type === 'folder';

      if (!isDirectory) {
        nextFilesState = nextFilesState.filter(f => f.path !== itemPath);
      } else {
        const pathPrefix = itemPath.endsWith('/') ? itemPath : itemPath + '/';
        nextFoldersState = nextFoldersState.filter(f => f.path !== itemPath && !f.path.startsWith(pathPrefix));
        nextFilesState = nextFilesState.filter(f => !f.path.startsWith(pathPrefix));
        if (activeRootFolders.includes(itemPath)) {
          removeRootFolder(itemPath); 
        }
      }
      const parentDirForOrder = getDirname(itemPath) || '.';
      removeFromItemOrder(itemPath, parentDirForOrder, isDirectory); 

      const pathPrefixToRemove = itemPath + (isDirectory ? '/' : '');
      const currentlyOpenAndToBeRemoved = openFiles.filter(f => // Use openFiles from current state, not nextOpenFiles
        isDirectory ? f.path.startsWith(pathPrefixToRemove) : f.path === itemPath
      );
      optimisticallyRemovedOpenFiles.push(...currentlyOpenAndToBeRemoved);
    });

    setFiles(nextFilesState);
    setFolders(nextFoldersState);
    optimisticallyRemovedOpenFiles.forEach(file => removeOpenFile(file)); 

    const currentFileWasDeleted = currentFile && optimisticallyRemovedOpenFiles.some(f => f.path === currentFile.path);

    if (currentFileWasDeleted) {
      const remainingOpenAfterDeletions = previousOpenFiles.filter(f =>
        !optimisticallyRemovedOpenFiles.some(removed => removed.path === f.path)
      );
      if (remainingOpenAfterDeletions.length > 0) {
        const currentIndexInOriginal = previousOpenFiles.findIndex(f => f.path === currentFile.path);
        if (currentIndexInOriginal > 0 && remainingOpenAfterDeletions.find(f => f.path === previousOpenFiles[currentIndexInOriginal - 1]?.path)) {
          optimisticallyClosedFileToReopenPath = previousOpenFiles[currentIndexInOriginal - 1].path;
        } else {
          optimisticallyClosedFileToReopenPath = remainingOpenAfterDeletions[0].path;
        }
      }
      setCurrentFile(null); 
      updateContent('');     
    }

    for (const item of itemsToDelete) {
      const { path: itemPath, type } = item;
      const isDirectory = type === 'folder';
      if (!isDirectory) { 
        try {
          const result = await window.api.deleteFile(itemPath);
          if (!result || !result.success) {
            overallSuccess = false;
            errors.push(`Failed to delete file ${getBasename(itemPath)}: ${result?.error || 'Unknown error'}`);
          }
        } catch (err) {
          overallSuccess = false;
          errors.push(`Error deleting file ${getBasename(itemPath)}: ${err.message}`);
        }
      }
    }

    if (overallSuccess) {
      if (optimisticallyClosedFileToReopenPath) {
        const fileToOpen = previousOpenFiles.find(f => f.path === optimisticallyClosedFileToReopenPath);
        if (fileToOpen) originalOpenFile(fileToOpen);
      }
      const successMessage = itemsToDelete.length > 1 ? `${itemsToDelete.length} items processed.` :
        (itemsToDelete[0].type === 'folder' ? `Removed folder from view: ${getBasename(itemsToDelete[0].path)}` : `Deleted file: ${getBasename(itemsToDelete[0].path)}`);
      showSuccess(successMessage);
    } else {
      console.error(`[App] Multi-Delete Failed. Rolling back. Errors: ${errors.join('; ')}`);
      showError(`Failed to process all items: ${errors.join('; ')}. Reverting changes.`);

      setFiles(previousFiles);
      setFolders(previousFolders);
      
      // Restore open files by clearing and re-adding from previous state
      // This relies on removeOpenFile and addOpenFile dispatching to context correctly.
      // A more direct AppState restoration might be needed for full robustness.
      const currentOpenPaths = new Set(openFiles.map(f => f.path));
      previousOpenFiles.forEach(pof => {
        if (!currentOpenPaths.has(pof.path)) {
          addOpenFile(pof); // Add if it was removed
        }
      });
      // Ensure files that were *not* part of optimistic removal but are in previousOpenFiles are still there
      // This part of rollback for openFiles might need more refinement based on exact state management of openFiles.

      for (const parentDir in previousItemOrdersByParent) {
        updateItemOrderForParent(parentDir, previousItemOrdersByParent[parentDir]);
      }
      // TODO: Rollback activeRootFolders if any were removed by re-adding them.
      // This requires knowing which ones were removed due to this operation.

      if (previousCurrentFile) {
        setCurrentFile(previousCurrentFile);
        updateContent(previousContent);
      } else if (currentFile) { // If currentFile was set (e.g. by opening another) but previously was null
        setCurrentFile(null);
        updateContent('');
      }
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

  // --- Get relevant parts from the main state object (around line 1700s) ---
  const { 
    // ONLY actual state properties here:
    savedWorkspaceStates, 
    pendingWorkspaceLoad,
    activeNamedWorkspaceName
    // REMOVE THE FOLLOWING IF THEY ARE PRESENT IN THIS BLOCK:
    // saveNamedWorkspace,      <-- remove this line if present
    // removeNamedWorkspace,    <-- remove this line if present
    // loadNamedWorkspace,      <-- remove this line if present
    // clearPendingWorkspaceLoad, <-- remove this line if present
    // setActiveNamedWorkspace  <-- remove this line if present
  } = state; 

  // ... (the rest of App.jsx, including handleRenameWorkspaceState, triggerLoadWorkspaceState etc.
  // which should use the actions obtained from the *initial* useAppState() destructuring)

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
        let sessionToLoad = null;
        const lastActiveNameFromLocalStorage = localStorage.getItem('lastActiveMdViewerWorkspaceName');

        // Priority 1: Does AppStateProvider have active root folders already?
        if (state.ui.activeRootFolders && state.ui.activeRootFolders.length > 0) {
          console.log("[App Startup] AppStateProvider restored session with root folders. Prioritizing this session:", state.ui.activeRootFolders);
          await performInitialScan(state.ui.activeRootFolders);

          let fileToOpenInitially = null;
          // Check if AppStateProvider restored a currentFile
          if (state.currentFile && state.currentFile.path) {
            console.log("[App Startup] AppStateProvider restored currentFile. Using this:", state.currentFile);
            fileToOpenInitially = state.currentFile;
          } else if (lastActiveNameFromLocalStorage && state.savedWorkspaceStates && state.savedWorkspaceStates[lastActiveNameFromLocalStorage]) {
            // AppStateProvider restored folders and openFiles, but NOT currentFile.
            // Let's try to use the activeFilePath from our more robust save.
            const lastSessionData = state.savedWorkspaceStates[lastActiveNameFromLocalStorage];
            if (lastSessionData && lastSessionData.activeFilePath) {
              console.log(`[App Startup] AppStateProvider did not restore currentFile. Trying activeFilePath ('${lastSessionData.activeFilePath}') from saved session '${lastActiveNameFromLocalStorage}'.`);
              // Find this file in the restored state.openFiles
              const targetOpenFile = state.openFiles.find(f => f.path === lastSessionData.activeFilePath);
              if (targetOpenFile) {
                console.log("[App Startup] Found target file in restored openFiles based on saved activeFilePath:", targetOpenFile);
                fileToOpenInitially = targetOpenFile;
              }
            }
          }
          
          // Fallback: If no specific file determined yet, use the first from restored openFiles
          if (!fileToOpenInitially && state.openFiles && state.openFiles.length > 0 && state.openFiles[0]?.path) {
            console.log("[App Startup] No specific currentFile determined. Attempting to open first of restored openFiles:", state.openFiles[0]);
            fileToOpenInitially = state.openFiles[0];
          }

          if (fileToOpenInitially) {
            originalOpenFile(fileToOpenInitially);
            // Also update the AppStateContext current file
            setAppCurrentFile(fileToOpenInitially);
          } else {
            console.log("[App Startup] No currentFile or openFiles with paths restored by AppStateProvider to auto-open after folder scan.");
          }
        } else if (lastActiveNameFromLocalStorage && state.savedWorkspaceStates && state.savedWorkspaceStates[lastActiveNameFromLocalStorage]) {
          // Priority 2: No root folders from AppStateProvider, so load the last active NAMED workspace fully.
          console.log(`[App Startup] No session folders from AppState. Found last active NAMED workspace: '${lastActiveNameFromLocalStorage}'. Triggering full load.`);
          sessionToLoad = state.savedWorkspaceStates[lastActiveNameFromLocalStorage];
          if (sessionToLoad) {
            loadNamedWorkspace(sessionToLoad); // This triggers the pendingWorkspaceLoad effect
          }
        } else {
          console.log("[App Startup] No active session from AppState or last named workspace found. Starting fresh.");
          if (lastActiveNameFromLocalStorage) {
              console.log(`[App Startup] Last active NAMED workspace '${lastActiveNameFromLocalStorage}' not found in current state.savedWorkspaceStates or was invalid. Clearing from localStorage.`);
              localStorage.removeItem('lastActiveMdViewerWorkspaceName');
          }
        }
      };

      loadLastSession();
    }
  }, [ /* ... existing dependencies ... */ 
      state.ui.activeRootFolders,
      state.currentFile, 
      state.openFiles,   
      state.savedWorkspaceStates, // Added: to check for last active named workspace
      loadNamedWorkspace, 
      scanFolder, 
      setAppLoading, 
      showError, 
      originalOpenFile,
      setAppCurrentFile, // Add dependency for setting app current file
      // initialLoadPerformedRef is a ref, not needed in deps
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
      activeFilePath: state.currentFile?.path // Use state.currentFile from AppStateContext
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
      activeFilePath: state.currentFile?.path // Use state.currentFile from AppStateContext
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
          activeFilePath: loadedActiveFilePath = null, // <-- NEW: Get the saved active file path
          preferences: loadedPreferences = {}, // Ensure default to empty object
          editorSelections: loadedEditorSelections = {},
          editorCursorPositions: loadedEditorCursorPositions = {},
          editorFontSize: loadedEditorFontSize = null, // Allow null to distinguish from default 0 or 14
          splitSizes: loadedSplitSizes = null, // <-- NEW: Get saved split sizes
          // any other properties...
        } = pendingWorkspaceLoad;

        console.log(`[App Load Effect] Setting state for workspace: '${loadedName}'. Folders: ${loadedRootFolders.length}, Files: ${loadedOpenFilesPaths.length}, ActiveFile: ${loadedActiveFilePath}`);
        setActiveRootFolders(loadedRootFolders);
        setActiveExpandedNodes(loadedExpandedNodes);
        setItemOrder(loadedItemOrder);
        setExplorerSort(loadedSortBy, loadedSortDir);
        // isProjectOpen will update via its own useEffect

        // Restore preferences
        if (loadedPreferences && Object.keys(loadedPreferences).length > 0) {
          console.log('[App pendingWorkspaceLoad] Restoring preferences:', loadedPreferences);
          updatePreferences(loadedPreferences); // Dispatch to update AppStateContext.ui.preferences
        } else {
          console.log('[App pendingWorkspaceLoad] No preferences to restore or loadedPreferences is empty.');
        }
        // Note: setExplorerSort is usually a specific part of updatePreferences or handled by it.
        // If updatePreferences(loadedPreferences) correctly sets sort, explicit setExplorerSort might be redundant
        // but keeping it for now if it handles defaults or specific logic.
        setExplorerSort(loadedPreferences.explorerSortBy || 'name', loadedPreferences.explorerSortDirection || 'asc');

        // Log loaded editor-specific states - actual restoration needs context actions
        console.log('[App pendingWorkspaceLoad] Loaded editor states (require context actions to restore):', 
          { loadedEditorSelections, loadedEditorCursorPositions, loadedEditorFontSize });
        if (loadedEditorFontSize !== null && typeof updatePreferences === 'function') {
            // Example: If editorFontSize is managed within the general preferences object
            // updatePreferences({ ...loadedPreferences, editor: { ...(loadedPreferences.editor || {}), fontSize: loadedEditorFontSize } });
            // Or, if AppStateContext has a specific action for editorFontSize, use that.
            // For now, we assume it might be part of the broader 'preferences' or needs a dedicated action.
            console.log(`[App pendingWorkspaceLoad] Editor font size to restore: ${loadedEditorFontSize}. Ensure AppStateContext handles this.`);
        }

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
                console.log(`[App Load Effect] Explicitly setting current file in useFiles and AppStateContext to:`, fileToMakeCurrent);
                // Explicitly set in useFiles() state
                setCurrentFile(fileToMakeCurrent); 
                // Also set in AppStateContext
                setAppCurrentFile(fileToMakeCurrent);

                console.log("[App Load Effect] Now calling originalOpenFile to load content for:", fileToMakeCurrent);
                originalOpenFile(fileToMakeCurrent); // Now primarily for content loading and other side effects
              } else {
                console.warn("[App Load Effect] No file found to make current after attempting to restore active/fallback.");
                setCurrentFile(null); // Clear in useFiles state
                setAppCurrentFile(null); // Clear in AppStateContext
                updateContent('');
              }
            } else {
              console.warn("[App Load Effect] No valid file objects found to re-open from saved state.");
              setCurrentFile(null); // Clear in useFiles state
              setAppCurrentFile(null); // Clear in AppStateContext
              updateContent('');
            }
          }
        } else {
           console.log("[App Load Effect] Loaded workspace has no root folders.");
           setCurrentFile(null); // Clear in useFiles state
           setAppCurrentFile(null); // Clear in AppStateContext
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

        // Restore split sizes if available
        if (loadedSplitSizes && Array.isArray(loadedSplitSizes) && loadedSplitSizes.length === 3) {
          console.log('[App Load Effect] Restoring split sizes:', loadedSplitSizes);
          setSplitSizes(loadedSplitSizes);
          // Also save to electron store for persistence across app restarts
          window.api.setStoreValue('splitSizes', loadedSplitSizes)
            .catch(error => console.error('[App Load Effect] Error saving loaded split sizes to store:', error));
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
        clearPendingWorkspaceLoad(); // This needs to be defined in scope
        setAppLoading(false); 
      }
    };

    performLoad();
  }, [ 
      pendingWorkspaceLoad, 
      clearOpenFiles, 
      originalClearFolders, 
      setActiveRootFolders, 
      setActiveExpandedNodes, 
      setItemOrder, 
      setExplorerSort, 
      scanFolder, 
      addOpenFile,
      originalOpenFile, 
      files, 
      setCurrentFile, updateContent, setFiles, setFolders, 
      clearPendingWorkspaceLoad, // Make sure it's a dependency if used inside
      setAppLoading, 
      showInfo, 
      showSuccess, 
      showError,
      setActiveNamedWorkspace, // Added setActiveNamedWorkspace to dependencies
      clearActiveNamedWorkspace,
      loadNamedWorkspace, // Added loadNamedWorkspace to dependencies
      updatePreferences, // Added updatePreferences to dependencies
      savedWorkspaceStates, // Added savedWorkspaceStates to dependencies
      splitSizes, // Added splitSizes to dependencies
      setSplitSizes // Add setSplitSizes to dependencies
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
      removeNamedWorkspace(stateName, false);
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
    
    // Use savedWorkspaceStates from context (via the 'state' object from useAppState)
    const orderedStates = Object.values(state.savedWorkspaceStates || {}); // Ensure fallback for initial empty state
    
    if (oldIndex < 0 || oldIndex >= orderedStates.length || newIndex < 0 || newIndex >= orderedStates.length) {
      console.warn(`[App] handleStateReorder: Invalid indices. oldIndex: ${oldIndex}, newIndex: ${newIndex}, states: ${orderedStates.length}`);
      return;
    }
    
    const reorderedArray = arrayMove(orderedStates, oldIndex, newIndex);
    
    const newStatesObject = reorderedArray.reduce((acc, s) => {
      acc[s.name] = s;
      return acc;
    }, {});
    
    // Dispatch action to update context state
    reorderSavedWorkspaceStates(newStatesObject); 
    
    try {
      localStorage.setItem('savedMdViewerWorkspaceStates', JSON.stringify(newStatesObject));
    } catch (error) {
      console.error("Failed to save reordered workspace states to localStorage:", error);
      showError("Failed to save the new state order.");
    }
  }, [state.savedWorkspaceStates, reorderSavedWorkspaceStates, showError]); // Dependencies updated
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

  // --- NEW: Handler to Rename a Saved Workspace State ---
  const handleRenameWorkspaceState = useCallback((oldName, newName) => {
    console.log(`[App] handleRenameWorkspaceState called: ${oldName} -> ${newName}`);
    if (!savedWorkspaceStates[oldName] || !newName || newName.trim() === '' || oldName === newName) {
      console.warn('[App] Rename aborted: Invalid names or old state not found.');
      return;
    }
    if (savedWorkspaceStates[newName]) {
      showError(`Cannot rename: A workspace named "${newName}" already exists.`);
      return;
    }

    const workspaceDataToRename = { ...savedWorkspaceStates[oldName] };
    const renamedWorkspaceData = {
      ...workspaceDataToRename,
      name: newName,
      timestamp: Date.now(),
    };

    try {
      // Check if we're renaming the active workspace
      const isActiveWorkspace = activeNamedWorkspaceName === oldName;
      
      // Use the renameWorkspace action creator 
      renameWorkspace(oldName, newName, renamedWorkspaceData);
      
      // If this was the active workspace, explicitly set it again to ensure UI updates
      if (isActiveWorkspace) {
        setActiveNamedWorkspace(newName);
      }
      
      showSuccess(`Workspace "${oldName}" renamed to "${newName}".`);
    } catch (error) {
      console.error(`[App] Error renaming workspace: ${error.message}`);
      showError(`Failed to rename workspace: ${error.message}`);
    }
  }, [savedWorkspaceStates, activeNamedWorkspaceName, renameWorkspace, setActiveNamedWorkspace, showError, showSuccess]);
  // --- END: Handler to Rename a Saved Workspace State ---

  // Callback to gather all relevant state for saving a session/workspace
  const gatherComprehensiveWorkspaceData = useCallback((nameToSaveWith) => {
    return {
      name: nameToSaveWith,
      timestamp: Date.now(),
      // Structural info
      rootFolders: state.ui.activeRootFolders || [],
      expandedNodes: state.ui.activeExpandedNodes || {},
      openFiles: state.openFiles.map(f => f.path), // Paths of open files from context
      activeFilePath: state.currentFile?.path || null, // <-- Use state.currentFile from AppStateContext
      itemOrder: state.ui.itemOrder || {},
      // UI Preferences & Editor State from AppStateContext
      preferences: { ...(state.ui.preferences || {}) }, 
      editorSelections: { ...(state.editor.selections || {}) },
      editorCursorPositions: { ...(state.editor.cursorPositions || {}) },
      editorFontSize: state.editor.fontSize || 14, // Default if undefined
      // Layout settings
      splitSizes: splitSizes, // Include Split component sizes
    };
  }, [
    state.ui.activeRootFolders,
    state.ui.activeExpandedNodes,
    state.openFiles, // from AppStateContext
    state.currentFile, // <-- Changed from useFiles().currentFile to AppStateContext.currentFile
    state.ui.itemOrder,
    state.ui.preferences,
    state.editor.selections,
    state.editor.cursorPositions,
    state.editor.fontSize,
    splitSizes, // Add splitSizes to dependencies
  ]);

  // Effect to save current workspace state on application close
  useEffect(() => {
    const handleBeforeUnload = () => {
      const activeNameFromContext = state.activeNamedWorkspaceName; // Current active named workspace in context
      let nameForLastActiveKey;
      let dataToSaveForSession;

      if (activeNameFromContext) {
        // If there's an active named workspace, its current state will be saved under its name.
        console.log(`[App BeforeUnload] Active named workspace is '${activeNameFromContext}'. Its state will be updated.`);
        nameForLastActiveKey = activeNameFromContext;
        dataToSaveForSession = gatherComprehensiveWorkspaceData(activeNameFromContext);
        // Dispatch to update context state (good for consistency if app doesn't close immediately)
        saveNamedWorkspace(activeNameFromContext, dataToSaveForSession);
      } else {
        // No active named workspace, save current state as __last_session__
        console.log("[App BeforeUnload] No active named workspace. Saving current state as __last_session__");
        nameForLastActiveKey = '__last_session__';
        dataToSaveForSession = gatherComprehensiveWorkspaceData(nameForLastActiveKey);
        saveNamedWorkspace(nameForLastActiveKey, dataToSaveForSession); // Save __last_session__ to context
      }

      // Manually prepare and save the 'savedWorkspaceStates' map to localStorage.
      // This ensures the latest data for 'nameForLastActiveKey' (either the active named one or __last_session__) is included.
      const currentSavedStatesFromContext = state.savedWorkspaceStates || {};
      const updatedSavedWorkspaceStates = {
        ...currentSavedStatesFromContext,
        [nameForLastActiveKey]: dataToSaveForSession // Overwrites/adds the session being saved
      };

      try {
        // Persist the map of all saved workspaces (including the one just processed)
        localStorage.setItem('savedMdViewerWorkspaceStates', JSON.stringify(updatedSavedWorkspaceStates));
        // Persist the pointer to the one that should be loaded next time
        localStorage.setItem('lastActiveMdViewerWorkspaceName', nameForLastActiveKey);
        console.log(`[App BeforeUnload] Manually saved/updated workspace '${nameForLastActiveKey}' in 'savedMdViewerWorkspaceStates' and set 'lastActiveMdViewerWorkspaceName' in localStorage.`);
      } catch (e) {
        console.error('[App BeforeUnload] Error manually saving workspace data to localStorage:', e);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [
    state.activeNamedWorkspaceName,
    state.savedWorkspaceStates, // Ensures 'currentSavedStatesFromContext' is up-to-date
    gatherComprehensiveWorkspaceData,
    saveNamedWorkspace // The dispatch action from useAppState
    // Dependencies from gatherComprehensiveWorkspaceData are implicitly handled by its useCallback
  ]);

  // Inside App function, add new state variable for split sizes after other state variables
  const [splitSizes, setSplitSizes] = useState([25, 37.5, 37.5]); // Default split sizes

  // Load split sizes from electron store when the app starts
  useEffect(() => {
    async function loadSavedSplitSizes() {
      try {
        const savedSizes = await window.api.getStoreValue('splitSizes');
        if (savedSizes && Array.isArray(savedSizes) && savedSizes.length === 3) {
          setSplitSizes(savedSizes);
        }
      } catch (error) {
        console.error('Failed to load saved split sizes:', error);
      }
    }

    loadSavedSplitSizes();
  }, []);

  // Add a handler for Split onDragEnd to save the new sizes
  const handleSplitDragEnd = (newSizes) => {
    // Only update if we have valid sizes
    if (newSizes && 
        newSizes.length === 3 && 
        newSizes.every(size => !isNaN(size))) {
      
      // Update local state
      setSplitSizes(newSizes);
      
      // Save to electron store
      window.api.setStoreValue('splitSizes', newSizes)
        .catch(error => console.error('Error saving split sizes:', error));
      
      // Force layout recalculation after resize
      window.dispatchEvent(new Event('resize'));
    }
  };

  // Add state for tracking detached windows
  const [detachedEditors, setDetachedEditors] = useState(new Map());
  const [isEditorDetached, setIsEditorDetached] = useState(false);
  
  // Generate a unique content ID for a file
  const getContentId = useCallback((file) => {
    return file ? `editor-${file.path}` : 'editor-untitled';
  }, []);
  
  // Check if current file's editor is detached
  useEffect(() => {
    if (currentFile) {
      const contentId = getContentId(currentFile);
      setIsEditorDetached(detachedEditors.has(contentId));
    } else {
      setIsEditorDetached(false);
    }
  }, [currentFile, detachedEditors, getContentId]);
  
  // Function to detach the editor into a separate window
  const handleDetachEditor = useCallback(async () => {
    if (!currentFile) return;
    
    // If editor is already detached, just return (clicking the button when detached doesn't do anything)
    if (isEditorDetached) return;
    
    const contentId = getContentId(currentFile);
    
    // Get cursor position safely
    let cursorPosition = null;
    try {
      if (editorRef.current && typeof editorRef.current.getCursorPosition === 'function') {
        cursorPosition = editorRef.current.getCursorPosition();
      } else if (editorRef.current && typeof editorRef.current.getCurrentCursorPosition === 'function') {
        // Fallback to getCurrentCursorPosition if getCursorPosition is not available
        cursorPosition = editorRef.current.getCurrentCursorPosition();
      }
    } catch (error) {
      console.error('Error getting cursor position:', error);
    }
    
    // Store content for the detached window to access
    window.__DETACHED_CONTENT__ = window.__DETACHED_CONTENT__ || {};
    window.__DETACHED_CONTENT__[contentId] = {
      content,
      cursorPosition,
      file: currentFile
    };
    
    // Create the detached window
    const result = await window.api.createDetachedWindow({
      title: `Editor - ${currentFile.name}`,
      width: 800,
      height: 600,
      contentId,
      fileInfo: currentFile
    });
    
    if (result.success) {
      // Track this detached window
      setDetachedEditors(prev => {
        const newMap = new Map(prev);
        newMap.set(contentId, result.windowId);
        return newMap;
      });
      
      // Set the editor as detached
      setIsEditorDetached(true);
    }
  }, [currentFile, content, editorRef]);
  
  // Set up listener for content updates from detached windows
  useEffect(() => {
    if (window.detachedAPI) {
      // We're in a detached window
      const isDetached = window.detachedAPI.isDetachedWindow();
      if (isDetached) {
        const contentId = window.detachedAPI.getContentId();
        const fileInfo = window.detachedAPI.getFileInfo();
        
        // Get initial content from main window
        window.api.getDetachedContent(contentId).then(data => {
          if (data) {
            // Set content
            setContent(data.content);
            
            // Set cursor position in state and editor
            if (data.cursorPosition) {
              // Update the cursor position state directly
              setCursorPosition(data.cursorPosition);
              
              // Also update the editor cursor if available
              if (editorRef.current) {
                editorRef.current.setCursorPosition(data.cursorPosition);
              }
            }
            
            // Load the file
            if (fileInfo.path) {
              // Find the file in the file tree or create a new file object
              const detachedFile = {
                path: fileInfo.path,
                name: fileInfo.name
              };
              
              setCurrentFile(detachedFile);
            }
          }
        });
        
        // Listen for content updates
        const unsubscribe = window.detachedAPI.onContentUpdate(data => {
          if (data.contentId === contentId) {
            // Update content
            setContent(data.content);
            
            // Update cursor position state and editor
            if (data.cursorPosition) {
              // Update state first
              setCursorPosition(data.cursorPosition);
              
              // Then try to update the editor
              if (editorRef.current) {
                editorRef.current.setCursorPosition(data.cursorPosition);
              }
            }
          }
        });
        
        return () => unsubscribe();
      } else {
        // We're in the main window - set up a listener for updates from detached windows
        const handleUpdatesFromDetachedWindows = (data) => {
          const { contentId, content: newContent, cursorPosition } = data;
          
          // Find the file that corresponds to this contentId
          const file = openFiles.find(file => getContentId(file) === contentId);
          
          if (file) {
            console.log('Received content update from detached window for file:', file.path);
            
            // Mark file as dirty (unsaved changes)
            if (file.path) {
              setFileDirty(file, true);
              
              // If this is the currently open file, also update the editor content
              if (file.path === currentFile?.path) {
                // Use updateContent to update the content in the editor
                console.log('Updating editor content with content from detached window');
                updateContent(newContent);
                
                // Also update cursor position if available
                if (cursorPosition && editorRef.current) {
                  editorRef.current.setCursorPosition(cursorPosition);
                  setCursorPosition(cursorPosition);
                }
              }
            }
          }
        };

        // Register the listener using the API we defined in preload.js
        const unsubscribe = window.api.onDetachedContentUpdate(handleUpdatesFromDetachedWindows);
        
        // Clean up listener on unmount
        return () => {
          unsubscribe();
        };
      }
    }
  }, [getContentId, currentFile, openFiles, editorRef, updateContent]);
  
  // Sync content changes to detached windows
  useEffect(() => {
    if (currentFile && detachedEditors.size > 0) {
      const contentId = getContentId(currentFile);
      
      // Get cursor position safely
      let cursorPosition = null;
      try {
        if (editorRef.current && typeof editorRef.current.getCursorPosition === 'function') {
          cursorPosition = editorRef.current.getCursorPosition();
        } else if (editorRef.current && typeof editorRef.current.getCurrentCursorPosition === 'function') {
          // Fallback to getCurrentCursorPosition if getCursorPosition is not available
          cursorPosition = editorRef.current.getCurrentCursorPosition();
        }
      } catch (error) {
        console.error('Error getting cursor position for sync:', error);
      }
      
      // If we have a detached window for this file, update its content
      if (detachedEditors.has(contentId)) {
        console.log('Sending content update to detached window for file:', currentFile.path);
        window.api.updateDetachedContent(contentId, content, cursorPosition);
      }
    }
  }, [content, currentFile, detachedEditors, editorRef, getContentId]);
  
  // Listen for detached window closed events
  useEffect(() => {
    if (!window.detachedAPI || !window.detachedAPI.isDetachedWindow()) {
      // Only run this in the main window
      const handleDetachedWindowClosed = (contentId) => {
        console.log(`Detached window closed for contentId: ${contentId}`);
        
        // Find the file associated with this contentId
        const fileWithThisContentId = openFiles.find(file => getContentId(file) === contentId);
        
        if (fileWithThisContentId) {
          console.log(`Resetting detached state for file: ${fileWithThisContentId.path}`);
          
          // Remove from detached editors map
          setDetachedEditors(prev => {
            const newMap = new Map(prev);
            newMap.delete(contentId);
            return newMap;
          });
          
          // Reset detached state if this is the current file
          if (currentFile && getContentId(currentFile) === contentId) {
            setIsEditorDetached(false);
          }
        }
      };
      
      // Register the listener
      const unsubscribe = window.api.onDetachedWindowClosed(handleDetachedWindowClosed);
      
      // Clean up listener on unmount
      return () => {
        unsubscribe();
      };
    }
  }, [currentFile, openFiles, getContentId]);
  
  // Original handleContentChange will be updated instead of duplicated

  // Apply detached window class to body if needed
  useEffect(() => {
    if (window.detachedAPI && window.detachedAPI.isDetachedWindow()) {
      document.body.classList.add('detached-window');
      
      // Set the document title to include the file name
      const fileInfo = window.detachedAPI.getFileInfo();
      if (fileInfo && fileInfo.name) {
        document.title = `${fileInfo.name} - Detached Editor`;
      } else {
        document.title = "Detached Editor";
      }
      
      // Cleanup function to remove class when component unmounts
      return () => {
        document.body.classList.remove('detached-window');
      };
    }
  }, []);

  // Check if this is a detached window
  const isDetachedWindow = window.detachedAPI && window.detachedAPI.isDetachedWindow();
  
  // If this is a detached window, only render the editor pane
  if (isDetachedWindow) {
    const contentId = window.detachedAPI.getContentId();
    const fileInfo = window.detachedAPI.getFileInfo();
    
    // Make sure cursor position is initialized (safeguard against the error)
    useEffect(() => {
      if (!cursorPosition) {
        setCursorPosition({ line: 1, column: 1 });
      }
    }, [cursorPosition]);
    
    // Additional useEffect to ensure immediate synchronization when content changes in detached window
    useEffect(() => {
      if (content && contentId && window.api) {
        // Get cursor position safely
        let currentCursorPosition = null;
        try {
          if (editorRef.current && typeof editorRef.current.getCursorPosition === 'function') {
            currentCursorPosition = editorRef.current.getCursorPosition();
          } else if (editorRef.current && typeof editorRef.current.getCurrentCursorPosition === 'function') {
            currentCursorPosition = editorRef.current.getCurrentCursorPosition();
          }
        } catch (error) {
          console.error('Error getting cursor position for detached sync:', error);
        }
        
        // Try both update methods for reliable synchronization
        // 1. Update the detached content record in main process
        if (window.api.updateDetachedContent) {
          window.api.updateDetachedContent(contentId, content, currentCursorPosition)
            .catch(err => console.error('Error with updateDetachedContent in useEffect:', err));
        }
        
        // 2. Send update directly to main window
        if (window.api.updateMainContent) {
          window.api.updateMainContent(contentId, content, currentCursorPosition)
            .catch(err => console.error('Error with updateMainContent in useEffect:', err));
        }
      }
    }, [content, contentId, editorRef]);

    // Create a single-item array for tabs display
    const detachedOpenFiles = fileInfo ? [fileInfo] : [];
    
    // Simplified layout for detached window
    return (
      <div className="detached-editor-container h-full flex flex-col">
        {/* Tabs section */}
        <div className="editor-tabs-container flex-shrink-0">
          <EditorTabs 
            currentFile={fileInfo}
            openFiles={detachedOpenFiles}
            onTabChange={() => {}} // No-op since there's only one tab
            onTabClose={() => {}} // No-op, can't close the only tab
            onNewTab={() => {}}   // No-op in detached mode
            isPreviewVisible={false}
            isEditorFullscreen={false}
            onToggleEditorVisibility={() => {}}
            onToggleFullscreen={() => {}}
            onDetachEditor={() => {}}
            isEditorDetached={true}
          />
        </div>
        
        {/* Toolbar section */}
        <div className="toolbar-container flex-shrink-0 flex items-center w-full">
          <MarkdownToolbar 
            onAction={handleToolbarAction} 
            onUndo={handleUndo}
            onRedo={handleRedo}
            onSearch={handleSearch}
            onReplace={handleReplace}
            onReplaceAll={handleReplaceAll}
          />
        </div>
        
        {/* Editor section */}
        <div className="detached-editor-content flex-grow relative">
          <MarkdownEditor
            ref={editorRef}
            content={content}
            filePath={fileInfo?.path}
            onChange={handleContentChange}
            onCursorChange={handleCursorChange}
            onScroll={handleEditorScroll}
            className="w-full h-full absolute inset-0"
          />
        </div>
        
        {/* Footer with file info */}
        <div className="detached-editor-footer flex justify-between bg-surface-100 dark:bg-surface-800 p-2 border-t border-surface-200 dark:border-surface-700 text-sm text-surface-600 dark:text-surface-400">
          <div>{fileInfo?.path || ''}</div>
          <div>
            Line: {cursorPosition?.line || 1}, Column: {cursorPosition?.column || 1}
          </div>
        </div>
      </div>
    );
  }
  
  // Regular app rendering for the main window
  return (
    <div className="app-container h-full flex flex-col bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100">
      <header className="bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-surface-100 p-2 border-b border-surface-200 dark:border-surface-700" role="banner">
         {/* Main flex container spanning full width, with responsive gap */}
         <div className="w-full flex items-center justify-between gap-2 md:gap-4"> {/* Changed container to w-full, responsive gap */}

           {/* 1. Saved State Tabs Container (Takes remaining space, scrolls) */}
           <WorkspaceStateTabs
             savedWorkspaceStates={savedWorkspaceStates} 
             activeNamedWorkspaceName={activeNamedWorkspaceName} 
             onLoadState={triggerLoadWorkspaceState} 
             onRemoveState={handleRemoveWorkspaceState} 
             onRenameWorkspaceState={handleRenameWorkspaceState} // Pass the new handler
             onStateReorder={handleStateReorder} 
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
            'display': (dimension === 0 && !sidebarVisible) || 
                       (dimension === 1 && (!isEditorContainerVisible || !sidebarVisible)) ? 
                       'none' : undefined,
          })}
          onDragStart={() => {
            // Set a flag to prevent other operations during drag
            window._isDraggingSplitPane = true;
          }}
          onDragEnd={(newSizes) => {
            // Clear flag
            window._isDraggingSplitPane = false;
            // Only update when all components are visible to avoid saving bad sizes
            if (sidebarVisible && isEditorContainerVisible && previewVisible) {
              handleSplitDragEnd(newSizes);
            } else {
              // Force layout recalculation even if we don't save the sizes
              window.dispatchEvent(new Event('resize'));
            }
          }}
        >
          {/* Pane 1: Sidebar */}
          <aside className={`bg-surface-100 dark:bg-surface-800 border-r border-surface-300 dark:border-surface-700 overflow-hidden flex-shrink-0 flex flex-col ${!sidebarVisible ? 'hidden' : ''} ${isEditorFullscreen ? 'hidden' : ''}`} role="complementary" aria-label="Sidebar">
            
            {/* --- START: Add Save State Button to Sidebar Top --- */}
            {isProjectOpen && (
              <div className="flex-shrink-0 p-2 border-b border-surface-200 dark:border-surface-700"> {/* Container with padding and border */}
                <button
                  onClick={activeNamedWorkspaceName ? handleClearWorkspace : handleSaveProject}
                  className={`btn btn-primary flex items-center justify-center gap-2 w-full`} 
                  title={activeNamedWorkspaceName ? "Clear Current Workspace (New Workspace)" : "Save Current Project Workspace"}
                  disabled={loading || (!activeNamedWorkspaceName && (!isProjectOpen || activeRootFolders.length === 0))}
                >
                  {loading && !activeNamedWorkspaceName ? ( 
                    <>
                      <LoadingSpinner size="sm" color="white" className="mr-1" />
                      {!isMobile && "Saving..."}
                    </>
                  ) : activeNamedWorkspaceName ? (
                    <>
                      <IconEraser size={20} className="mr-1" />
                      {isMobile ? "New" : "New Workspace"}
                    </>
                  ) : (
                    <>
                      <IconDeviceFloppy size={20} className="mr-1" />
                      {isMobile ? "Save" : "Save Workspace"}
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
                           itemOrderVersion={itemOrderVersion} // Pass the new state
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
             {/* <div className="flex-shrink-0 bg-surface-100 dark:bg-surface-800 p-2 border-t border-surface-200 dark:border-surface-700 space-y-2"> */}
               {/* The New Workspace button that was here has been removed. Its functionality is merged with the Save Workspace button at the top of the sidebar. */}
               {/* <button
                 onClick={openAndScanFolder} // Use the existing handler from App
                 className="w-full px-3 py-1 border border-surface-300 dark:border-surface-600 rounded text-sm hover:bg-surface-200 dark:hover:bg-surface-700 flex items-center justify-center gap-2"
               >
                 <IconFolderPlus size={16} />
                 Add Folder
               </button> */}
             {/* </div> */}
          </aside>
          
          {/* Pane 2: Editor - Moved from nested split */}
          <div 
             className={`editor-pane flex flex-col h-full overflow-auto ${!isEditorContainerVisible ? 'hidden' : ''} ${isEditorFullscreen ? 'editor-fullscreen-active' : ''}`} 
             role="region" 
             aria-label="Editor"
          >
            {/* div.editor-area-wrapper is removed. Its children are now direct children of editor-pane. */}
            {/* Editor Tabs */}
            <div className="editor-tabs-container flex-shrink-0 pointer-events-auto"> {/* Ensure tabs don't grow */}
              <div className="flex justify-between items-center">
                <EditorTabs 
                  currentFile={currentFile}
                  openFiles={openFiles}
                  onTabChange={handleTabChange}
                  onTabClose={handleTabClose}
                  onNewTab={handleNewTab}
                  onTabReorder={handleTabReorder}
                  onToggleEditorVisibility={toggleEditorEye}
                  isPreviewVisible={previewVisible}
                  isEditorFullscreen={isEditorFullscreen}
                  onToggleFullscreen={() => setIsEditorFullscreen(!isEditorFullscreen)}
                  FullscreenMaximizeIcon={IconArrowsMaximize}
                  FullscreenMinimizeIcon={IconArrowsMinimize}
                  onDetachEditor={handleDetachEditor}
                  isEditorDetached={isEditorDetached}
                />
                {/* Detach button moved to EditorTabs component */}
              </div>
            </div>
            
            {/* Toolbar */}
            <div className="toolbar-container flex-shrink-0 flex items-center w-full"> {/* Ensure toolbar doesn't grow, added flex items-center AND w-full */}
              <MarkdownToolbar 
                onAction={handleToolbarAction} 
                onUndo={handleUndo}
                onRedo={handleRedo}
                onSearch={handleSearch}
                onReplace={handleReplace}
                onReplaceAll={handleReplaceAll}
              />
              {/* Fullscreen Toggle Button REMOVED from here */}
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
                filePath={currentFile ? currentFile.path : null} // Pass filePath
                onChange={handleContentChange}
                onCursorChange={handleCursorChange} // This can remain if App.jsx needs direct line/col updates
                onScroll={handleEditorScroll} // This scroll handler is now on the correct element
                inScrollSync={scrollSyncEnabled}
                scrollSource={scrollSource}
                className="w-full h-full absolute inset-0" // Make editor fill container
              />
            </div>
          </div>

          {/* Pane 3: Preview - Moved from nested split */}
          <div 
            className={`preview-pane flex flex-col h-full overflow-auto ${!previewVisible ? 'hidden' : ''} ${isEditorFullscreen ? 'hidden' : ''}`} // ADDED: ${isEditorFullscreen ? 'hidden' : ''}
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
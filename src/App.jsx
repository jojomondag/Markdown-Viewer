import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IconFolderOpen, IconSettings, IconX, IconEye, IconLink, IconUnlink, IconZoomIn, IconZoomOut, IconZoomReset, IconPrinter, IconSortAscending, IconSortDescending, IconTrash, IconEyeOff } from '@tabler/icons-react';
import Split from 'react-split';
// import { newFilesInProgress } from './components/FileExplorer'; // Remove reference to deleted file
import FileExplorer from './components/ArboristFileExplorer'; // Use Arborist explorer
import FileHistory from './components/FileHistory';
import MarkdownEditor from './components/MarkdownEditor';
import MarkdownPreview from './components/MarkdownPreview';
import SidebarTabs from './components/SidebarTabs';
import ThemeToggle from './components/ThemeToggle';
import StatusBar from './components/StatusBar';
import MarkdownToolbar from './components/MarkdownToolbar';
import LoadingOverlay from './components/LoadingOverlay';
import LoadingSpinner from './components/LoadingSpinner';
import SettingsPanel from './components/SettingsPanel';
import AccessibilityHelper from './components/AccessibilityHelper';
import { NotificationProvider } from './context/NotificationContext';
import { SettingsProvider } from './context/SettingsContext';
import { AppStateProvider, useAppState } from './context/AppStateContext';
import useFiles from './hooks/useFiles';
import { registerGlobalShortcuts } from './utils/keyboardShortcuts';
import useNotification from './hooks/useNotification';
import { useSettings } from './context/SettingsContext';
import EditorTabs from './components/EditorTabs';
import FileSearch from './components/FileSearch';
import { isValidDrop, createDropDestination } from './utils/fileOperations';
import path from 'path';
import { getDirname, getBasename } from './utils/pathUtils'; // Import path utils

function App() {
  console.log('[App] Component rendering');
  const editorRef = useRef(null);
  const editorContainerRef = useRef(null);
  const previewRef = useRef(null);
  const previousContentRef = useRef('');
  const prevLoadingRef = useRef(false);
  const prevCurrentFileRef = useRef(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [previewVisible, setPreviewVisible] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [customCSS, setCustomCSS] = useState('');
  const [isEditorContainerVisible, setIsEditorContainerVisible] = useState(true);
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
  const { showSuccess, showError, showInfo } = useNotification();
  
  // Get settings
  const { settings } = useSettings();
  
  // Get app state
  const { 
    state,
    setLoading,
    setUnsavedChanges,
    setSidebarTab,
    setPanel,
    addToHistory,
    addOpenFile,
    removeOpenFile,
    updateOpenFile,
    setFileDirty,
    updatePreferences
  } = useAppState();
  
  // Get open files from app state
  const openFiles = state.openFiles;
  
  // Track the current folder path
  const [currentFolders, setCurrentFolders] = useState([]);
  
  // Add state for file explorer sort settings
  const [explorerSortBy, setExplorerSortBy] = useState(state.ui.preferences.explorerSortBy || 'name');
  const [explorerSortDirection, setExplorerSortDirection] = useState(state.ui.preferences.explorerSortDirection || 'asc');
  
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
        
        // Update the list of root folders
        setCurrentFolders(prev => { 
          console.log('[App] setCurrentFolders: Previous state:', prev);
          const newFolders = [...prev];
          result.folderPaths.forEach(folderPath => {
            const normalizedPath = folderPath.replace(/\\/g, '/');
            const alreadyExists = newFolders.some(
              existingPath => existingPath.replace(/\\/g, '/') === normalizedPath
            );
            if (!alreadyExists) {
              console.log(`[App] setCurrentFolders: Adding new path: ${folderPath}`);
              newFolders.push(folderPath);
            }
          });
          console.log('[App] setCurrentFolders: New state:', newFolders); 
          return newFolders; 
        });
        
        // --- FIX: Call scanFolder for each selected path --- 
        console.log('[App] Calling scanFolder for each selected path...');
        for (const folderPath of result.folderPaths) {
          await scanFolder(folderPath, true); // Call scanFolder in add mode
        }
        console.log('[App] Finished calling scanFolder for all paths.');
        // --- End Fix ---
        
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
      
      setLoading({ files: true });
      
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
              !prevFolders.some(existingFolder => existingFolder.path === newFolder.path)
            );
            console.log('[scanFolder] setFolders: Adding root folder:', rootFolder); // Log root folder to add
            console.log('[scanFolder] setFolders: Adding unique subfolders:', uniqueSubFolders); // Log unique subfolders to add
            // Always include the root folder + unique subfolders
            const newState = [...prevFolders, rootFolder, ...uniqueSubFolders]; 
            console.log('[scanFolder] setFolders: New state count:', newState.length); // Log new folders count
            return newState;
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
      setLoading({ files: false });
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
      
      // Explorer operations
      TOGGLE_SORT_DIRECTION: () => {
        const newDirection = explorerSortDirection === 'asc' ? 'desc' : 'asc';
        handleExplorerSortChange(explorerSortBy, newDirection);
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
    handleExplorerSortChange,
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
    if (!sidebarVisible) return [0, 100];
    
    // On mobile, sidebar takes up more space when open
    if (isMobile) {
      return [80, 20]; // Sidebar takes 80% on mobile when open
    }
    
    return [settings.ui.sidebarWidth, 100 - settings.ui.sidebarWidth];
  };
  
  const getEditorPreviewSizes = () => {
    if (!previewVisible) return [100, 0];
    if (!isEditorContainerVisible) return [0, 100]; // When editor is hidden, preview takes 100%
    
    // On mobile, stack editor and preview when both are visible
    if (isMobile) {
      return [50, 50]; // Equal sizing for vertical layout
    }
    
    return [100 - settings.ui.previewWidth, settings.ui.previewWidth];
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
      setLoading('files', loading);
      setLoading('content', loading && !!currentFile);
    }
    
    prevCurrentFileRef.current = currentFile;
    prevLoadingRef.current = loading;
  }, [loading, currentFile, setLoading]);
  
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
    if (file.path !== currentFile?.path) {
      // If there are unsaved changes, confirm before switching
      if (currentFile && openFiles.find(f => f.path === currentFile.path)?.isDirty) {
        const confirmed = window.confirm(`You have unsaved changes in ${currentFile.name}. Continue?`);
        if (!confirmed) return;
      }
      
      // Open the selected file
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

  // Add new file operation handlers
  const handleMoveFile = (sourceItem, targetItem) => {
    // Check if this is a valid drop
    if (!isValidDrop(sourceItem, targetItem)) {
      console.log('Cannot move to this location');
      return;
    }
    
    const newPath = createDropDestination(sourceItem, targetItem);
    
    // In a real app, you would perform actual file operations here
    if (sourceItem.type === 'file') {
      setFiles(prevFiles => {
        // Remove the file from its old location
        const updatedFiles = prevFiles.filter(f => f.path !== sourceItem.path);
        // Add it to its new location
        updatedFiles.push({
          ...sourceItem,
          path: newPath,
          name: path.basename(newPath)
        });
        return updatedFiles;
      });
    } else {
      // For folders, update all files and subfolders within that folder
      const folderPrefix = sourceItem.path + '/';
      const newPrefix = newPath + '/';
      
      // Update folders
      setFolders(prevFolders => {
        const updatedFolders = prevFolders.filter(f => f.path !== sourceItem.path);
        
        // Move the folder itself
        updatedFolders.push({
          ...sourceItem,
          path: newPath,
          name: path.basename(newPath)
        });
        
        // Move all subfolders
        prevFolders.forEach(folder => {
          if (folder.path !== sourceItem.path && folder.path.startsWith(folderPrefix)) {
            const relativePath = folder.path.substring(folderPrefix.length);
            const updatedPath = newPrefix + relativePath;
            updatedFolders.push({
              ...folder,
              path: updatedPath,
              name: path.basename(updatedPath)
            });
          }
        });
        
        return updatedFolders;
      });
      
      // Update files
      setFiles(prevFiles => {
        const updatedFiles = [...prevFiles];
        
        // Move all files within the folder
        prevFiles.forEach((file, index) => {
          if (file.path.startsWith(folderPrefix)) {
            const relativePath = file.path.substring(folderPrefix.length);
            const updatedPath = newPrefix + relativePath;
            
            // Replace the file with updated path
            updatedFiles[index] = {
              ...file,
              path: updatedPath,
              name: path.basename(updatedPath)
            };
          }
        });
        
        return updatedFiles;
      });
    }
  };

  // Add handler for file/folder deletion
  const handleDeleteFile = useCallback((filePath, isDirectory) => {
    if (isDirectory) {
      console.log(`Deleting folder: ${filePath}`);
      
      // Remove folder and all subfolders
      setFolders(prevFolders => 
        prevFolders.filter(folder => 
          folder.path !== filePath && !folder.path.startsWith(filePath + '/')
        )
      );
      
      // Remove all files in the folder
      setFiles(prevFiles => 
        prevFiles.filter(file => 
          !file.path.startsWith(filePath + '/')
        )
      );
      
      // Close any open files from that folder
      openFiles.forEach(file => {
        if (file.path.startsWith(filePath + '/')) {
          removeOpenFile(file);
        }
      });
      
      showSuccess(`Deleted folder ${path.basename(filePath)}`);
    } else {
      console.log(`Deleting file: ${filePath}`);
      
      // Remove the file
      setFiles(prevFiles => 
        prevFiles.filter(file => file.path !== filePath)
      );
      
      // If the file is open, close it
      const openFile = openFiles.find(file => file.path === filePath);
      if (openFile) {
        removeOpenFile(openFile);
      }
      
      // If it's the current file, clear the editor
      if (currentFile && currentFile.path === filePath) {
        // In a real app, you might want to switch to another open file
        // For now, we'll just clear the current file
        originalOpenFile(null);
      }
      
      showSuccess(`Deleted file ${path.basename(filePath)}`);
    }
  }, [openFiles, removeOpenFile, currentFile, originalOpenFile, showSuccess]);

  // Add handler for creating new folders
  const handleCreateFolder = useCallback((folderData) => {
    console.log('[App] handleCreateFolder called with folderData:', folderData); // Log entry
    
    // Extract just the basename for the folder name
    const folderBasename = path.basename(folderData.path);
    console.log('[App] handleCreateFolder - Using basename for folder display:', folderBasename);
    
    // Add the new folder to the folders list
    setFolders(prevFolders => {
      console.log('[App] handleCreateFolder - setFolders: Previous count:', prevFolders.length); // Log prev count
      const newFolderObject = {
        ...folderData,
        // Ensure we use only the basename without any path components
        name: folderBasename,
        displayName: folderBasename, // Explicitly add displayName
        type: 'folder'
      };
      console.log('[App] handleCreateFolder - setFolders: Adding new folder object:', newFolderObject); // Log new object
      const newState = [...prevFolders, newFolderObject];
      console.log('[App] handleCreateFolder - setFolders: New count:', newState.length); // Log new count
      return newState;
    });
    
    // Use the basename of the folder name for the success message
    showSuccess(`Created folder: ${folderBasename}`);
    console.log('[App] handleCreateFolder finished.'); // Log finish
  }, [showSuccess]);

  // Add handler for creating new files
  const handleCreateFile = useCallback((fileData) => {
    console.log('Created new file:', fileData);
    
    // Add the new file to the files list
    setFiles(prevFiles => [...prevFiles, {
      ...fileData,
      name: path.basename(fileData.path),
      type: 'file'
    }]);
    
    // Don't open the file after creation - it will be opened after renaming
    // openFile(fileData); - removing this line
    
    showSuccess(`Created file: ${fileData.name}`);
  }, [showSuccess]);

  // Add handler for sort changes - memoize it with useCallback to prevent infinite loop
  const handleExplorerSortChange = useCallback((sortBy, direction) => {
    setExplorerSortBy(sortBy);
    setExplorerSortDirection(direction);
    
    // Save to preferences
    updatePreferences({
      explorerSortBy: sortBy,
      explorerSortDirection: direction
    });
  }, [updatePreferences]);

  // Add a wrapper for clearFolders
  const clearAllFolders = () => {
    originalClearFolders();
    setCurrentFolders([]);
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
      
      setLoading(true);
      const result = await window.api.deleteFolder(path);
      
      if (result.success) {
        showSuccess(`Folder deleted: ${folderName}`);
        
        // Refresh folders
        const refreshResult = await window.api.listFolders(currentFolders);
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
      setLoading(false);
    }
  };
  
  const handleMoveFolder = async (sourcePath, targetPath) => {
    try {
      if (!targetPath) return;
      
      setLoading(true);
      const result = await window.api.moveFolder(sourcePath, targetPath);
      
      if (result.success) {
        const folderName = sourcePath.split('/').pop().split('\\').pop();
        showSuccess(`Folder moved: ${folderName}`);
        
        // Refresh folders
        const refreshResult = await window.api.listFolders(currentFolders);
        if (refreshResult.success) {
          setFolders(refreshResult.folders);
        }
        
        // Refresh files
        const filesResult = await window.api.listFiles(currentFolders);
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
      setLoading(false);
    }
  };
  
  const handleCopyFile = async (path) => {
    try {
      setLoading(true);
      const result = await window.api.copyFile(path);
      
      if (result.success) {
        const fileName = path.split('/').pop().split('\\').pop();
        showSuccess(`File copied: ${fileName}`);
        
        // Refresh files
        const filesResult = await window.api.listFiles(currentFolders);
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
      setLoading(false);
    }
  };
  
  const handleCopyFolder = async (path) => {
    try {
      setLoading(true);
      const result = await window.api.copyFolder(path);
      
      if (result.success) {
        const folderName = path.split('/').pop().split('\\').pop();
        showSuccess(`Folder copied: ${folderName}`);
        
        // Refresh folders
        const refreshResult = await window.api.listFolders(currentFolders);
        if (refreshResult.success) {
          setFolders(refreshResult.folders);
        }
        
        // Refresh files
        const filesResult = await window.api.listFiles(currentFolders);
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
      setLoading(false);
    }
  };

  // *** NEW: Handler for renaming files/folders ***
  const handleRenameItem = async (oldPath, newPath, isDirectory) => {
    console.log(`[App] Renaming item: ${oldPath} -> ${newPath}, isDirectory: ${isDirectory}`);
    try {
      // Use the existing moveItem API which handles both files and folders
      // Note: main.js implements moveItem as copy+delete, not fs.rename directly
      const result = await window.api.moveItem(oldPath, newPath, isDirectory);
      
      if (!result || !result.success) {
        throw new Error(result?.message || 'Unknown error during rename/move');
      }

      // Update state
      if (isDirectory) {
        // Update the specific folder
        setFolders(prev => prev.map(f => f.path === oldPath ? { ...f, path: newPath, name: getBasename(newPath) } : f));
        // TODO: Need to recursively update paths of children folders and files if backend doesn't provide them
        // This might require re-scanning the parent directory or handling recursion here.
        // For now, just updating the main folder path.
      } else {
        // Update the specific file
        setFiles(prev => prev.map(f => f.path === oldPath ? { ...f, path: newPath, name: getBasename(newPath) } : f));
        
        // Update open file tabs if the renamed file was open
        const openFileIndex = openFiles.findIndex(f => f.path === oldPath);
        if (openFileIndex > -1) {
          const updatedOpenFile = { ...openFiles[openFileIndex], path: newPath, name: getBasename(newPath) };
          updateOpenFile(updatedOpenFile);
          // If the renamed file was the *current* file, update that too
          if (currentFile?.path === oldPath) {
             setCurrentFile(updatedOpenFile);
          }
        }
      }
      
      showSuccess(`Renamed to ${getBasename(newPath)}`);
      console.log('[App] Rename successful, state updated.');
      
    } catch (error) {
      console.error(`[App] Error renaming item: ${error.message}`);
      showError(`Failed to rename: ${error.message}`);
      // Optionally, trigger a rescan or revert state changes if needed
    }
  };

  return (
    <div className="app-container h-full flex flex-col bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100">
      <AccessibilityHelper />
      
      <header className="bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-surface-100 p-2 border-b border-surface-200 dark:border-surface-700" role="banner">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center justify-start space-x-2">
            <button
              onClick={openAndScanFolder}
              className="btn btn-primary flex items-center gap-2 w-full justify-center"
              title={`Add Folder (Ctrl+O)`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" color="white" className="mr-1" />
                  {!isMobile && "Adding..."}
                </>
              ) : (
                <>
                  <IconFolderOpen size={isMobile ? 16 : 18} className="mr-1" />
                  {isMobile ? "Add" : "Add Folder"}
                </>
              )}
            </button>
            
            {currentFolders.length > 0 && (
              <button 
                className="flex items-center bg-error-600 hover:bg-error-500 dark:bg-error-700 dark:hover:bg-error-600 px-2 py-1 rounded text-sm text-white"
                onClick={clearAllFolders}
                title="Clear all folders"
              >
                <IconTrash size={isMobile ? 16 : 18} className="mr-1" />
                {!isMobile && "Clear All"}
              </button>
            )}
            
            {state.editor.unsavedChanges && (
              <span className="ml-2 text-xs bg-warning-500 px-1.5 py-0.5 rounded">
                Unsaved
              </span>
            )}
          </div>
          
          <div className="flex justify-center">
            {/* App title or logo could go here */}
          </div>
          
          <div className="flex items-center justify-end space-x-2">
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
          className="flex-grow flex overflow-hidden"
          sizes={getSplitSizes()}
          minSize={sidebarVisible ? (isMobile ? 250 : 150) : 0}
          expandToMin={true}
          gutterSize={sidebarVisible ? 5 : 0}
          gutterAlign="center"
          snapOffset={30}
          dragInterval={1}
          direction="horizontal"
          cursor="col-resize"
          elementStyle={(dimension, size, gutterSize) => ({
            'flex-basis': `calc(${size}% - ${gutterSize}px)`,
          })}
          gutterStyle={(dimension, gutterSize) => ({
            'flex-basis': `${gutterSize}px`,
          })}
        >
          <aside className={`bg-surface-100 dark:bg-surface-800 border-r border-surface-300 dark:border-surface-700 overflow-hidden ${!sidebarVisible ? 'hidden' : ''}`} role="complementary" aria-label="Sidebar">
            <SidebarTabs activeTab={activeTab} onTabChange={handleSidebarTabChange}>
              <SidebarTabs.Pane id="files">
                <LoadingOverlay isLoading={state.loading.files} message="Loading files..." transparent preserveChildren={true}>
                  {error && (
                    <div className="p-4 text-sm text-error-500 bg-error-100 dark:bg-error-900/20 border-l-4 border-error-500 mb-2">
                      Error: {error}
                    </div>
                  )}
                  
                  {/* Add file history */}
                  {state.fileHistory.length > 0 && (
                    <FileHistory onFileSelect={openFile} />
                  )}
                  
                  {files.length > 0 || folders.length > 0 ? (
                    <FileExplorer 
                      files={files} 
                      folders={folders}
                      currentFolders={currentFolders}
                      currentFilePath={currentFile?.path}
                      onFileSelect={openFile} 
                      onDeleteFile={handleDeleteFile}
                      onCreateFile={handleCreateFile}
                      onCreateFolder={handleCreateFolder}
                      onDeleteFolder={handleDeleteFolder}
                      onMoveFile={handleMoveFile}
                      onMoveFolder={handleMoveFolder}
                      onCopyFile={handleCopyFile}
                      onCopyFolder={handleCopyFolder}
                      onScanFolder={async (folderPath, addMode) => {
                        console.log('[App] Prop onScanFolder called with:', { folderPath, addMode });
                        const result = await scanFolder(folderPath, addMode);
                        // If called in addMode from Arborist, update currentFolders here
                        if (addMode && folderPath) {
                          const normalizedPath = folderPath.replace(/\\/g, '/');
                          setCurrentFolders(prev => {
                            if (!prev.includes(normalizedPath) && !prev.includes(folderPath)) { // Check both formats just in case
                               console.log(`[App] Prop onScanFolder updating currentFolders with: ${folderPath}`);
                               return [...prev, folderPath]; // Add the original path format
                            }
                            return prev;
                          });
                        }
                        return result; // Return the result from the original scanFolder
                      }}
                      onRenameItem={handleRenameItem}
                    />
                  ) : (
                    <div className="text-sm text-surface-600 p-4">
                      No files loaded. Click "Open Folder" to get started.
                    </div>
                  )}
                </LoadingOverlay>
              </SidebarTabs.Pane>
              <SidebarTabs.Pane id="search">
                <FileSearch 
                  files={files} 
                  folders={folders} 
                  onFileSelect={openFile} 
                />
              </SidebarTabs.Pane>
            </SidebarTabs>
          </aside>
          
          <div className="flex-grow flex flex-col" role="region" aria-label="Content area">
            <Split
              key={`split-${isEditorContainerVisible ? 'editor' : 'no-editor'}-${previewVisible ? 'preview' : 'no-preview'}`}
              className={`flex overflow-hidden h-full ${isMobile ? 'flex-col' : ''}`}
              sizes={getEditorPreviewSizes()}
              minSize={previewVisible ? (isMobile ? 150 : 200) : 0}
              maxSize={!isEditorContainerVisible ? 0 : Infinity}
              gutterSize={(previewVisible && isEditorContainerVisible) ? 5 : 0}
              gutterAlign="center"
              snapOffset={30}
              dragInterval={1}
              direction={isMobile ? "vertical" : "horizontal"}
              cursor={isMobile ? "row-resize" : "col-resize"}
              elementStyle={(dimension, size, gutterSize) => ({
                'flex-basis': `calc(${size}% - ${gutterSize}px)`,
              })}
              gutterStyle={(dimension, gutterSize) => ({
                'flex-basis': `${gutterSize}px`,
              })}
              onDragEnd={() => {
                // Force layout recalculation after resize
                window.dispatchEvent(new Event('resize'));
              }}
            >
              <div className={`overflow-hidden flex flex-col h-full ${!isEditorContainerVisible ? 'hidden' : ''}`} role="region" aria-label="Editor">
                {/* Add editor tabs */}
                <div className="editor-tabs-container">
                  <EditorTabs 
                    currentFile={currentFile}
                    openFiles={openFiles}
                    onTabChange={handleTabChange}
                    onTabClose={handleTabClose}
                    onNewTab={handleNewTab}
                  />
                </div>
                
                <div className="toolbar-container">
                  <MarkdownToolbar 
                    onAction={handleToolbarAction} 
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    onToggleEditorVisibility={toggleEditorEye}
                    isEditorVisible={isEditorVisible}
                    onTogglePreviewVisibility={togglePreviewEye}
                    isPreviewVisible={previewVisible}
                    onSearch={handleSearch}
                    onReplace={handleReplace}
                    onReplaceAll={handleReplaceAll}
                  />
                </div>
                
                {/* EDITOR CONTAINER: Restructured to ensure proper input handling */}
                <div 
                  className={`editor h-full flex-grow overflow-hidden ${!isEditorVisible ? 'hidden' : ''}`} 
                  style={{ 
                    position: "relative", 
                    isolation: "isolate", // Create a stacking context
                    pointerEvents: "auto", // Ensure it captures pointer events
                    zIndex: 30, // Increase z-index to ensure it's above other elements
                    display: isEditorVisible ? "flex" : "none",
                    flexDirection: "column",
                    minHeight: "0",
                    width: "100%", // Ensure it takes full width of parent
                    height: "100%" // Ensure it takes full height of parent
                  }}
                >
                  {state.loading.content && !forcingScrollRef.current && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-surface-900/70 backdrop-blur-sm z-50 pointer-events-none">
                      <div className="pointer-events-none">
                        <LoadingSpinner />
                        <p className="mt-4 text-surface-700 dark:text-surface-300 font-medium">Loading content...</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Direct editor mount without unnecessary wrappers */}
                  <MarkdownEditor
                    ref={editorRef}
                    content={content}
                    onChange={handleContentChange}
                    onCursorChange={handleCursorChange}
                    onScroll={handleEditorScroll}
                    inScrollSync={scrollSyncEnabled}
                    scrollSource={scrollSource}
                    className="w-full h-full"
                  />
                </div>
              </div>
              
              <div 
                className={`overflow-hidden flex flex-col h-full ${!previewVisible ? 'hidden' : ''}`} 
                role="region" 
                aria-label="Preview"
                style={{
                  flexGrow: !isEditorContainerVisible ? 1 : 'unset',
                  width: !isEditorContainerVisible ? '100%' : 'unset',
                  minHeight: "0", // Allow shrinking
                  height: "100%" // Take full height
                }}
              >
                <div className="preview-header flex justify-between items-center p-2 border-b border-surface-300 dark:border-surface-700 bg-surface-100 dark:bg-surface-800">
                  <div className="flex items-center space-x-2">
                    <button
                      className="p-1 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600 rounded"
                      onClick={togglePreviewEye}
                      title={isEditorContainerVisible ? "Hide Editor" : "Show Editor"}
                    >
                      {isEditorContainerVisible ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                    </button>
                    <h3 className="text-sm font-medium">Preview</h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    {/* Zoom Controls */}
                    <div className="flex items-center space-x-1 mr-2">
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
                      className="p-1 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600 rounded"
                      onClick={handlePrintPreview}
                      title="Print Preview"
                    >
                      <IconPrinter size={16} />
                    </button>
                    
                    {/* Scroll Sync Toggle */}
                    <button
                      className={`p-1 rounded ${
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
                <div className="preview-container flex-grow overflow-hidden h-full" style={{ minHeight: "0", height: "100%" }}>
                  <LoadingOverlay isLoading={state.loading.content} message="Generating preview..." transparent preserveChildren={true}>
                    <MarkdownPreview 
                      ref={previewRef}
                      content={content}
                      onScroll={handlePreviewScroll}
                      customCSS={customCSS}
                      inScrollSync={scrollSyncEnabled}
                      scrollSource={scrollSource}
                      currentFilePath={currentFile?.path}
                    />
                  </LoadingOverlay>
                </div>
              </div>
            </Split>
          </div>
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
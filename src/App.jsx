import React, { useState, useEffect, useRef, useCallback } from 'react';
import { IconFileText, IconFolderOpen, IconSettings, IconX, IconEye, IconLink, IconUnlink, IconZoomIn, IconZoomOut, IconZoomReset, IconMaximize, IconPrinter, IconSort, IconSortAscending, IconSortDescending } from '@tabler/icons-react';
import Split from 'react-split';
import FileExplorer from './components/FileExplorer';
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
import AccessibilityHelper, { announceToScreenReader } from './components/AccessibilityHelper';
import { NotificationProvider } from './context/NotificationContext';
import { SettingsProvider } from './context/SettingsContext';
import { AppStateProvider, useAppState } from './context/AppStateContext';
import useFiles from './hooks/useFiles';
import { registerGlobalShortcuts, KEYBOARD_SHORTCUTS } from './utils/keyboardShortcuts';
import useNotification from './hooks/useNotification';
import { useSettings } from './context/SettingsContext';
import EditorTabs from './components/EditorTabs';
import FileSearch from './components/FileSearch';
import { isValidDrop, createDropDestination } from './utils/fileOperations';
import path from 'path';

function App() {
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
  const {
    files,
    folders,
    currentFile,
    content,
    loading,
    error,
    openAndScanFolder: originalOpenAndScanFolder,
    openFile: originalOpenFile,
    saveFile: originalSaveFile,
    updateContent,
    setFiles,
    setFolders
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
  const [currentFolder, setCurrentFolder] = useState(null);
  
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
  
  // Wrap the saveFile function to show notifications
  const saveFile = (content) => {
    try {
      originalSaveFile(content);
      
      // Clear dirty flag for the saved file
      if (currentFile) {
        setFileDirty(currentFile, false);
      }
      
      showSuccess(`File ${currentFile?.name} saved successfully!`);
    } catch (error) {
      showError(`Failed to save file: ${error.message}`);
    }
  };
  
  // Wrap the openFile function to show notifications and handle tabs
  const openFile = (file) => {
    try {
      // Check if file is already open
      const isAlreadyOpen = openFiles.some(f => f.path === file.path);
      
      if (!isAlreadyOpen) {
        // Add file to open files
        addOpenFile(file);
      }
      
      // Actually open the file
      originalOpenFile(file);
      showInfo(`Opened file: ${file.name}`);
      announceToScreenReader(`Opened file: ${file.name}`);
      
      // Add file to history
      addToHistory(file);
      
      // Focus the editor after opening the file
      setTimeout(() => {
        if (editorRef.current && editorRef.current.focus) {
          editorRef.current.focus();
        }
      }, 300);
    } catch (error) {
      showError(`Failed to open file: ${error.message}`);
      announceToScreenReader(`Error: Failed to open file`);
    }
  };
  
  // Wrap the openAndScanFolder function to show notifications
  const openAndScanFolder = async () => {
    try {
      const result = await originalOpenAndScanFolder();
      if (result && result.folderPath) {
        setCurrentFolder(result.folderPath);
      }
      showSuccess('Folder opened successfully!');
    } catch (error) {
      showError(`Failed to open folder: ${error.message}`);
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
        showInfo(`Sorting ${newDirection === 'asc' ? 'ascending' : 'descending'}`);
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
    showInfo,
    handleUndo,
    handleRedo
  ]);

  // Update isMobile state when window size changes
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
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
    
    // On mobile, stack editor and preview when both are visible
    if (isMobile) {
      return [50, 50]; // Equal sizing for vertical layout
    }
    
    return [100 - settings.ui.previewWidth, settings.ui.previewWidth];
  };

  // Announce file changes to screen readers
  useEffect(() => {
    if (currentFile) {
      announceToScreenReader(`Opened file: ${currentFile.name}`);
    }
  }, [currentFile]);

  // Update loading states
  useEffect(() => {
    // Skip if nothing has changed
    if (prevLoadingRef.current === loading && prevCurrentFileRef.current === currentFile) {
      return;
    }
    
    // Update app state only when loading or currentFile actually changes
    setLoading('files', loading);
    setLoading('content', loading && !!currentFile);
    
    // Update refs
    prevLoadingRef.current = loading;
    prevCurrentFileRef.current = currentFile;
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
    showInfo(`Scroll sync ${!scrollSyncEnabled ? 'enabled' : 'disabled'}`);
  };

  // Handle scroll synchronization
  const handleEditorScroll = (scrollInfo) => {
    // Skip tiny scroll amounts or resets to 0
    const scrollPercentage = scrollInfo.scrollPercentage;
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
      
      // Also clear any long timeout
      if (window._longScrollTimeout) {
        clearTimeout(window._longScrollTimeout);
      }
      
      scrollSyncTimeoutRef.current = setTimeout(() => {
        // Double-check the scroll position before clearing source
        if (previewRef.current) {
          const info = previewRef.current.getScrollInfo();
          if (info && Math.abs(info.scrollPercentage - scrollPercentage) > 0.05) {
            // Try one more time if the positions are very different
            previewRef.current.scrollToPosition(scrollPercentage);
          }
        }
        
        // Keep forcing scroll flag active for a shorter time to avoid lockups
        setTimeout(() => {
          forcingScrollRef.current = false;
        }, 500);
        
        // Clear the scroll source after a shorter delay
        const longTimeoutId = setTimeout(() => {
          // Only clear if not actively forcing
          if (!forcingScrollRef.current) {
            setScrollSource(null);
          }
        }, 500); // Shorter delay to allow scroll source to change
        
        // Store this timeout so we can clear it if user scrolls again
        window._longScrollTimeout = longTimeoutId;
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
      
      // Also clear any long timeout
      if (window._longScrollTimeout) {
        clearTimeout(window._longScrollTimeout);
      }
      
      scrollSyncTimeoutRef.current = setTimeout(() => {
        // Double-check the scroll position before clearing source
        if (editorRef.current) {
          const info = editorRef.current.getScrollInfo();
          if (info && Math.abs(info.scrollPercentage - scrollPercentage) > 0.05) {
            // Try one more time if the positions are very different
            editorRef.current.scrollToPosition(scrollPercentage);
          }
        }
        
        // Keep forcing scroll flag active for a shorter time to avoid lockups
        setTimeout(() => {
          forcingScrollRef.current = false;
        }, 500);
        
        // Clear the scroll source after a shorter delay
        const longTimeoutId = setTimeout(() => {
          // Only clear if not actively forcing
          if (!forcingScrollRef.current) {
            setScrollSource(null);
          }
        }, 500); // Shorter delay to allow scroll source to change
        
        // Store this timeout so we can clear it if user scrolls again
        window._longScrollTimeout = longTimeoutId;
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
      showInfo(`Zoom: ${newZoom}%`);
    }
  }, [previewRef, showInfo]);
  
  const handleZoomOut = useCallback(() => {
    if (previewRef.current) {
      const newZoom = previewRef.current.zoomOut();
      setPreviewZoom(newZoom);
      showInfo(`Zoom: ${newZoom}%`);
    }
  }, [previewRef, showInfo]);
  
  const handleZoomReset = useCallback(() => {
    if (previewRef.current) {
      const newZoom = previewRef.current.resetZoom();
      setPreviewZoom(newZoom);
      showInfo(`Zoom: ${newZoom}%`);
    }
  }, [previewRef, showInfo]);

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
    // For now, just show a message - in a real app this would open a new blank file
    showInfo('Select a file from the explorer to open it');
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
      showInfo('Preview must be visible to print');
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
  const handleMoveFile = useCallback((sourceItem, targetItem) => {
    if (!isValidDrop(sourceItem, targetItem)) {
      showInfo('Cannot move to this location', 'error');
      return;
    }
    
    const newPath = createDropDestination(sourceItem, targetItem);
    
    // Simulate moving file
    setFileOperationStatus({ type: 'moving', source: sourceItem.path, target: newPath });
    
    // In a real app, you would perform actual file operations here
    setTimeout(() => {
      // Update file list based on the drag operation
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
            if (folder.path.startsWith(folderPrefix)) {
              const relativePath = folder.path.slice(folderPrefix.length);
              const newFolderPath = newPrefix + relativePath;
              updatedFolders.push({
                ...folder,
                path: newFolderPath,
                name: path.basename(newFolderPath)
              });
            }
          });
          
          return updatedFolders;
        });
        
        // Update files
        setFiles(prevFiles => {
          const updatedFiles = prevFiles.filter(f => !f.path.startsWith(folderPrefix));
          
          // Move all files in the folder
          prevFiles.forEach(file => {
            if (file.path.startsWith(folderPrefix)) {
              const relativePath = file.path.slice(folderPrefix.length);
              const newFilePath = newPrefix + relativePath;
              updatedFiles.push({
                ...file,
                path: newFilePath,
                name: path.basename(newFilePath)
              });
            }
          });
          
          return updatedFiles;
        });
      }
      
      setFileOperationStatus(null);
      showInfo(`Moved ${sourceItem.name} to ${path.basename(newPath)}`, 'success');
    }, 500);
  }, [showInfo]);

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

  return (
    <div className="app-container h-full flex flex-col bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100">
      <AccessibilityHelper />
      
      <header className="bg-primary-700 dark:bg-primary-800 text-white p-2 md:p-4 shadow-md" role="banner">
        <div className="container mx-auto flex items-center justify-between">
          <div className="w-1/3 flex items-center justify-start">
            <button 
              className="flex items-center bg-primary-600 dark:bg-primary-700 hover:bg-primary-500 dark:hover:bg-primary-600 px-2 py-1 md:px-3 md:py-1 rounded text-sm md:text-base"
              onClick={openAndScanFolder}
              title={`Add Folder ${KEYBOARD_SHORTCUTS.OPEN_FILE}`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" color="white" className="mr-1 md:mr-2" />
                  {!isMobile && "Adding..."}
                </>
              ) : (
                <>
                  <IconFolderOpen size={isMobile ? 18 : 20} className="mr-1 md:mr-2" />
                  {isMobile ? "Add" : "Add Folder"}
                </>
              )}
            </button>
            {state.editor.unsavedChanges && (
              <span className="ml-2 text-xs bg-warning-500 px-1.5 py-0.5 rounded">
                Unsaved
              </span>
            )}
          </div>
          
          <div className="w-1/3 flex justify-center">
            {/* Intentionally left empty for spacing */}
          </div>
          
          <div className="w-1/3 flex items-center justify-end space-x-1 md:space-x-2">
            <ThemeToggle />
            <button 
              className="p-1 md:p-2 rounded hover:bg-primary-600 dark:hover:bg-primary-700"
              onClick={() => setIsSettingsOpen(true)}
              title="Settings"
            >
              <IconSettings size={isMobile ? 18 : 20} />
            </button>
          </div>
        </div>
      </header>
      
      <main id="main-content" className="flex-grow flex flex-col overflow-hidden" role="main">
        <Split 
          className="flex-grow flex overflow-hidden"
          sizes={getSplitSizes()}
          minSize={sidebarVisible ? (isMobile ? 250 : 150) : 0}
          expandToMin={false}
          gutterSize={sidebarVisible ? 5 : 0}
          gutterAlign="center"
          snapOffset={30}
          dragInterval={1}
          direction="horizontal"
          cursor="col-resize"
        >
          <aside className={`bg-surface-100 dark:bg-surface-800 border-r border-surface-300 dark:border-surface-700 overflow-hidden ${!sidebarVisible ? 'hidden' : ''}`} role="complementary" aria-label="Sidebar">
            {/* Mobile close button */}
            {isMobile && sidebarVisible && (
              <div className="flex justify-end p-1">
                <button 
                  onClick={() => setSidebarVisible(false)}
                  className="p-1 rounded-full bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600"
                  aria-label="Close sidebar"
                >
                  <IconX size={16} aria-hidden="true" />
                </button>
              </div>
            )}
            
            <SidebarTabs activeTab={activeTab} onTabChange={handleSidebarTabChange}>
              <SidebarTabs.Pane id="files">
                <LoadingOverlay isLoading={state.loading.files} message="Loading files..." transparent>
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
                      onFileSelect={openFile} 
                      onCreateFile={handleNewTab}
                      onCreateFolder={handleNewTab}
                      onMoveFile={handleMoveFile}
                      fileOperationStatus={fileOperationStatus}
                      sortBy={explorerSortBy}
                      sortDirection={explorerSortDirection}
                      onSortChange={handleExplorerSortChange}
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
              className={`flex overflow-hidden ${isMobile ? 'flex-col' : ''}`}
              sizes={getEditorPreviewSizes()}
              minSize={previewVisible ? (isMobile ? 150 : 200) : 0}
              gutterSize={previewVisible ? 5 : 0}
              gutterAlign="center"
              snapOffset={30}
              dragInterval={1}
              direction={isMobile ? "vertical" : "horizontal"}
              cursor={isMobile ? "row-resize" : "col-resize"}
            >
              <div className="overflow-hidden flex flex-col" role="region" aria-label="Editor">
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
                
                <div className="toolbar-container mt-2">
                  <MarkdownToolbar 
                    onAction={handleToolbarAction} 
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                  />
                </div>
                
                {/* EDITOR CONTAINER: Restructured to ensure proper input handling */}
                <div 
                  className="editor h-full flex-grow overflow-hidden p-4 pt-2" 
                  style={{ 
                    position: "relative", 
                    isolation: "isolate", // Create a stacking context
                    pointerEvents: "auto", // Ensure it captures pointer events
                    zIndex: 30 // Increase z-index to ensure it's above other elements
                  }}
                >
                  {state.loading.content && (
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
              
              <div className={`p-4 overflow-hidden flex flex-col ${!previewVisible ? 'hidden' : ''}`} role="region" aria-label="Preview">
                <div className="preview-header flex justify-between items-center p-2 border-b border-surface-300 dark:border-surface-700 bg-surface-100 dark:bg-surface-800">
                  <h3 className="text-sm font-medium">Preview</h3>
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
                    
                    {/* Close Button */}
                    <button
                      className="p-1 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600 rounded"
                      onClick={() => setPreviewVisible(false)}
                      title="Close Preview"
                    >
                      <IconX size={16} />
                    </button>
                  </div>
                </div>
                <div className="preview-container flex-grow overflow-hidden">
                  <LoadingOverlay isLoading={state.loading.content} message="Generating preview..." transparent>
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
      
      {/* Mobile controls */}
      {isMobile && (
        <div className="fixed bottom-4 right-4 flex space-x-2 z-10">
          {!sidebarVisible && (
            <button
              onClick={() => setSidebarVisible(true)}
              className="p-3 rounded-full bg-primary-600 text-white shadow-lg"
              title="Show Sidebar"
              aria-label="Show sidebar"
            >
              <IconFolderOpen size={18} aria-hidden="true" />
            </button>
          )}
          <button
            onClick={() => setPreviewVisible(!previewVisible)}
            className="p-3 rounded-full bg-primary-600 text-white shadow-lg"
            title={previewVisible ? "Hide Preview" : "Show Preview"}
            aria-label={previewVisible ? "Hide Preview" : "Show Preview"}
          >
            <IconEye size={18} aria-hidden="true" />
          </button>
        </div>
      )}
      
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
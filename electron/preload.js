const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api',
  {
    // File system operations
    openFileDialog: (multiSelect = false) => ipcRenderer.invoke('open-folder', multiSelect),
    scanDirectory: (directoryPath) => ipcRenderer.invoke('scan-folder', directoryPath),
    readMarkdownFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    writeMarkdownFile: (filePath, content) => ipcRenderer.invoke('save-file', filePath, content),
    
    // Original operations still available under electron namespace
    openFile: (path) => ipcRenderer.invoke('open-file', path),
    saveFile: (path, content) => ipcRenderer.invoke('save-file', path, content),
    watchFile: (path) => ipcRenderer.invoke('watch-file', path),
    unwatchFile: (path) => ipcRenderer.invoke('unwatch-file', path),
    openFolder: (multiSelect = false) => ipcRenderer.invoke('open-folder', multiSelect),
    scanFolder: (path) => ipcRenderer.invoke('scan-folder', path),
    readFile: (path) => ipcRenderer.invoke('read-file', path),
    
    // Register imported folders to prevent duplicate file creation
    registerImportedFolder: (path) => ipcRenderer.invoke('register-imported-folder', path),
    
    // File permission testing operations
    testFileReadAccess: (path) => ipcRenderer.invoke('test-file-read', path),
    testFileWriteAccess: (path) => ipcRenderer.invoke('test-file-write', path),
    testDirReadAccess: (path) => ipcRenderer.invoke('test-dir-read', path),
    testDirWriteAccess: (path) => ipcRenderer.invoke('test-dir-write', path),
    
    // File operations for drag and drop
    moveItem: (sourcePath, targetPath, isDirectory) => 
      ipcRenderer.invoke('move-item', sourcePath, targetPath, isDirectory),
    copyItem: (sourcePath, targetPath, isDirectory) => 
      ipcRenderer.invoke('copy-item', sourcePath, targetPath, isDirectory),
    
    // Deletion operations
    deleteFile: (filePath) => 
      ipcRenderer.invoke('deleteFile', filePath),
    deleteFolder: (folderPath) => 
      ipcRenderer.invoke('deleteFolder', folderPath),
    
    // Move/Copy operations (keeping for reference, moveItem can rename)
    moveFolder: (sourcePath, targetPath) => 
      ipcRenderer.invoke('moveFolder', sourcePath, targetPath),
    copyFile: (filePath) => 
      ipcRenderer.invoke('copyFile', filePath),
    copyFolder: (folderPath) => 
      ipcRenderer.invoke('copyFolder', folderPath),
    
    // File creation operations
    createFile: (filePath, content = '') => ipcRenderer.invoke('create-file', filePath, content),
    createFolder: (folderPath) => ipcRenderer.invoke('create-folder', folderPath),
    
    // Path operations
    pathResolve: (...paths) => ipcRenderer.invoke('path-resolve', ...paths),
    pathDirname: (filePath) => ipcRenderer.invoke('path-dirname', filePath),
    
    // File explorer integration
    openInExplorer: (path) => ipcRenderer.invoke('open-in-explorer', path),
    
    // Get imported folders
    getImportedFolders: () => ipcRenderer.invoke('get-imported-folders'),
    
    // IPC for file watching
    onFileChange: (callback) => {
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on('file-change', subscription);
      return () => {
        ipcRenderer.removeListener('file-change', subscription);
      };
    },
    openExternalLink: (url) => ipcRenderer.invoke('open-external-link', url),

    // --- File Explorer ---
    showItemInFolder: (itemPath) => ipcRenderer.invoke('show-item-in-folder', itemPath),

    // --- Store API for persisting settings ---
    getStoreValue: (key) => ipcRenderer.invoke('get-store-value', key),
    setStoreValue: (key, value) => ipcRenderer.invoke('set-store-value', key, value),
    
    // --- Detached Window API ---
    createDetachedWindow: (options) => ipcRenderer.invoke('create-detached-window', options),
    getDetachedContent: (contentId) => ipcRenderer.invoke('get-detached-content', contentId),
    updateDetachedContent: (contentId, content, cursorPosition) => {
      console.log(`[Preload] Sending update-detached-content for contentId: ${contentId}, content length: ${content?.length}`);
      return ipcRenderer.invoke('update-detached-content', contentId, content, cursorPosition);
    },
    updateMainContent: (contentId, content, cursorPosition) => {
      console.log(`[Preload] Sending direct update-main-content for contentId: ${contentId}, content length: ${content?.length}`);
      return ipcRenderer.invoke('update-main-content', contentId, content, cursorPosition);
    },
    closeDetachedWindow: (contentId) => ipcRenderer.invoke('close-detached-window', contentId),
    
    // Tab synchronization methods
    updateDetachedTab: (contentId, filePath) => {
      console.log(`[Preload] Sending update-detached-tab for contentId: ${contentId}, filePath: ${filePath}`);
      return ipcRenderer.invoke('update-detached-tab', contentId, filePath);
    },
    notifyMainWindowTabChange: (contentId, filePath) => {
      console.log(`[Preload] Notifying main window of tab change: ${filePath}`);
      return ipcRenderer.invoke('notify-main-tab-change', contentId, filePath);
    },

    // --- Event Listeners ---
    onDetachedContentUpdate: (callback) => {
      const subscription = (event, data) => callback(data);
      ipcRenderer.on('update-content', subscription);
      return () => ipcRenderer.removeListener('update-content', subscription);
    },
    onDetachedWindowClosed: (callback) => {
      const subscription = (event, contentId) => callback(contentId);
      ipcRenderer.on('detached-window-closed', subscription);
      return () => ipcRenderer.removeListener('detached-window-closed', subscription);
    },

    // Add listener for tab changes from detached windows
    onDetachedTabChange: (callback) => {
      console.log('[Preload] Registering detached-tab-change listener in main window');
      const subscription = (event, contentId, filePath) => callback(contentId, filePath);
      ipcRenderer.on('detached-tab-change', subscription);
      return () => ipcRenderer.removeListener('detached-tab-change', subscription);
    },
    
    // Remove tab change listener
    removeDetachedTabChangeListener: (callback) => {
      ipcRenderer.removeListener('detached-tab-change', callback);
    },

    // Remove detached window closed listener
    removeDetachedWindowClosedListener: (callback) => {
      ipcRenderer.removeListener('detached-window-closed', callback);
    },
    
    // --- Other APIs (Add more as needed) ---
    // Example: openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
    // Example: readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    // ... etc.
  }
); 

// Set up detached window communication
contextBridge.exposeInMainWorld(
  'detachedAPI',
  {
    // Used to get content from the parent window when a detached window is created
    getContent: (contentId) => {
      // This function will be called by executeJavaScript from the main process
      // to retrieve content for a detached window
      return window.__DETACHED_CONTENT__ && window.__DETACHED_CONTENT__[contentId];
    },
    
    // Listen for content updates from other windows
    onContentUpdate: (callback) => {
      console.log('[Preload] Registering update-content listener in detached window');
      const subscription = (event, data) => {
        console.log('[Preload] Received update-content event in detached window', {
          contentId: data.contentId,
          contentLength: data.content?.length,
          cursorPosition: data.cursorPosition
        });
        callback(data);
      };
      ipcRenderer.on('update-content', subscription);
      return () => ipcRenderer.removeListener('update-content', subscription);
    },
    
    // Listen for tab change notifications from main window
    onTabChange: (callback) => {
      console.log('[Preload] Registering tab-change listener in detached window');
      const subscription = (event, filePath) => {
        console.log(`[Preload] Received tab-change event for path: ${filePath}`);
        callback(filePath);
      };
      ipcRenderer.on('tab-change', subscription);
      return () => ipcRenderer.removeListener('tab-change', subscription);
    },
    
    // Clear all tab change listeners to prevent memory leaks
    _clearTabChangeListeners: () => {
      console.log('[Preload] Clearing all tab-change listeners');
      ipcRenderer.removeAllListeners('tab-change');
    },
    
    // Check if this is a detached window
    isDetachedWindow: () => {
      const url = new URL(window.location.href);
      return url.searchParams.has('detached') && url.searchParams.has('contentId');
    },
    
    // Get the content ID for this detached window
    getContentId: () => {
      const url = new URL(window.location.href);
      return url.searchParams.get('contentId');
    },
    
    // Get the file info for this detached window
    getFileInfo: () => {
      const url = new URL(window.location.href);
      const contentId = url.searchParams.get('contentId');
      
      // If we have detached content with file info, use that
      if (window.__DETACHED_CONTENT__ && 
          window.__DETACHED_CONTENT__[contentId] && 
          window.__DETACHED_CONTENT__[contentId].file) {
        return window.__DETACHED_CONTENT__[contentId].file;
      }
      
      // Otherwise, create minimal file info from URL params
      return {
        path: url.searchParams.get('filePath') || '',
        name: url.searchParams.get('fileName') || 'Untitled'
      };
    },
    
    // Get all open files for this detached window
    getAllOpenFiles: () => {
      const url = new URL(window.location.href);
      // Get the content ID to access the detached content
      const contentId = url.searchParams.get('contentId');
      
      // If we have detached content with allOpenFiles, use that
      if (window.__DETACHED_CONTENT__ && 
          window.__DETACHED_CONTENT__[contentId] && 
          window.__DETACHED_CONTENT__[contentId].allOpenFiles) {
        console.log('[Preload] Using allOpenFiles from detached content');
        return window.__DETACHED_CONTENT__[contentId].allOpenFiles;
      }
      
      // Check if we have allOpenFilePaths in the URL
      const openFilePathsParam = url.searchParams.get('allOpenFilePaths');
      if (openFilePathsParam) {
        console.log('[Preload] Using file paths from URL parameter');
        // Split the paths using the delimiter
        const filePaths = openFilePathsParam.split('|').filter(Boolean);
        
        if (filePaths.length === 0) {
          console.log('[Preload] No valid file paths found in URL parameter');
          return [];
        }
        
        // Create file objects for each path
        const fileObjects = filePaths.map(path => {
          const name = path.split('/').pop() || path.split('\\').pop() || 'Untitled';
          return {
            path,
            name,
            type: 'file'
          };
        });
        
        console.log('[Preload] Created file objects from paths:', fileObjects);
        return fileObjects;
      }
      
      // Fallback: just return an array with the current file
      const fileInfo = this.getFileInfo();
      if (fileInfo && fileInfo.path) {
        console.log('[Preload] Falling back to single file:', fileInfo);
        return [fileInfo];
      }
      
      console.log('[Preload] No files found, returning empty array');
      return [];
    }
  }
);

console.log('[Preload] Script loaded and API exposed.'); 
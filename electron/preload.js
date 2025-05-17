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
    updateDetachedContent: (contentId, content, cursorPosition) => 
      ipcRenderer.invoke('update-detached-content', contentId, content, cursorPosition),
    closeDetachedWindow: (contentId) => ipcRenderer.invoke('close-detached-window', contentId),
    
    // Listen for content updates from detached windows in the main window
    onDetachedContentUpdate: (callback) => {
      const subscription = (event, data) => callback(data);
      ipcRenderer.on('update-content', subscription);
      return () => {
        ipcRenderer.removeListener('update-content', subscription);
      };
    },
    
    // Listen for detached window closed events
    onDetachedWindowClosed: (callback) => {
      const subscription = (event, contentId) => callback(contentId);
      ipcRenderer.on('detached-window-closed', subscription);
      return () => {
        ipcRenderer.removeListener('detached-window-closed', subscription);
      };
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
      const subscription = (event, data) => callback(data);
      ipcRenderer.on('update-content', subscription);
      return () => {
        ipcRenderer.removeListener('update-content', subscription);
      };
    },
    
    // Check if this is a detached window
    isDetachedWindow: () => {
      const url = new URL(window.location.href);
      return url.searchParams.get('detached') === 'true';
    },
    
    // Get the content ID for this detached window
    getContentId: () => {
      const url = new URL(window.location.href);
      return url.searchParams.get('contentId');
    },
    
    // Get file info for this detached window
    getFileInfo: () => {
      const url = new URL(window.location.href);
      return {
        path: url.searchParams.get('filePath'),
        name: url.searchParams.get('fileName')
      };
    }
  }
);

console.log('[Preload] Script loaded and API exposed.'); 
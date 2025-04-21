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
    renameItem: (oldPath, newName, isDirectory) => 
      ipcRenderer.invoke('rename-item', oldPath, newName, isDirectory),
    createFile: (filePath, content = '') => {
      console.log('[Preload] Creating file at:', filePath);
      return ipcRenderer.invoke('create-file', filePath, content);
    },
    createFolder: (folderPath) => {
      console.log('[Preload] Creating folder at:', folderPath);
      return ipcRenderer.invoke('create-folder', folderPath);
    },
    
    // Event listeners
    onFileChange: (callback) => {
      // Clean up previous listeners to avoid duplicates
      ipcRenderer.removeAllListeners('file-changed');
      ipcRenderer.on('file-changed', (event, path) => callback(path));
    },
    removeFileChangeListener: () => {
      ipcRenderer.removeAllListeners('file-changed');
    },
    openExternalLink: (url) => ipcRenderer.invoke('open-external-link', url),

    // Open a folder in the system file explorer
    openInExplorer: (folderPath) => {
      console.log('[Preload] Opening folder in system explorer:', folderPath);
      return ipcRenderer.invoke('open-in-explorer', folderPath);
    },

    // *** NEW: Expose path functions via IPC ***
    pathDirname: (filePath) => ipcRenderer.invoke('path-dirname', filePath),
    pathResolve: (...paths) => ipcRenderer.invoke('path-resolve', ...paths)
  }
); 
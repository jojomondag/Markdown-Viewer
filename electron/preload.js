const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api',
  {
    // File system operations
    openFileDialog: () => ipcRenderer.invoke('open-folder'),
    scanDirectory: (directoryPath) => ipcRenderer.invoke('scan-folder', directoryPath),
    readMarkdownFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    writeMarkdownFile: (filePath, content) => ipcRenderer.invoke('save-file', filePath, content),
    
    // Original operations still available under electron namespace
    openFile: (path) => ipcRenderer.invoke('open-file', path),
    saveFile: (path, content) => ipcRenderer.invoke('save-file', path, content),
    watchFile: (path) => ipcRenderer.invoke('watch-file', path),
    unwatchFile: (path) => ipcRenderer.invoke('unwatch-file', path),
    openFolder: () => ipcRenderer.invoke('open-folder'),
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
    renameItem: (sourcePath, newName, isDirectory) => 
      ipcRenderer.invoke('rename-item', sourcePath, newName, isDirectory),
    
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

    // *** NEW: Expose path functions via IPC ***
    pathDirname: (filePath) => ipcRenderer.invoke('path-dirname', filePath),
    pathResolve: (...paths) => ipcRenderer.invoke('path-resolve', ...paths)
  }
); 
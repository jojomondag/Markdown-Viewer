const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const Store = require('electron-store');

// Initialize store for app preferences
const store = new Store();

// Create a map to store file watchers
const fileWatchers = new Map();

// Keep track of imported folder paths to prevent duplicate file creation
const importedFolderPaths = [];

// Keep track of detached windows
const detachedWindows = new Map();

// Create a variable to hold the main window reference
let mainWindow;

// Set up custom app data path to avoid permission issues
const userDataPath = path.join(app.getPath('documents'), 'MarkdownViewer');
try {
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  app.setPath('userData', userDataPath);
} catch (error) {
  console.error('Failed to set up user data directory:', error);
}

// Get stored window size and position
function getStoredWindowBounds() {
  const defaultBounds = { width: 1200, height: 800, x: undefined, y: undefined };
  const bounds = store.get('windowBounds', defaultBounds);
  
  // Always center the window to avoid off-screen issues
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  
  return {
    width: bounds.width || 1200,
    height: bounds.height || 800,
    x: Math.floor((screenWidth - (bounds.width || 1200)) / 2),
    y: Math.floor((screenHeight - (bounds.height || 800)) / 2)
  };
}

// Create main window
function createWindow() {
  // Get saved window bounds
  const windowBounds = getStoredWindowBounds();

  const mainWindow = new BrowserWindow({
    width: windowBounds.width,
    height: windowBounds.height,
    x: windowBounds.x,
    y: windowBounds.y,
    show: false, // Don't show until ready
    icon: path.join(__dirname, '../assets/icon.ico'),
    autoHideMenuBar: true, // Hide the menu bar
    menuBarVisible: false, // Completely hide menu bar on Windows/Linux
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Handle navigation attempts within the app
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Prevent navigation within the app for external URLs
    if (url.startsWith('http://') || url.startsWith('https://')) {
      event.preventDefault();
      shell.openExternal(url);
      console.log(`Intercepted will-navigate to ${url} - opening in external browser`);
    }
  });

  // Handle new window creation (e.g., target="_blank" links)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // For external URLs, open in default browser and prevent new electron window
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      console.log(`Intercepted new-window for ${url} - opening in external browser`);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Save window size and position when changes occur
  ['resize', 'move'].forEach(event => {
    mainWindow.on(event, () => {
      if (!mainWindow.isMaximized() && !mainWindow.isMinimized()) {
        const bounds = mainWindow.getBounds();
        store.set('windowBounds', bounds);
      }
    });
  });

  // Save maximized state
  mainWindow.on('maximize', () => {
    store.set('isMaximized', true);
  });

  mainWindow.on('unmaximize', () => {
    store.set('isMaximized', false);
    // Save the restored bounds
    const bounds = mainWindow.getBounds();
    store.set('windowBounds', bounds);
  });

  // Load the app - in development or production
  let startUrl;
  if (process.env.NODE_ENV === 'development') {
    startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../index.html')}`;
  } else {
    // In production, the app is packaged and we need to load from the root index.html
    startUrl = `file://${path.join(__dirname, '../index.html')}`;
  }
  
  mainWindow.loadURL(startUrl);

  // Show window when ready to prevent flash of white content
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Apply maximized state if previously maximized
    if (store.get('isMaximized', false)) {
      mainWindow.maximize();
    }
    
    // Focus and bring to front
    mainWindow.focus();
    mainWindow.setAlwaysOnTop(true);
    mainWindow.setAlwaysOnTop(false);
  });

  // Add error handling for loading failures
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', errorCode, errorDescription, validatedURL);
    // Show window anyway so user can see the error
    mainWindow.show();
  });

  return mainWindow;
}

// Create a detached window for editor
function createDetachedWindow(options) {
  const { title = 'Detached Editor', width = 800, height = 600, contentId, fileInfo, allOpenFilePaths = [] } = options;
  
  // Use Markdown Editor in the window title
  const windowTitle = fileInfo?.name ? `${fileInfo.name} - Markdown Editor` : 'Markdown Editor';
  
  const detachedWindow = new BrowserWindow({
    width,
    height,
    title: windowTitle,
    icon: path.join(__dirname, '../assets/icon.ico'),
    autoHideMenuBar: true, // Hide the menu bar
    menuBarVisible: false, // Completely hide menu bar on Windows/Linux
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load the app with query parameters to identify this as a detached window
  let startUrl;
  if (process.env.NODE_ENV === 'development') {
    startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../index.html')}`;
  } else {
    // In production, the app is packaged and we need to load from the root index.html
    startUrl = `file://${path.join(__dirname, '../index.html')}`;
  }
  
  // Add query parameters to indicate this is a detached window
  const url = new URL(startUrl);
  url.searchParams.append('detached', 'true');
  url.searchParams.append('contentId', contentId);
  
  // If we have file info, add that too
  if (fileInfo) {
    url.searchParams.append('filePath', fileInfo.path);
    url.searchParams.append('fileName', fileInfo.name);
  }
  
  // Add the open file paths as a query parameter
  if (allOpenFilePaths && allOpenFilePaths.length > 0) {
    // Join the paths with a delimiter that's unlikely to appear in file paths
    const joinedPaths = allOpenFilePaths.join('|');
    url.searchParams.append('allOpenFilePaths', joinedPaths);
  }
  
  detachedWindow.loadURL(url.toString());
  
  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    detachedWindow.webContents.openDevTools();
  }
  
  // Store the window reference
  detachedWindows.set(contentId, detachedWindow);
  
  // Remove from our tracking when closed
  detachedWindow.on('closed', () => {
    detachedWindows.delete(contentId);
    // Notify the main window that this detached window has been closed
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('detached-window-closed', contentId);
    }
  });
  
  return detachedWindow;
}

// Create window when Electron is ready
app.whenReady().then(() => {
  mainWindow = createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });

  // Add IPC handler to access store from renderer
  ipcMain.handle('get-store-value', (event, key) => {
    return store.get(key);
  });

  ipcMain.handle('set-store-value', (event, key, value) => {
    store.set(key, value);
    return true;
  });
});

// Quit app when all windows are closed (except on macOS)
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('open-file', async (event, filePath) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    return content;
  } catch (error) {
    console.error('Error opening file:', error);
    throw new Error(`Failed to open file: ${error.message}`);
  }
});

ipcMain.handle('save-file', async (event, filePath, content) => {
  try {
    // Ensure the directory exists before writing the file
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      await fs.promises.mkdir(dirPath, { recursive: true });
    }
    await fs.promises.writeFile(filePath, content, 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving file:', error);
    throw new Error(`Failed to save file: ${error.message}`);
  }
});

ipcMain.handle('create-file', async (event, filePath, content = '') => {
  console.log('[Main Process] Received create-file request for:', filePath);
  try {
    // Normalize file path in a platform-aware way (don't force Windows style)
    const normalizedPath = path.normalize(filePath);
    console.log('[Main Process] Normalized path:', normalizedPath);
    
    // Check if file already exists
    if (fs.existsSync(normalizedPath)) {
      console.log('[Main Process] File already exists:', normalizedPath);
      throw new Error('File already exists');
    }
    
    // Check if the file is being created in an imported folder
    // Use startsWith with platform-specific path comparisons
    console.log('[Main Process] Current imported folders:', importedFolderPaths);
    
    const isInImportedFolder = importedFolderPaths.some(folderPath => {
      // Normalize the folder path in the same way for consistent comparison
      const normalizedFolderPath = path.normalize(folderPath);
      // Log comparison for debugging
      console.log(`[Main Process] Comparing: ${normalizedPath} with imported folder: ${normalizedFolderPath}`);
      return normalizedPath.startsWith(normalizedFolderPath);
    });
    
    console.log('[Main Process] Is file in imported folder?', isInImportedFolder);
    
    // Create parent directories if needed
    const dirPath = path.dirname(normalizedPath);
    console.log('[Main Process] Ensuring parent directory exists:', dirPath);
    if (!fs.existsSync(dirPath)) {
      console.log('[Main Process] Creating parent directory:', dirPath);
      await fs.promises.mkdir(dirPath, { recursive: true });
    }
    
    // Create the file with initial content
    console.log('[Main Process] Writing file:', normalizedPath);
    await fs.promises.writeFile(normalizedPath, content, 'utf8');
    
    // Return file info
    const stats = await fs.promises.stat(normalizedPath);
    console.log('[Main Process] File created successfully:', normalizedPath);
    return {
      name: path.basename(normalizedPath),
      path: normalizedPath,
      type: 'file',
      size: stats.size,
      lastModified: stats.mtime
    };
  } catch (error) {
    console.error('[Main Process] Error creating file:', error);
    throw new Error(`Failed to create file: ${error.message}`);
  }
});

// Track imported folders
ipcMain.handle('register-imported-folder', (event, folderPath) => {
  if (!importedFolderPaths.includes(folderPath)) {
    importedFolderPaths.push(folderPath);
  }
  return true;
});

ipcMain.handle('create-folder', async (event, folderPath) => {
  console.log('[Main Process] Received create-folder request for:', folderPath);
  try {
    // Normalize folder path in a platform-aware way
    const normalizedPath = path.normalize(folderPath);
    console.log('[Main Process] Normalized path:', normalizedPath);
    
    // Check if folder already exists
    if (fs.existsSync(normalizedPath)) {
      console.log('[Main Process] Folder already exists:', normalizedPath);
      throw new Error('Folder already exists');
    }
    
    // Create the folder and any parent directories needed
    console.log('[Main Process] Creating folder:', normalizedPath);
    await fs.promises.mkdir(normalizedPath, { recursive: true });
    
    // Return folder info
    const stats = await fs.promises.stat(normalizedPath);
    console.log('[Main Process] Folder created successfully:', normalizedPath);
    return {
      name: path.basename(normalizedPath),
      path: normalizedPath,
      type: 'folder',
      lastModified: stats.mtime
    };
  } catch (error) {
    console.error('[Main Process] Error creating folder:', error);
    throw new Error(`Failed to create folder: ${error.message}`);
  }
});

ipcMain.handle('watch-file', async (event, filePath) => {
  try {
    // Clean up existing watcher if any
    if (fileWatchers.has(filePath)) {
      fileWatchers.get(filePath).close();
    }
    
    // Create new watcher
    const watcher = chokidar.watch(filePath, {
      persistent: true
    });
    
    // Handle file changes
    watcher.on('change', path => {
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('file-changed', path);
      });
    });
    
    fileWatchers.set(filePath, watcher);
    return true;
  } catch (error) {
    console.error('Error watching file:', error);
    throw new Error(`Failed to watch file: ${error.message}`);
  }
});

ipcMain.handle('unwatch-file', async (event, filePath) => {
  try {
    if (fileWatchers.has(filePath)) {
      fileWatchers.get(filePath).close();
      fileWatchers.delete(filePath);
    }
    return true;
  } catch (error) {
    console.error('Error unwatching file:', error);
    throw new Error(`Failed to unwatch file: ${error.message}`);
  }
});

ipcMain.handle('open-folder', async (event, allowMultiSelect = false) => {
  console.log("[Main Process] Received 'open-folder' request.");
  try {
    console.log("[Main Process] Calling dialog.showOpenDialog...");
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory', allowMultiSelect ? 'multiSelections' : null].filter(Boolean)
    });
    
    console.log(`[Main Process] dialog.showOpenDialog result: canceled=${canceled}, filePaths=${filePaths}`);
    
    if (canceled) {
      console.log("[Main Process] Dialog was cancelled by user.");
      return null;
    }
    
    // Register imported folders
    filePaths.forEach(folderPath => {
      if (!importedFolderPaths.includes(folderPath)) {
        importedFolderPaths.push(folderPath);
      }
    });
    
    if (allowMultiSelect) {
      console.log(`[Main Process] Returning multiple selected paths: ${filePaths}`);
      return filePaths;
    } else {
      console.log(`[Main Process] Returning selected path: ${filePaths[0]}`);
      return filePaths[0];
    }
  } catch (error) {
    console.error('[Main Process] Error opening folder dialog:', error);
    throw error;
  }
});

ipcMain.handle('scan-folder', async (event, folderPath) => {
  try {
    const files = [];
    const folders = [];
    
    // Recursive function to scan directories
    async function scanRecursively(currentPath, isRootLevel = false) {
      const items = await fs.promises.readdir(currentPath, { withFileTypes: true });
      
      // Add this folder to our list even if it's empty
      if (!isRootLevel) {
        folders.push({
          name: path.basename(currentPath),
          path: currentPath,
          type: 'folder'
        });
      }
      
      for (const item of items) {
        const itemPath = path.join(currentPath, item.name);
        
        if (item.isDirectory()) {
          // Recursively scan this directory
          await scanRecursively(itemPath);
        } else if (item.isFile() && item.name.endsWith('.md')) {
          const stats = await fs.promises.stat(itemPath);
          files.push({
            name: item.name,
            path: itemPath,
            type: 'file',
            size: stats.size,
            lastModified: stats.mtime
          });
        }
      }
    }
    
    // Start recursive scan
    await scanRecursively(folderPath, true);
    
    // Check if any subfolders were discovered
    // If the directory is empty (no subfolders), add it manually so it still appears
    const hasSubfolders = folders.length > 0;
    
    // If the folder is empty or only contains non-markdown files, we need to manually add the root folder
    const rootItemStats = await fs.promises.stat(folderPath);
    const rootItems = await fs.promises.readdir(folderPath, { withFileTypes: true });
    const hasEmptySubfolders = rootItems.some(item => item.isDirectory());
    
    if (!hasSubfolders && (rootItems.length === 0 || hasEmptySubfolders)) {
      folders.push({
        name: path.basename(folderPath),
        path: folderPath,
        type: 'folder'
      });
    }
    
    return { files, folders };
  } catch (error) {
    console.error('Error scanning folder:', error);
    throw new Error(`Failed to scan folder: ${error.message}`);
  }
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    return content;
  } catch (error) {
    console.error('Error reading file:', error);
    throw new Error(`Failed to read file: ${error.message}`);
  }
});

// Add IPC handler to open a folder in the system file explorer
ipcMain.handle('open-in-explorer', async (event, folderPath) => {
  console.log(`[Main Process] Opening folder in system explorer: ${folderPath}`);
  try {
    // Use shell.openPath to open the folder in system file explorer
    const result = await shell.openPath(folderPath);
    
    // If result is empty string, it was successful
    if (result === '') {
      console.log(`[Main Process] Successfully opened folder: ${folderPath}`);
      return { success: true };
    } else {
      console.error(`[Main Process] Failed to open folder: ${result}`);
      return { success: false, error: result };
    }
  } catch (error) {
    console.error('[Main Process] Error opening folder in explorer:', error);
    return { success: false, error: error.message };
  }
});

// File permission testing handlers
ipcMain.handle('test-file-read', async (event, filePath) => {
  try {
    // Test if file exists and can be read
    await fs.promises.access(filePath, fs.constants.R_OK);
    return {
      success: true,
      message: 'Read permission granted for file'
    };
  } catch (error) {
    // Check if file doesn't exist or is inaccessible
    if (error.code === 'ENOENT') {
      return {
        success: false,
        message: 'File does not exist'
      };
    } else {
      return {
        success: false,
        message: `Cannot read file: ${error.message}`
      };
    }
  }
});

ipcMain.handle('test-file-write', async (event, filePath) => {
  try {
    // Test if file can be written to
    const fileExists = fs.existsSync(filePath);
    
    if (fileExists) {
      // If file exists, check write permission
      await fs.promises.access(filePath, fs.constants.W_OK);
    } else {
      // If file doesn't exist, check if parent directory is writable
      const dirPath = path.dirname(filePath);
      await fs.promises.access(dirPath, fs.constants.W_OK);
      
      // Try to create and remove a temp file to confirm
      const tempPath = path.join(dirPath, `.temp_${Date.now()}`);
      await fs.promises.writeFile(tempPath, '');
      await fs.promises.unlink(tempPath);
    }
    
    return {
      success: true,
      message: 'Write permission granted for file'
    };
  } catch (error) {
    return {
      success: false,
      message: `Cannot write to file: ${error.message}`
    };
  }
});

ipcMain.handle('test-dir-read', async (event, dirPath) => {
  try {
    // Test if directory exists and can be read
    await fs.promises.access(dirPath, fs.constants.R_OK);
    
    // Try to read directory contents to confirm
    await fs.promises.readdir(dirPath);
    
    return {
      success: true,
      message: 'Read permission granted for directory'
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        success: false,
        message: 'Directory does not exist'
      };
    } else {
      return {
        success: false,
        message: `Cannot read directory: ${error.message}`
      };
    }
  }
});

ipcMain.handle('test-dir-write', async (event, dirPath) => {
  try {
    // Test if directory exists and can be written to
    await fs.promises.access(dirPath, fs.constants.W_OK);
    
    // Try to create and remove a temp file to confirm
    const tempPath = path.join(dirPath, `.temp_${Date.now()}`);
    await fs.promises.writeFile(tempPath, '');
    await fs.promises.unlink(tempPath);
    
    return {
      success: true,
      message: 'Write permission granted for directory'
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        success: false,
        message: 'Directory does not exist'
      };
    } else {
      return {
        success: false,
        message: `Cannot write to directory: ${error.message}`
      };
    }
  }
});

// Helper function for recursive directory moving
async function moveItem(sourcePath, targetPath, isDirectory) {
  if (isDirectory) {
    // Create target directory if it doesn't exist
    if (!fs.existsSync(targetPath)) {
      await fs.promises.mkdir(targetPath, { recursive: true });
    }
    
    // Copy directory contents recursively
    const items = await fs.promises.readdir(sourcePath, { withFileTypes: true });
    for (const item of items) {
      const srcPath = path.join(sourcePath, item.name);
      const tgtPath = path.join(targetPath, item.name);
      
      if (item.isDirectory()) {
        await fs.promises.mkdir(tgtPath, { recursive: true });
        // Recursively copy subdirectory
        await moveItem(srcPath, tgtPath, true);
      } else {
        await fs.promises.copyFile(srcPath, tgtPath);
      }
    }
    
    // Remove original directory
    await fs.promises.rmdir(sourcePath, { recursive: true });
  } else {
    // Create parent directory if it doesn't exist
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      await fs.promises.mkdir(targetDir, { recursive: true });
    }
    
    // Move file (copy then delete)
    await fs.promises.copyFile(sourcePath, targetPath);
    await fs.promises.unlink(sourcePath);
  }
}

// File operations for drag and drop
ipcMain.handle('move-item', async (event, sourcePath, targetPath, isDirectory) => {
  try {
    console.log(`[Main Process] Moving ${isDirectory ? 'directory' : 'file'}: ${sourcePath} -> ${targetPath}`);
    await moveItem(sourcePath, targetPath, isDirectory);
    
    return {
      success: true,
      message: `Successfully moved ${isDirectory ? 'directory' : 'file'}`
    };
  } catch (error) {
    console.error('Error moving item:', error);
    return {
      success: false,
      message: `Failed to move ${isDirectory ? 'directory' : 'file'}: ${error.message}`
    };
  }
});

// Helper function for recursive directory copying
async function copyItem(sourcePath, targetPath, isDirectory) {
  if (isDirectory) {
    // Create target directory if it doesn't exist
    if (!fs.existsSync(targetPath)) {
      await fs.promises.mkdir(targetPath, { recursive: true });
    }
    
    // Copy directory contents recursively
    const items = await fs.promises.readdir(sourcePath, { withFileTypes: true });
    for (const item of items) {
      const srcPath = path.join(sourcePath, item.name);
      const tgtPath = path.join(targetPath, item.name);
      
      if (item.isDirectory()) {
        await fs.promises.mkdir(tgtPath, { recursive: true });
        // Recursively copy subdirectory
        await copyItem(srcPath, tgtPath, true);
      } else {
        await fs.promises.copyFile(srcPath, tgtPath);
      }
    }
  } else {
    // Create parent directory if it doesn't exist
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      await fs.promises.mkdir(targetDir, { recursive: true });
    }
    
    // Copy file
    await fs.promises.copyFile(sourcePath, targetPath);
  }
}

ipcMain.handle('copy-item', async (event, sourcePath, targetPath, isDirectory) => {
  try {
    console.log(`[Main Process] Copying ${isDirectory ? 'directory' : 'file'}: ${sourcePath} -> ${targetPath}`);
    await copyItem(sourcePath, targetPath, isDirectory);
    
    return {
      success: true,
      message: `Successfully copied ${isDirectory ? 'directory' : 'file'}`
    };
  } catch (error) {
    console.error('Error copying item:', error);
    return {
      success: false,
      message: `Failed to copy ${isDirectory ? 'directory' : 'file'}: ${error.message}`
    };
  }
});

// *** NEW: Add handler for opening external links ***
ipcMain.handle('open-external-link', async (event, url) => {
  try {
    console.log(`Attempting to open external URL in system browser: ${url}`);
    // Basic validation: Ensure it's a http/https URL
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      console.log(`URL validation passed, calling shell.openExternal`);
      await shell.openExternal(url);
      console.log(`shell.openExternal completed successfully`);
      return { success: true };
    } else {
      console.warn(`Attempted to open non-http(s) URL: ${url}`);
      return { success: false, error: 'Invalid URL protocol. Only http and https are allowed.' };
    }
  } catch (error) {
    console.error(`Failed to open external link ${url}:`, error);
    return { success: false, error: error.message };
  }
});

// *** NEW: IPC Handlers for path operations ***
ipcMain.handle('path-dirname', (event, filePath) => {
  try {
    return path.dirname(filePath);
  } catch (error) {
    console.error('[Main Process] Error in path-dirname handler:', error);
    throw error; // Propagate error back to renderer
  }
});

ipcMain.handle('path-resolve', (event, ...paths) => {
  try {
    return path.resolve(...paths);
  } catch (error) {
    console.error('[Main Process] Error in path-resolve handler:', error);
    throw error; // Propagate error back to renderer
  }
});

// *** NEW: IPC Handlers for file/folder operations ***
ipcMain.handle('deleteFolder', async (event, folderPath) => {
  console.log(`[Main Process] Deleting folder: ${folderPath}`);
  try {
    // Use recursive option to delete all contents
    await fs.promises.rm(folderPath, { recursive: true, force: true });
    
    return { success: true };
  } catch (error) {
    console.error('[Main Process] Error deleting folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('moveFolder', async (event, sourcePath, targetPath) => {
  console.log(`[Main Process] Moving folder: ${sourcePath} to ${targetPath}`);
  try {
    const folderName = path.basename(sourcePath);
    const destinationPath = path.join(targetPath, folderName);
    
    // Check if destination already exists
    if (fs.existsSync(destinationPath)) {
      console.error(`[Main Process] Cannot move folder: Destination already exists: ${destinationPath}`);
      return { success: false, error: 'A folder with that name already exists at the destination' };
    }
    
    // Create target directory if it doesn't exist
    if (!fs.existsSync(targetPath)) {
      await fs.promises.mkdir(targetPath, { recursive: true });
    }
    
    // Move the folder
    await fs.promises.rename(sourcePath, destinationPath);
    
    return {
      success: true,
      oldPath: sourcePath,
      newPath: destinationPath
    };
  } catch (error) {
    console.error('[Main Process] Error moving folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('copyFile', async (event, filePath) => {
  console.log(`[Main Process] Copying file: ${filePath}`);
  try {
    const dirPath = path.dirname(filePath);
    const baseName = path.basename(filePath);
    const extension = path.extname(filePath);
    const nameWithoutExt = baseName.slice(0, -extension.length);
    
    // Generate a unique name for the copy
    let copyPath = path.join(dirPath, `${nameWithoutExt} - Copy${extension}`);
    let counter = 1;
    
    // If the copy already exists, increment counter
    while (fs.existsSync(copyPath)) {
      copyPath = path.join(dirPath, `${nameWithoutExt} - Copy (${counter})${extension}`);
      counter++;
    }
    
    // Copy the file
    await fs.promises.copyFile(filePath, copyPath);
    
    // Get file stats
    const stats = await fs.promises.stat(copyPath);
    
    return {
      success: true,
      path: copyPath,
      name: path.basename(copyPath),
      type: 'file',
      lastModified: stats.mtime
    };
  } catch (error) {
    console.error('[Main Process] Error copying file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('copyFolder', async (event, folderPath) => {
  console.log(`[Main Process] Copying folder: ${folderPath}`);
  try {
    const dirPath = path.dirname(folderPath);
    const baseName = path.basename(folderPath);
    
    // Generate a unique name for the copy
    let copyPath = path.join(dirPath, `${baseName} - Copy`);
    let counter = 1;
    
    // If the copy already exists, increment counter
    while (fs.existsSync(copyPath)) {
      copyPath = path.join(dirPath, `${baseName} - Copy (${counter})`);
      counter++;
    }
    
    // Create the folder
    await fs.promises.mkdir(copyPath, { recursive: true });
    
    // Helper function to copy files and folders recursively
    const copyRecursive = async (src, dest) => {
      const entries = await fs.promises.readdir(src, { withFileTypes: true });
      
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
          await fs.promises.mkdir(destPath, { recursive: true });
          await copyRecursive(srcPath, destPath);
        } else {
          await fs.promises.copyFile(srcPath, destPath);
        }
      }
    };
    
    // Copy contents recursively
    await copyRecursive(folderPath, copyPath);
    
    // Get folder stats
    const stats = await fs.promises.stat(copyPath);
    
    return {
      success: true,
      path: copyPath,
      name: path.basename(copyPath),
      type: 'folder',
      lastModified: stats.mtime
    };
  } catch (error) {
    console.error('[Main Process] Error copying folder:', error);
    return { success: false, error: error.message };
  }
});

// *** NEW: IPC Handler for deleting files ***
ipcMain.handle('deleteFile', async (event, filePath) => {
  console.log(`[Main Process] Deleting file: ${filePath}`);
  try {
    // Ensure the file exists before attempting deletion
    await fs.promises.access(filePath, fs.constants.F_OK); // Check existence
    await fs.promises.unlink(filePath); // Delete the file
    
    return { success: true };
  } catch (error) {
    console.error('[Main Process] Error deleting file:', error);
    // Handle specific error case: File not found
    if (error.code === 'ENOENT') {
      return { success: false, error: 'File not found' };
    }
    return { success: false, error: error.message };
  }
});

// Handle 'show-item-in-folder' request from renderer
ipcMain.handle('show-item-in-folder', (event, itemPath) => {
  if (itemPath) {
    console.log(`[IPC Main] Received request to show item: ${itemPath}`); // Optional logging
    shell.showItemInFolder(itemPath);
  } else {
    console.error('[IPC Main] Received show-item-in-folder request without a path.');
  }
});

// IPC Handlers for detached windows
ipcMain.handle('create-detached-window', async (event, options) => {
  try {
    const detachedWindow = createDetachedWindow(options);
    return { 
      success: true, 
      windowId: detachedWindow.id 
    };
  } catch (error) {
    console.error('Error creating detached window:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
});

// Get detached content from main window
ipcMain.handle('get-detached-content', async (event, contentId) => {
  // Get content from the main window
  const content = await mainWindow.webContents.executeJavaScript(
    `window.detachedAPI.getContent('${contentId}')`
  );
  return content;
});

// Update content in detached windows from main window
ipcMain.handle('update-detached-content', async (event, contentId, content, cursorPosition) => {
  console.log(`[Main Process] Updating detached content for ${contentId}`);
  try {
    const window = detachedWindows.get(contentId);
    if (window && !window.isDestroyed() && window.webContents) {
      console.log(`[Main Process] Found window, sending update-content event`);
      window.webContents.send('update-content', { 
        contentId, 
        content, 
        cursorPosition 
      });
      return { success: true };
    } else if (!window) {
      console.warn(`[Main Process] No detached window found for contentId: ${contentId}`);
    } else if (window.isDestroyed()) {
      console.warn(`[Main Process] Window for contentId ${contentId} is destroyed`);
      detachedWindows.delete(contentId);
    } else {
      console.warn(`[Main Process] Window for contentId ${contentId} exists but webContents is unavailable`);
    }
    return { success: false, error: 'Window not found, destroyed, or unavailable' };
  } catch (error) {
    console.error(`[Main Process] Error updating detached content:`, error);
    return { success: false, error: error.message };
  }
});

// Close a detached window
ipcMain.handle('close-detached-window', async (event, contentId) => {
  const window = detachedWindows.get(contentId);
  if (window && !window.isDestroyed()) {
    window.close();
    return { success: true };
  }
  return { success: false, error: 'Window not found or destroyed' };
});

// Update content in main window from detached window
ipcMain.handle('update-main-content', async (event, contentId, content, cursorPosition) => {
  console.log(`[Main Process] Received update from detached window for contentId: ${contentId}`);
  
  try {
    // Relay the update to the main window
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log(`[Main Process] Relaying update to main window`);
      mainWindow.webContents.send('update-content', { 
        contentId, 
        content, 
        cursorPosition 
      });
      return { success: true };
    } else {
      console.warn(`[Main Process] Main window not available for update`);
      return { success: false, error: 'Main window not available' };
    }
  } catch (error) {
    console.error(`[Main Process] Error relaying update to main window:`, error);
    return { success: false, error: error.message };
  }
});

// Update tab in detached window from main window
ipcMain.handle('update-detached-tab', async (event, contentId, filePath) => {
  console.log(`[Main Process] Updating tab in detached window for contentId: ${contentId}, file: ${filePath}`);
  
  try {
    const window = detachedWindows.get(contentId);
    if (window && !window.isDestroyed() && window.webContents) {
      console.log(`[Main Process] Found detached window, sending tab-change event`);
      window.webContents.send('tab-change', filePath);
      return { success: true };
    } else if (!window) {
      console.warn(`[Main Process] No detached window found for contentId: ${contentId}`);
      return { success: false, error: 'Detached window not found' };
    } else if (window.isDestroyed()) {
      console.warn(`[Main Process] Window for contentId ${contentId} was destroyed`);
      detachedWindows.delete(contentId); // Clean up the reference
      return { success: false, error: 'Detached window was destroyed' };
    } else {
      console.warn(`[Main Process] Window for contentId ${contentId} has no webContents`);
      return { success: false, error: 'Detached window has no webContents' };
    }
  } catch (error) {
    console.error(`[Main Process] Error updating tab in detached window:`, error);
    return { success: false, error: error.message };
  }
});

// Notify main window of tab change in detached window
ipcMain.handle('notify-main-tab-change', async (event, contentId, filePath) => {
  console.log(`[Main Process] Received tab change notification from detached window: ${filePath}`);
  
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log(`[Main Process] Sending tab change notification to main window`);
      mainWindow.webContents.send('detached-tab-change', contentId, filePath);
      return { success: true };
    } else {
      console.warn(`[Main Process] Main window not available for tab change notification`);
      return { success: false, error: 'Main window not available' };
    }
  } catch (error) {
    console.error(`[Main Process] Error notifying main window of tab change:`, error);
    return { success: false, error: error.message };
  }
});
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');

// Create a map to store file watchers
const fileWatchers = new Map();

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

// Create main window
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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

  // Load the app - in development or production
  const startUrl = process.env.ELECTRON_START_URL || 
                  `file://${path.join(__dirname, '../index.html')}`;
  mainWindow.loadURL(startUrl);

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// Create window when Electron is ready
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
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
    // Normalize file path for Windows if needed
    const normalizedPath = filePath.replace(/\\\\/g, '\\').replace(/\//g, '\\');
    console.log('[Main Process] Normalized path:', normalizedPath);
    
    // Check if file already exists
    if (fs.existsSync(normalizedPath)) {
      console.log('[Main Process] File already exists:', normalizedPath);
      throw new Error('File already exists');
    }
    
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
      
      for (const item of items) {
        const itemPath = path.join(currentPath, item.name);
        
        if (item.isDirectory()) {
          // Add this folder to our list
          folders.push({
            name: item.name,
            path: itemPath,
            type: 'folder'
          });
          
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

// File operations for drag and drop
ipcMain.handle('move-item', async (event, sourcePath, targetPath, isDirectory) => {
  try {
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

ipcMain.handle('copy-item', async (event, sourcePath, targetPath, isDirectory) => {
  try {
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

ipcMain.handle('rename-item', async (event, oldPath, newName, isDirectory) => {
  try {
    // Normalize path to handle different path separators
    oldPath = path.normalize(oldPath);
    
    const dirPath = path.dirname(oldPath);
    const newPath = path.join(dirPath, newName);
    
    // Check if target already exists
    if (fs.existsSync(newPath)) {
      return { 
        success: false, 
        message: `A file or folder named "${newName}" already exists in this location`,
        oldPath: oldPath,
        newPath: null
      };
    }
    
    // Perform the rename operation
    await fs.promises.rename(oldPath, newPath);
    
    // Verify the rename was successful
    if (fs.existsSync(newPath) && !fs.existsSync(oldPath)) {
      return { 
        success: true, 
        oldPath: oldPath,
        newPath: newPath
      };
    } else {
      return { 
        success: false, 
        message: 'Rename operation did not complete as expected',
        oldPath: oldPath,
        newPath: null
      };
    }
  } catch (error) {
    console.error('Error renaming item:', error);
    return { 
      success: false, 
      message: `Error renaming: ${error.message}`,
      oldPath: oldPath,
      newPath: null
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
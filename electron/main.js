const { app, BrowserWindow, ipcMain, dialog } = require('electron');
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

ipcMain.handle('open-folder', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    
    if (canceled) {
      return null;
    }
    
    return filePaths[0];
  } catch (error) {
    console.error('Error opening folder dialog:', error);
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

ipcMain.handle('rename-item', async (event, sourcePath, newName, isDirectory) => {
  try {
    const sourceDir = path.dirname(sourcePath);
    const targetPath = path.join(sourceDir, newName);
    
    // Check if the target already exists
    if (fs.existsSync(targetPath)) {
      return {
        success: false,
        message: `A ${isDirectory ? 'directory' : 'file'} with this name already exists`
      };
    }
    
    // Rename the item
    await fs.promises.rename(sourcePath, targetPath);
    
    return {
      success: true,
      message: `Successfully renamed ${isDirectory ? 'directory' : 'file'}`
    };
  } catch (error) {
    console.error('Error renaming item:', error);
    return {
      success: false,
      message: `Failed to rename ${isDirectory ? 'directory' : 'file'}: ${error.message}`
    };
  }
});
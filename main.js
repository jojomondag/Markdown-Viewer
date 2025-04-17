const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fileUtils = require('./fileUtils');
require('electron-reload')(__dirname, {
  electron: path.join(__dirname, 'node_modules', '.bin', 'electron'),
  hardResetMethod: 'exit'
});

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 3440,
    height: 1440,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Remove the menu bar
  //mainWindow.removeMenu();

  // Load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'src/index.html'));

  // Open the DevTools in development mode
  mainWindow.webContents.openDevTools();
};

// Handle file dialog requests
ipcMain.handle('open-file-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory', 'multiSelections']
  });
  if (canceled) {
    return [];
  } else {
    return filePaths;
  }
});

// Handle directory scanning for markdown files
ipcMain.handle('scan-directory', async (_, directoryPath) => {
  try {
    const result = await fileUtils.scanDirectoryForMarkdownFiles(directoryPath);
    return result;
  } catch (error) {
    console.error('Error scanning directory:', error);
    throw error;
  }
});

// Handle reading markdown file content
ipcMain.handle('read-markdown-file', async (_, filePath) => {
  try {
    return await fileUtils.readMarkdownFile(filePath);
  } catch (error) {
    console.error('Error reading markdown file:', error);
    throw error;
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
}); 
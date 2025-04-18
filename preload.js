// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Example API method
  sayHello: () => 'Hello from Electron!',
  // File dialog methods
  openFileDialog: () => ipcRenderer.invoke('open-folder'),
  // Directory scanning method
  scanDirectory: (directoryPath) => ipcRenderer.invoke('scan-folder', directoryPath),
  // Read markdown file
  readMarkdownFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  // Write markdown file
  writeMarkdownFile: (filePath, content) => ipcRenderer.invoke('save-file', filePath, content),
  // You can add more API methods here as needed
});

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency]);
  }
}); 
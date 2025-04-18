/**
 * Utility functions for interacting with the Electron file system API
 */

// Check if the Electron API is available
const isApiAvailable = () => {
  return typeof window !== 'undefined' && window.api !== undefined;
};

// Open a file dialog to select a folder
export const openFolder = async () => {
  try {
    if (!isApiAvailable()) {
      console.error('Error: window.api is not available.');
      throw new Error('Electron API is not available. Please run in Electron environment.');
    }
    
    const folderPath = await window.api.openFileDialog();
    if (folderPath === null) {
      // User cancelled the dialog
      return null; 
    }
    
    // For compatibility with code expecting an array
    return [folderPath];
  } catch (error) {
    console.error('Error opening folder:', error);
    throw error;
  }
};

// Scan a directory for markdown files
export const scanDirectory = async (directoryPath) => {
  try {
    if (!isApiAvailable()) {
      console.error('Error: window.api is not available.');
      throw new Error('Electron API is not available. Please run in Electron environment.');
    }
    
    const result = await window.api.scanDirectory(directoryPath);
    return result;
  } catch (error) {
    console.error('Error scanning directory:', error);
    throw error;
  }
};

// Read a markdown file
export const readMarkdownFile = async (filePath) => {
  try {
    if (!isApiAvailable()) {
      console.error('Error: window.api is not available.');
      throw new Error('Electron API is not available. Please run in Electron environment.');
    }
    
    const content = await window.api.readMarkdownFile(filePath);
    return content;
  } catch (error) {
    console.error('Error reading markdown file:', error);
    throw error;
  }
};

// Save a markdown file
export const saveMarkdownFile = async (filePath, content) => {
  try {
    if (!isApiAvailable()) {
      console.error('Error: window.api is not available.');
      throw new Error('Electron API is not available. Please run in Electron environment.');
    }
    
    await window.api.writeMarkdownFile(filePath, content);
  } catch (error) {
    console.error('Error saving markdown file:', error);
    throw error;
  }
}; 
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
      // Instead of throwing an error, use the mock API that's set up in polyfills.js
      return window.api?.openFileDialog() || Promise.resolve([]);
    }
    
    // Enable multiSelections to allow selecting multiple folders
    const folderPaths = await window.api.openFileDialog(true); // Add true parameter for multiSelect
    
    // Handle cancellation
    if (folderPaths === null) {
      // User cancelled the dialog
      return null; 
    }
    
    // Handle different return types - ensure we always return an array
    return Array.isArray(folderPaths) ? folderPaths : [folderPaths];
  } catch (error) {
    console.error('Error in openFolder function:', error);
    // Return an empty array instead of throwing to prevent UI blocking
    return [];
  }
};

// Scan a directory for markdown files
export const scanDirectory = async (directoryPath) => {
  try {
    if (!isApiAvailable()) {
      console.warn('Warning: window.api is not available for scanning directory. Using mock implementation.');
      // Use mock API from polyfills if available
      return window.api?.scanDirectory(directoryPath) || { files: [], folders: [] };
    }
    
    const result = await window.api.scanDirectory(directoryPath);
    return result;
  } catch (error) {
    console.error('Error scanning directory:', error);
    // Return empty arrays instead of throwing
    return { files: [], folders: [] };
  }
};

// Read a markdown file
export const readMarkdownFile = async (filePath) => {
  try {
    if (!isApiAvailable()) {
      console.warn('Warning: window.api is not available for reading file. Using mock implementation.');
      return window.api?.readMarkdownFile(filePath) || '# Unable to read file\n\nElectron API is not available.';
    }
    
    const content = await window.api.readMarkdownFile(filePath);
    
    // Add validation to handle null/undefined content
    if (content === null || content === undefined) {
      console.warn(`Read null or undefined content from file: ${filePath}`);
      return ''; // Return empty string instead of null/undefined
    }
    
    return content;
  } catch (error) {
    console.error('Error reading markdown file:', error);
    return `# Error Reading File\n\n${error.message}`;
  }
};

// Save a markdown file
export const saveMarkdownFile = async (filePath, content) => {
  try {
    if (!isApiAvailable()) {
      console.warn('Warning: window.api is not available for saving file. Using mock implementation.');
      return window.api?.writeMarkdownFile(filePath, content);
    }
    
    await window.api.writeMarkdownFile(filePath, content);
    return true;
  } catch (error) {
    console.error('Error saving markdown file:', error);
    throw error;
  }
};
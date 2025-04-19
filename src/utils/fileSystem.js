/**
 * Utility functions for interacting with the Electron file system API
 */

// Check if the Electron API is available
const isApiAvailable = () => {
  return typeof window !== 'undefined' && window.api !== undefined;
};

// Open a file dialog to select a folder
export const openFolder = async () => {
  console.log('Attempting to open folder...'); // Log entry
  try {
    if (!isApiAvailable()) {
      console.warn('Warning: window.api is not available. Using mock implementation.'); // Log mock usage
      // Instead of throwing an error, use the mock API that's set up in polyfills.js
      const mockResult = await (window.api?.openFileDialog() || Promise.resolve([]));
      console.log('Mock openFileDialog result:', mockResult); // Log mock result
      return mockResult;
    }
    
    console.log('Using real window.api.openFileDialog'); // Log real API usage
    const folderPath = await window.api.openFileDialog();
    console.log('Real openFileDialog result:', folderPath); // Log real API result
    
    // Handle cancellation
    if (folderPath === null) {
      console.log('Folder selection cancelled by user.'); // Log cancellation
      // User cancelled the dialog
      return null; 
    }
    
    // Handle different return types - ensure we always return an array
    const result = Array.isArray(folderPath) ? folderPath : [folderPath];
    console.log('Processed folder path:', result); // Log processed result
    return result;
  } catch (error) {
    console.error('Error in openFolder function:', error); // Log errors
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
import { useState, useCallback } from 'react';
import { openFolder, scanDirectory, readMarkdownFile, saveMarkdownFile } from '../utils/fileSystem';

const useFiles = () => {
  const [directories, setDirectories] = useState([]);
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFile, setCurrentFile] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Open a folder and scan for markdown files
  const openAndScanFolder = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try to open folder using fileSystem utility with multiSelect enabled
      const selectedFolders = await openFolder();
      
      // Check if folder selection was cancelled or empty
      if (!selectedFolders || selectedFolders.length === 0) {
        console.log('Folder selection was cancelled or returned empty');
        setLoading(false);
        return null;
      }
      
      // Process all selected folders
      let allFolders = [];
      let allFiles = [];
      let addedDirectories = [];
      
      // Loop through each selected folder and scan it
      for (const folderPath of selectedFolders) {
        // Check if this folder is already in our list
        if (directories.includes(folderPath)) {
          console.log(`Folder already added: ${folderPath}`);
          continue; // Skip this folder
        }
        
        // Add to our list of added directories
        addedDirectories.push(folderPath);
        
        // Scan the directory for files and folders
        const result = await scanDirectory(folderPath);
        
        // Make sure we have valid folders and files
        const scannedFolders = result?.folders || [];
        const markdownFiles = result?.files || [];
        
        // Add to our collection
        allFolders = [...allFolders, ...scannedFolders];
        allFiles = [...allFiles, ...markdownFiles];
      }
      
      // Update state with all the new directories, folders and files
      if (addedDirectories.length > 0) {
        setDirectories(prev => [...prev, ...addedDirectories]);
        setFolders(prev => [...prev, ...allFolders]);
        setFiles(prev => [...prev, ...allFiles]);
      }
      
      // Return info about what was added
      return { 
        folderPaths: addedDirectories,
        folders: allFolders,
        files: allFiles
      };
    } catch (err) {
      setError(err.message || 'Failed to open folder');
      console.error('Error opening folder:', err);
      throw err; // Rethrow to let the caller handle it
    } finally {
      setLoading(false);
    }
  }, [directories]);

  // Helper to clear all folders
  const clearFolders = useCallback(() => {
    setDirectories([]);
    setFolders([]);
    setFiles([]);
    setCurrentFile(null);
    setContent('');
  }, []);

  // Open a markdown file
  const openFile = useCallback(async (file) => {
    try {
      setLoading(true);
      setError(null);
      
      // Validate file object
      if (!file || !file.path) {
        console.error('Invalid file object provided to openFile');
        setError('Invalid file object');
        setLoading(false);
        return;
      }
      
      const fileContent = await readMarkdownFile(file.path);
      
      // Ensure content is set to empty string if undefined/null
      setContent(fileContent || '');
      setCurrentFile(file);
    } catch (err) {
      setError(err.message || 'Failed to open file');
      console.error('Error opening file:', err);
      // Set empty content on error to avoid undefined issues
      setContent('');
    } finally {
      setLoading(false);
    }
  }, []);

  // Save the current file
  const saveFile = useCallback(async (newContent) => {
    if (!currentFile) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Ensure content is never undefined
      const contentToSave = newContent || '';
      
      await saveMarkdownFile(currentFile.path, contentToSave);
      setContent(contentToSave);
    } catch (err) {
      setError(err.message || 'Failed to save file');
      console.error('Error saving file:', err);
    } finally {
      setLoading(false);
    }
  }, [currentFile]);

  // Update content without saving
  const updateContent = useCallback((newContent) => {
    // Ensure content is never undefined
    setContent(newContent || '');
  }, []);

  return {
    directories,
    files,
    folders,
    currentFile,
    content,
    loading,
    error,
    openAndScanFolder,
    clearFolders,
    openFile,
    saveFile,
    updateContent,
    setFiles,
    setFolders
  };
};

export default useFiles;
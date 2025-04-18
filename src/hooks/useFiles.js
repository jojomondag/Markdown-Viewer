import { useState, useCallback } from 'react';
import { openFolder, scanDirectory, readMarkdownFile, saveMarkdownFile } from '../utils/fileSystem';

const useFiles = () => {
  const [currentDirectory, setCurrentDirectory] = useState(null);
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
      
      const selectedFolders = await openFolder();
      // Handle cases where user cancels the dialog or API returns null
      if (!selectedFolders) {
        console.log('Folder selection was cancelled');
        return null;
      }
      
      if (selectedFolders.length > 0) {
        const directoryPath = selectedFolders[0];
        setCurrentDirectory(directoryPath);
        
        const result = await scanDirectory(directoryPath);
        // Make sure we have valid folders and files
        const scannedFolders = result?.folders || [];
        const markdownFiles = result?.files || [];
        
        setFolders(scannedFolders);
        setFiles(markdownFiles);
        
        // Return the folder path to inform the caller
        return { 
          folderPath: directoryPath,
          folders: scannedFolders,
          files: markdownFiles
        };
      }
      return null;
    } catch (err) {
      setError(err.message || 'Failed to open folder');
      console.error('Error opening folder:', err);
      throw err; // Rethrow to let the caller handle it
    } finally {
      setLoading(false);
    }
  }, []);

  // Open a markdown file
  const openFile = useCallback(async (file) => {
    try {
      setLoading(true);
      setError(null);
      
      const fileContent = await readMarkdownFile(file.path);
      setContent(fileContent);
      setCurrentFile(file);
    } catch (err) {
      setError(err.message || 'Failed to open file');
      console.error('Error opening file:', err);
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
      
      await saveMarkdownFile(currentFile.path, newContent);
      setContent(newContent);
    } catch (err) {
      setError(err.message || 'Failed to save file');
      console.error('Error saving file:', err);
    } finally {
      setLoading(false);
    }
  }, [currentFile]);

  // Update content without saving
  const updateContent = useCallback((newContent) => {
    setContent(newContent);
  }, []);

  return {
    currentDirectory,
    files,
    folders,
    currentFile,
    content,
    loading,
    error,
    openAndScanFolder,
    openFile,
    saveFile,
    updateContent
  };
};

export default useFiles;
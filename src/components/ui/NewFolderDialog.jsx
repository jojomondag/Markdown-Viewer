import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './modal';
import { IconFolderPlus } from '@tabler/icons-react';

/**
 * Dialog for creating a new folder
 */
const NewFolderDialog = ({ 
  isOpen, 
  onClose, 
  onCreateFolder,
  parentFolder,
}) => {
  const [folderName, setFolderName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  
  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setFolderName('');
      setError('');
      // Focus the input after the modal is rendered
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // First clean the name - remove any path components
    let cleanFolderName = folderName;
    
    // Remove any path-like segments (everything before the last slash or backslash)
    if (folderName.includes('/') || folderName.includes('\\')) {
      const lastSlashIndex = Math.max(
        folderName.lastIndexOf('/'), 
        folderName.lastIndexOf('\\')
      );
      
      if (lastSlashIndex !== -1) {
        cleanFolderName = folderName.substring(lastSlashIndex + 1);
      }
    }
    
    // Validate the cleaned folder name
    if (!cleanFolderName.trim()) {
      setError('Folder name cannot be empty');
      return;
    }
    
    // Check for invalid characters in the cleaned name
    if (/[<>:"/\\|?*]/.test(cleanFolderName)) {
      setError('Folder name contains invalid characters');
      return;
    }
    
    // Call the create folder handler with the clean name
    onCreateFolder(cleanFolderName);
    onClose();
  };
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Folder"
      size="sm"
      footer={
        <>
          <button
            type="button"
            className="px-4 py-2 border border-surface-300 dark:border-surface-600 rounded-md text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="new-folder-form"
            className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            Create
          </button>
        </>
      }
    >
      <form id="new-folder-form" onSubmit={handleSubmit}>
        <div className="mb-4">
          <label 
            htmlFor="folder-name" 
            className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
          >
            Folder Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <IconFolderPlus 
                size={18} 
                className="text-surface-500 dark:text-surface-400" 
              />
            </div>
            <input
              ref={inputRef}
              type="text"
              id="folder-name"
              className={`w-full pl-10 pr-3 py-2 border ${error ? 'border-error-500' : 'border-surface-300 dark:border-surface-600'} rounded-md bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500`}
              placeholder="Enter folder name"
              value={folderName}
              onChange={(e) => {
                // Clean the input value as the user types to prevent slash characters
                let newValue = e.target.value;
                
                // If input contains slashes or backslashes, strip everything before the last slash/backslash
                if (newValue.includes('/') || newValue.includes('\\')) {
                  const lastSlashIndex = Math.max(
                    newValue.lastIndexOf('/'), 
                    newValue.lastIndexOf('\\')
                  );
                  
                  if (lastSlashIndex !== -1) {
                    newValue = newValue.substring(lastSlashIndex + 1);
                    // After cleaning, re-check for invalid characters
                    if (/[<>:"/\\|?*]/.test(newValue)) {
                      setError('Folder name contains invalid characters');
                    } else {
                      setError('');
                    }
                  }
                } else if (/[<>:"/\\|?*]/.test(newValue)) {
                  setError('Folder name contains invalid characters');
                } else {
                  setError('');
                }
                
                // Update state with clean name
                setFolderName(newValue);
              }}
            />
          </div>
          {error && (
            <p className="mt-1 text-sm text-error-500">{error}</p>
          )}
          {parentFolder && (
            <p className="mt-2 text-xs text-surface-500 dark:text-surface-400">
              Creating folder in: {parentFolder.name || parentFolder.path}
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
};

export { NewFolderDialog }; 
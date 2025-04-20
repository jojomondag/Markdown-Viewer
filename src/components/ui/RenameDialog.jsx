import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './modal';
import { IconEdit, IconFile, IconFolder } from '@tabler/icons-react';
import path from 'path-browserify';

/**
 * Dialog for renaming files and folders
 */
const RenameDialog = ({ 
  isOpen, 
  onClose, 
  onRename,
  item,
}) => {
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  
  // Reset state and set initial value when modal opens
  useEffect(() => {
    if (isOpen && item) {
      // Get just the basename for the initial value
      let basename = '';
      if (item.name) {
        basename = item.name;
      } else if (item.path) {
        basename = path.basename(item.path);
      }
      
      setNewName(basename);
      setError('');
      
      // Focus the input after the modal is rendered
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          // Select the name part without the extension for files
          if (item.type === 'file') {
            const extIndex = basename.lastIndexOf('.');
            if (extIndex > 0) {
              inputRef.current.setSelectionRange(0, extIndex);
            } else {
              inputRef.current.select();
            }
          } else {
            inputRef.current.select();
          }
        }
      }, 100);
    }
  }, [isOpen, item]);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate new name
    if (!newName.trim()) {
      setError('Name cannot be empty');
      return;
    }
    
    // Check for invalid characters
    if (/[<>:"/\\|?*]/.test(newName)) {
      setError('Name contains invalid characters');
      return;
    }
    
    // Call the rename handler
    onRename(item.path, newName);
    onClose();
  };
  
  if (!item) return null;
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Rename ${item.type === 'file' ? 'File' : 'Folder'}`}
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
            form="rename-form"
            className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            Rename
          </button>
        </>
      }
    >
      <form id="rename-form" onSubmit={handleSubmit}>
        <div className="mb-4">
          <label 
            htmlFor="item-name" 
            className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
          >
            New Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {item.type === 'file' ? (
                <IconFile 
                  size={18} 
                  className="text-surface-500 dark:text-surface-400" 
                />
              ) : (
                <IconFolder 
                  size={18} 
                  className="text-surface-500 dark:text-surface-400" 
                />
              )}
            </div>
            <input
              ref={inputRef}
              type="text"
              id="item-name"
              className={`w-full pl-10 pr-3 py-2 border ${error ? 'border-error-500' : 'border-surface-300 dark:border-surface-600'} rounded-md bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500`}
              placeholder={`Enter new ${item.type} name`}
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                if (error) setError('');
              }}
            />
          </div>
          {error && (
            <p className="mt-1 text-sm text-error-500">{error}</p>
          )}
          <p className="mt-2 text-xs text-surface-500 dark:text-surface-400">
            Current path: {item.path}
          </p>
        </div>
      </form>
    </Modal>
  );
};

export { RenameDialog }; 
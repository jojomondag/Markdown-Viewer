import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './ui/modal'; // Assuming modal is in ui subfolder
import { IconDeviceFloppy } from '@tabler/icons-react';

/**
 * Dialog for naming a saved project state.
 */
const SaveStateDialog = ({ 
  isOpen, 
  onClose, 
  onSubmit,
  defaultName = '' // Allow passing a default name
}) => {
  const [stateName, setStateName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  
  // Reset state when modal opens and set default name
  useEffect(() => {
    if (isOpen) {
      setStateName(defaultName);
      setError('');
      // Focus the input after the modal is rendered
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select(); // Select the default text
        }
      }, 100); 
    }
  }, [isOpen, defaultName]);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    const cleanName = stateName.trim();
    
    if (!cleanName) {
      setError('State name cannot be empty.');
      return;
    }
    
    // Optional: Add more validation if needed (e.g., length, characters)
    
    onSubmit(cleanName); // Pass the validated name to the parent handler
    onClose(); // Close the dialog
  };
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Save Project State"
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
            form="save-state-form" // Link to the form
            className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            Save State
          </button>
        </>
      }
    >
      <form id="save-state-form" onSubmit={handleSubmit} noValidate>
        <div className="mb-4">
          <label 
            htmlFor="state-name" 
            className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
          >
            State Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <IconDeviceFloppy 
                size={18} 
                className="text-surface-500 dark:text-surface-400" 
              />
            </div>
            <input
              ref={inputRef}
              type="text"
              id="state-name"
              className={`w-full pl-10 pr-3 py-2 border ${error ? 'border-error-500' : 'border-surface-300 dark:border-surface-600'} rounded-md bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500`}
              placeholder="Enter a name for this state"
              value={stateName}
              onChange={(e) => setStateName(e.target.value)}
              required // Basic HTML5 validation
            />
          </div>
          {error && (
            <p className="mt-1 text-xs text-error-500">{error}</p>
          )}
        </div>
      </form>
    </Modal>
  );
};

export default SaveStateDialog; 
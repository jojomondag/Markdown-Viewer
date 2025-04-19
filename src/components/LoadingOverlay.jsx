import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';

/**
 * Loading overlay component
 * @param {Object} props Component props
 * @param {boolean} props.isLoading Whether loading is in progress
 * @param {string} props.message Message to display during loading
 * @param {boolean} props.transparent Whether the overlay should be transparent
 * @param {React.ReactNode} props.children Content to display when not loading
 */
const LoadingOverlay = ({ isLoading, message, transparent = false, children, preserveChildren = true }) => {
  // Use local loading state with a timeout safety
  const [showLoading, setShowLoading] = useState(isLoading);
  const [showCancelButton, setShowCancelButton] = useState(false);
  
  useEffect(() => {
    // Update the local loading state when the prop changes
    setShowLoading(isLoading);
    setShowCancelButton(false);
    
    // Set up a safety timeout to avoid stuck spinners
    let timeoutId, cancelButtonTimeoutId;
    if (isLoading) {
      // Show cancel button after 5 seconds
      cancelButtonTimeoutId = setTimeout(() => {
        setShowCancelButton(true);
      }, 5000);
      
      // Automatically hide the spinner after 10 seconds
      timeoutId = setTimeout(() => {
        setShowLoading(false);
      }, 10000);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (cancelButtonTimeoutId) clearTimeout(cancelButtonTimeoutId);
    };
  }, [isLoading]);
  
  const bgClasses = transparent
    ? 'bg-white/80 dark:bg-surface-900/80'
    : 'bg-white dark:bg-surface-900';

  // Handle manual cancel
  const handleCancel = () => {
    setShowLoading(false);
  };

  // If preserveChildren is true, we keep rendering children even during loading
  // This prevents the UI from "forgetting" the current state during loading
  return (
    <div className="relative w-full h-full">
      {(preserveChildren || !showLoading) && children}
      
      {showLoading && (
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center z-50 ${bgClasses} transition-opacity duration-200`}
        >
          <LoadingSpinner size="lg" />
          {message && (
            <p className="mt-4 text-surface-700 dark:text-surface-300 font-medium">
              {message}
            </p>
          )}
          {showCancelButton && (
            <button 
              onClick={handleCancel}
              className="mt-4 px-3 py-1 bg-error-100 text-error-700 dark:bg-error-900 dark:text-error-300 rounded hover:bg-error-200 dark:hover:bg-error-800 transition-colors"
            >
              Cancel Loading
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default LoadingOverlay; 
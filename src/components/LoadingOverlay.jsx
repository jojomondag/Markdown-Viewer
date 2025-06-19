import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';

/**
 * Loading overlay component
 * @param {Object} props Component props
 * @param {boolean} props.isLoading Whether loading is in progress
 * @param {string} props.message Message to display during loading
 * @param {boolean} props.transparent Whether the overlay should be transparent
 * @param {React.ReactNode} props.children Content to display when not loading
 * @param {boolean} props.preserveChildren Whether to preserve children during loading
 */
const LoadingOverlay = ({ isLoading, message, transparent = false, children, preserveChildren = true }) => {
  // Use local loading state with a timeout safety - REMOVED: Simplify, rely directly on isLoading prop
  // const [showLoading, setShowLoading] = useState(isLoading);
  // const [showCancelButton, setShowCancelButton] = useState(false);

  // REMOVED: useEffect managing timeouts

  const bgClasses = transparent
    ? 'bg-white/80 dark:bg-surface-900/80'
    : 'bg-white dark:bg-surface-900';

  // REMOVED: handleCancel logic, as the button is removed

  // If preserveChildren is true, we keep rendering children even during loading
  // This prevents the UI from "forgetting" the current state during loading
  return (
    <div className="relative w-full h-full flex flex-col">
      {(preserveChildren || !isLoading) && children}

      {/* Only show loading overlay if there's a message to display */}
      {isLoading && message && (
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center z-50 ${bgClasses}`}
        >
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-surface-700 dark:text-surface-300 font-medium">
            {message}
          </p>
        </div>
      )}
    </div>
  );
};

export default LoadingOverlay; 
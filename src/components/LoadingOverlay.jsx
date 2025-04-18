import React from 'react';
import LoadingSpinner from './LoadingSpinner';

/**
 * Loading overlay that covers a section of the UI
 * Can be full screen or contained within a parent element
 */
const LoadingOverlay = ({ 
  isLoading, 
  message = 'Loading...', 
  fullScreen = false,
  transparent = false,
  children
}) => {
  if (!isLoading) {
    return children || null;
  }
  
  const positionClasses = fullScreen 
    ? 'fixed inset-0 z-50' 
    : 'absolute inset-0 z-10';
    
  const bgClasses = transparent
    ? 'bg-white/70 dark:bg-surface-900/70 backdrop-blur-sm'
    : 'bg-white dark:bg-surface-900';

  return (
    <div className="relative">
      {children}
      
      <div className={`${positionClasses} ${bgClasses} flex flex-col items-center justify-center pointer-events-none`}>
        <LoadingSpinner size="lg" />
        
        {message && (
          <p className="mt-4 text-surface-700 dark:text-surface-300 font-medium">
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default LoadingOverlay; 
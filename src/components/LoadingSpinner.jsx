import React from 'react';

/**
 * Loading spinner component with customizable size and color
 */
const LoadingSpinner = ({ 
  size = 'md', 
  color = 'primary',
  className = ''
}) => {
  // Size classes
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  };
  
  // Color classes
  const colorClasses = {
    primary: 'border-primary-500',
    surface: 'border-surface-500',
    white: 'border-white'
  };
  
  return (
    <div className={`${className} flex items-center justify-center`}>
      <div 
        className={`
          ${sizeClasses[size]} 
          ${colorClasses[color]} 
          border-t-transparent 
          rounded-full 
          animate-spin
        `}
        role="status"
        aria-label="Loading"
      />
    </div>
  );
};

export default LoadingSpinner; 
import React, { useEffect, useRef } from 'react';

/**
 * ContextMenu component that displays a dropdown with options at a specific position
 */
const ContextMenu = ({ 
  items = [], 
  onClose, 
  position = { x: 0, y: 0 },
  className = "",
}) => {
  const menuRef = useRef(null);
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);
  
  // Ensure menu stays within viewport bounds
  useEffect(() => {
    if (!menuRef.current) return;
    
    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Adjust horizontal position if menu overflows to the right
    if (position.x + rect.width > viewportWidth) {
      menu.style.left = `${viewportWidth - rect.width - 10}px`;
    }
    
    // Adjust vertical position if menu overflows to the bottom
    if (position.y + rect.height > viewportHeight) {
      menu.style.top = `${viewportHeight - rect.height - 10}px`;
    }
  }, [position]);

  return (
    <div 
      ref={menuRef}
      className={`
        absolute z-50 shadow-lg rounded-md min-w-40
        bg-white dark:bg-surface-800 
        border border-surface-200 dark:border-surface-700
        py-1 text-sm
        ${className}
      `}
      style={{ 
        top: `${position.y}px`, 
        left: `${position.x}px` 
      }}
      role="menu"
    >
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {item.divider ? (
            <div className="h-px bg-surface-200 dark:bg-surface-700 my-1" />
          ) : (
            <button
              className={`
                flex items-center w-full px-4 py-1.5 
                text-surface-800 dark:text-surface-100
                hover:bg-surface-100 dark:hover:bg-surface-700
                disabled:opacity-50 disabled:pointer-events-none
                ${item.danger ? 'text-error-500 hover:text-error-700 dark:hover:text-error-400' : ''}
                ${item.className || ''}
              `}
              onClick={(e) => {
                if (item.onClick) item.onClick(e);
                onClose();
              }}
              disabled={item.disabled}
              role="menuitem"
            >
              {item.icon && (
                <span className="mr-2">{item.icon}</span>
              )}
              {item.label}
            </button>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export { ContextMenu }; 
import React, { useState, useEffect, useRef } from 'react';
import { IconX, IconPlus } from '@tabler/icons-react';
import useNotification from '../hooks/useNotification';

const EditorTabs = ({ 
  currentFile, 
  openFiles, 
  onTabChange, 
  onTabClose, 
  onNewTab 
}) => {
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, file: null });
  const { showInfo } = useNotification();
  
  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu({ visible: false, x: 0, y: 0, file: null });
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);
  
  // Handle context menu (right click)
  const handleContextMenu = (e, file) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Position the menu at the mouse position
    setContextMenu({ 
      visible: true, 
      x: e.clientX,
      y: e.clientY, 
      file
    });
  };
  
  // Handle tab close click
  const handleCloseClick = (e, file) => {
    e.stopPropagation();
    if (onTabClose) {
      onTabClose(file);
    }
  };
  
  // Handle context menu options
  const handleCloseOthers = (file) => {
    if (onTabClose) {
      openFiles
        .filter(f => f.path !== file.path)
        .forEach(f => onTabClose(f));
      
      showInfo('Closed other tabs');
    }
    setContextMenu({ visible: false, x: 0, y: 0, file: null });
  };
  
  const handleCloseAll = () => {
    if (onTabClose) {
      openFiles.forEach(f => onTabClose(f));
      showInfo('Closed all tabs');
    }
    setContextMenu({ visible: false, x: 0, y: 0, file: null });
  };
  
  const handleCloseRight = (file) => {
    if (onTabClose) {
      const currentIndex = openFiles.findIndex(f => f.path === file.path);
      if (currentIndex >= 0) {
        openFiles
          .slice(currentIndex + 1)
          .forEach(f => onTabClose(f));
        
        showInfo('Closed tabs to the right');
      }
    }
    setContextMenu({ visible: false, x: 0, y: 0, file: null });
  };
  
  return (
    <div className="editor-tabs flex items-center overflow-x-auto bg-surface-100 dark:bg-surface-800 border-b border-surface-300 dark:border-surface-700 relative z-5 shadow-sm pointer-events-auto">
      {openFiles.map((file) => {
        const isActive = currentFile && file.path === currentFile.path;
        const isDirty = file.isDirty;
        
        return (
          <div 
            key={file.path} 
            className={`
              flex items-center min-w-[90px] max-w-[150px] h-8 px-2 py-0.5 cursor-pointer relative
              border-r border-surface-300 dark:border-surface-700
              ${isActive 
                ? 'bg-white dark:bg-surface-900 text-primary-600 dark:text-primary-400' 
                : 'bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700'}
            `}
            onClick={() => onTabChange(file)}
            onContextMenu={(e) => handleContextMenu(e, file)}
          >
            <span className="truncate flex-grow text-xs">{file.name}</span>
            
            {isDirty && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-warning-500 flex-shrink-0" />
            )}
            
            <button
              className="ml-1 p-0.5 rounded-full hover:bg-surface-300 dark:hover:bg-surface-600 text-surface-500 dark:text-surface-400 flex-shrink-0"
              onClick={(e) => handleCloseClick(e, file)}
              title="Close tab"
            >
              <IconX size={12} />
            </button>
          </div>
        );
      })}
      
      {/* Context menu */}
      {contextMenu.visible && contextMenu.file && (
        <div 
          className="fixed z-50 rounded-md shadow-lg bg-white dark:bg-surface-800 ring-1 ring-black ring-opacity-5 focus:outline-none"
          style={{ 
            left: `${contextMenu.x}px`, 
            top: `${contextMenu.y}px`,
            transform: 'translate(-50%, -100%)' // Position above cursor
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="py-1 px-1 flex flex-row space-x-2">
            <button 
              className="px-3 py-1 text-xs text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded"
              onClick={() => handleCloseOthers(contextMenu.file)}
            >
              Close other
            </button>
            <button 
              className="px-3 py-1 text-xs text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded"
              onClick={() => handleCloseRight(contextMenu.file)}
            >
              Close right
            </button>
            <button 
              className="px-3 py-1 text-xs text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded"
              onClick={handleCloseAll}
            >
              Close all
            </button>
          </div>
        </div>
      )}
      
      {/* New tab button */}
      <button
        className="h-8 px-2 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700 flex items-center"
        onClick={onNewTab}
        title="New tab"
      >
        <IconPlus size={14} />
      </button>
    </div>
  );
};

export default EditorTabs; 
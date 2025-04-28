import React, { useState, useEffect } from 'react';
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
  
  const filteredOpenFiles = openFiles;
  
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
      filteredOpenFiles
        .filter(f => f.path !== file.path)
        .forEach(f => onTabClose(f));
      
      showInfo('Closed other tabs');
    }
    setContextMenu({ visible: false, x: 0, y: 0, file: null });
  };
  
  const handleCloseAll = () => {
    if (onTabClose) {
      filteredOpenFiles.forEach(f => onTabClose(f));
      showInfo('Closed all tabs');
    }
    setContextMenu({ visible: false, x: 0, y: 0, file: null });
  };
  
  const handleCloseRight = (file) => {
    if (onTabClose) {
      const currentIndex = filteredOpenFiles.findIndex(f => f.path === file.path);
      if (currentIndex >= 0) {
        filteredOpenFiles
          .slice(currentIndex + 1)
          .forEach(f => onTabClose(f));
        
        showInfo('Closed tabs to the right');
      }
    }
    setContextMenu({ visible: false, x: 0, y: 0, file: null });
  };
  
  return (
    <div className="editor-tabs min-w-0 flex-1 flex items-center gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-surface-400 dark:scrollbar-thumb-surface-600 pr-2 min-h-[38px] bg-surface-100 dark:bg-surface-800 border-b border-surface-300 dark:border-surface-700 relative z-5 shadow-sm pointer-events-auto">
      {filteredOpenFiles.map((file) => {
        const isActive = currentFile && file.path === currentFile.path;
        const isDirty = file.isDirty;
        
        return (
          <button
            key={file.path}
            className={`
              flex-shrink-0 px-2 py-1 border-b-2 text-xs whitespace-nowrap transition-colors duration-150 ease-in-out group relative flex items-center focus:outline-none
              ${isActive
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent hover:border-surface-400 dark:hover:border-surface-500 text-surface-600 dark:text-surface-300 hover:text-surface-800 dark:hover:text-surface-100'}
            `}
            style={{ paddingRight: isDirty ? '1.1rem' : '1.6rem' }}
            onClick={() => onTabChange(file)}
            onContextMenu={(e) => handleContextMenu(e, file)}
            title={file.path}
          >
            <span className="truncate flex-grow">{file.name}</span>
            
            {isDirty && (
              <span className="ml-1 mr-0.5 w-1.5 h-1.5 rounded-full bg-warning-500 flex-shrink-0" />
            )}
            
            <button
              onClick={(e) => handleCloseClick(e, file)}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 p-0.5 rounded-full text-surface-400 dark:text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700 hover:text-surface-700 dark:hover:text-surface-200 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out flex-shrink-0 focus:outline-none"
              title={`Close tab: ${file.name}`}
            >
              <IconX size={12} />
            </button>
          </button>
        );
      })}
      
      {/* Context menu */}
      {contextMenu.visible && contextMenu.file && (
        <div
          className="fixed z-50 rounded-md shadow-lg bg-white dark:bg-surface-800 ring-1 ring-black ring-opacity-5 focus:outline-none"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            // Position slightly above and potentially centered on the cursor
            // transform: 'translateY(-100%)' // Simple above cursor
            transform: 'translate(-20px, -100%)' // Move slightly left and above
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="py-1 px-1 flex flex-row gap-1">
            <button
              className="px-3 py-1 text-xs text-left text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded focus:outline-none"
              onClick={() => handleCloseOthers(contextMenu.file)}
            >
              Close Others
            </button>
            <button
              className="px-3 py-1 text-xs text-left text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded focus:outline-none"
              onClick={() => handleCloseRight(contextMenu.file)}
            >
              Close to the Right
            </button>
            <button
              className="px-3 py-1 text-xs text-left text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded focus:outline-none"
              onClick={handleCloseAll}
            >
              Close All
            </button>
          </div>
        </div>
      )}
      
      {/* New tab button */}
      <button
        className="flex-shrink-0 px-1.5 py-1 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700 flex items-center rounded focus:outline-none"
        onClick={onNewTab}
        title="New tab"
      >
        <IconPlus size={14} />
      </button>
    </div>
  );
};

export default EditorTabs;
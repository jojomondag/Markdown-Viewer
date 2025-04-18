import React, { useState, useEffect } from 'react';
import { IconX, IconPlus, IconDotsVertical } from '@tabler/icons-react';
import { useAppState } from '../context/AppStateContext';
import useNotification from '../hooks/useNotification';

const EditorTabs = ({ 
  currentFile, 
  openFiles, 
  onTabChange, 
  onTabClose, 
  onNewTab 
}) => {
  const [activeMenu, setActiveMenu] = useState(null);
  const { showInfo } = useNotification();
  
  // Close tab menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenu(null);
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);
  
  // Handle tab menu click
  const handleTabMenuClick = (e, fileId) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === fileId ? null : fileId);
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
    setActiveMenu(null);
  };
  
  const handleCloseAll = () => {
    if (onTabClose) {
      openFiles.forEach(f => onTabClose(f));
      showInfo('Closed all tabs');
    }
    setActiveMenu(null);
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
    setActiveMenu(null);
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
              flex items-center min-w-[120px] max-w-[200px] h-10 px-3 py-1 cursor-pointer relative
              border-r border-surface-300 dark:border-surface-700
              ${isActive 
                ? 'bg-white dark:bg-surface-900 text-primary-600 dark:text-primary-400' 
                : 'bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700'}
            `}
            onClick={() => onTabChange(file)}
          >
            <span className="truncate flex-grow text-sm">{file.name}</span>
            
            {isDirty && (
              <span className="ml-1 w-2 h-2 rounded-full bg-warning-500 flex-shrink-0" />
            )}
            
            <button
              className="ml-2 p-0.5 rounded-full hover:bg-surface-300 dark:hover:bg-surface-600 text-surface-500 dark:text-surface-400 flex-shrink-0"
              onClick={(e) => handleCloseClick(e, file)}
              title="Close tab"
            >
              <IconX size={14} />
            </button>
            
            <button
              className="ml-1 p-0.5 rounded-full hover:bg-surface-300 dark:hover:bg-surface-600 text-surface-500 dark:text-surface-400 flex-shrink-0"
              onClick={(e) => handleTabMenuClick(e, file.path)}
              title="Tab options"
            >
              <IconDotsVertical size={14} />
            </button>
            
            {/* Tab menu */}
            {activeMenu === file.path && (
              <div 
                className="absolute top-full left-0 z-50 mt-1 w-48 rounded-md shadow-lg bg-white dark:bg-surface-800 ring-1 ring-black ring-opacity-5 focus:outline-none"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="py-1">
                  <button 
                    className="block w-full text-left px-4 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700"
                    onClick={() => handleCloseOthers(file)}
                  >
                    Close other tabs
                  </button>
                  <button 
                    className="block w-full text-left px-4 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700"
                    onClick={() => handleCloseRight(file)}
                  >
                    Close tabs to the right
                  </button>
                  <button 
                    className="block w-full text-left px-4 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700"
                    onClick={handleCloseAll}
                  >
                    Close all tabs
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      
      {/* New tab button */}
      <button
        className="h-10 px-3 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700 flex items-center"
        onClick={onNewTab}
        title="New tab"
      >
        <IconPlus size={16} />
      </button>
    </div>
  );
};

export default EditorTabs; 
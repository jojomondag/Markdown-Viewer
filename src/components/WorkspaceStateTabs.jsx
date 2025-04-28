import React, { useState, useEffect } from 'react';
import { IconX } from '@tabler/icons-react';

const WorkspaceStateTabs = ({ savedWorkspaceStates, onLoadState, onRemoveState }) => {
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, stateData: null });
  const states = Object.values(savedWorkspaceStates);

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu({ visible: false, x: 0, y: 0, stateData: null });
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const handleContextMenu = (e, stateData) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      stateData
    });
  };

  const handleCloseOthers = (stateToKeep) => {
    if (onRemoveState) {
      states
        .filter(s => s.name !== stateToKeep.name)
        .forEach(s => onRemoveState(s.name));
    }
    setContextMenu({ visible: false, x: 0, y: 0, stateData: null });
  };

  const handleCloseAll = () => {
    if (onRemoveState) {
      states.forEach(s => onRemoveState(s.name));
    }
    setContextMenu({ visible: false, x: 0, y: 0, stateData: null });
  };

  if (states.length === 0) {
    return (
      <div className="workspace-state-tabs min-w-0 flex-1 flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-surface-400 dark:scrollbar-thumb-surface-600 pr-2 min-h-[38px]">
        <span className="text-xs text-surface-500 dark:text-surface-400 italic px-2">No saved states</span>
      </div>
    );
  }

  return (
    <div className="workspace-state-tabs min-w-0 flex-1 flex items-center gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-surface-400 dark:scrollbar-thumb-surface-600 pr-2 min-h-[38px]">
      {/* Add a 'Home' or 'Default' tab if needed in the future */}
      {/* <button className="flex-shrink-0 px-3 py-1.5 border-b-2 border-primary-500 text-primary-600 dark:text-primary-400 text-sm whitespace-nowrap">
        Home
      </button> */}
      {states.map((stateData) => (
        <button
          key={stateData.name}
          onClick={() => onLoadState(stateData)}
          onContextMenu={(e) => handleContextMenu(e, stateData)}
          className="flex-shrink-0 px-3 py-1.5 border-b-2 border-transparent hover:border-surface-400 dark:hover:border-surface-500 text-surface-600 dark:text-surface-300 hover:text-surface-800 dark:hover:text-surface-100 text-sm whitespace-nowrap transition-colors duration-150 ease-in-out group relative pr-7 focus:outline-none"
          title={`Load state: ${stateData.name}`}
        >
          {stateData.name}
          <button 
            onClick={(e) => { 
              e.stopPropagation();
              onRemoveState(stateData.name); 
            }}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 p-0.5 rounded-full text-surface-400 dark:text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700 hover:text-surface-700 dark:hover:text-surface-200 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out focus:outline-none"
            title={`Remove state: ${stateData.name}`}
          >
            <IconX size={12} />
          </button>
        </button>
      ))}

      {/* Context menu */}
      {contextMenu.visible && contextMenu.stateData && (
        <div
          className="fixed z-50 rounded-md shadow-lg bg-white dark:bg-surface-800 ring-1 ring-black ring-opacity-5 focus:outline-none"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
             transform: 'translate(-20px, -100%)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="py-1 px-1 flex flex-row gap-1">
            <button
              className="px-3 py-1 text-xs text-left text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded focus:outline-none"
              onClick={() => handleCloseOthers(contextMenu.stateData)}
            >
              Close Others
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
    </div>
  );
};

export default WorkspaceStateTabs; 
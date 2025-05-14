import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { IconX, IconEdit, IconCheck } from '@tabler/icons-react';
import SortableTabs from './common/SortableTabs';
import ContextMenu from './common/ContextMenu';

const WorkspaceStateTabs = ({ 
  savedWorkspaceStates, 
  onLoadState, 
  onRemoveState, 
  onStateReorder, 
  activeNamedWorkspaceName, 
  onRenameWorkspaceState 
}) => {
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, stateData: null });
  const [renamingTab, setRenamingTab] = useState(null);
  
  // Use useMemo to ensure these only update when savedWorkspaceStates changes
  const states = useMemo(() => Object.values(savedWorkspaceStates || {}), [savedWorkspaceStates]);
  const stateNames = useMemo(() => states.map(s => s.name), [states]);
  
  // Reference to input field for rename
  const renameInputRef = useRef(null);
  const [editName, setEditName] = useState('');

  // Helper function to apply rename from input value
  const applyRenameFromInput = useCallback(() => {
    if (!renamingTab) return false;
    
    if (editName && editName.trim() !== '' && editName !== renamingTab) {
        // Apply the rename
      onRenameWorkspaceState(renamingTab, editName.trim());
        return true;
    }
    return false;
  }, [renamingTab, editName, onRenameWorkspaceState]);

  // Set the edit name when rename mode is activated
  useEffect(() => {
    if (renamingTab) {
      const stateToRename = states.find(s => s.name === renamingTab);
      if (stateToRename) {
        setEditName(stateToRename.name);
      }

      // Focus after DOM updates
      setTimeout(() => {
        if (renameInputRef.current) {
          renameInputRef.current.focus();
          renameInputRef.current.select();
        }
      }, 50);
    }
  }, [renamingTab, states]);

  // If the tab being renamed is removed, cancel rename mode
  useEffect(() => {
    if (renamingTab && !savedWorkspaceStates[renamingTab]) {
      setRenamingTab(null);
    }
  }, [savedWorkspaceStates, renamingTab]);

  // Handle click outside to close context menu and apply rename
  useEffect(() => {
    const handleClickOutside = () => {
      // setContextMenu({ visible: false, x: 0, y: 0, stateData: null }); // Removed: ContextMenu handles its own close
      
      // Auto-apply rename if clicking outside while a tab is being renamed
      if (renamingTab) {
        applyRenameFromInput();
        // Clear renaming state
        setRenamingTab(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [renamingTab, applyRenameFromInput]);

  // Handle context menu
  const handleContextMenu = (e, stateData) => {
    e.preventDefault();
    e.stopPropagation();
    // Ensure any active renaming is applied/cancelled before showing context menu
    if (renamingTab && renamingTab !== stateData.name) {
      applyRenameFromInput();
      setRenamingTab(null);
    } else if (renamingTab === stateData.name) {
      // If right-clicking the tab currently being renamed, finish renaming first
      applyRenameFromInput();
      setRenamingTab(null);
      // If the name didn't change, proceed to show context menu for original name
      if (editName === stateData.name) {
        // Allow context menu to open after rename input is gone
        setTimeout(() => {
            setContextMenu({
                visible: true,
                x: e.clientX,
                y: e.clientY,
                stateData
            });
        }, 0);
        return;
      }
      // If name changed, context menu is not relevant for the *new* stateData yet
      return;
    }

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      stateData
    });
  };

  // Handle tab click to load state or toggle rename mode
  const handleTabClick = (e, stateData) => {
    // If we have a tab being renamed and user clicked a different tab,
    // first apply the rename and then load the clicked tab
    if (renamingTab && renamingTab !== stateData.name) {
      // Apply any pending rename
      applyRenameFromInput();
      // Clear renaming state
      setRenamingTab(null);
    }

    // Don't load if trying to rename this tab
    if (renamingTab === stateData.name) return;

    // If tab is already active, enter rename mode
    if (activeNamedWorkspaceName === stateData.name) {
      setRenamingTab(stateData.name);
      return;
    }

    // Otherwise, load the workspace
    onLoadState(stateData.name);
  };

  // Handle workspace state removal
  const handleRemoveClick = (e, stateName) => {
    e.stopPropagation();
    if (onRemoveState) {
      onRemoveState(stateName);
    }
  };

  // Handle input field change during rename
  const handleInputChange = (e) => {
    setEditName(e.target.value);
  };

  // Handle input field key events during rename
  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      applyRenameFromInput();
      setRenamingTab(null);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setRenamingTab(null);
    } else if (e.key === 'Tab') {
      // Allow Tab to naturally move focus, but first submit the rename
      if (editName && editName.trim() !== '' && editName !== renamingTab) {
        applyRenameFromInput();
      }
      setRenamingTab(null);
    }
  };

  // Handle direct submit button click for rename
  const handleSubmitRename = (e) => {
    e.preventDefault();
    e.stopPropagation();
    applyRenameFromInput();
    setRenamingTab(null);
  };

  // Handle context menu "close others" option
  const handleCloseOthers = () => {
    if (onRemoveState && contextMenu.stateData) {
      states
        .filter(s => s.name !== contextMenu.stateData.name)
        .forEach(s => onRemoveState(s.name));
    }
    // setContextMenu({ visible: false, x: 0, y: 0, stateData: null }); // Removed: ContextMenu handles its own close
  };

  // Handle context menu "close all" option
  const handleCloseAll = () => {
    if (onRemoveState) {
      states.forEach(s => onRemoveState(s.name));
    }
    // setContextMenu({ visible: false, x: 0, y: 0, stateData: null }); // Removed: ContextMenu handles its own close
  };

  // Function to check if dragging should be disabled for a tab
  const isTabDraggingDisabled = (stateData) => {
    return renamingTab === stateData.name;
  };

  // Render tab content based on normal or rename mode
  const renderWorkspaceTabContent = (stateData, isActive, isDragging) => {
    const isRenaming = renamingTab === stateData.name;

    if (isRenaming) {
      return (
        <div 
          className="flex items-center w-full px-3 py-1.5 border-b-2 border-primary-500 dark:border-primary-400"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <input
            ref={renameInputRef}
            type="text"
            value={editName}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            className="w-full bg-transparent border-b border-primary-400 outline-none focus:outline-none text-primary-700 dark:text-primary-300 mr-2 z-10"
            placeholder="Workspace name"
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
            }}
            autoFocus={true}
            spellCheck={false}
            autoComplete="off"
          />
          <button
            onClick={handleSubmitRename}
            className="p-1 text-primary-600 dark:text-primary-400 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-full z-10"
            title="Save new name"
            type="button"
          >
            <IconCheck size={14} />
          </button>
        </div>
      );
    }

    return (
      <div
        className={`flex-shrink-0 px-3 py-1.5 border-b-2 text-sm whitespace-nowrap transition-colors duration-150 ease-in-out group relative flex items-center ${isActive ? 'border-primary-500 dark:border-primary-400 text-primary-700 dark:text-primary-300' : 'border-transparent hover:border-surface-400 dark:hover:border-surface-500 text-surface-600 dark:text-surface-300 hover:text-surface-800 dark:hover:text-surface-100'}`}
        title={`Load state: ${stateData.name}`}
        // style={{ paddingRight: '2rem' }} // Removed to allow close button to be closer if name is short
      >
        <span className="truncate flex-grow text-left pointer-events-none mr-1">
          {stateData.name}
        </span>

        <button
          onClick={(e) => handleRemoveClick(e, stateData.name)}
          onPointerDown={(e) => {
            e.stopPropagation(); // Prevent drag from starting
            // Also prevent context menu from opening on the remove button itself if right-clicked
            if (e.button === 2) {
                e.preventDefault();
            }
          }}
          className="absolute right-1 top-1/2 transform -translate-y-1/2 p-0.5 rounded-full text-surface-400 dark:text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700 hover:text-surface-700 dark:hover:text-surface-200 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out focus:outline-none pointer-events-auto z-10"
          title={`Remove state: ${stateData.name}`}
        >
          <IconX size={12} />
        </button>
      </div>
    );
  };

  if (states.length === 0) {
    return (
      <div className="workspace-state-tabs min-w-0 flex-1 flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-surface-400 dark:scrollbar-thumb-surface-600 pr-2 min-h-[38px]">
        <span className="text-xs text-surface-500 dark:text-surface-400 italic px-2">No saved states</span>
      </div>
    );
  }

  return (
    <>
      <SortableTabs
        items={states}
        getItemId={(state) => state.name}
        onItemClick={handleTabClick}
        onItemContextMenu={handleContextMenu}
        onReorder={onStateReorder}
        renderItem={renderWorkspaceTabContent}
        activeItemId={activeNamedWorkspaceName}
        className="workspace-state-tabs min-w-0 flex-1 flex items-center gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-surface-400 dark:scrollbar-thumb-surface-600 pr-2 min-h-[38px]"
        dragConstraints={{ distance: 2 }}
        isItemDraggingDisabled={isTabDraggingDisabled}
      />

      {/* Context menu */}
      <ContextMenu 
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        items={[
          // { label: 'Rename', onClick: handleRenameFromContextMenu, disabled: !contextMenu.stateData }, // Removed Rename option
          { label: 'Close Others', onClick: handleCloseOthers, disabled: !contextMenu.stateData || states.length <= 1 },
          { label: 'Close All', onClick: handleCloseAll, disabled: states.length === 0 },
        ]}
        onClose={() => setContextMenu({ visible: false, x: 0, y: 0, stateData: null })}
        transform="translate(0, 0)"
      />
    </>
  );
};

export default WorkspaceStateTabs; 
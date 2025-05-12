import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconX, IconEdit, IconCheck } from '@tabler/icons-react';

// New SortableStateTab component
const SortableStateTab = ({ 
  id, 
  stateData, 
  onLoadState, 
  onContextMenu, 
  handleRemoveClick, 
  isSelected, 
  isRenaming, 
  onRenameClick,
  onRenameSubmit,
  onRenameCancel
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const [editName, setEditName] = useState(stateData.name);
  const inputRef = useRef(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    flexShrink: 0,
  };

  // Reset editName when we enter rename mode or when state data changes
  useEffect(() => {
    if (isRenaming) {
      setEditName(stateData.name);
    }
  }, [stateData.name, isRenaming]);

  // Focus the input when entering rename mode
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      // Use a small timeout to ensure the DOM has updated
      setTimeout(() => {
        inputRef.current.focus();
        inputRef.current.select();
      }, 50);
    }
  }, [isRenaming]);

  const handleTabClick = (e) => {
    e.stopPropagation();
    
    // Pass the tab name to the load handler to either load or trigger rename
    onLoadState(stateData.name);
  };

  const handleInputChange = (e) => {
    // Don't preventDefault here as it interferes with input field
    e.stopPropagation();
    const newValue = e.target.value;
    setEditName(newValue);
    console.log("Input value changed to:", newValue);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onRenameSubmit(stateData.name, editName);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onRenameCancel();
    } else if (e.key === 'Tab') {
      // Allow Tab to naturally move focus, but first submit the rename
      if (editName && editName.trim() !== '' && editName !== stateData.name) {
        onRenameSubmit(stateData.name, editName);
      } else {
        onRenameCancel();
      }
    }
  };

  const handleSubmitRename = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (editName && editName.trim() !== '') {
      onRenameSubmit(stateData.name, editName);
    } else {
      onRenameCancel();
    }
  };

  // Add additional click handler for when in rename mode to keep focus
  const handleRenameContainerClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Don't apply drag listeners if in rename mode
  const dragProps = isRenaming ? {} : { ...attributes, ...listeners };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...dragProps}
      className={`${isRenaming ? "rename-active" : ""} select-none h-full`}
    >
      <div
        key={stateData.name}
        onClick={isRenaming ? handleRenameContainerClick : (e) => handleTabClick(e)}
        onContextMenu={(e) => onContextMenu(e, stateData)}
        className={`flex-shrink-0 px-3 py-1.5 border-b-2 ${isSelected ? 'border-primary-500 dark:border-primary-400 text-primary-700 dark:text-primary-300' : 'border-transparent hover:border-surface-400 dark:hover:border-surface-500 text-surface-600 dark:text-surface-300 hover:text-surface-800 dark:hover:text-surface-100'} text-sm whitespace-nowrap transition-colors duration-150 ease-in-out group relative pr-7 focus:outline-none w-full h-full flex items-center ${isRenaming ? 'pointer-events-auto' : ''}`}
        title={isRenaming ? 'Editing workspace name' : `Load state: ${stateData.name}`}
      >
        {isRenaming ? (
          <div className="flex items-center w-full" onClick={handleRenameContainerClick}>
            <input
              ref={inputRef}
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
              onFocus={e => e.target.select()}
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
        ) : (
          <span 
            className={`truncate flex-grow text-left ${!isRenaming ? 'pointer-events-none' : ''}`}
          >
            {stateData.name}
          </span>
        )}

        {!isRenaming && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveClick(e, stateData.name); // Pass name to handler
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 p-0.5 rounded-full text-surface-400 dark:text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700 hover:text-surface-700 dark:hover:text-surface-200 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out focus:outline-none"
            title={`Remove state: ${stateData.name}`}
          >
            <IconX size={12} />
          </button>
        )}
      </div>
    </div>
  );
};

const WorkspaceStateTabs = ({ savedWorkspaceStates, onLoadState, onRemoveState, onStateReorder, activeNamedWorkspaceName, onRenameWorkspaceState }) => {
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, stateData: null });
  const [renamingTab, setRenamingTab] = useState(null);
  
  // Use useMemo to ensure these only update when savedWorkspaceStates changes
  const states = useMemo(() => Object.values(savedWorkspaceStates || {}), [savedWorkspaceStates]);
  const stateNames = useMemo(() => states.map(s => s.name), [states]);

  // Helper function to apply rename from input value
  const applyRenameFromInput = useCallback(() => {
    if (!renamingTab) return false;
    
    const editInputElement = document.querySelector('.workspace-state-tabs input[type="text"]');
    if (editInputElement && editInputElement.value && editInputElement.value.trim() !== '') {
      const newName = editInputElement.value.trim();
      if (newName !== renamingTab) {
        // Apply the rename
        onRenameWorkspaceState(renamingTab, newName);
        return true;
      }
    }
    return false;
  }, [renamingTab, onRenameWorkspaceState]);

  useEffect(() => {
    // If the tab being renamed is no longer in the workspace states, cancel rename mode
    if (renamingTab && !savedWorkspaceStates[renamingTab]) {
      setRenamingTab(null);
    }
  }, [savedWorkspaceStates, renamingTab]);

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu({ visible: false, x: 0, y: 0, stateData: null });
      
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

  // Renamed original onRemoveState handler to avoid conflict
  const handleRemoveClick = (e, stateName) => {
    // e is already passed, stopPropagation happened in SortableStateTab
    if (onRemoveState) {
      onRemoveState(stateName);
    }
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

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = stateNames.indexOf(active.id);
      const newIndex = stateNames.indexOf(over.id);
      if (onStateReorder) {
        onStateReorder(oldIndex, newIndex);
      }
      // Clear optimistic selection on drag, as selection might change
      setRenamingTab(null);
    }
  };

  // Handle starting the rename process
  const handleRenameClick = (tabName) => {
    setRenamingTab(tabName);
  };

  // Handle submitting the new name
  const handleRenameSubmit = (oldName, newName) => {
    if (!newName || newName.trim() === '' || oldName === newName) {
      setRenamingTab(null);
      return;
    }

    // Call the rename handler passed from App.jsx
    if (onRenameWorkspaceState) {
      // Set renaming to null first to ensure clean state update
      setRenamingTab(null);
      
      // Call the rename handler
      onRenameWorkspaceState(oldName, newName);
    } else {
      console.error("[WorkspaceStateTabs] onRenameWorkspaceState prop is missing!");
      setRenamingTab(null);
    }
  };

  // Handle canceling the rename
  const handleRenameCancel = () => {
    setRenamingTab(null);
  };
  
  // Wrapper for onLoadState
  const handleInitiateLoad = (tabName) => {
    // If we have a tab being renamed and user clicked a different tab,
    // first apply the rename and then load the clicked tab
    if (renamingTab && renamingTab !== tabName) {
      // Apply any pending rename
      applyRenameFromInput();
      // Clear renaming state
      setRenamingTab(null);
    }

    // Don't load if trying to rename this tab
    if (renamingTab === tabName) return;

    // If tab is already active, enter rename mode
    if (activeNamedWorkspaceName === tabName) {
      setRenamingTab(tabName);
      return;
    }

    // Otherwise, load the workspace
    onLoadState(tabName); 
  };

  // Restore the sensors for drag and drop functionality
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 2,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (states.length === 0) {
    // No changes needed for empty state
    return (
      <div className="workspace-state-tabs min-w-0 flex-1 flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-surface-400 dark:scrollbar-thumb-surface-600 pr-2 min-h-[38px]">
        <span className="text-xs text-surface-500 dark:text-surface-400 italic px-2">No saved states</span>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="workspace-state-tabs min-w-0 flex-1 flex items-center gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-surface-400 dark:scrollbar-thumb-surface-600 pr-2 min-h-[38px]">
        <SortableContext items={stateNames} strategy={rectSortingStrategy}>
          {states.map((stateData) => (
            <SortableStateTab
              key={`workspace-tab-${stateData.name}`} // Use a key that includes a prefix to ensure uniqueness
              id={stateData.name} 
              stateData={stateData}
              onLoadState={handleInitiateLoad} 
              onContextMenu={handleContextMenu}
              handleRemoveClick={handleRemoveClick} 
              isSelected={activeNamedWorkspaceName === stateData.name} 
              isRenaming={renamingTab === stateData.name}
              onRenameClick={handleRenameClick}
              onRenameSubmit={handleRenameSubmit}
              onRenameCancel={handleRenameCancel}
            />
          ))}
        </SortableContext>

        {/* Context menu (remains the same) */}
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
                 onClick={() => {
                   setRenamingTab(contextMenu.stateData.name);
                   setContextMenu({ visible: false, x: 0, y: 0, stateData: null });
                 }}
               >
                 Rename
               </button>
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
    </DndContext>
  );
};

export default WorkspaceStateTabs; 
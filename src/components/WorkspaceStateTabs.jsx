import React, { useState, useEffect } from 'react';
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
import { IconX } from '@tabler/icons-react';

// New SortableStateTab component
const SortableStateTab = ({ id, stateData, onLoadState, onContextMenu, handleRemoveClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    flexShrink: 0,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <button
        key={stateData.name} // Keep key on button
        onClick={() => onLoadState(stateData)}
        onContextMenu={(e) => onContextMenu(e, stateData)}
        className="flex-shrink-0 px-3 py-1.5 border-b-2 border-transparent hover:border-surface-400 dark:hover:border-surface-500 text-surface-600 dark:text-surface-300 hover:text-surface-800 dark:hover:text-surface-100 text-sm whitespace-nowrap transition-colors duration-150 ease-in-out group relative pr-7 focus:outline-none w-full h-full flex items-center" // Added flex items-center
        title={`Load state: ${stateData.name}`}
      >
        <span className="truncate flex-grow text-left">{stateData.name}</span>
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
      </button>
    </div>
  );
};

const WorkspaceStateTabs = ({ savedWorkspaceStates, onLoadState, onRemoveState, onStateReorder }) => {
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, stateData: null });
  const states = Object.values(savedWorkspaceStates);
  const stateNames = states.map(s => s.name);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
    }
  };

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
              key={stateData.name}
              id={stateData.name} // Use name as unique ID
              stateData={stateData}
              onLoadState={onLoadState}
              onContextMenu={handleContextMenu}
              handleRemoveClick={handleRemoveClick} // Pass renamed handler
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
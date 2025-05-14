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

/**
 * Base SortableItem component that can be customized for different tab types
 */
export const SortableItem = ({ 
  id, 
  item, 
  isActive, 
  renderContent, 
  onClick, 
  onContextMenu,
  tabClassName = "sortable-tab pointer-events-auto",
  customAttributes = {},
  disableDragging = false
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id,
    disabled: disableDragging,
    transition: {
      duration: 150,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  });

  // Track if we're handling a click vs. a drag
  const [isClickIntent, setIsClickIntent] = useState(false);
  
  // Reset click intent when dragging starts
  useEffect(() => {
    if (isDragging && isClickIntent) {
      setIsClickIntent(false);
    }
  }, [isDragging, isClickIntent]);

  // Base styles for the sortable item
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    flexShrink: 0,
    touchAction: 'none',
    opacity: isDragging ? 0.5 : 1,
    pointerEvents: 'auto',
    cursor: disableDragging ? 'default' : 'grab',
    position: 'relative',
    zIndex: isDragging ? 1000 : 1,
    userSelect: 'none',
    ...(customAttributes.style || {})
  };

  // Only apply drag listeners if dragging is not disabled
  const dragProps = disableDragging ? {} : { ...attributes, ...listeners };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      tabIndex={0}
      {...dragProps}
      {...(customAttributes.divProps || {})}
      onMouseDown={(e) => {
        if (e.button === 0 && !disableDragging) { // Left click only
          setIsClickIntent(true);
        }
        if (customAttributes.onMouseDown) {
          customAttributes.onMouseDown(e);
        }
      }}
      onClick={(e) => { 
        e.preventDefault();
        e.stopPropagation();
        
        if (!isDragging && onClick) {
          onClick(e, item);
        }
      }}
      onContextMenu={(e) => {
        if (onContextMenu) {
          onContextMenu(e, item);
        }
      }}
      role="tab" 
      aria-selected={isActive} 
      className={tabClassName}
      data-dragging={isDragging}
      data-draggable={!disableDragging}
    >
      {renderContent({ item, isDragging, isActive })}
    </div>
  );
};

/**
 * SortableTabs component that handles the drag-drop behavior
 */
export const SortableTabs = ({
  items,
  getItemId,
  itemsToRender = null,
  onItemClick,
  onItemContextMenu,
  onReorder,
  renderItem,
  activeItemId = null,
  className = "sortable-tabs min-w-0 flex-1 flex items-center gap-1 overflow-x-auto",
  dragConstraints = { distance: 5, tolerance: 5, delay: 100 },
  extraContent = null,
  customAttributes = {},
  isItemDraggingDisabled = () => false // Function to determine if a specific item should have dragging disabled
}) => {
  // Setup dnd-kit sensors with configurable constraints
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: dragConstraints,
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Map items to IDs for the SortableContext
  const itemIds = items.map(item => getItemId(item));
  
  // Determine which items to render (allows for filtered subsets)
  const renderItems = itemsToRender || items;

  // Handle drag end for reordering
  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (active && over && active.id !== over.id) {
      const oldIndex = itemIds.indexOf(active.id);
      const newIndex = itemIds.indexOf(over.id);
      
      if (onReorder && oldIndex !== -1 && newIndex !== -1) {
        onReorder(oldIndex, newIndex);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className={className}>
        <SortableContext items={itemIds} strategy={rectSortingStrategy}>
          {renderItems.map((item) => {
            const id = getItemId(item);
            const isActive = activeItemId === id;
            const isDraggingDisabled = isItemDraggingDisabled(item);
            
            return (
              <SortableItem
                key={id}
                id={id}
                item={item}
                isActive={isActive}
                onClick={onItemClick}
                onContextMenu={onItemContextMenu}
                renderContent={({ item, isDragging, isActive }) => renderItem(item, isActive, isDragging)}
                customAttributes={customAttributes}
                disableDragging={isDraggingDisabled}
              />
            );
          })}
        </SortableContext>
        
        {extraContent}
      </div>
    </DndContext>
  );
};

export default SortableTabs; 
import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import {
  IconFolder,
  IconFile,
  IconFolderOpen,
  IconChevronRight,
  IconChevronDown
} from '@tabler/icons-react';

// TreeNode component extracted from ArboristFileExplorer
const TreeNode = ({
  node,
  level = 0,
  onNodeSelect,
  onFolderToggle,
  expandedNodes,
  selectedNodePaths, // Changed from isSelected
  renamingNodePath, // Path of the node currently being renamed
  onRenameSubmit,   // Function to call when rename is submitted
  onRenameCancel,    // Function to call when rename is cancelled
  currentFilePath, // Added prop
  onContextMenu, // Re-added prop
  onMoveItem, // Added prop for drop handler
  isDragging, // Is this node being dragged?
  dragOverPosition, // Where is the cursor relative to this node? ('top', 'bottom', 'middle')
  dragOverPath, // Path of the node being dragged over (used by parent)
  itemOrderVersion // Accept the new prop
}) => {
  // Add console log to debug rendering (only when debugging needed)
  // console.log(`[TreeNode] Rendering node: ${node.path} with itemOrderVersion: ${itemOrderVersion}`);
  
  const isExpanded = expandedNodes[node.path] || false;
  const isSelected = selectedNodePaths.has(node.path); // Calculate isSelected internally
  const hasChildren = node.children && node.children.length > 0;
  const isFolder = node.type === 'folder';

  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(node.name);
  const renameInputRef = useRef(null);
  
  // Throttle mechanism for dragOver events
  const lastDragOverRef = useRef(0);
  const lastPositionRef = useRef(null);
  
  // Keep track of local drag state to prevent loss of node info
  const nodeStateRef = useRef(node);
  useEffect(() => {
    nodeStateRef.current = node;
  }, [node]);

  // Effect to set renaming state based on prop
  useLayoutEffect(() => {
    if (renamingNodePath === node.path) {
      setIsRenaming(true);
      const currentName = node.name;
      setNewName(currentName);

      // Attempt to focus immediately after state update makes input visible
      // The ref might not be populated on the very first call that sets isRenaming=true,
      // so the setTimeout below acts as a more reliable fallback.
      if (renameInputRef.current) {
        renameInputRef.current.focus();
        const isFile = node.type === 'file';
        const lastDotIndex = isFile ? currentName.lastIndexOf('.') : -1;
        const selectionEnd = (isFile && lastDotIndex > 0) ? lastDotIndex : currentName.length;
        renameInputRef.current.setSelectionRange(0, selectionEnd);
      }

      // Fallback/ensure focus after a short delay, also handles selection
      const timerId = setTimeout(() => {
        const inputElement = renameInputRef.current;
        if (inputElement) {
          inputElement.focus();
          const isFile = node.type === 'file';
          const lastDotIndex = isFile ? currentName.lastIndexOf('.') : -1;
          const selectionEnd = (isFile && lastDotIndex > 0) ? lastDotIndex : currentName.length;
          inputElement.setSelectionRange(0, selectionEnd);
        }
      }, 50); // Shortened delay (e.g., 50ms) as this is now more of a fallback

      return () => clearTimeout(timerId); // Cleanup timeout
    } else {
      setIsRenaming(false);
    }
  }, [renamingNodePath, node.path, node.name, node.type]);

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    // If renaming is in progress for this node, don't process the click further
    // as it might interfere with the input field.
    if (isRenaming) {
      return;
    }
    onNodeSelect(node, e);
  }, [node, onNodeSelect, isRenaming]);

  const handleToggle = useCallback((e) => {
      e.stopPropagation();
      if (isFolder) {
          onFolderToggle(node.path);
      }
  }, [isFolder, node.path, onFolderToggle]);


  const handleRenameChange = (e) => {
    setNewName(e.target.value);
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleRenameBlur();
    } else if (e.key === 'Escape') {
      setIsRenaming(false);
      setNewName(node.name);
      onRenameCancel();
    }
  };

  const handleRenameBlur = () => {
    if (isRenaming) {
      const trimmedName = newName.trim();
      if (trimmedName && trimmedName !== node.name) {
        onRenameSubmit(node, trimmedName);
      } else {
        onRenameCancel();
      }
      setIsRenaming(false);
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node);
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = useCallback((e) => {
    e.stopPropagation();
    let draggedItems = [];
    const isNodeSelected = selectedNodePaths.has(node.path);
    
    if (isNodeSelected && selectedNodePaths.size > 1) {
      // For multi-selection, gather all selected items
      draggedItems = Array.from(selectedNodePaths).map(path => ({ 
        path, 
        type: path.includes('.') ? 'file' : 'folder', // Simple type detection
        name: path.split('/').pop() // Ensure name is available
      }));
    } else {
      // If dragging an item that's not part of the current selection,
      // just drag that single item
      draggedItems = [{ 
        path: node.path, 
        type: node.type, 
        name: node.name // Ensure name is available
      }];
    }
    
    // Set both text/plain AND application/json formats to ensure cross-browser compatibility
    e.dataTransfer.setData('text/plain', JSON.stringify(draggedItems));
    e.dataTransfer.setData('application/json', JSON.stringify(draggedItems));
    e.dataTransfer.effectAllowed = 'move';
    
    // Call parent handler to update the explorer state
    onMoveItem(draggedItems, null, 'dragStart');
  }, [node, selectedNodePaths, onMoveItem]);

  // Determine drop position relative to the node
  const getDropPosition = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    
    // Position thresholds - top 25%, middle 50%, bottom 25%
    const height = rect.height;
    const topThreshold = height * 0.25;
    const bottomThreshold = height * 0.75;
    
    // For folders, we allow drops inside the folder (middle position)
    // For files, only allow top/bottom positions
    if (offsetY < topThreshold) {
      return 'top';
    } else if (offsetY > bottomThreshold) {
      return 'bottom';
    } else {
      return 'middle'; // Inside the folder or between items
    }
  }, []);

  // Optimize handleDragOver with debounce
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Throttle dragOver events to reduce excessive event handling
    // Only process event every 200ms (increased from 150ms)
    const now = Date.now();
    if (now - lastDragOverRef.current < 200) {
      return;
    }
    
    const position = getDropPosition(e);
    
    // Skip if position hasn't changed since last call
    if (position === lastPositionRef.current && dragOverPath === node.path) {
      return;
    }
    
    lastPositionRef.current = position;
    lastDragOverRef.current = now;
    
    // Set the drop effect based on position and node type
    if (node.type === 'folder' || position !== 'middle') {
      e.dataTransfer.dropEffect = 'move';
    } else {
      // Can't drop inside a file
      e.dataTransfer.dropEffect = 'none';
    }
    
    onMoveItem(null, nodeStateRef.current, 'dragOver', position);
  }, [node, getDropPosition, onMoveItem, dragOverPath]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Reset throttle refs when drop occurs
    lastDragOverRef.current = 0;
    lastPositionRef.current = null;
    
    try {
      // Try both data formats
      let data;
      try {
        data = e.dataTransfer.getData('application/json');
        if (!data) {
          data = e.dataTransfer.getData('text/plain');
        }
      } catch (err) {
        data = e.dataTransfer.getData('text/plain');
      }

      if (!data) {
        console.error('[TreeNode] No drag data available');
        return;
      }
      
      const sourceItems = JSON.parse(data);
      const position = getDropPosition(e);
      
      if (sourceItems && sourceItems.length > 0) {
        // Check if we're trying to drop onto self
        const isDroppingOnSelf = sourceItems.some(item => item.path === node.path);
        if (isDroppingOnSelf && position === 'middle') {
          return;
        }
        
        // Use current node state from ref to ensure we have all properties
        onMoveItem(sourceItems, nodeStateRef.current, 'drop', position);
      }
    } catch (error) {
      console.error('[TreeNode] Error during drop:', error);
    }
  }, [node, getDropPosition, onMoveItem]);

  const handleDragEnd = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Reset throttle refs
    lastDragOverRef.current = 0;
    lastPositionRef.current = null;
    
    onMoveItem(null, null, 'dragEnd');
  }, [onMoveItem]);
  // --- End Drag and Drop Handlers ---

  // Define CSS classes based on node state
  const baseClasses = 'flex items-center px-1 py-1 rounded cursor-pointer hover:bg-surface-200 dark:hover:bg-surface-700 overflow-hidden';
  const selectionClasses = isSelected ? 'bg-primary-100 dark:bg-primary-900 border border-primary-400 dark:border-primary-600' : '';
  const currentFileClasses = !isSelected && node.path === currentFilePath ? 'font-semibold text-primary-700 dark:text-primary-300' : '';
  const combinedClasses = `${baseClasses} ${selectionClasses} ${currentFileClasses}`.trim();

  // Define CSS classes for drag-over visual feedback
  const getDragOverClasses = () => {
      if (dragOverPath !== node.path) return '';
      switch (dragOverPosition) {
          case 'top': return 'border-t-2 border-blue-500 dark:border-blue-400 -mt-px';
          case 'bottom': return 'border-b-2 border-blue-500 dark:border-blue-400 -mb-px';
          case 'middle':
              // Only apply background if dropping *into* a folder
              return node.type === 'folder' ? 'bg-blue-100 dark:bg-blue-900/30 rounded' : 'bg-red-100 dark:bg-red-900/30 rounded';
          default: return '';
      }
  };
  const dragOverContainerClasses = getDragOverClasses();

  return (
    <div
      className={`flex flex-col ${isDragging ? 'opacity-70' : ''} ${dragOverPath === node.path ? getDragOverClasses() : ''}`}
      style={{ paddingLeft: level * 16 }}
      onContextMenu={handleContextMenu}
    >
      <div
        className={combinedClasses}
        onClick={handleClick}
        draggable={true}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        data-testid={`tree-node-${node.path}`}
      >
        {/* Folder Toggle or Spacer */}
        <div className="w-5 flex-shrink-0" onClick={hasChildren ? handleToggle : undefined}>
          {hasChildren && isFolder ? (
            isExpanded ? (
              <IconChevronDown size={16} className="opacity-60" />
            ) : (
              <IconChevronRight size={16} className="opacity-60" />
            )
          ) : (
            <span className="w-4"></span>
          )}
        </div>

        {/* Icon */}
        <div className="w-5 flex-shrink-0 mr-1">
          {isFolder ? (
            isExpanded ? (
              <IconFolderOpen size={16} className="text-amber-500" />
            ) : (
              <IconFolder size={16} className="text-amber-500" />
            )
          ) : (
            <IconFile size={16} className="opacity-60" />
          )}
        </div>

        {/* Name (with rename input if active) */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={newName}
            onChange={handleRenameChange}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameBlur}
            className="flex-grow bg-white dark:bg-surface-800 border border-primary-500 rounded px-1 py-0 text-sm outline-none"
          />
        ) : (
          <div className="flex-grow truncate" data-testid="node-name">
            {node.name}
          </div>
        )}
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div className="children">
          {node.children.map(child => (
            <TreeNode
              key={`${child.path}-${itemOrderVersion}`}
              node={child}
              level={level + 1}
              onNodeSelect={onNodeSelect}
              onFolderToggle={onFolderToggle}
              expandedNodes={expandedNodes}
              selectedNodePaths={selectedNodePaths}
              renamingNodePath={renamingNodePath}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
              currentFilePath={currentFilePath}
              onContextMenu={onContextMenu}
              onMoveItem={onMoveItem}
              isDragging={dragOverPath === child.path}
              dragOverPath={dragOverPath}
              dragOverPosition={dragOverPosition}
              itemOrderVersion={itemOrderVersion}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TreeNode; 
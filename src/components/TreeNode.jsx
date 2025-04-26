import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  dragOverPath // Path of the node being dragged over (used by parent)
}) => {
  const isExpanded = expandedNodes[node.path] || false;
  const isSelected = selectedNodePaths.has(node.path); // Calculate isSelected internally
  const hasChildren = node.children && node.children.length > 0;
  const isFolder = node.type === 'folder';

  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(node.name);
  const renameInputRef = useRef(null);

  // Effect to set renaming state based on prop
  useEffect(() => {
    if (renamingNodePath === node.path) {
      setIsRenaming(true);
      const currentName = node.name; // Use original node name
      setNewName(currentName);

      // Focus the input and select text when renaming starts
      setTimeout(() => {
        const inputElement = renameInputRef.current;
        if (inputElement) {
          inputElement.focus();

          // Determine selection range
          const isFile = node.type === 'file';
          const lastDotIndex = isFile ? currentName.lastIndexOf('.') : -1;
          const selectionEnd = (isFile && lastDotIndex > 0) ? lastDotIndex : currentName.length;

          inputElement.setSelectionRange(0, selectionEnd);
        }
      }, 0); // Timeout ensures element is rendered and ready

    } else {
      setIsRenaming(false);
    }
    // Add node.type as dependency
  }, [renamingNodePath, node.path, node.name, node.type]);

  const handleClick = useCallback((e) => {
    e.stopPropagation(); // Prevent event bubbling
    // Always call onNodeSelect to let the parent handle selection/rename/toggle logic
    onNodeSelect(node, e); // Pass event object
  }, [node, onNodeSelect]);

  const handleToggle = useCallback((e) => {
      e.stopPropagation(); // Prevent event bubbling
      if (isFolder) {
          onFolderToggle(node.path);
      }
  }, [isFolder, node.path, onFolderToggle]);


  const handleRenameChange = (e) => {
    setNewName(e.target.value);
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleRenameBlur(); // Submit on Enter
    } else if (e.key === 'Escape') {
      setIsRenaming(false); // Cancel on Escape
      setNewName(node.name); // Reset name
      onRenameCancel(); // Notify parent
    }
  };

  const handleRenameBlur = () => {
    if (isRenaming) {
      const trimmedName = newName.trim();
      if (trimmedName && trimmedName !== node.name) {
        onRenameSubmit(node, trimmedName); // Submit if name changed and not empty
      } else {
        onRenameCancel(); // Cancel if name is unchanged or empty
      }
      setIsRenaming(false); // Exit renaming mode regardless
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault(); // Prevent default browser context menu
    e.stopPropagation();
    onContextMenu(e, node); // Pass event and node data
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = useCallback((e) => {
    e.stopPropagation();

    let draggedItems = [];
    const isNodeSelected = selectedNodePaths.has(node.path);

    if (isNodeSelected) {
      // Dragging a selected node: include all selected items
      // Parent resolves types if needed
      draggedItems = Array.from(selectedNodePaths).map(path => ({ path, type: 'unknown' }));
    } else {
      // Dragging an unselected node: select only this node and drag it
      // The parent component will handle the implicit selection via the 'dragStart' action
      draggedItems = [{ path: node.path, type: node.type }];
    }

    e.dataTransfer.setData('application/json', JSON.stringify(draggedItems));
    e.dataTransfer.effectAllowed = 'move';

    // Notify parent about the drag start, passing the items being dragged
    onMoveItem(draggedItems, null, 'dragStart');
  }, [node.path, node.type, selectedNodePaths, onMoveItem]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault(); // Necessary to allow dropping
    e.stopPropagation();

    // Determine position relative to the target element
    const hoverThreshold = 0.25; // Percentage of height for top/bottom zones
    const rect = e.currentTarget.getBoundingClientRect();
    const hoverY = e.clientY - rect.top;

    let position = 'middle';
    if (hoverY < rect.height * hoverThreshold) {
        position = 'top';
    } else if (hoverY > rect.height * (1 - hoverThreshold)) {
        position = 'bottom';
    }

    // Notify parent about the drag over event, passing the target node and position
    onMoveItem(null, node, 'dragOver', position);

    // Set drop effect (visual cue) - this might be better handled by parent setting styles
    e.dataTransfer.dropEffect = 'move';
  }, [node, onMoveItem]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const draggedItemsData = JSON.parse(e.dataTransfer.getData('application/json'));

      // Determine drop position again (similar to dragOver)
      const hoverThreshold = 0.25; // Percentage of height for top/bottom zones
      const rect = e.currentTarget.getBoundingClientRect();
      const hoverY = e.clientY - rect.top;

      let position = 'middle';
      if (hoverY < rect.height * hoverThreshold) {
          position = 'top';
      } else if (hoverY > rect.height * (1 - hoverThreshold)) {
          position = 'bottom';
      }

      // Basic validation: ensure dragged data is an array and not empty
      if (Array.isArray(draggedItemsData) && draggedItemsData.length > 0) {
        // Check if dropping onto self or one of the dragged items
        const isDroppingOnSelfOrDragged = draggedItemsData.some(item => item.path === node.path);
        if (!isDroppingOnSelfOrDragged) {
          // Call the parent handler to perform the move
          onMoveItem(draggedItemsData, node, 'drop', position);
        } else {
            console.log('[TreeNode] Drop onto self ignored.');
        }
      } else {
        console.error('[TreeNode DnD] Drop ignored (invalid data)');
      }
    } catch (error) {
      console.error('[TreeNode DnD] Error parsing dropped data:', error);
    } finally {
        // Notify parent to clear dragOver state regardless of drop success/failure
        onMoveItem(null, null, 'dragEnd'); // Use dragEnd action type
    }
  }, [node, onMoveItem]); // Ensure all dependencies using node/onMoveItem are included

  const handleDragEnd = useCallback((e) => {
    e.stopPropagation();
    // Notify parent to clear all drag states
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
          case 'top': return 'border-t-2 border-blue-600 -mt-0.5'; // Use margin instead of padding/border size increase
          case 'bottom': return 'border-b-2 border-blue-600 -mb-0.5'; // Use margin instead of padding/border size increase
          case 'middle':
              // Only apply background if dropping *into* a folder
              return node.type === 'folder' ? 'bg-blue-100 dark:bg-blue-900/50 rounded' : 'bg-error-100 dark:bg-error-900/50 rounded'; // Indicate invalid middle drop on file
          default: return '';
      }
  };
  const dragOverContainerClasses = getDragOverClasses();

  return (
    <div
      className={`flex flex-col transition-all duration-100 ease-in-out ${isDragging ? 'opacity-50' : ''} ${dragOverContainerClasses}`.trim()}
      draggable="true"
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      onContextMenu={handleContextMenu} // Attach context menu to the outer div
    >
      <div
        className={combinedClasses}
        onClick={handleClick} // Use combined click handler
        // Remove onContextMenu from here, it's on the outer div
        style={{ paddingLeft: `${level * 16}px` }}
      >
        {/* Toggle Chevron */}
        <div className="flex-shrink-0 mr-1 w-4 h-4 flex items-center justify-center" onClick={handleToggle}>
          {isFolder && hasChildren && (
            isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />
          )}
        </div>
        {/* Icon */}
        <div className="flex-shrink-0 mr-2">
          {isFolder ? (
            isExpanded ? <IconFolderOpen size={16} color="#60a5fa" /> : <IconFolder size={16} color="#60a5fa" />
          ) : (
            <IconFile size={16} color="#a1a1aa" />
          )}
        </div>
        {/* Name or Input */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={newName}
            onChange={handleRenameChange}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameBlur}
            onClick={(e) => e.stopPropagation()} // Prevent click from bubbling
            className="flex-grow bg-surface-100 dark:bg-surface-800 border border-primary-500 rounded px-1 text-sm outline-none"
            style={{ marginLeft: '2px' }}
          />
        ) : (
          <div className="truncate text-sm" data-testid="node-name">
            {node.name}
          </div>
        )}
      </div>

      {/* Children */}
      {isFolder && isExpanded && hasChildren && (
        <div className="ml-0"> {/* No extra indent needed if padding works */}
          {node.children.map(child => (
            <TreeNode
              key={child.path}
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
              isDragging={isDragging} // Pass down dragging state if needed for children styling
              dragOverPath={dragOverPath}
              dragOverPosition={dragOverPosition}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TreeNode; 
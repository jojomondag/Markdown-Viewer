import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  IconFolder,
  IconFile,
  IconFolderOpen,
  IconChevronRight,
  IconChevronDown,
  IconFolderPlus,
  IconFolderOff
} from '@tabler/icons-react';
import path from 'path-browserify';
import { getBasename, getDirname } from '../utils/pathUtils'; // Assuming pathUtils exists
import { isValidDrop, createDropDestination } from '../utils/fileOperations'; // Import DnD utils

// Simple TreeNode component
const TreeNode = ({ 
  node, 
  level = 0, 
  onNodeSelect, 
  onFolderToggle,
  expandedNodes, 
  isSelected, 
  renamingNodePath, // Path of the node currently being renamed
  onRenameSubmit,   // Function to call when rename is submitted
  onRenameCancel,    // Function to call when rename is cancelled
  currentFilePath, // Added prop
  selectedNodePath, // Added prop
  onContextMenu, // Re-added prop
  onMoveItem, // Added prop for drop handler
  isDragging, // Is this node being dragged?
  dragOverPosition, // Where is the cursor relative to this node? ('top', 'bottom', 'middle')
  dragOverPath // Path of the node being dragged over (used by parent)
}) => {
  const isExpanded = expandedNodes[node.path] || false;
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

  const handleClick = (e) => {
    e.stopPropagation(); // Prevent event bubbling
    console.log('[TreeNode] handleClick triggered for node:', node);
    // Always call onNodeSelect to let the parent handle selection/rename/toggle logic
    onNodeSelect(node, e); // Pass event object
    
    // --- Removed folder toggle logic from here, moved to parent handler ---
    // if (isFolder) {
    //   console.log('[TreeNode] Calling onFolderToggle');
    //   onFolderToggle(node.path);
    // } 
  };

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
  const handleDragStart = (e) => {
    e.stopPropagation(); // Prevent parent drag
    console.log('[DnD] Drag Start:', node.path);
    // Set data to be transferred (path and type)
    e.dataTransfer.setData('application/json', JSON.stringify({ path: node.path, type: node.type }));
    e.dataTransfer.effectAllowed = 'move';
    // Optionally set a drag image or rely on default browser behavior
    // Notify parent about drag start (e.g., to set dragging state)
    onMoveItem(node, null, 'dragStart'); 
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // Necessary to allow dropping
    e.stopPropagation();
    
    // Determine position relative to the target element
    const rect = e.currentTarget.getBoundingClientRect();
    const verticalMidpoint = rect.top + rect.height / 2; // Calculate the vertical middle

    let position = 'middle';
    // If cursor is in the top half, position is 'top', otherwise 'bottom'
    if (e.clientY < verticalMidpoint) {
        position = 'top';
    } else {
        position = 'bottom';
    }

    // Indicate this node is being dragged over
    onMoveItem(null, node, 'dragOver', position); // Pass position
    // Set drop effect (visual cue)
    e.dataTransfer.dropEffect = 'move'; 
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[DnD] Drop onto:', node.path);
    try {
      const draggedItemData = JSON.parse(e.dataTransfer.getData('application/json'));
      
      // Determine drop position again (similar to dragOver)
      const rect = e.currentTarget.getBoundingClientRect();
      const verticalMidpoint = rect.top + rect.height / 2;
      let position = 'middle';
      // If cursor is in the top half, position is 'top', otherwise 'bottom'
      if (e.clientY < verticalMidpoint) {
          position = 'top';
      } else {
          position = 'bottom';
      }

      console.log('[DnD] Dropped item data:', draggedItemData, 'at position:', position);
      if (draggedItemData && draggedItemData.path !== node.path) { // Ensure not dropping onto self
        // Call the parent handler to perform the move
        onMoveItem(draggedItemData, node, 'drop', position); // Pass position
      } else {
        console.log('[DnD] Drop ignored (self or invalid data)');
      }
    } catch (error) {
      console.error('[DnD] Error parsing dropped data:', error);
    }
    // Notify parent to clear dragOver state
    onMoveItem(null, null, 'dragEnd'); 
  };

  const handleDragEnd = (e) => {
    e.stopPropagation();
    console.log('[DnD] Drag End');
    // Notify parent to clear all drag states
    onMoveItem(null, null, 'dragEnd');
  };
  // --- End Drag and Drop Handlers ---

  return (
    <div 
      className={`flex flex-col transition-all duration-100 ease-in-out
                 ${isDragging ? 'opacity-50' : ''} 
                  /* Drag Over Visuals */
                  ${dragOverPath === node.path && dragOverPosition === 'top' ? 'border-t-4 border-blue-600 bg-blue-200 dark:bg-blue-800/50 pt-1 mb-1' : ''} /* DEBUG: Added BG */
                  ${dragOverPath === node.path && dragOverPosition === 'bottom' ? 'border-b-4 border-blue-600 bg-blue-200 dark:bg-blue-800/50 pb-1 mt-1' : ''} /* DEBUG: Added BG */
                  ${dragOverPath === node.path && dragOverPosition === 'middle' && node.type === 'folder' ? 'bg-blue-100 dark:bg-blue-900/50 rounded' : ''} 
                  ${dragOverPath === node.path && dragOverPosition === 'middle' && node.type !== 'folder' ? 'bg-error-100 dark:bg-error-900/50 rounded' : ''} // Invalid middle drop on file
                 `}
      draggable="true" // Make node draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
    >
      <div 
        className={`flex items-center px-1 py-1 rounded cursor-pointer hover:bg-surface-200 dark:hover:bg-surface-700 
                    ${isSelected || node.path === currentFilePath ? 'bg-primary-100 dark:bg-primary-900 border border-primary-400 dark:border-primary-600' : ''}`}
        onClick={handleClick}
        onContextMenu={handleContextMenu} // Re-added context menu handler
        style={{ paddingLeft: `${level * 16}px` }}
      >
        <div className="flex-shrink-0 mr-1 w-4">
          {isFolder && hasChildren && (
            isExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />
          )}
        </div>
        <div className="flex-shrink-0 mr-2">
          {isFolder ? (
            isExpanded ? <IconFolderOpen size={16} color="#60a5fa" /> : <IconFolder size={16} color="#60a5fa" />
          ) : (
            <IconFile size={16} color="#a1a1aa" />
          )}
        </div>
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={newName}
            onChange={handleRenameChange}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameBlur}
            onClick={(e) => e.stopPropagation()} // Prevent click from bubbling to node selection
            className="flex-grow bg-surface-100 dark:bg-surface-800 border border-primary-500 rounded px-1 text-sm outline-none"
            style={{ marginLeft: '2px' }} // Add some spacing
          />
        ) : (
          <div className="truncate text-sm" data-testid="node-name">
            {node.name}
            {isFolder && hasChildren && (
              <span className="text-xs text-gray-400 ml-1">({node.children.length})</span>
            )}
          </div>
        )}
      </div>
      
      {isFolder && isExpanded && hasChildren && (
        <div className="ml-2"> {/* Indent children */}
          {node.children.map(child => (
            <TreeNode
              key={child.path}
              node={child}
              level={level + 1}
              onNodeSelect={onNodeSelect} // Pass down selection handler
              onFolderToggle={onFolderToggle} // Re-added prop passing
              expandedNodes={expandedNodes}
              isSelected={selectedNodePath === child.path} // Internal selection state
              renamingNodePath={renamingNodePath} // Pass renaming state
              onRenameSubmit={onRenameSubmit} // Pass rename submit handler
              onRenameCancel={onRenameCancel} // Pass rename cancel handler
              currentFilePath={currentFilePath} // Pass down current file path
              selectedNodePath={selectedNodePath} // Pass down selected path state
              onContextMenu={onContextMenu} // Pass down context menu handler
              onMoveItem={onMoveItem} // Pass down move handler
              isDragging={isDragging} 
              dragOverPath={dragOverPath} 
              dragOverPosition={dragOverPosition} // Pass down drag over position directly
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Main FileExplorer component (Arborist style)
const FileExplorer = ({ 
  files = [], 
  folders = [], // Expects a flat list of folders
  currentFolders = [], // <-- Accept currentFolders prop
  currentFilePath, 
  onFileSelect, 
  onScanFolder, // Function provided by App.jsx to scan/add folders
  onRenameItem, // Added prop for rename handler
  onCreateFile, // Added prop for create file handler
  onCreateFolder, // Added prop for create folder handler
  onDeleteItem, // Added prop for delete handler
  onMoveItemProp, // Added prop for move handler from App.jsx
  itemOrder, // Added prop for explicit item order
  // Add any other necessary props based on App.jsx usage
}) => {
  const [expandedNodes, setExpandedNodes] = useState({});
  const [treeData, setTreeData] = useState([]);
  const [rootFolderName, setRootFolderName] = useState(''); // Optional: display root folder name
  const [selectedNodePath, setSelectedNodePath] = useState(null); // State for selected node path
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, node: null }); // Re-added context menu state
  const [renamingNodePath, setRenamingNodePath] = useState(null); // State for which node is being renamed
  const explorerRef = useRef(null); // Re-added ref for the explorer container

  // --- Drag and Drop State ---
  const [draggingPath, setDraggingPath] = useState(null);
  const [dragOverPath, setDragOverPath] = useState(null); // Path of the node being dragged over
  const [dragOverPosition, setDragOverPosition] = useState(null); // 'top', 'bottom', 'middle'
  // --- End Drag and Drop State ---

  // Function to build the tree structure from flat lists based on currentFolders
  const buildTree = useCallback((files, folders, currentFolders, currentItemOrder) => {
    console.log("[Arborist buildTree] Building tree for roots:", currentFolders);
    const nodes = {};
    const roots = [];
    const allItems = [...folders, ...files];

    // First pass: Create nodes for all items and store them in the map
    allItems.forEach(item => {
        const name = getBasename(item.path);
        nodes[item.path] = { 
            ...item, // Copy original item data
            name: name, // Ensure name is basename
            children: item.type === 'folder' ? [] : null // Initialize children for folders
        };
    });

    // Second pass: Establish parent-child relationships
    Object.values(nodes).forEach(node => {
        const parentPath = getDirname(node.path);
        if (parentPath && parentPath !== '.' && parentPath !== node.path && nodes[parentPath]) {
            // Ensure parent exists and is a folder before adding child
            if(nodes[parentPath].type === 'folder') {
                // Avoid adding duplicates
                if (!nodes[parentPath].children.some(child => child.path === node.path)) {
                    nodes[parentPath].children.push(node);
                }
            }
        } 
    });

    // Third pass: Identify roots based on currentFolders prop
    currentFolders.forEach(rootPath => {
        // Normalize the root path from the prop for matching
        const normalizedRootPath = rootPath.replace(/\\/g, '/'); 
        // Find the node corresponding to this root path
        const rootNode = Object.values(nodes).find(node => node.path.replace(/\\/g, '/') === normalizedRootPath);
        if (rootNode) {
            // Check if it's already added to prevent duplicates if currentFolders has dupes
            if (!roots.some(r => r.path === rootNode.path)) {
                console.log("[Arborist buildTree] Adding root node:", rootNode);
                roots.push(rootNode);
            } else {
                 console.log("[Arborist buildTree] Skipping duplicate root node:", rootNode);
            }
        } else {
            console.warn(`[Arborist buildTree] Root path ${rootPath} not found in processed nodes.`);
        }
    });

    // Optional: Sort children within each node (folders first, then alphabetically)
    const sortNodesRecursive = (nodeList, parentPath, orderMap) => {
        if (!nodeList) return;

        console.log(`[Sort] Sorting children for parent: '${parentPath}'`);
        // Get the predefined order for this parent, if available
        const predefinedOrder = orderMap ? orderMap[parentPath] : null;
        if(predefinedOrder) {
            console.log(`[Sort] Found predefined order for '${parentPath}':`, JSON.stringify(predefinedOrder));
        } else {
            console.log(`[Sort] No predefined order found for '${parentPath}'. Using default sort.`);
        }

        nodeList.sort((a, b) => {
            // --- Predefined Order Logic --- 
            if (predefinedOrder) {
                const indexA = predefinedOrder.indexOf(a.path);
                const indexB = predefinedOrder.indexOf(b.path);

                // If both items are in the predefined order, sort by their index
                if (indexA !== -1 && indexB !== -1) {
                    return indexA - indexB;
                }
                // If only A is in the order, it comes first
                if (indexA !== -1) return -1;
                // If only B is in the order, it comes first
                if (indexB !== -1) return 1;
                // If neither is in the order, fall through to default sort
            }
            // --- Default Sort Logic --- 
            let comparisonResult = 0;
            if (a.type === 'folder' && b.type !== 'folder') return -1;
            if (a.type !== 'folder' && b.type === 'folder') return 1;
            comparisonResult = a.name.localeCompare(b.name);
            // console.log(`[Sort Compare Default] ${a.name} vs ${b.name}: ${comparisonResult}`); // Optional: Very verbose log
            return comparisonResult;
        });
        nodeList.forEach(node => {
            if (node.children) sortNodesRecursive(node.children, node.path, orderMap);
        });
    };

    // Sort children of all nodes in the map that have children
    Object.values(nodes).forEach(node => {
        if (node.children) {
            sortNodesRecursive(node.children, node.path, currentItemOrder);
        }
    });

    // Sort the final list of root nodes themselves (using '.' as the key for the root level)
    sortNodesRecursive(roots, '.', currentItemOrder);

    console.log("[Arborist buildTree] Final roots:", roots);
    return roots;
  }, []);

  useEffect(() => {
    // Rebuild tree when files, folders, OR currentFolders change
    console.log("Arborist useEffect rebuilding tree. currentFolders:", currentFolders, "itemOrder:", JSON.stringify(itemOrder));
    const newTree = buildTree(files, folders, currentFolders, itemOrder);
    setTreeData(newTree);

    // Update root folder name based on the *last* added root folder
    if (currentFolders.length > 0) {
        const lastRootPath = currentFolders[currentFolders.length - 1];
        setRootFolderName(getBasename(lastRootPath));
    } else {
        setRootFolderName('');
    }
    
    // Auto-expand all root folders defined in currentFolders
    if (currentFolders.length > 0) {
        const rootPathsToExpand = {};
        currentFolders.forEach(rootPath => {
            const normalizedPath = rootPath.replace(/\\/g, '/');
            rootPathsToExpand[normalizedPath] = true;
        });
        // Merge with existing expanded nodes to preserve subfolder state
        setExpandedNodes(prev => ({ ...prev, ...rootPathsToExpand })); 
    }

  }, [files, folders, currentFolders, buildTree, itemOrder]);

  const handleFolderToggle = useCallback((path) => {
    setExpandedNodes(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  }, []);

  // Updated handler for selecting/renaming/toggling nodes
  const handleNodeSelect = useCallback((node, event) => { // Accept event object
    console.log('Node selected/clicked:', node, 'Target:', event.target);

    if (selectedNodePath === node.path) {
      // Second click on the same node: Initiate rename ONLY if text was clicked
      if (event.target.closest('[data-testid="node-name"]')) {
        console.log('Second click on TEXT detected, initiating rename for:', node.path);
        handleRenameStart(node);
      } else {
        console.log('Second click on NON-TEXT detected.');
        // If second click is on an icon of an already selected item, perform icon action
        if (node.type === 'folder') {
          // Specifically handle toggling the folder if the icon area is clicked again
          console.log('Toggling already selected folder:', node.path);
          handleFolderToggle(node.path);
        }
        // If it was a file, clicking the icon again on a selected file does nothing extra
      }
    } else {
      // First click or click on a different node: Select and potentially toggle/open
      console.log('First click or different node selected:', node.path);
      setSelectedNodePath(node.path);

      // If it's a file, call the original onFileSelect (presumably to open it)
      if (node.type === 'file') {
        onFileSelect(node);
      } 
      // If it's a folder, toggle its expansion
      else if (node.type === 'folder') {
        handleFolderToggle(node.path); // Toggle folder on first select
      }
    }
  }, [selectedNodePath, onFileSelect, handleFolderToggle, handleRenameStart]); // Added dependencies

  // Function to initiate rename
  const handleRenameStart = useCallback((node) => { // Make useCallback
    setRenamingNodePath(node.path);
  }, []); // Added dependency array

  // Function to handle submitted rename
  const handleRenameSubmit = async (node, newName) => {
    console.log(`Attempting to rename ${node.path} to ${newName}`);
    setRenamingNodePath(null); // Exit renaming mode visually first
    
    const oldPath = node.path;
    // Construct the new path using path-browserify for frontend consistency
    const newPath = path.join(getDirname(oldPath), newName);
    
    // Ensure the new name is valid (basic check)
    if (!newName || newName.includes('/') || newName.includes('\\')) {
        console.error("Invalid name for rename.");
        // TODO: Show user notification
        return; 
    }

    try {
        // We need a way to actually perform the rename.
        // This likely involves calling an API exposed from the main process.
        // Let's assume an `onRenameItem` prop is passed down from App.jsx
        if (typeof onRenameItem === 'function') { 
            // Pass old path, new path, and type (file/folder)
            await onRenameItem(oldPath, newPath, node.type === 'folder');
            console.log(`Rename successful: ${oldPath} -> ${newPath}`);
            // The parent (App.jsx) should update the files/folders list,
            // which will cause this component to re-render with the new data.
            setSelectedNodePath(newPath); // Select the newly renamed item
        } else {
            console.warn('onRenameItem prop is not provided. Cannot perform rename.');
        }
    } catch (error) {
        console.error('Rename failed:', error);
        // TODO: Show user notification of failure
        // Optionally, revert visual state if needed, though re-render should handle it.
    }
  };

  // Function to cancel rename
  const handleRenameCancel = () => {
    setRenamingNodePath(null);
  };

  // Handle open folder button click (Replaces existing content)
  const handleOpenFolder = useCallback(() => {
    if (window.api && window.api.openFolderDialog) {
      window.api.openFolderDialog().then(folderPath => {
        if (folderPath && onScanFolder) {
          console.log(`Arborist requesting scan (replace mode): ${folderPath}`);
          // Scan the selected folder, replacing existing content (addMode = false)
          onScanFolder(folderPath, false).then(() => {
            // Auto-expand the root folder
            if (folderPath) {
              // Normalize the path for consistency
              const normalizedPath = path.normalize(folderPath).replace(/\\/g, '/');
              setExpandedNodes({ [normalizedPath]: true }); // Reset and expand only this one
            }
          });
        }
      });
    } else {
      console.log("API for opening folder dialog not available");
    }
  }, [onScanFolder]);

  // Handle add folder button click (Adds to existing content)
  const handleAddFolder = useCallback(() => {
    if (window.api && window.api.openFolderDialog) {
      window.api.openFolderDialog().then(folderPath => {
        if (folderPath && onScanFolder) {
          console.log(`Arborist requesting scan (add mode): ${folderPath}`);
          // Scan the selected folder, adding to existing content (addMode = true)
          onScanFolder(folderPath, true).then(() => {
            // Auto-expand the newly added folder
            if (folderPath) {
              // Normalize the path for consistency
              const normalizedPath = path.normalize(folderPath).replace(/\\/g, '/');
              setExpandedNodes(prev => ({
                ...prev,
                [normalizedPath]: true
              }));
            }
          });
        }
      });
    } else {
      console.log("API for opening folder dialog not available");
    }
  }, [onScanFolder]);
  
  // Re-added context menu handlers and effects
  const handleContextMenu = useCallback((event, node) => {
    event.preventDefault();
    event.stopPropagation();
    const bounds = explorerRef.current?.getBoundingClientRect();
    const x = event.clientX - (bounds?.left ?? 0);
    const y = event.clientY - (bounds?.top ?? 0);
    setSelectedNodePath(node.path); // Select node on right-click
    setContextMenu({ visible: true, x, y, node });
  }, []);

  const handleClickOutside = useCallback((event) => {
    if (contextMenu.visible) {
      setContextMenu(prev => ({ ...prev, visible: false }));
    }
  }, [contextMenu.visible]);

  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [handleClickOutside]);

  // --- Placeholder Action Handlers --- 
  const handleDeleteItem = (node) => {
    console.log('Delete requested for:', node);
    setContextMenu(prev => ({ ...prev, visible: false }));
    if (typeof onDeleteItem === 'function') {
      onDeleteItem(node.path, node.type === 'folder');
    } else {
        console.warn('onDeleteItem prop is not provided.');
    }
  };

  const handleNewFile = async (folderNode) => { // Make async
    console.log('New file requested in:', folderNode);
    setContextMenu(prev => ({ ...prev, visible: false }));
    if (typeof onCreateFile === 'function' && typeof onFileSelect === 'function') { // Check onFileSelect exists
      const newPath = await onCreateFile(folderNode.path); // Call prop and wait for path
      if (newPath) {
        console.log('New file created, initiating rename for:', newPath);
        
        // Expand parent folder if collapsed
        if (!expandedNodes[folderNode.path]) {
          console.log(`Expanding parent folder ${folderNode.path} after new file creation.`);
          handleFolderToggle(folderNode.path);
        }
        
        // --- START: Open the new file in the editor ---
        const newFileObject = {
          path: newPath,
          name: getBasename(newPath), // Use path util to get name
          type: 'file' 
        };
        console.log('Opening newly created file:', newFileObject);
        onFileSelect(newFileObject); 
        // --- END: Open the new file in the editor ---

        setRenamingNodePath(newPath); // Trigger rename for the new file
        // Optional: Scroll the new item into view if needed
      } else {
        console.error('onCreateFile prop failed or did not return a path.');
      }
    } else {
      console.warn('onCreateFile or onFileSelect prop is not provided.'); // Updated warning
    }
  };

  const handleNewFolder = async (parentNode) => { // Make async
    console.log('New folder requested in:', parentNode);
    setContextMenu(prev => ({ ...prev, visible: false }));
    if (typeof onCreateFolder === 'function') {
      const newPath = await onCreateFolder(parentNode.path); // Call prop and wait for path
      if (newPath) {
        console.log('New folder created, initiating rename for:', newPath);
        setRenamingNodePath(newPath); // Trigger rename for the new folder
        // Optional: Scroll the new item into view if needed
      } else {
        console.error('onCreateFolder prop failed or did not return a path.');
      }
    } else {
        console.warn('onCreateFolder prop is not provided.');
    }
  };

  // --- Drag and Drop Handler passed to TreeNode ---
  const handleMoveItem = useCallback((sourceNodeData, targetNode, action, position = null) => {
    if (action === 'dragStart' && sourceNodeData) {
      setDraggingPath(sourceNodeData.path);
      setDragOverPath(null); // Clear drag over when starting a new drag
      setDragOverPosition(null);
    } else if (action === 'dragOver' && targetNode) {
      // --- Optimize: Only update state if path or position actually changes ---
      if (targetNode.path !== dragOverPath || position !== dragOverPosition) {
        // console.log(`[DnD State Update] Path: ${dragOverPath}=>${targetNode.path}, Pos: ${dragOverPosition}=>${position}`); // Debug log
        setDragOverPath(targetNode.path);
        setDragOverPosition(position);
      }
      // ---------------------------------------------------------------------
      // Logic for allowing drop effect is handled by onDragOver in TreeNode directly
    } else if (action === 'drop' && sourceNodeData && targetNode) {
      setDragOverPath(null); // Clear visual cues immediately on drop
      setDragOverPosition(null);
      
      // Determine the effective target and action for App.jsx
      let effectiveTargetNode = targetNode;
      let dropActionType = position; // 'top', 'bottom', 'middle'

      // If dropping on top/bottom, the logical target is the parent
      // We only pass the node we dropped relative to, and the position
      if (position === 'top' || position === 'bottom') {
        // Keep targetNode as the node we dropped relative to
      } else if (position === 'middle' && targetNode.type !== 'folder') {
        // Dropping onto a file is invalid for move *into*
        console.log('[Explorer] Invalid drop target (middle of file).');
        setDraggingPath(null);
        return; // Abort
      } // else: dropping middle of folder is fine, targetNode is correct

      const sourceItem = { path: sourceNodeData.path, type: sourceNodeData.type };

      // Check validity using the original target node
      if (isValidDrop(sourceItem, targetNode)) { 
        console.log(`[Explorer] Requesting move: ${sourceNodeData.path} relative to ${targetNode.path} at position ${position}`);
        if (typeof onMoveItemProp === 'function') {
            // Pass source, the node dropped relative to, and the position
            onMoveItemProp(sourceItem, targetNode, position); 
        } else {
            console.warn('onMoveItemProp is not provided. Cannot perform move.');
        }
      }
      // Reset drag path state regardless of validity
      setDraggingPath(null);
    } else if (action === 'dragEnd') {
      // Reset all drag states when drag ends (dropped outside or cancelled)
      setDraggingPath(null);
      setDragOverPath(null);
      setDragOverPosition(null);
    }
  }, [onMoveItemProp, dragOverPath, dragOverPosition]); // Add dragOver states as dependencies
  // --- End Drag and Drop Handler ---

  return (
    <div ref={explorerRef} className="file-explorer h-full flex flex-col relative"> {/* Keep relative for potential future absolute elements */}
      {/* Tree content area */}
      <div className="file-explorer-content p-2 w-full flex-grow overflow-auto">
        {treeData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-4 text-surface-500 dark:text-surface-400 text-sm text-center">
            <IconFolderOff size={24} className="mb-2 opacity-50" />
            <p>No files loaded</p>
            <div className="mt-3 flex flex-col gap-2">
              {/* Button to open a folder initially */}
              <button 
                onClick={handleOpenFolder}
                className="px-3 py-1 bg-primary-500 hover:bg-primary-600 text-white rounded text-sm"
              >
                Open Folder
              </button>
               {/* Button to add a folder initially */}
              <button 
                onClick={handleAddFolder}
                className="px-3 py-1 border border-surface-300 dark:border-surface-600 rounded text-sm hover:bg-surface-200 dark:hover:bg-surface-700"
              >
                Add Folder
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm">
            {treeData.map(node => (
              <TreeNode
                key={node.path}
                node={node}
                level={0} // Start top-level nodes at level 0
                onNodeSelect={handleNodeSelect} // Use the new selection handler
                onFolderToggle={handleFolderToggle} // Keep this separate for buildTree logic
                expandedNodes={expandedNodes}
                isSelected={selectedNodePath === node.path} // Pass internal selection state
                renamingNodePath={renamingNodePath} // Pass renaming state
                onRenameSubmit={handleRenameSubmit} // Pass rename submit handler
                onRenameCancel={handleRenameCancel} // Pass rename cancel handler
                currentFilePath={currentFilePath} // Pass down current file path
                selectedNodePath={selectedNodePath} // Pass down selected path state
                onContextMenu={handleContextMenu} // Pass down context menu handler
                onMoveItem={handleMoveItem} // Pass down unified DnD handler
                isDragging={draggingPath === node.path} 
                dragOverPath={dragOverPath} 
                dragOverPosition={dragOverPosition} // Pass down drag over position directly
              />
            ))}
            {/* Optional Footer Info */}
            {/* 
            <div className="mt-2 pt-2 text-xs text-gray-500 border-t border-gray-200 dark:border-gray-700">
              {treeData.length} root items · {files.length} files · {folders.length} folders
            </div> 
            */}
          </div>
        )}
      </div>
      
      {/* Context Menu - Now uncommented */}
      {contextMenu.visible && contextMenu.node ? (
        <div 
          className="absolute bg-white dark:bg-neutral-800 border border-surface-300 dark:border-surface-700 rounded shadow-lg py-1 z-50 text-sm"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()} // Prevent menu clicks from closing itself immediately
        >
          <ul>
            {/* Rename Option */}
            <li
              className="px-3 py-1 hover:bg-primary-500 hover:text-white cursor-pointer"
              onClick={() => {
                setContextMenu(prev => ({ ...prev, visible: false })); // Close menu first
                handleRenameStart(contextMenu.node); // Initiate rename
              }}
            >
              Rename
            </li>
            <li className="border-t border-surface-200 dark:border-surface-700 my-1"></li>

            {/* Folder Specific Options */}
            {contextMenu.node.type === 'folder' && (
              <>
                <li 
                  className="px-3 py-1 hover:bg-primary-500 hover:text-white cursor-pointer"
                  onClick={() => handleNewFile(contextMenu.node)}
                >
                  New File
                </li>
                <li 
                  className="px-3 py-1 hover:bg-primary-500 hover:text-white cursor-pointer"
                  onClick={() => handleNewFolder(contextMenu.node)}
                >
                  New Folder
                </li>
                <li className="border-t border-surface-200 dark:border-surface-700 my-1"></li>
              </>
            )}
            
            {/* Delete Option */}
            <li 
              className="px-3 py-1 text-error-500 hover:bg-error-500 hover:text-white cursor-pointer"
              onClick={() => handleDeleteItem(contextMenu.node)}
            >
              Delete {contextMenu.node.type === 'folder' ? 'Folder' : 'File'}
            </li>
          </ul>
        </div>
      ) : null} 
    </div>
  );
};

export default FileExplorer; 
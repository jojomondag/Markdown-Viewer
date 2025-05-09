import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  IconFolder,
  IconFile,
  IconFolderOpen,
  IconChevronRight,
  IconChevronDown,
  IconFolderPlus,
  IconFolderOff,
  IconExternalLink
} from '@tabler/icons-react';
import path from 'path-browserify';
import { getBasename, getDirname } from '../utils/pathUtils'; // Assuming pathUtils exists
import { isValidDrop } from '../utils/fileOperations'; // Import DnD utils
import TreeNode from './TreeNode';

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
  expandedNodes, // <-- Accept expandedNodes state from props
  onFolderToggle, // <-- Accept folder toggle handler from props
  onAddFolderProp, // <-- Accept the new prop from App.jsx
  // Add any other necessary props based on App.jsx usage
}) => {
  const [treeData, setTreeData] = useState([]);
  const [rootFolderName, setRootFolderName] = useState(''); // Optional: display root folder name
  const [selectedNodePaths, setSelectedNodePaths] = useState(new Set()); // Use a Set for multi-selection
  const [shiftSelectionAnchorPath, setShiftSelectionAnchorPath] = useState(null); // Anchor for shift-click range selection
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
                roots.push(rootNode);
            } else {
                 console.warn("[Arborist buildTree] Skipping duplicate root node:", rootNode);
            }
        } else {
            console.warn(`[Arborist buildTree] Root path ${rootPath} not found in processed nodes.`);
        }
    });

    // Optional: Sort children within each node (folders first, then alphabetically)
    const sortNodesRecursive = (nodeList, parentPath, orderMap) => {
        if (!nodeList) return;

        // Get the predefined order for this parent, if available
        const predefinedOrder = orderMap ? orderMap[parentPath] : null;

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

    return roots;
  }, []);

  useEffect(() => {
    // Rebuild tree when files, folders, OR currentFolders change
    const newTree = buildTree(files, folders, currentFolders, itemOrder);
    setTreeData(newTree);

    // Update root folder name based on the *last* added root folder
    if (currentFolders.length > 0) {
        const lastRootPath = currentFolders[currentFolders.length - 1];
        setRootFolderName(getBasename(lastRootPath));
    } else {
        setRootFolderName('');
    }

  }, [files, folders, currentFolders, buildTree, itemOrder]);

  // Helper function to get a flattened list of visible nodes
  const getVisibleNodes = useCallback(() => {
    const visible = [];
    const traverse = (nodes) => {
      if (!nodes) return;
      nodes.forEach(node => {
        visible.push(node);
        if (node.type === 'folder' && expandedNodes[node.path] && node.children) {
          traverse(node.children);
        }
      });
    };
    traverse(treeData);
    return visible;
  }, [treeData, expandedNodes]);

  // Updated handler for selecting/renaming/toggling nodes
  const handleNodeSelect = useCallback((node, event) => { // Accept event object
    const isCtrlCmdPressed = event.metaKey || event.ctrlKey;
    const isShiftPressed = event.shiftKey;
    const clickedPath = node.path;

    setSelectedNodePaths(prevSelectedPaths => {
      let newSelectedPaths = new Set(prevSelectedPaths);

      if (isShiftPressed && shiftSelectionAnchorPath) {
        // Shift + Click: Select range
        const visibleNodes = getVisibleNodes();
        const anchorIndex = visibleNodes.findIndex(n => n.path === shiftSelectionAnchorPath);
        const clickedIndex = visibleNodes.findIndex(n => n.path === clickedPath);

        if (anchorIndex !== -1 && clickedIndex !== -1) {
          newSelectedPaths = new Set(); // Start fresh for range selection
          const start = Math.min(anchorIndex, clickedIndex);
          const end = Math.max(anchorIndex, clickedIndex);
          for (let i = start; i <= end; i++) {
            newSelectedPaths.add(visibleNodes[i].path);
          }
        } else {
          // Anchor not found, treat as normal click
          newSelectedPaths = new Set([clickedPath]);
          setShiftSelectionAnchorPath(clickedPath);
        }
      } else if (isCtrlCmdPressed) {
        // Ctrl/Cmd + Click: Toggle selection
        if (newSelectedPaths.has(clickedPath)) {
          newSelectedPaths.delete(clickedPath);
          // If we deselect the anchor, clear it or pick another? Clear for now.
          if (shiftSelectionAnchorPath === clickedPath) {
             setShiftSelectionAnchorPath(null);
          }
        } else {
          newSelectedPaths.add(clickedPath);
          setShiftSelectionAnchorPath(clickedPath); // Set anchor on add
        }
      } else {
        // Normal Click (or Shift without anchor): Select only this item
        if (newSelectedPaths.has(clickedPath) && newSelectedPaths.size === 1) {
           // Clicking the already single-selected item
           // Initiate rename ONLY if clicking the text part
          if (event.target.closest('[data-testid="node-name"]')) {
             handleRenameStart(node);
          } else if (node.type === 'folder') {
             // Clicking the icon part of an already selected folder toggles it
             onFolderToggle(node.path);
          }
          // Keep selection as is if renaming or toggling
        } else {
          // Select only the clicked item
          newSelectedPaths = new Set([clickedPath]);
          setShiftSelectionAnchorPath(clickedPath); // Set anchor on normal click
          // Open file / Toggle folder only on a normal click that changes selection
          if (node.type === 'file') {
            onFileSelect(node);
          } else if (node.type === 'folder') {
            onFolderToggle(node.path);
          }
        }
      }
      return newSelectedPaths;
    });
  }, [onFileSelect, onFolderToggle, handleRenameStart, shiftSelectionAnchorPath, getVisibleNodes]); // Added dependencies

  // Function to initiate rename
  const handleRenameStart = useCallback((node) => { // Make useCallback
    setRenamingNodePath(node.path);
  }, []); // Added dependency array

  // Function to handle submitted rename
  const handleRenameSubmit = async (node, newName) => {
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
            // The parent (App.jsx) should update the files/folders list,
            // which will cause this component to re-render with the new data.
            setSelectedNodePaths(new Set([newPath])); // Select the newly renamed item
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

  // --- START: New Handler for Show in Explorer ---
  const handleShowInExplorer = (node) => {
    setContextMenu(prev => ({ ...prev, visible: false })); // Close context menu
    if (node && node.path) {
      if (window.api && typeof window.api.showItemInFolder === 'function') {
        window.api.showItemInFolder(node.path);
      } else {
        console.warn('window.api.showItemInFolder is not available.');
        // Provide fallback or user feedback if needed
      }
    } else {
      console.error('Cannot show item in explorer: Node or node path is missing.', node);
    }
  };
  // --- END: New Handler for Show in Explorer ---

  // Handle open folder button click (Replaces existing content)
  const handleOpenFolder = useCallback(() => {
    // Call the function passed down from App.jsx
    if (onAddFolderProp) {
      onAddFolderProp();
    } else {
      console.error("onAddFolderProp function is not available in FileExplorer");
    }
  }, [onAddFolderProp]); // Depend on the new prop

  // Re-added context menu handlers and effects
  const handleContextMenu = useCallback((event, node) => {
    event.preventDefault();
    event.stopPropagation();
    
    // --- Calculate position relative to viewport ---
    let x = event.clientX;
    let y = event.clientY;

    // --- Prevent viewport overflow ---
    // Estimate menu size (adjust if needed)
    const menuWidth = 160; // Approx width in pixels
    const menuHeight = 150; // Approx height in pixels (adjust based on items)

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (x + menuWidth > viewportWidth) {
      x = viewportWidth - menuWidth - 10; // Adjust left position
    }
    if (y + menuHeight > viewportHeight) {
      y = viewportHeight - menuHeight - 10; // Adjust top position
    }
    // --- End overflow prevention ---

    setSelectedNodePaths(new Set([node.path])); // Select node on right-click
    setContextMenu({ visible: true, x, y, node });
  }, []); // Removed explorerRef dependency

  const handleClickOutside = useCallback((event) => {
    // Check if the click is outside the context menu itself
    if (contextMenu.visible && !event.target.closest('.context-menu')) {
        setContextMenu(prev => ({ ...prev, visible: false }));
    }
}, [contextMenu.visible]);

  useEffect(() => {
    // Use capture phase for click outside to handle clicks on other elements potentially stopping propagation
    document.addEventListener('click', handleClickOutside, true); 
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [handleClickOutside]);

  // --- Placeholder Action Handlers ---
  const handleDeleteItem = (node) => {
    setContextMenu(prev => ({ ...prev, visible: false }));
    if (typeof onDeleteItem === 'function') {
      onDeleteItem(node.path, node.type === 'folder');
    } else {
        console.warn('onDeleteItem prop is not provided.');
    }
  };

  const handleNewFile = async (folderNode) => { // Make async
    setContextMenu(prev => ({ ...prev, visible: false }));
    if (typeof onCreateFile === 'function' && typeof onFileSelect === 'function') { // Check onFileSelect exists
      const newPath = await onCreateFile(folderNode.path); // Call prop and wait for path
      if (newPath) {

        // Expand parent folder if collapsed
        if (!expandedNodes[folderNode.path]) {
          onFolderToggle(folderNode.path);
        }

        // --- START: Open the new file in the editor ---
        const newFileObject = {
          path: newPath,
          name: getBasename(newPath), // Use path util to get name
          type: 'file'
        };
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
    setContextMenu(prev => ({ ...prev, visible: false }));
    if (typeof onCreateFolder === 'function') {
      const newPath = await onCreateFolder(parentNode.path); // Call prop and wait for path
      if (newPath) {
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
    // sourceNodeData can now be an array of items or a single item (from dragStart)
    if (action === 'dragStart' && sourceNodeData) {
      // If dragging an unselected item, select it first
      const items = Array.isArray(sourceNodeData) ? sourceNodeData : [sourceNodeData];
      if (items.length === 1 && !selectedNodePaths.has(items[0].path)) {
        setSelectedNodePaths(new Set([items[0].path]));
        setShiftSelectionAnchorPath(items[0].path);
      }
      // Mark the primary dragged item for visual feedback (optional)
      setDraggingPath(items[0]?.path || null);
      setDragOverPath(null); // Clear drag over when starting a new drag
      setDragOverPosition(null);
    } else if (action === 'dragOver' && targetNode) {
      // Update drag over state for visual feedback
      if (targetNode.path !== dragOverPath || position !== dragOverPosition) {
        setDragOverPath(targetNode.path);
        setDragOverPosition(position);
      }
      // ---------------------------------------------------------------------
      // Logic for allowing drop effect is handled by onDragOver in TreeNode directly
    } else if (action === 'drop' && sourceNodeData && targetNode) {
      // sourceNodeData is now guaranteed to be an array by handleDrop
      const sourceItems = sourceNodeData;

      setDragOverPath(null); // Clear visual cues immediately on drop
      setDragOverPosition(null);

      if (position === 'top' || position === 'bottom') {
        // Keep targetNode as the node we dropped relative to
      } else if (position === 'middle' && targetNode.type !== 'folder') {
        // Dropping onto a file is invalid for move *into*
        console.warn('[Explorer] Invalid drop target (middle of file).');
        // No need to clear draggingPath here, dragEnd will handle it
        return; // Abort
      } // else: dropping middle of folder is fine, targetNode is correct

      // Check validity for the *first* dragged item as a representative check
      // More robust checking might be needed depending on requirements
      if (sourceItems.length > 0 && isValidDrop(sourceItems[0], targetNode)) {
        if (typeof onMoveItemProp === 'function') {
            // Pass source items array, the node dropped relative to, and the position
            onMoveItemProp(sourceItems, targetNode, position);
        } else {
            console.warn('onMoveItemProp is not provided. Cannot perform move.');
        }
      } else {
        console.warn('[Explorer] Drop deemed invalid or no items.');
      }
      // Reset drag path state regardless of validity
      setDraggingPath(null);
    } else if (action === 'dragEnd') {
      // Reset all drag states when drag ends (dropped outside or cancelled)
      setDraggingPath(null);
      setDragOverPath(null);
      setDragOverPosition(null);
    }
  }, [onMoveItemProp, dragOverPath, dragOverPosition, selectedNodePaths, setSelectedNodePaths, setShiftSelectionAnchorPath]); // Added dependencies
  // --- End Drag and Drop Handler ---

  return (
    <div
      ref={explorerRef}
      className={`file-explorer h-full flex flex-col relative overflow-hidden ${
        treeData.length === 0 ? 'items-center justify-center' : ''
      }`}
      onClick={(e) => {
        // Prevent clicks inside the tree from deselecting
        if (e.target === explorerRef.current) {
            setSelectedNodePaths(new Set()); // Clear selection set
            setShiftSelectionAnchorPath(null); // Clear anchor
        }
      }}
    >
      {treeData.length === 0 ? (
        <button
          onClick={handleOpenFolder}
          className="btn btn-primary px-4 py-2 text-sm flex flex-col items-center"
        >
          <IconFolderPlus size={24} className="mb-1 opacity-75" />
          open workspace
        </button>
      ) : (
        // Scrollable Content Area for the tree
        <div className="w-full flex-grow overflow-y-auto min-h-0 p-2">
          <div className="text-sm">
            {treeData.map(node => (
              <TreeNode
                key={node.path}
                node={node}
                level={0}
                onNodeSelect={handleNodeSelect}
                onFolderToggle={onFolderToggle}
                expandedNodes={expandedNodes}
                selectedNodePaths={selectedNodePaths}
                renamingNodePath={renamingNodePath}
                onRenameSubmit={handleRenameSubmit}
                onRenameCancel={handleRenameCancel}
                currentFilePath={currentFilePath}
                onContextMenu={handleContextMenu}
                onMoveItem={handleMoveItem}
                isDragging={draggingPath === node.path}
                dragOverPath={dragOverPath}
                dragOverPosition={dragOverPosition}
              />
            ))}
          </div>
        </div>
      )}

      {/* Context Menu Structure */}
      {contextMenu.visible && (
        <div
          className="context-menu fixed z-50 bg-white dark:bg-surface-800 shadow-lg rounded-md py-1 border border-surface-300 dark:border-surface-700 w-40" // <-- Changed to position: fixed
          style={{ top: contextMenu.y, left: contextMenu.x }}
          // Added ref/data-attribute to help handleClickOutside ignore clicks inside
          data-context-menu="true" 
        >
          {contextMenu.node && contextMenu.node.type === 'folder' && (
            <>
              <button onClick={() => handleNewFile(contextMenu.node)} className="context-menu-item w-full text-left px-3 py-1 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700">New File</button>
              <button onClick={() => handleNewFolder(contextMenu.node)} className="context-menu-item w-full text-left px-3 py-1 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700">New Folder</button>
              <div className="context-menu-divider h-px my-1 bg-surface-200 dark:bg-surface-700"></div>
            </>
          )}
          <button onClick={() => handleRenameStart(contextMenu.node)} className="context-menu-item w-full text-left px-3 py-1 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700">Rename</button>
          {contextMenu.node && contextMenu.node.type === 'folder' ? (
            <button onClick={() => handleDeleteItem(contextMenu.node)} className="context-menu-item w-full text-left px-3 py-1 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700">Remove Folder</button>
          ) : (
            <button onClick={() => handleDeleteItem(contextMenu.node)} className="context-menu-item w-full text-left px-3 py-1 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700">Delete File</button>
          )}
          {/* --- START: Add Show in Explorer option --- */}
          <div className="context-menu-divider h-px my-1 bg-surface-200 dark:bg-surface-700"></div>
          <button
             onClick={() => handleShowInExplorer(contextMenu.node)}
             className="context-menu-item w-full text-left px-3 py-1 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 flex items-center gap-2" // Added flex for icon
           >
             <IconExternalLink size={14} className="opacity-70" /> {/* Added icon */}
             Show in Explorer
           </button>
          {/* --- END: Add Show in Explorer option --- */}
           {/* Add more context menu options here if needed */}
        </div>
      )}
    </div>
  );
};

export default FileExplorer;
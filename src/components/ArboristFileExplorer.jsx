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
  onContextMenu // Re-added prop
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
      setNewName(node.name);
      // Focus the input when renaming starts
      setTimeout(() => renameInputRef.current?.focus(), 0);
    } else {
      setIsRenaming(false);
    }
  }, [renamingNodePath, node.path, node.name]);

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

  return (
    <div className="flex flex-col">
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
  // Add any other necessary props based on App.jsx usage
}) => {
  const [expandedNodes, setExpandedNodes] = useState({});
  const [treeData, setTreeData] = useState([]);
  const [rootFolderName, setRootFolderName] = useState(''); // Optional: display root folder name
  const [selectedNodePath, setSelectedNodePath] = useState(null); // State for selected node path
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, node: null }); // Re-added context menu state
  const [renamingNodePath, setRenamingNodePath] = useState(null); // State for which node is being renamed
  const explorerRef = useRef(null); // Re-added ref for the explorer container

  // Function to build the tree structure from flat lists based on currentFolders
  const buildTree = useCallback((files, folders, currentFolders) => {
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
    const sortNodesRecursive = (nodeList) => {
        if (!nodeList) return;
        nodeList.sort((a, b) => {
            if (a.type === 'folder' && b.type !== 'folder') return -1;
            if (a.type !== 'folder' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
        });
        nodeList.forEach(node => {
            if (node.children) sortNodesRecursive(node.children);
        });
    };

    // Sort children of all nodes in the map that have children
    Object.values(nodes).forEach(node => {
        if (node.children) {
            sortNodesRecursive(node.children);
        }
    });

    // Sort the final list of root nodes themselves
    sortNodesRecursive(roots);

    console.log("[Arborist buildTree] Final roots:", roots);
    return roots;
  }, []);

  useEffect(() => {
    // Rebuild tree when files, folders, OR currentFolders change
    console.log("Arborist useEffect rebuilding tree. currentFolders:", currentFolders);
    const newTree = buildTree(files, folders, currentFolders);
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

  }, [files, folders, currentFolders, buildTree]); // Add currentFolders dependency

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
    if (typeof onCreateFile === 'function') {
      const newPath = await onCreateFile(folderNode.path); // Call prop and wait for path
      if (newPath) {
        console.log('New file created, initiating rename for:', newPath);
        setRenamingNodePath(newPath); // Trigger rename for the new file
        // Optional: Scroll the new item into view if needed
      } else {
        console.error('onCreateFile prop failed or did not return a path.');
      }
    } else {
      console.warn('onCreateFile prop is not provided.');
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
  // --- End Placeholder Action Handlers ---

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
      
      {/* Context Menu */}      
      {contextMenu.visible && contextMenu.node && (
        <div 
          className="absolute bg-white dark:bg-neutral-800 border border-surface-300 dark:border-surface-700 rounded shadow-lg py-1 z-50 text-sm"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()} // Prevent menu clicks from closing itself immediately
        >
          <ul>
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
                <li className="border-t border-surface-200 dark:border-surface-700 my-1"></li> {/* Separator */} 
              </>
            )}
            <li 
              className="px-3 py-1 text-error-500 hover:bg-error-500 hover:text-white cursor-pointer"
              onClick={() => handleDeleteItem(contextMenu.node)}
            >
              Delete {contextMenu.node.type === 'folder' ? 'Folder' : 'File'}
            </li>
            {/* Add other actions here later */}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FileExplorer; 
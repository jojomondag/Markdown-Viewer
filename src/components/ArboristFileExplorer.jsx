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
  selectedNodePath // Added prop
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
    onNodeSelect(node);
    
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

  return (
    <div className="flex flex-col">
      <div 
        className={`flex items-center px-1 py-1 rounded cursor-pointer hover:bg-surface-200 dark:hover:bg-surface-700 
                    ${isSelected || node.path === currentFilePath ? 'bg-primary-100 dark:bg-primary-900 border border-primary-400 dark:border-primary-600' : ''}`}
        onClick={handleClick}
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
          <div className="truncate text-sm">
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
  // Add any other necessary props based on App.jsx usage
}) => {
  const [expandedNodes, setExpandedNodes] = useState({});
  const [treeData, setTreeData] = useState([]);
  const [rootFolderName, setRootFolderName] = useState(''); // Optional: display root folder name
  const [selectedNodePath, setSelectedNodePath] = useState(null); // State for selected node path
  const [renamingNodePath, setRenamingNodePath] = useState(null); // State for which node is being renamed
  const explorerRef = useRef(null); // Ref for the explorer container

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
  const handleNodeSelect = useCallback((node) => {
    console.log('Node selected/clicked:', node);

    if (selectedNodePath === node.path) {
      // Second click on the same node: Initiate rename
      console.log('Second click detected, initiating rename for:', node.path);
      handleRenameStart(node);
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
    // setContextMenu(prev => ({ ...prev, visible: false })); // Removed context menu part
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
  
  return (
    <div ref={explorerRef} className="file-explorer h-full flex flex-col relative"> {/* Keep relative for potential future absolute elements */}
      {/* Header with Add/Open buttons */}
      <div className="file-explorer-header p-2 border-b border-surface-200 dark:border-surface-700 flex justify-between items-center">
        <div className="text-sm font-medium flex items-center">
          <span>Files</span>
          {/* Optional Root Folder Display */}
          {rootFolderName && (
             <span className="ml-2 text-xs text-surface-500 dark:text-surface-400 flex items-center">
               <IconFolder size={12} className="mr-1" />
               {rootFolderName}
             </span>
          )}
        </div>
        <div className="flex space-x-1">
          {/* Using handleOpenFolder for the "Open Folder" icon */}
          <button 
            onClick={handleOpenFolder} 
            className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300"
            title="Open Folder (Replaces current)"
          >
            <IconFolderOpen size={16} />
          </button>
          {/* Using handleAddFolder for the "Add Folder" icon */}
          <button 
            onClick={handleAddFolder}
            className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300"
            title="Add Folder (Adds to current)"
          >
            <IconFolderPlus size={16} />
          </button>
        </div>
      </div>
      
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
    </div>
  );
};

export default FileExplorer; 
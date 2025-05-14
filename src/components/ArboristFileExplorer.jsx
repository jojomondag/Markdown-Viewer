import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  IconFolderPlus,
  IconExternalLink
} from '@tabler/icons-react';
import path from 'path-browserify';
import { getBasename, getDirname } from '../utils/pathUtils';
import TreeNode from './TreeNode';

const FileExplorer = ({
  files = [],
  folders = [],
  currentFolders = [],
  currentFilePath,
  onFileSelect,
  onRenameItem,
  onCreateFile,
  onCreateFolder,
  onDeleteItem,
  onMoveItemProp,
  itemOrder,
  expandedNodes,
  onFolderToggle,
  onAddFolderProp,
  itemOrderVersion,
}) => {
  const [treeData, setTreeData] = useState([]);
  const [selectedNodePaths, setSelectedNodePaths] = useState(new Set());
  const [shiftSelectionAnchorPath, setShiftSelectionAnchorPath] = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, node: null });
  const [renamingNodePath, setRenamingNodePath] = useState(null);
  const explorerRef = useRef(null);
  const [draggingPath, setDraggingPath] = useState(null);
  const [dragOverPath, setDragOverPath] = useState(null);
  const [dragOverPosition, setDragOverPosition] = useState(null);
  const dragStateRef = useRef({
    draggingPath: null,
    dragOverPath: null,
    dragOverPosition: null
  });
  const buildTree = useCallback((files, folders, rootPaths, currentItemOrder) => {
    if (itemOrderVersion % 5 === 0) {
      console.log('[ArboristFileExplorer] Building tree with itemOrderVersion:', itemOrderVersion);
    }
    const allItems = [...files, ...folders];
    const nodes = {};
    const roots = [];
    allItems.forEach(item => {
      const node = {
        ...item,
        key: `${item.path}-${itemOrderVersion}`,
        children: []
      };
      nodes[item.path] = node;
    });
    Object.values(nodes).forEach(node => {
      if (node.path === '.') return;
      const parentPath = getDirname(node.path) || '.';
      const parentNode = nodes[parentPath];
      if (parentNode) {
        parentNode.children.push(node);
      }
    });
    rootPaths.forEach(rootPath => {
        const rootNode = nodes[rootPath];
        if (rootNode) {
            if (!roots.some(r => r.path === rootNode.path)) {
                roots.push(rootNode);
            } else {
                 console.warn("[Arborist buildTree] Skipping duplicate root node:", rootNode);
            }
        } else {
            console.warn(`[Arborist buildTree] Root path ${rootPath} not found in processed nodes.`);
        }
    });
    const sortNodesRecursive = (nodeList, parentPath, orderMap) => {
        if (!nodeList) return;
        const predefinedOrder = orderMap ? orderMap[parentPath] : null;
        if (false) {
          console.log(`[ArboristFileExplorer] Sorting nodes for parent ${parentPath}:`,
            {
              nodeCount: nodeList.length,
              hasPredefinedOrder: !!predefinedOrder,
              predefinedOrder: predefinedOrder || 'none',
              nodesPaths: nodeList.map(n => n.path),
              itemOrderVersion
            }
          );
        }
        nodeList.sort((a, b) => {
            if (predefinedOrder) {
                const indexA = predefinedOrder.indexOf(a.path);
                const indexB = predefinedOrder.indexOf(b.path);
                if (false) {
                  console.log(`[ArboristFileExplorer] Comparing nodes: ${a.path} (idx: ${indexA}) vs ${b.path} (idx: ${indexB}), itemOrderVersion: ${itemOrderVersion}`);
                }
                if (indexA !== -1 && indexB !== -1) {
                    return indexA - indexB;
                }
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;
            }
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
    Object.values(nodes).forEach(node => {
        if (node.children) {
            sortNodesRecursive(node.children, node.path, currentItemOrder);
        }
    });
    sortNodesRecursive(roots, '.', currentItemOrder);
    if (itemOrderVersion % 5 === 0) {
      console.log('[ArboristFileExplorer] Built tree structure with itemOrderVersion:', itemOrderVersion,
        roots.map(root => ({
          path: root.path,
          childrenCount: root.children?.length || 0
        }))
      );
    }
    return roots;
  }, [itemOrderVersion]);
  useEffect(() => {
    console.log('[ArboristFileExplorer] useEffect triggered to rebuild tree with itemOrderVersion:', itemOrderVersion);
    const newTree = buildTree(files, folders, currentFolders, itemOrder);
    setTreeData(newTree);
  }, [files, folders, currentFolders, buildTree, itemOrder, itemOrderVersion]);
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
  const handleNodeSelect = useCallback((node, event) => {
    const isCtrlCmdPressed = event.metaKey || event.ctrlKey;
    const isShiftPressed = event.shiftKey;
    const clickedPath = node.path;
    setSelectedNodePaths(prevSelectedPaths => {
      let newSelectedPaths = new Set(prevSelectedPaths);
      if (isShiftPressed && shiftSelectionAnchorPath) {
        const visibleNodes = getVisibleNodes();
        const anchorIndex = visibleNodes.findIndex(n => n.path === shiftSelectionAnchorPath);
        const clickedIndex = visibleNodes.findIndex(n => n.path === clickedPath);
        if (anchorIndex !== -1 && clickedIndex !== -1) {
          newSelectedPaths = new Set();
          const start = Math.min(anchorIndex, clickedIndex);
          const end = Math.max(anchorIndex, clickedIndex);
          for (let i = start; i <= end; i++) {
            newSelectedPaths.add(visibleNodes[i].path);
          }
        } else {
          newSelectedPaths = new Set([clickedPath]);
          setShiftSelectionAnchorPath(clickedPath);
        }
      } else if (isCtrlCmdPressed) {
        if (newSelectedPaths.has(clickedPath)) {
          newSelectedPaths.delete(clickedPath);
          if (shiftSelectionAnchorPath === clickedPath) {
             setShiftSelectionAnchorPath(null);
          }
        } else {
          newSelectedPaths.add(clickedPath);
          setShiftSelectionAnchorPath(clickedPath);
        }
      } else {
        if (newSelectedPaths.has(clickedPath) && newSelectedPaths.size === 1) {
          if (event.target.closest('[data-testid="node-name"]')) {
             handleRenameStart(node);
          } else if (node.type === 'folder') {
             onFolderToggle(node.path);
          }
        } else {
          newSelectedPaths = new Set([clickedPath]);
          setShiftSelectionAnchorPath(clickedPath);
          if (node.type === 'file') {
            onFileSelect(node);
          } else if (node.type === 'folder') {
            onFolderToggle(node.path);
          }
        }
      }
      return newSelectedPaths;
    });
  }, [onFileSelect, onFolderToggle, handleRenameStart, shiftSelectionAnchorPath, getVisibleNodes]);
  const handleRenameStart = useCallback((node) => {
    setContextMenu(prev => ({ ...prev, visible: false }));
    setRenamingNodePath(node.path);
  }, []);
  const handleRenameSubmit = async (node, newName) => {
    setRenamingNodePath(null);
    const oldPath = node.path;
    const newPath = path.join(getDirname(oldPath), newName);
    if (!newName || newName.includes('/') || newName.includes('\\')) {
        console.error("Invalid name for rename.");
        return;
    }
    try {
        if (typeof onRenameItem === 'function') {
            await onRenameItem(oldPath, newPath, node.type === 'folder');
            setSelectedNodePaths(new Set([newPath]));
        } else {
            console.warn('onRenameItem prop is not provided. Cannot perform rename.');
        }
    } catch (error) {
        console.error('Rename failed:', error);
    }
  };
  const handleRenameCancel = () => {
    setRenamingNodePath(null);
  };
  const handleShowInExplorer = (node) => {
    setContextMenu(prev => ({ ...prev, visible: false }));
    if (node && node.path) {
      if (window.api && typeof window.api.showItemInFolder === 'function') {
        window.api.showItemInFolder(node.path);
      } else {
        console.warn('window.api.showItemInFolder is not available.');
      }
    } else {
      console.error('Cannot show item in explorer: Node or node path is missing.', node);
    }
  };
  const handleOpenFolder = useCallback(() => {
    if (onAddFolderProp) {
      onAddFolderProp();
    } else {
      console.error("onAddFolderProp function is not available in FileExplorer");
    }
  }, [onAddFolderProp]);
  const handleContextMenu = useCallback((event, node) => {
    event.preventDefault();
    event.stopPropagation();
    let x = event.clientX;
    let y = event.clientY;
    const menuWidth = 160;
    const menuHeight = 150;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    if (x + menuWidth > viewportWidth) {
      x = viewportWidth - menuWidth - 10;
    }
    if (y + menuHeight > viewportHeight) {
      y = viewportHeight - menuHeight - 10;
    }

    // Preserve multi-selection if right-clicked node is already selected
    if (!selectedNodePaths.has(node.path) || selectedNodePaths.size <= 1) {
      setSelectedNodePaths(new Set([node.path]));
    }
    // If it is part of a multi-selection, selectedNodePaths remains unchanged.

    setContextMenu({ visible: true, x, y, node });
  }, [selectedNodePaths]);
  const handleClickOutside = useCallback((event) => {
    if (contextMenu.visible && !event.target.closest('.context-menu')) {
        setContextMenu(prev => ({ ...prev, visible: false }));
    }
}, [contextMenu.visible]);
  useEffect(() => {
    document.addEventListener('click', handleClickOutside, true);
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [handleClickOutside]);
  const handleDeleteItem = (clickedNode) => {
    setContextMenu(prev => ({ ...prev, visible: false }));
    if (typeof onDeleteItem !== 'function') {
      console.warn('onDeleteItem prop is not provided.');
      return;
    }

    const itemsToDelete = [];
    // Create a map for quick lookup of node details (including type)
    const allNodesMap = new Map();
    [...files, ...folders].forEach(item => allNodesMap.set(item.path, item));

    if (selectedNodePaths.has(clickedNode.path) && selectedNodePaths.size > 1) {
      // Multi-selection delete
      selectedNodePaths.forEach(path => {
        const nodeDetails = allNodesMap.get(path);
        if (nodeDetails) {
          itemsToDelete.push({ path: nodeDetails.path, type: nodeDetails.type });
        } else {
          console.warn(`[ArboristFileExplorer] Node details not found for path: ${path}. Inferring type.`);
          // Basic type inference if node details are missing (e.g. during rapid changes)
          // This is a fallback; ideally, all selected paths should have details.
          const isLikelyFolder = !path.includes('.') || path.endsWith('/'); 
          itemsToDelete.push({ path: path, type: isLikelyFolder ? 'folder' : 'file' });
        }
      });
    } else {
      // Single item delete (the clicked node or if selection was cleared to just one)
      itemsToDelete.push({ path: clickedNode.path, type: clickedNode.type });
    }

    if (itemsToDelete.length > 0) {
      onDeleteItem(itemsToDelete); // onDeleteItem now expects an array
    }
  };
  const handleNewFile = async (folderNode) => {
    setContextMenu(prev => ({ ...prev, visible: false }));
    if (typeof onCreateFile === 'function' && typeof onFileSelect === 'function') {
      const newFileCreationResult = await onCreateFile(folderNode.path);
      if (newFileCreationResult && newFileCreationResult.path) {
        const newPath = newFileCreationResult.path;
        if (!expandedNodes[folderNode.path]) {
          onFolderToggle(folderNode.path);
        }
        onFileSelect(newFileCreationResult);
        setTimeout(() => {
          setRenamingNodePath(newPath);
        }, 0);
      } else {
        console.error('onCreateFile prop failed or did not return a path.');
      }
    } else {
      console.warn('onCreateFile or onFileSelect prop is not provided.');
    }
  };
  const handleNewFolder = async (parentNode) => {
    setContextMenu(prev => ({ ...prev, visible: false }));
    if (typeof onCreateFolder === 'function') {
      const newPath = await onCreateFolder(parentNode.path);
      if (newPath) {
        setTimeout(() => {
          setRenamingNodePath(newPath);
        }, 0);
      } else {
        console.error('onCreateFolder prop failed or did not return a path.');
      }
    } else {
        console.warn('onCreateFolder prop is not provided.');
    }
  };
  const handleMoveItem = useCallback((sourceNodeData, targetNode, action, position = null) => {
    if (action === 'dragStart' && sourceNodeData) {
      const items = Array.isArray(sourceNodeData) ? sourceNodeData : [sourceNodeData];
      if (items.length === 1 && !selectedNodePaths.has(items[0].path)) {
        setSelectedNodePaths(new Set([items[0].path]));
        setShiftSelectionAnchorPath(items[0].path);
      }
      setDraggingPath(items[0]?.path || null);
      dragStateRef.current.draggingPath = items[0]?.path || null;
      setDragOverPath(null);
      setDragOverPosition(null);
      dragStateRef.current.dragOverPath = null;
      dragStateRef.current.dragOverPosition = null;
    } else if (action === 'dragOver' && targetNode) {
      if (dragStateRef.current.dragOverPath !== targetNode.path ||
          dragStateRef.current.dragOverPosition !== position) {
        setDragOverPath(targetNode.path);
        setDragOverPosition(position);
        dragStateRef.current.dragOverPath = targetNode.path;
        dragStateRef.current.dragOverPosition = position;
      }
    } else if (action === 'drop' && targetNode && sourceNodeData) {
      const items = Array.isArray(sourceNodeData) ? sourceNodeData : [sourceNodeData];
      if (items.some(item => item.path === targetNode.path)) {
        return;
      }
      let effectivePosition = position;
      if (targetNode.type === 'file' && position === 'middle') {
        effectivePosition = 'bottom';
      }
      if (onMoveItemProp) {
        const completeItems = items.map(item => ({
          path: item.path,
          type: item.type || (item.path.includes('.') ? 'file' : 'folder'),
          name: item.name || item.path.split('/').pop()
        }));
        const completeTargetNode = {
          path: targetNode.path,
          type: targetNode.type || (targetNode.path.includes('.') ? 'file' : 'folder'),
          name: targetNode.name || targetNode.path.split('/').pop()
        };
        onMoveItemProp(completeItems, completeTargetNode, effectivePosition);
      }
      setDragOverPath(null);
      setDragOverPosition(null);
      setDraggingPath(null);
      dragStateRef.current.dragOverPath = null;
      dragStateRef.current.dragOverPosition = null;
      dragStateRef.current.draggingPath = null;
    } else if (action === 'dragEnd') {
      setDragOverPath(null);
      setDragOverPosition(null);
      setDraggingPath(null);
      dragStateRef.current.dragOverPath = null;
      dragStateRef.current.dragOverPosition = null;
      dragStateRef.current.draggingPath = null;
    }
  }, [selectedNodePaths, setSelectedNodePaths, setShiftSelectionAnchorPath, onMoveItemProp]);
  const handleExplorerContextMenu = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    let x = event.clientX;
    let y = event.clientY;
    const menuWidth = 160;
    const menuHeight = 150;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    if (x + menuWidth > viewportWidth) {
      x = viewportWidth - menuWidth - 10;
    }
    if (y + menuHeight > viewportHeight) {
      y = viewportHeight - menuHeight - 10;
    }
    setContextMenu({ visible: true, x, y, node: null });
  }, []);
  const handleAddRootFolder = () => {
    setContextMenu(prev => ({ ...prev, visible: false }));
    if (typeof onAddFolderProp === 'function') {
      onAddFolderProp();
    } else {
      console.error("onAddFolderProp function is not available");
    }
  };
  useEffect(() => {
    dragStateRef.current = {
      draggingPath,
      dragOverPath,
      dragOverPosition
    };
  }, [draggingPath, dragOverPath, dragOverPosition]);
  return (
    <div
      ref={explorerRef}
      className={`file-explorer h-full flex flex-col relative overflow-hidden ${
        treeData.length === 0 ? 'items-center justify-center' : ''
      }`}
      onClick={(e) => {
        if (e.target === explorerRef.current) {
            setSelectedNodePaths(new Set());
            setShiftSelectionAnchorPath(null);
        }
      }}
      onContextMenu={handleExplorerContextMenu}
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
        <div className="w-full flex-grow overflow-y-auto min-h-0 p-2" onContextMenu={handleExplorerContextMenu}>
          <div className="text-sm">
            {treeData.map(node => (
              <TreeNode
                key={`${node.path}-${itemOrderVersion}`}
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
                itemOrderVersion={itemOrderVersion}
              />
            ))}
          </div>
        </div>
      )}
      {}
      {contextMenu.visible && (
        <div
          className="context-menu fixed z-50 bg-white dark:bg-surface-800 shadow-lg rounded-md py-1 border border-surface-300 dark:border-surface-700 w-40"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          data-context-menu="true"
        >
          {}
          {!contextMenu.node && (
            <button
              onClick={handleAddRootFolder}
              className="context-menu-item w-full text-left px-3 py-1 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700"
            >
              {}
              Add Folder to Workspace
            </button>
          )}
          {}
          {contextMenu.node && (
            <>
              {contextMenu.node.type === 'folder' && (
                <>
                  <button onClick={() => handleNewFile(contextMenu.node)} className="context-menu-item w-full text-left px-3 py-1 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700">New File</button>
                  <button onClick={() => handleNewFolder(contextMenu.node)} className="context-menu-item w-full text-left px-3 py-1 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700">New Folder</button>
                  <div className="context-menu-divider h-px my-1 bg-surface-200 dark:bg-surface-700"></div>
                </>
              )}
              <button onClick={() => handleRenameStart(contextMenu.node)} className="context-menu-item w-full text-left px-3 py-1 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700">Rename</button>
              {contextMenu.node && contextMenu.node.type === 'folder' ? (
                <button onClick={() => handleDeleteItem(contextMenu.node)} className="context-menu-item w-full text-left px-3 py-1 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700">Remove Folder from Workspace</button>
              ) : (
                <button onClick={() => handleDeleteItem(contextMenu.node)} className="context-menu-item w-full text-left px-3 py-1 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700">Delete File</button>
              )}
              {}
              <div className="context-menu-divider h-px my-1 bg-surface-200 dark:bg-surface-700"></div>
              <button
                onClick={() => handleShowInExplorer(contextMenu.node)}
                className="context-menu-item w-full text-left px-3 py-1 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 flex items-center gap-2"
              >
                <IconExternalLink size={14} className="opacity-70" />
                Show in Explorer
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
export default FileExplorer;
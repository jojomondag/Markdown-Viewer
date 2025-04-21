import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { 
  IconFolder, 
  IconFile,
  IconTrash,
  IconCopy,
  IconEdit,
  IconFolderPlus,
  IconFilePlus,
  IconFolderOpen,
  IconSortAscending,
  IconSortDescending,
  IconAbc,
  IconCalendar,
  IconFileTypography,
  IconCheck,
  IconX
} from '@tabler/icons-react';
import path from 'path-browserify';
import { ContextMenu } from './ui/context-menu';
import { NewFolderDialog } from './ui/NewFolderDialog';
import { RenameDialog } from './ui/RenameDialog';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { isValidDrop } from '../utils/fileOperations';
import { formatShortcut, KEYBOARD_SHORTCUTS } from '../utils/keyboardShortcuts';

// Utility function to normalize folder objects
const normalizeFolderObject = (folder) => {
  if (!folder) return null;
  
  // Ensure path is a string
  const folderPath = typeof folder.path === 'string' ? folder.path : '';
  
  // Create a normalized name (just the basename, no path)
  let folderName = path.basename(folderPath);
  
  const normalizedFolder = {
    ...folder,
    name: folderName,
    path: folderPath
  };
  
  console.log('Normalized folder object:', {
    before: { name: folder.name, path: folder.path },
    after: { name: normalizedFolder.name, path: normalizedFolder.path }
  });
  
  return normalizedFolder;
};

// Add a utility function to extract only basename from objects for display
const getDisplayName = (item) => {
  if (!item) return '';
  
  // Get the path and handle Windows paths properly
  let itemPath = '';
  if (item.path) {
    itemPath = item.path;
    
    // For Windows paths with backslashes, extract the last part directly
    if (itemPath.includes('\\')) {
      const parts = itemPath.split('\\');
      return parts[parts.length - 1] || '';
    } else {
      return path.basename(itemPath);
    }
  }
  
  return item.name || '';
};

// Memoize FileItem to prevent unnecessary re-renders
const MemoizedFileItem = memo(({ file, currentFilePath, onFileSelect, onContextMenu, depth, isLastChild, onStartEditing, isEditing, onFinishEditing, onCancelEditing, editValue, onEditValueChange }) => {
  const isActive = currentFilePath === file.path;
  const inputRef = useRef(null);
  
  // Always use just the basename for display
  const displayName = getDisplayName(file);

  // Focus the input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      
      // Select name without extension for files
      const extIndex = displayName.lastIndexOf('.');
      if (extIndex > 0) {
        inputRef.current.setSelectionRange(0, extIndex);
      } else {
        inputRef.current.select();
      }
    }
  }, [isEditing, displayName]);
  
  return (
    <div 
      className={`file-item ${isActive ? 'active' : ''}`}
      onClick={(e) => {
        // Only trigger file select action on double click
        const isDoubleClick = e.detail === 2;
        if (isDoubleClick) {
          onFileSelect(file);
        }
      }}
      onContextMenu={(e) => onContextMenu(e, file)}
      style={{ 
        paddingLeft: `${depth * 16}px`,
        display: 'flex', 
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        position: 'relative'
      }}
    >
      {depth > 0 && (
        <>
          {/* Horizontal connector line */}
          <div 
            className="tree-line-horizontal" 
            style={{
              position: 'absolute',
              left: `${(depth - 0.75) * 16}px`,
              top: '50%',
              height: '1px',
              width: '8px',
              backgroundColor: 'var(--color-border, #ccc)'
            }}
          />
          {/* Vertical connector line (only show for non-last children or for open folders) */}
          <div 
            className="tree-line-vertical" 
            style={{
              position: 'absolute',
              left: `${(depth - 0.75) * 16}px`,
              top: '-8px', 
              height: isLastChild ? '50%' : '100%', // Only extend halfway if last child
              width: '1px',
              backgroundColor: 'var(--color-border, #ccc)'
            }}
          />
        </>
      )}
      <div className="file-icon" style={{ marginRight: '8px', flexShrink: 0 }}>
        <IconFile />
      </div>
      {isEditing ? (
        <div className="file-name-editing flex items-center" style={{ flex: 1 }}>
          <input 
            ref={inputRef}
            type="text"
            className="px-1 py-0 border border-primary-400 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 w-full"
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onFinishEditing();
                e.preventDefault();
              } else if (e.key === 'Escape') {
                onCancelEditing();
                e.preventDefault();
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="ml-1 flex">
            <button 
              className="p-0.5 text-success-500 hover:bg-surface-200 dark:hover:bg-surface-600 rounded"
              onClick={(e) => {
                e.stopPropagation();
                onFinishEditing();
              }}
              title="Save"
            >
              <IconCheck size={14} />
            </button>
            <button 
              className="p-0.5 text-error-500 hover:bg-surface-200 dark:hover:bg-surface-600 rounded"
              onClick={(e) => {
                e.stopPropagation();
                onCancelEditing();
              }}
              title="Cancel"
            >
              <IconX size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div 
          className="file-name cursor-text" 
          title={displayName} 
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}
          onClick={(e) => {
            e.stopPropagation();
            if (!isEditing) {
              onStartEditing(file);
            }
          }}
        >
          {displayName}
        </div>
      )}
    </div>
  );
});

// Memoize FolderItem to prevent unnecessary re-renders
const MemoizedFolderItem = memo(({ 
  folder, 
  expandedFolders,
  toggleFolder,
  depth,
  onContextMenu,
  isLastChild,
  onStartEditing,
  isEditing,
  onFinishEditing,
  onCancelEditing,
  editValue,
  onEditValueChange
}) => {
  const isRoot = folder.isRoot === true;
  const isExpanded = expandedFolders[folder.path] || false;
  const inputRef = useRef(null);
  
  // Always use just the basename for display
  const displayName = getDisplayName(folder);
  
  // Focus the input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  
  return (
    <div 
      className={`folder-item ${isExpanded ? 'expanded' : ''} ${isRoot ? 'root-folder' : ''}`}
      style={{ 
        paddingLeft: `${depth * 16}px`,
        display: 'flex', 
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        position: 'relative'
      }}
      onClick={(e) => {
        e.stopPropagation();
        // Folder row click toggles folder
        const isDoubleClick = e.detail === 2;
        if (isDoubleClick) {
          toggleFolder(folder.path);
        }
      }}
      onContextMenu={(e) => onContextMenu(e, folder)}
    >
      {depth > 0 && (
        <>
          {/* Horizontal connector line */}
          <div 
            className="tree-line-horizontal" 
            style={{
              position: 'absolute',
              left: `${(depth - 0.75) * 16}px`,
              top: '50%',
              height: '1px',
              width: '8px',
              backgroundColor: 'var(--color-border, #ccc)'
            }}
          />
          {/* Vertical connector line (only show for non-last children or for open folders) */}
          <div 
            className="tree-line-vertical" 
            style={{
              position: 'absolute',
              left: `${(depth - 0.75) * 16}px`,
              top: '-8px',
              height: isLastChild ? '50%' : '100%', // Only extend halfway if last child
              width: '1px',
              backgroundColor: 'var(--color-border, #ccc)'
            }}
          />
        </>
      )}
      <div 
        className="folder-icon" 
        style={{ marginRight: '8px', flexShrink: 0 }}
        onClick={(e) => {
          e.stopPropagation();
          toggleFolder(folder.path);
        }}
      >
        {isExpanded ? <IconFolderOpen /> : <IconFolder />}
      </div>
      {isEditing ? (
        <div className="folder-name-editing flex items-center" style={{ flex: 1 }}>
          <input 
            ref={inputRef}
            type="text"
            className="px-1 py-0 border border-primary-400 bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 w-full"
            value={editValue}
            onChange={(e) => onEditValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onFinishEditing();
                e.preventDefault();
              } else if (e.key === 'Escape') {
                onCancelEditing();
                e.preventDefault();
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="ml-1 flex">
            <button 
              className="p-0.5 text-success-500 hover:bg-surface-200 dark:hover:bg-surface-600 rounded"
              onClick={(e) => {
                e.stopPropagation();
                onFinishEditing();
              }}
              title="Save"
            >
              <IconCheck size={14} />
            </button>
            <button 
              className="p-0.5 text-error-500 hover:bg-surface-200 dark:hover:bg-surface-600 rounded"
              onClick={(e) => {
                e.stopPropagation();
                onCancelEditing();
              }}
              title="Cancel"
            >
              <IconX size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div 
          className="folder-name cursor-text" 
          title={displayName} 
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}
          onClick={(e) => {
            e.stopPropagation();
            if (!isEditing && !isRoot) {
              onStartEditing(folder);
            }
          }}
        >
          {displayName}
        </div>
      )}
    </div>
  );
});

const FileExplorer = ({ 
  files, 
  folders,
  currentFolders,
  onFileSelect, 
  onDeleteFile, 
  onRenameFile, 
  onScanFolder, 
  onMoveFile, 
  fileOperationStatus,
  onCreateFile,
  onCreateFolder,
  currentFilePath,
  sortBy: externalSortBy,
  sortDirection: externalSortDirection,
  onSortChange
}) => {
  // Load expanded folders from localStorage
  const [expandedFolders, setExpandedFolders] = useState(() => {
    try {
      const saved = localStorage.getItem('fileExplorer_expandedFolders');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error('Error loading expanded folders from localStorage', e);
      return {};
    }
  });
  
  const [contextMenu, setContextMenu] = useState({
    show: false,
    x: 0,
    y: 0,
    type: null, // 'file' or 'folder'
    item: null
  });
  const [focusedItem, setFocusedItem] = useState(null);
  const [draggingItem, setDraggingItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);
  const fileExplorerRef = useRef(null);
  const itemRefs = useRef({});
  const contextMenuRef = useRef(null);

  // Add state for the new folder dialog
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderParent, setNewFolderParent] = useState(null);
  
  // Add state for the rename dialog
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [itemToRename, setItemToRename] = useState(null);
  
  // Add state for the delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Use external sort props if provided
  const [sortBy, setSortBy] = useState(externalSortBy || 'name'); 
  const [sortDirection, setSortDirection] = useState(externalSortDirection || 'asc');

  // New state for inline editing
  const [editingItem, setEditingItem] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Save expanded folders to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('fileExplorer_expandedFolders', JSON.stringify(expandedFolders));
    } catch (e) {
      console.error('Error saving expanded folders to localStorage', e);
    }
  }, [expandedFolders]);

  // Add some CSS for the root folder
  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .folder-item.root-folder .folder-icon svg {
        color: var(--color-primary-500);
      }
      .folder-item.root-folder {
        font-weight: 500;
      }
    `;
    document.head.appendChild(styleEl);
    
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);

  // Save currentFilePath to localStorage whenever it changes
  useEffect(() => {
    if (currentFilePath) {
      try {
        localStorage.setItem('fileExplorer_selectedFile', currentFilePath);
      } catch (e) {
        console.error('Error saving selected file to localStorage', e);
      }
    }
  }, [currentFilePath]);

  // Restore selected file on component mount
  useEffect(() => {
    const savedFilePath = localStorage.getItem('fileExplorer_selectedFile');
    if (savedFilePath && files.length > 0 && !currentFilePath) {
      const fileToSelect = files.find(file => file.path === savedFilePath);
      if (fileToSelect) {
        // Ensure parent folders are expanded
        expandParentFolders(savedFilePath);
        onFileSelect(fileToSelect);
      }
    }
  }, [files, onFileSelect, currentFilePath]);

  // Scroll selected file into view when it changes
  useEffect(() => {
    if (currentFilePath) {
      const refKey = `file-${currentFilePath}`;
      const element = itemRefs.current[refKey];
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [currentFilePath]);

  // Update local state when external props change
  useEffect(() => {
    if (externalSortBy) {
      setSortBy(externalSortBy);
    }
  }, [externalSortBy]);

  useEffect(() => {
    if (externalSortDirection) {
      setSortDirection(externalSortDirection);
    }
  }, [externalSortDirection]);
  
  // Create root folder objects from currentFolders prop
  const rootFolders = useMemo(() => {
    if (!currentFolders || currentFolders.length === 0) return [];
    
    console.log('Creating root folders from:', currentFolders);
    
    const roots = currentFolders.map(folderPath => {
      // Extract just the last segment of the path regardless of slash type
      let folderName;
      if (folderPath && typeof folderPath === 'string') {
        if (folderPath.includes('\\')) {
          const parts = folderPath.split('\\');
          folderName = parts[parts.length - 1] || '';
        } else {
          folderName = path.basename(folderPath);
        }
      } else {
        folderName = 'Unknown';
      }
      
      // Create a clean root folder object with a display name that is just the basename
      const rootFolder = {
        name: folderName,       // Only store the basename as the name
        path: folderPath,       // Keep the full path for operations
        type: 'folder',
        isRoot: true,
        displayName: folderName // Explicitly add a displayName property
      };
      
      console.log('Created root folder:', rootFolder);
      return rootFolder;
    });
    
    console.log('Final root folders:', roots);
    return roots;
  }, [currentFolders]);

  // Group files and folders by top-level directory (needed for the empty state check)
  const topLevelFolders = folders.filter(folder => 
    !folders.some(f => folder.path !== f.path && folder.path.startsWith(f.path))
  );
  const topLevelFiles = files.filter(file => 
    !folders.some(folder => file.path.startsWith(folder.path))
  );

  // Expand the root folders when currentFolders changes
  useEffect(() => {
    if (currentFolders && currentFolders.length > 0) {
      const newExpandedFolders = { ...expandedFolders };
      
      // Auto-expand all root folders
      currentFolders.forEach(folderPath => {
        if (!expandedFolders[folderPath]) {
          newExpandedFolders[folderPath] = true;
        }
      });
      
      if (Object.keys(newExpandedFolders).length > Object.keys(expandedFolders).length) {
        setExpandedFolders(newExpandedFolders);
      }
    }
  }, [currentFolders, expandedFolders]);

  // Add rootFolders to the flattened items list
  const getFlattenedItems = () => {
    const items = [];
    const addedPaths = new Set();
    
    // Helper to normalize path separators for consistent comparison
    const normalizePath = (p) => p.replace(/\\/g, '/');
    
    // Get all normalized paths for quick checking
    const normalizedFolderPaths = folders.map(f => normalizePath(f.path));
    const normalizedRootPaths = rootFolders.map(rf => normalizePath(rf.path));
    
    // Process a folder tree recursively
    const processFolder = (folder, level, parentPath) => {
      const normalizedPath = normalizePath(folder.path);
      if (addedPaths.has(normalizedPath)) return;
      
      // Extract the folder name properly handling Windows paths
      let folderDisplayName;
      if (folder.path && folder.path.includes('\\')) {
        const parts = folder.path.split('\\');
        folderDisplayName = parts[parts.length - 1] || '';
      } else {
        folderDisplayName = path.basename(folder.path || '');
      }
      
      // Add the folder itself with clean naming
      items.push({
        ...folder,
        name: folderDisplayName,          // Override name with basename
        displayName: folderDisplayName,   // Explicitly add displayName property
        type: 'folder',
        level: level,
        parentPath: parentPath
      });
      addedPaths.add(normalizedPath);
      
      // If folder is expanded, process its children
      if (expandedFolders[folder.path]) {
        // Get direct child folders
        const childFolders = folders.filter(f => {
          const normalizedFolderPath = normalizePath(f.path);
          const folderParentPath = path.dirname(normalizedFolderPath);
          return folderParentPath === normalizedPath && !addedPaths.has(normalizedFolderPath);
        });
        
        // Get direct child files
        const childFiles = files.filter(f => {
          const normalizedFilePath = normalizePath(f.path);
          const fileParentPath = path.dirname(normalizedFilePath);
          return fileParentPath === normalizedPath && !addedPaths.has(normalizedFilePath);
        });
        
        // Sort children
        sortItems(childFolders, 'folder');
        sortItems(childFiles, 'file');
        
        // Process child folders recursively
        childFolders.forEach(childFolder => {
          processFolder(childFolder, level + 1, folder.path);
        });
        
        // Add child files
        childFiles.forEach(file => {
          const normalizedFilePath = normalizePath(file.path);
          if (addedPaths.has(normalizedFilePath)) return;
          
          // Extract file name properly handling Windows paths
          let fileDisplayName;
          if (file.path && file.path.includes('\\')) {
            const parts = file.path.split('\\');
            fileDisplayName = parts[parts.length - 1] || '';
          } else {
            fileDisplayName = path.basename(file.path || '');
          }
          
          items.push({
            ...file,
            name: fileDisplayName,         // Override with basename
            displayName: fileDisplayName,  // Add explicit displayName
            type: 'file',
            level: level + 1,
            parentPath: folder.path
          });
          addedPaths.add(normalizedFilePath);
        });
      }
    };
    
    // First, add all root folders
    rootFolders.forEach(rootFolder => {
      // Ensure root folder name is basename
      const rootDisplayName = path.basename(rootFolder.path || '');
      
      items.push({
        ...rootFolder,
        name: rootDisplayName, // Override with display name
        type: 'folder',
        level: 0,
        parentPath: null
      });
      
      addedPaths.add(normalizePath(rootFolder.path));
      
      // Process each root folder's contents if expanded
      if (expandedFolders[rootFolder.path]) {
        const rootPath = normalizePath(rootFolder.path);
        
        // Get direct child folders of this root
        const rootChildFolders = folders.filter(folder => {
          const folderParentPath = path.dirname(normalizePath(folder.path));
          return folderParentPath === rootPath;
        });
        
        // Get direct child files of this root
        const rootChildFiles = files.filter(file => {
          const fileParentPath = path.dirname(normalizePath(file.path));
          return fileParentPath === rootPath;
        });
        
        // Sort the children
        sortItems(rootChildFolders, 'folder');
        sortItems(rootChildFiles, 'file');
        
        // Process child folders recursively
        rootChildFolders.forEach(folder => {
          processFolder(folder, 1, rootFolder.path);
        });
        
        // Add child files
        rootChildFiles.forEach(file => {
          const normalizedFilePath = normalizePath(file.path);
          if (addedPaths.has(normalizedFilePath)) return;
          
          // Extract file name properly handling Windows paths
          let fileDisplayName;
          if (file.path && file.path.includes('\\')) {
            const parts = file.path.split('\\');
            fileDisplayName = parts[parts.length - 1] || '';
          } else {
            fileDisplayName = path.basename(file.path || '');
          }
          
          items.push({
            ...file,
            name: fileDisplayName,         // Override with basename
            displayName: fileDisplayName,  // Add explicit displayName
            type: 'file',
            level: 1,
            parentPath: rootFolder.path
          });
          addedPaths.add(normalizedFilePath);
        });
      }
    });
    
    // Finally, add orphaned files and folders (those not under any root folder)
    // First identify orphans
    const orphanFolders = folders.filter(folder => {
      const normalizedFolderPath = normalizePath(folder.path);
      
      // Skip if already added
      if (addedPaths.has(normalizedFolderPath)) return false;
      
      // Check if this is a top-level folder not inside any root
      const folderParentPath = path.dirname(normalizedFolderPath);
      return !normalizedRootPaths.includes(folderParentPath) && 
             !normalizedFolderPaths.some(p => p !== normalizedFolderPath && normalizedFolderPath.startsWith(p + '/'));
    });
    
    // Add top-level orphan folders first
    sortItems(orphanFolders, 'folder');
    orphanFolders.forEach(folder => {
      processFolder(folder, 0, null);
    });
    
    // Add orphan files
    const orphanFiles = files.filter(file => {
      const normalizedFilePath = normalizePath(file.path);
      if (addedPaths.has(normalizedFilePath)) return false;
      
      const fileParentPath = path.dirname(normalizedFilePath);
      return !normalizedRootPaths.includes(fileParentPath) &&
             !normalizedFolderPaths.some(p => fileParentPath.startsWith(p));
    });
    
    sortItems(orphanFiles, 'file');
    orphanFiles.forEach(file => {
      // Extract file name properly handling Windows paths
      let fileDisplayName;
      if (file.path && file.path.includes('\\')) {
        const parts = file.path.split('\\');
        fileDisplayName = parts[parts.length - 1] || '';
      } else {
        fileDisplayName = path.basename(file.path || '');
      }
      
      items.push({
        ...file,
        name: fileDisplayName,
        displayName: fileDisplayName,
        type: 'file',
        level: 0,
        parentPath: null
      });
      addedPaths.add(normalizePath(file.path));
    });
    
    return items;
  };
  
  // Helper function to sort items based on current sort settings
  const sortItems = (items, itemType) => {
    items.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'type':
          // For files, compare extensions
          if (itemType === 'file') {
            const extA = path.extname(a.name).toLowerCase();
            const extB = path.extname(b.name).toLowerCase();
            comparison = extA.localeCompare(extB);
            // If extensions are the same, sort by name
            if (comparison === 0) {
              comparison = a.name.localeCompare(b.name);
            }
          } else {
            // For folders, just sort by name when sorting by type
            comparison = a.name.localeCompare(b.name);
          }
          break;
        case 'date':
          // Compare modification dates if available
          const dateA = a.modifiedAt ? new Date(a.modifiedAt) : new Date(0);
          const dateB = b.modifiedAt ? new Date(b.modifiedAt) : new Date(0);
          comparison = dateA - dateB;
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }
      
      // Apply sort direction
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };
  
  // Memoize the flattened items calculation to prevent it from recalculating on every render
  const flattenedItems = useMemo(() => {
    return getFlattenedItems();
  }, [files, folders, expandedFolders, sortBy, sortDirection]);
  
  // Update toggle sort direction to use onSortChange
  const toggleSortDirection = () => {
    const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    setSortDirection(newDirection);
    if (onSortChange) {
      onSortChange(sortBy, newDirection);
    }
  };
  
  // Update change sort field to use onSortChange
  const changeSortBy = (field) => {
    setSortBy(field);
    if (onSortChange) {
      onSortChange(field, sortDirection);
    }
  };
  
  // Set up keyboard navigation
  useEffect(() => {
    if (!fileExplorerRef.current) return;
    
    const handleKeyDown = (e) => {
      if (!flattenedItems.length) return;
      
      const currentIndex = focusedItem 
        ? flattenedItems.findIndex(item => 
            item.path === focusedItem.path && item.type === focusedItem.type
          )
        : -1;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < flattenedItems.length - 1) {
            const nextItem = flattenedItems[currentIndex + 1];
            setFocusedItem(nextItem);
            // Focus the DOM element
            if (itemRefs.current[`${nextItem.type}-${nextItem.path}`]) {
              itemRefs.current[`${nextItem.type}-${nextItem.path}`].focus();
            }
          }
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            const prevItem = flattenedItems[currentIndex - 1];
            setFocusedItem(prevItem);
            // Focus the DOM element
            if (itemRefs.current[`${prevItem.type}-${prevItem.path}`]) {
              itemRefs.current[`${prevItem.type}-${prevItem.path}`].focus();
            }
          }
          break;
          
        case 'ArrowRight':
          e.preventDefault();
          if (focusedItem && focusedItem.type === 'folder' && !expandedFolders[focusedItem.path]) {
            toggleFolder(focusedItem.path);
          }
          break;
          
        case 'ArrowLeft':
          e.preventDefault();
          if (focusedItem && focusedItem.type === 'folder' && expandedFolders[focusedItem.path]) {
            toggleFolder(focusedItem.path);
          } else if (focusedItem && focusedItem.parentPath) {
            // Move to parent folder
            const parentFolder = folders.find(folder => folder.path === focusedItem.parentPath);
            if (parentFolder) {
              setFocusedItem({ ...parentFolder, type: 'folder' });
              if (itemRefs.current[`folder-${parentFolder.path}`]) {
                itemRefs.current[`folder-${parentFolder.path}`].focus();
              }
            }
          }
          break;
          
        case 'Enter':
          e.preventDefault();
          if (focusedItem) {
            if (focusedItem.type === 'file') {
              onFileSelect(focusedItem);
            } else {
              toggleFolder(focusedItem.path);
            }
          }
          break;
          
        case ' ': // Space bar
          e.preventDefault();
          if (focusedItem && focusedItem.type === 'file') {
            onFileSelect(focusedItem);
          }
          break;
          
        case 'F10':
          if (e.shiftKey || e.ctrlKey) {
            e.preventDefault();
            if (focusedItem) {
              // Simulate a right-click at the current focused item's position
              const itemElement = itemRefs.current[`${focusedItem.type}-${focusedItem.path}`];
              if (itemElement) {
                const rect = itemElement.getBoundingClientRect();
                handleContextMenu({
                  preventDefault: () => {},
                  clientX: rect.left + rect.width / 2,
                  clientY: rect.top + rect.height / 2
                }, focusedItem);
              }
            }
          }
          break;
          
        case 'Escape':
          if (contextMenu.show) {
            closeContextMenu();
          }
          break;
          
        case 'Home':
          e.preventDefault();
          if (flattenedItems.length > 0) {
            const firstItem = flattenedItems[0];
            setFocusedItem(firstItem);
            if (itemRefs.current[`${firstItem.type}-${firstItem.path}`]) {
              itemRefs.current[`${firstItem.type}-${firstItem.path}`].focus();
            }
          }
          break;
          
        case 'End':
          e.preventDefault();
          if (flattenedItems.length > 0) {
            const lastItem = flattenedItems[flattenedItems.length - 1];
            setFocusedItem(lastItem);
            if (itemRefs.current[`${lastItem.type}-${lastItem.path}`]) {
              itemRefs.current[`${lastItem.type}-${lastItem.path}`].focus();
            }
          }
          break;
          
        default:
          break;
      }
    };
    
    // Add event listener
    fileExplorerRef.current.addEventListener('keydown', handleKeyDown);
    
    return () => {
      if (fileExplorerRef.current) {
        fileExplorerRef.current.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [expandedFolders, focusedItem, flattenedItems, folders, onFileSelect]);

  const toggleFolder = (folderPath) => {
    setExpandedFolders(prev => {
      const newState = { ...prev };
      newState[folderPath] = !prev[folderPath];
      return newState;
    });
  };

  // Handle right-click context menu
  const handleContextMenu = (e, item) => {
    e.preventDefault();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      type: item.type,
      item: item
    });
  };

  // Close the context menu
  const closeContextMenu = () => {
    setContextMenu({
      show: false,
      x: 0,
      y: 0,
      type: null,
      item: null
    });
  };

  // Handle focus
  const handleFocus = (item) => {
    setFocusedItem(item);
  };

  // Handle file operations
  const handleRename = () => {
    const target = contextMenu.item;
    // Instead of using prompt, open the rename dialog
    setItemToRename(target);
    setRenameDialogOpen(true);
  };

  const handleDelete = () => {
    const target = contextMenu.item;
    // Instead of using confirm, open the delete confirmation dialog
    setItemToDelete(target);
    setDeleteDialogOpen(true);
  };

  // Function to handle deletion from the confirmation dialog
  const confirmDelete = () => {
    if (itemToDelete && onDeleteFile) {
      onDeleteFile(itemToDelete.path, itemToDelete.type === 'folder');
    }
  };

  const handleCopy = () => {
    const target = contextMenu.item;
    // Copy file path to clipboard
    navigator.clipboard.writeText(target.path)
      .then(() => {
        console.log('Path copied to clipboard');
      })
      .catch(() => {
        console.error('Failed to copy path to clipboard');
      });
  };

  const handleNewFile = (parentFolder) => {
    console.log(`New file will be created in: ${parentFolder ? parentFolder.name : 'root'}`);
    
    let folderPath;
    if (parentFolder && parentFolder.path) {
      folderPath = parentFolder.path;
      console.log('Using parent folder path:', folderPath);
    } else if (currentFolders && currentFolders.length > 0) {
      folderPath = currentFolders[0];
      console.log('Using current folder path:', folderPath);
    } else {
      console.error('No valid folder to create file in');
      return;
    }
    
    // Generate a timestamp-based name to ensure uniqueness
    const timestamp = new Date().getTime();
    const fileName = `new_${timestamp}.md`;
    
    // For Windows, ensure the path uses the correct separators
    // but don't modify the path too much as it might break the absolute path
    let newFilePath;
    try {
      // Simply join the path components
      newFilePath = path.join(folderPath, fileName);
      console.log('New file path:', newFilePath);
    } catch (err) {
      console.error('Error creating file path:', err);
      alert('Failed to create file path');
      return;
    }
    
    console.log('Attempting to create file at:', newFilePath);
    
    // Create the file with empty content
    window.api.createFile(newFilePath)
      .then(fileData => {
        console.log('Created new file:', fileData);
        
        // Add the file to the files list
        if (typeof onCreateFile === 'function') {
          console.log('Calling onCreateFile with:', fileData);
          onCreateFile(fileData);
          
          // Immediately put the new file in rename mode
          setTimeout(() => {
            // Make sure the parent folder is expanded first
            if (parentFolder) {
              // Only expand the folder if it's not already expanded
              if (!expandedFolders[parentFolder.path]) {
                toggleFolder(parentFolder.path);
              }
            }
            
            // Start editing the newly created file
            handleStartEditing({
              ...fileData,
              type: 'file'
            });
          }, 100); // Small delay to ensure the file is in the DOM
        } else {
          console.error('onCreateFile is not a function:', onCreateFile);
        }
      })
      .catch(error => {
        console.error('Failed to create file:', error);
        alert(`Error creating file: ${error.message}`);
      });
  };

  const handleNewFolder = (parentFolder) => {
    // Instead of using prompt, open the dialog and set the parent folder
    setNewFolderParent(parentFolder);
    setNewFolderDialogOpen(true);
  };

  // New function to handle folder creation from the dialog
  const createNewFolder = (folderName) => {
    if (!folderName) return;
    
    let newFolderPath;
    const parentFolder = newFolderParent;
    
    if (parentFolder && parentFolder.path) {
      // If we have a parent folder, join the path
      newFolderPath = path.join(parentFolder.path, folderName);
      console.log('Creating folder with parent:', {
        parentName: parentFolder.name,
        parentPath: parentFolder.path,
        newName: folderName,
        newPath: newFolderPath
      });
    } else {
      // For root folders, ensure we're using a proper path
      if (currentFolders && currentFolders.length > 0) {
        newFolderPath = path.join(currentFolders[0], folderName);
        console.log('Creating root folder in:', {
          rootFolder: currentFolders[0],
          newName: folderName,
          newPath: newFolderPath
        });
      } else {
        // Last resort fallback
        console.warn('Adding folder without proper context, folder display may be incorrect');
        newFolderPath = folderName;
        console.log('Creating standalone folder:', {
          newName: folderName,
          newPath: newFolderPath
        });
      }
    }
    
    // Create the new folder object
    // Always use only the basename part for display name
    const newFolder = {
      name: path.basename(folderName), // Explicitly use basename of the provided name
      path: newFolderPath,             // Full path for operations
      type: 'folder',
      isRoot: !parentFolder            // Root if no parent
    };
    
    console.log('New folder object created:', newFolder);
    
    // Add the folder to state
    if (typeof onCreateFolder === 'function') {
      console.log('Calling onCreateFolder with:', newFolder);
      onCreateFolder(newFolder);
    } else {
      console.warn('onCreateFolder is not available to add a new folder');
    }
  };

  // Create new function to handle rename from dialog
  const renameItem = (filePath, newName) => {
    if (onRenameFile && newName) {
      // Calculate the full new path to maintain folder structure
      const dirPath = path.dirname(filePath);
      const newPath = path.join(dirPath, newName);
      
      // Call the rename handler with the old path and new name
      // This ensures proper path calculation in the parent component
      onRenameFile(filePath, newName);
    }
  };

  // Context menu items for files
  const getFileMenuItems = (file) => [
    { 
      label: 'Open', 
      onClick: () => onFileSelect(file),
    },
    { 
      label: 'Rename', 
      icon: <IconEdit size={16} />, 
      onClick: handleRename
    },
    { 
      label: 'Copy Path', 
      icon: <IconCopy size={16} />, 
      onClick: handleCopy
    },
    { divider: true },
    { 
      label: 'Delete', 
      icon: <IconTrash size={16} />, 
      onClick: handleDelete,
      danger: true
    },
  ];

  // Context menu items for folders
  const getFolderMenuItems = (folder) => [
    { 
      label: expandedFolders[folder.path] ? 'Collapse' : 'Expand', 
      onClick: () => toggleFolder(folder.path)
    },
    {
      label: 'Open in File Explorer',
      onClick: () => window.api.openInExplorer(folder.path)
    },
    { divider: true },
    { 
      label: 'New File', 
      icon: <IconFilePlus size={16} />, 
      onClick: () => handleNewFile(folder)
    },
    { 
      label: 'New Folder', 
      icon: <IconFolderPlus size={16} />, 
      onClick: () => handleNewFolder(folder)
    },
    { divider: true },
    { 
      label: 'Rename', 
      icon: <IconEdit size={16} />, 
      onClick: handleRename
    },
    { 
      label: 'Copy Path', 
      icon: <IconCopy size={16} />, 
      onClick: handleCopy
    },
    { divider: true },
    { 
      label: 'Delete', 
      icon: <IconTrash size={16} />, 
      onClick: handleDelete,
      danger: true
    },
  ];

  // Root level menu items (displayed when right-clicking on empty space)
  const rootMenuItems = [
    { 
      label: 'New File', 
      icon: <IconFilePlus size={16} />, 
      onClick: () => handleNewFile(null)
    },
    { 
      label: 'New Folder', 
      icon: <IconFolderPlus size={16} />, 
      onClick: () => handleNewFolder(null)
    },
  ];

  // Instructions for keyboard navigation
  const keyboardInstructions = [
    { key: '↑/↓', description: 'Navigate between items' },
    { key: '←/→', description: 'Collapse/expand folders' },
    { key: 'Enter', description: 'Open file or toggle folder' },
    { key: 'Space', description: 'Select file' },
    { key: 'Menu/Ctrl+F10', description: 'Open context menu' },
    { key: 'Home/End', description: 'Jump to first/last item' },
    { key: 'Ctrl+C', description: 'Copy path to clipboard' },
  ];

  // Drag and drop handlers
  const handleDragStart = (e, item) => {
    e.dataTransfer.setData('application/json', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'move';
    
    // Add a drag image
    const dragIcon = document.createElement('div');
    dragIcon.className = "file-drag-icon";
    dragIcon.textContent = item.name;
    dragIcon.style.position = 'absolute';
    dragIcon.style.top = '-1000px';
    document.body.appendChild(dragIcon);
    e.dataTransfer.setDragImage(dragIcon, 0, 0);
    
    // Remove the drag icon after a delay
    setTimeout(() => {
      document.body.removeChild(dragIcon);
    }, 0);
    
    setDraggingItem(item);
  };

  const handleDragOver = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggingItem || !item) return;
    
    // Only change cursor if this is a valid drop target
    if (isValidDrop(draggingItem, item)) {
      e.dataTransfer.dropEffect = 'move';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
    
    setDragOverItem(item);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverItem(null);
  };

  const handleDrop = async (e, targetItem) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragOverItem(null);
    
    if (!draggingItem) {
      // Try to get the drag data from the event
      try {
        const jsonData = e.dataTransfer.getData('application/json');
        if (jsonData) {
          const sourceItem = JSON.parse(jsonData);
          processDrop(sourceItem, targetItem);
        }
      } catch (err) {
        console.error('Failed to parse drag data:', err);
      }
    } else {
      processDrop(draggingItem, targetItem);
    }
    
    setDraggingItem(null);
  };

  // Add a new function to process the drop
  const processDrop = (sourceItem, targetItem) => {
    if (!sourceItem || !targetItem) return;
    
    // Check if this is a valid drop
    if (!isValidDrop(sourceItem, targetItem)) {
      console.error(`Cannot move ${sourceItem.type} to this location`);
      return;
    }
    
    // Call the onMoveFile callback
    if (onMoveFile) {
      onMoveFile(sourceItem, targetItem);
    }
  };

  // Function to expand parent folders of a given path
  const expandParentFolders = (filePath) => {
    if (!filePath) return;
    
    const normalizedPath = filePath.replace(/\\/g, '/');
    const dirPath = path.dirname(normalizedPath);
    
    // Don't expand if it's the root
    if (dirPath === '.' || dirPath === '/') return;
    
    // Create a new expandedFolders object to avoid mutation during the loop
    const newExpandedFolders = { ...expandedFolders };
    
    // Build a list of all parent directories that need to be expanded
    const parentsToExpand = [];
    let currentDir = dirPath;
    
    // First, check if any root folder contains this file
    const isInRootFolder = rootFolders.some(rootFolder => {
      const normalizedRootPath = rootFolder.path.replace(/\\/g, '/');
      if (normalizedPath.startsWith(normalizedRootPath)) {
        // Add root folder to the expand list
        parentsToExpand.push(normalizedRootPath);
        return true;
      }
      return false;
    });
    
    // Then collect all parent folders
    while (currentDir && currentDir !== '.' && currentDir !== '/') {
      // Check if this folder exists in our folders list
      const folderExists = folders.some(folder => {
        const normalizedFolderPath = folder.path.replace(/\\/g, '/');
        return normalizedFolderPath === currentDir;
      });
      
      if (folderExists) {
        parentsToExpand.push(currentDir);
      }
      
      // Move up to parent directory
      currentDir = path.dirname(currentDir);
    }
    
    // Set all parent folders to expanded state
    parentsToExpand.forEach(parentPath => {
      newExpandedFolders[parentPath] = true;
    });
    
    setExpandedFolders(newExpandedFolders);
  };

  // When currentFilePath changes, ensure parent folders are expanded
  useEffect(() => {
    if (currentFilePath) {
      expandParentFolders(currentFilePath);
    }
  }, [currentFilePath, folders]);

  // Process files directly before rendering to ensure clean names
  const cleanItemForDisplay = (item) => {
    if (!item) return item;
    
    return {
      ...item,
      displayName: path.basename(item.path || '')
    };
  };

  // New function to handle starting inline editing
  const handleStartEditing = (item) => {
    if (!item) return;
    
    // Don't allow editing the root folder
    if (item.isRoot) return;
    
    setEditingItem(item);
    setEditValue(getDisplayName(item));
  };
  
  // Function to finish editing and save changes
  const handleFinishEditing = () => {
    if (!editingItem || !editValue.trim()) {
      setEditingItem(null);
      return;
    }
    
    // Check for invalid characters
    if (/[<>:"/\\|?*]/.test(editValue)) {
      alert('Name contains invalid characters');
      return;
    }
    
    // Make sure the extension is preserved for files
    let newName = editValue;
    if (editingItem.type === 'file') {
      const oldName = getDisplayName(editingItem);
      const oldExtIndex = oldName.lastIndexOf('.');
      if (oldExtIndex > 0) {
        const oldExt = oldName.substring(oldExtIndex);
        // If the new name doesn't already have this extension, add it
        if (!newName.endsWith(oldExt)) {
          newName = newName + oldExt;
        }
      }
    }
    
    // Check if the name has actually changed
    if (newName === getDisplayName(editingItem)) {
      // No change, just exit edit mode
      setEditingItem(null);
      setEditValue('');
      return;
    }
    
    const isFolder = editingItem.type === 'folder';
    
    // Calculate new path while maintaining folder structure
    const dirPath = path.dirname(editingItem.path);
    const newPath = path.join(dirPath, newName);
    
    // Check if a file with this name already exists in the same directory
    const fileExists = files.some(f => 
      path.dirname(f.path) === dirPath && 
      path.basename(f.path) === newName
    ) || folders.some(f => 
      path.dirname(f.path) === dirPath && 
      path.basename(f.path) === newName
    );
    
    if (fileExists) {
      alert(`A ${isFolder ? 'folder' : 'file'} with this name already exists in this location`);
      setEditingItem(null);
      setEditValue('');
      return;
    }
    
    // Call the rename handler with the new name - the UI will be updated through
    // the standard data flow from the parent component
    renameItem(editingItem.path, newName);
    
    // Reset the editing state - don't wait for the operation to complete
    // as the state refresh will happen anyway
    setEditingItem(null);
    setEditValue('');
  };
  
  // Function to cancel editing without saving
  const handleCancelEditing = () => {
    setEditingItem(null);
    setEditValue('');
  };

  // Add a click handler to the document to close the inline editor when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (editingItem && fileExplorerRef.current && !fileExplorerRef.current.contains(event.target)) {
        handleCancelEditing();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingItem]);

  return (
    <div 
      ref={fileExplorerRef}
      className="file-explorer overflow-auto h-full flex flex-col"
      onContextMenu={(e) => {
        // Only show root context menu if clicking on the empty area
        if (e.target === e.currentTarget) {
          handleContextMenu(e, null);
        }
      }}
      role="tree"
      aria-label="File Explorer"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // Handle drop on the root explorer
      }}
    >
      {/* Sort controls */}
      <div className="file-explorer-toolbar bg-surface-200 dark:bg-surface-700 p-2 border-b border-surface-300 dark:border-surface-600 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-1">
          <span className="text-xs text-surface-600 dark:text-surface-400 mr-1">Sort by:</span>
          <button 
            className={`p-1 rounded text-xs flex items-center ${sortBy === 'name' ? 'bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-400' : 'hover:bg-surface-300 dark:hover:bg-surface-600'}`}
            onClick={() => changeSortBy('name')}
            title="Sort by name"
          >
            <IconAbc size={14} className="mr-1" />
            <span>Name</span>
          </button>
          <button 
            className={`p-1 rounded text-xs flex items-center ${sortBy === 'type' ? 'bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-400' : 'hover:bg-surface-300 dark:hover:bg-surface-600'}`}
            onClick={() => changeSortBy('type')}
            title="Sort by type"
          >
            <IconFileTypography size={14} className="mr-1" />
            <span>Type</span>
          </button>
          <button 
            className={`p-1 rounded text-xs flex items-center ${sortBy === 'date' ? 'bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-400' : 'hover:bg-surface-300 dark:hover:bg-surface-600'}`}
            onClick={() => changeSortBy('date')}
            title="Sort by date"
          >
            <IconCalendar size={14} className="mr-1" />
            <span>Date</span>
          </button>
        </div>
        <div className="flex items-center space-x-1">
          <button
            className="p-1 rounded hover:bg-surface-300 dark:hover:bg-surface-600"
            onClick={toggleSortDirection}
            title={`${sortDirection === 'asc' ? 'Sort ascending' : 'Sort descending'} (${formatShortcut(KEYBOARD_SHORTCUTS.TOGGLE_SORT_DIRECTION)})`}
          >
            {sortDirection === 'asc' ? 
              <IconSortAscending size={16} /> : 
              <IconSortDescending size={16} />
            }
          </button>
        </div>
      </div>
      
      {/* Keyboard navigation instructions - visually hidden but accessible to screen readers */}
      <div className="sr-only">
        <h3>Keyboard Navigation:</h3>
        <ul>
          {keyboardInstructions.map((instruction, i) => (
            <li key={i}>{instruction.key}: {instruction.description}</li>
          ))}
        </ul>
      </div>
      
      {/* File and folder listing */}
      <div className="file-explorer-content p-1 w-full flex-grow overflow-auto" style={{ position: 'relative' }}>
        {topLevelFolders.length === 0 && topLevelFiles.length === 0 && (!currentFolders || currentFolders.length === 0) ? (
          <div className="p-4 text-surface-500 dark:text-surface-400 text-sm text-center h-full flex items-center justify-center">
            No files or folders to display
          </div>
        ) : (
          <>
            {flattenedItems.map((item, index) => {
              // Override the display name to ensure it's always just the basename
              const displayName = getDisplayName(item);
              
              // Create a new clean item with explicit display name
              const cleanedItem = {
                ...item,
                name: displayName,
                displayName: displayName
              };
              
              // Assign ref to item for keyboard navigation
              const refKey = `${item.type}-${item.path}`;
              const isLastChild = index === flattenedItems.length - 1 || 
                                  (flattenedItems[index + 1] && 
                                   (flattenedItems[index + 1].level <= item.level));
              
              // Check if this item is being edited
              const isEditing = editingItem && editingItem.path === item.path;
              
              return (
                <div 
                  key={item.path}
                  ref={el => itemRefs.current[`${item.type}-${item.path}`] = el}
                  tabIndex={0}
                  onFocus={() => handleFocus(item)}
                  draggable={!isEditing}
                  onDragStart={e => !isEditing && handleDragStart(e, item)}
                  onDragOver={e => handleDragOver(e, item)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, item)}
                  className={`${dragOverItem && dragOverItem.path === item.path ? 'bg-primary-100 dark:bg-primary-900' : ''} ${currentFilePath === item.path ? 'file-selected bg-primary-50 dark:bg-primary-800' : ''} transition-all duration-200`}
                  style={{ position: 'relative', minHeight: '24px' }}
                >
                  {item.type === 'file' ? (
                    <MemoizedFileItem
                      file={cleanedItem}
                      currentFilePath={currentFilePath}
                      onFileSelect={onFileSelect}
                      onContextMenu={handleContextMenu}
                      depth={item.level}
                      isLastChild={isLastChild}
                      onStartEditing={handleStartEditing}
                      isEditing={isEditing}
                      onFinishEditing={handleFinishEditing}
                      onCancelEditing={handleCancelEditing}
                      editValue={editValue}
                      onEditValueChange={setEditValue}
                    />
                  ) : (
                    <MemoizedFolderItem
                      folder={cleanedItem}
                      expandedFolders={expandedFolders}
                      toggleFolder={toggleFolder}
                      depth={item.level}
                      onContextMenu={handleContextMenu}
                      isLastChild={isLastChild}
                      onStartEditing={handleStartEditing}
                      isEditing={isEditing}
                      onFinishEditing={handleFinishEditing}
                      onCancelEditing={handleCancelEditing}
                      editValue={editValue}
                      onEditValueChange={setEditValue}
                    />
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
      
      {/* Context Menu */}
      {contextMenu.show && (
        <ContextMenu
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={closeContextMenu}
          items={
            contextMenu.type === 'file' 
              ? getFileMenuItems(contextMenu.item)
              : contextMenu.type === 'folder'
                ? getFolderMenuItems(contextMenu.item)
                : rootMenuItems
          }
        />
      )}

      {/* New Folder Dialog */}
      <NewFolderDialog
        isOpen={newFolderDialogOpen}
        onClose={() => setNewFolderDialogOpen(false)}
        onCreateFolder={createNewFolder}
        parentFolder={newFolderParent}
      />

      {/* Rename Dialog */}
      <RenameDialog
        isOpen={renameDialogOpen}
        onClose={() => setRenameDialogOpen(false)}
        onRename={renameItem}
        item={itemToRename}
      />
      
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title={`Delete ${itemToDelete?.type === 'folder' ? 'Folder' : 'File'}`}
        message={`Are you sure you want to delete ${itemToDelete?.name || itemToDelete?.path}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        isDanger={true}
      />
    </div>
  );
};

export default FileExplorer;
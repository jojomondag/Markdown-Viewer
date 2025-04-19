import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { 
  IconFolder, 
  IconFile, 
  IconChevronRight, 
  IconChevronDown,
  IconTrash,
  IconCopy,
  IconEdit,
  IconDownload,
  IconFolderPlus,
  IconFilePlus,
  IconFolderOpen,
  IconArrowsMove,
  IconSortAscending,
  IconSortDescending,
  IconAbc,
  IconCalendar,
  IconFileTypography
} from '@tabler/icons-react';
import path from 'path-browserify';
import { ContextMenu } from './ui/context-menu';
import useNotification from '../hooks/useNotification';
import { announceToScreenReader } from './AccessibilityHelper';
import { isElectron } from '../utils/environment';
import { isValidDrop, createDropDestination } from '../utils/fileOperations';
import { formatShortcut, KEYBOARD_SHORTCUTS } from '../utils/keyboardShortcuts';

// Memoize FileItem to prevent unnecessary re-renders
const MemoizedFileItem = memo(({ file, currentFilePath, onFileSelect, showInfo, showError, setSelectedItem, onContextMenu }) => {
  const isActive = currentFilePath === file.path;
  
  return (
    <div 
      className={`file-item ${isActive ? 'active' : ''}`}
      onClick={() => onFileSelect(file)}
      onContextMenu={(e) => onContextMenu(e, file)}
      style={{ 
        display: 'flex', 
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%'
      }}
    >
      <div className="file-icon" style={{ marginRight: '8px', flexShrink: 0 }}>
        <IconFile />
      </div>
      <div className="file-name" title={file.name} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {file.name}
      </div>
    </div>
  );
});

// Memoize FolderItem to prevent unnecessary re-renders
const MemoizedFolderItem = memo(({ 
  folder, 
  expandedFolders,
  toggleFolder,
  depth,
  onContextMenu
}) => {
  const isExpanded = expandedFolders[folder.path] || false;
  
  return (
    <div 
      className={`folder-item ${isExpanded ? 'expanded' : ''}`}
      style={{ 
        paddingLeft: `${depth * 16}px`,
        display: 'flex', 
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%'
      }}
      onClick={(e) => {
        e.stopPropagation();
        toggleFolder(folder.path);
      }}
      onContextMenu={(e) => onContextMenu(e, folder)}
    >
      <div className="folder-icon" style={{ marginRight: '8px', flexShrink: 0 }}>
        {isExpanded ? <IconFolderOpen /> : <IconFolder />}
      </div>
      <div className="folder-name" title={folder.name} style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {folder.name}
      </div>
    </div>
  );
});

const FileExplorer = ({ 
  files, 
  folders, 
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
  const [expandedFolders, setExpandedFolders] = useState({});
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

  // Use external sort props if provided
  const [sortBy, setSortBy] = useState(externalSortBy || 'name'); 
  const [sortDirection, setSortDirection] = useState(externalSortDirection || 'asc');

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

  const { showInfo, showError, showNotification } = useNotification();
  
  // Flatten the file/folder structure for keyboard navigation
  const getFlattenedItems = () => {
    const items = [];
    const addedPaths = new Set(); // Prevent adding duplicates if structure is complex

    // Helper function to recursively add items with their levels
    const addItemsRecursive = (currentFolders, currentFiles, level = 0, parentPath = null) => {
      
      // Filter and sort folders for the current level
      const foldersForLevel = currentFolders.filter(f => {
        // Determine the expected parent path based on the current parentPath
        const folderParentPath = path.dirname(f.path);
        if (parentPath === null) {
          // Top level: Parent directory should not be within any *other* listed folder's path
           return !currentFolders.some(pf => pf.path !== f.path && folderParentPath.startsWith(pf.path));
        } else {
          // Nested level: Parent directory must match the parentPath passed in
          return folderParentPath === parentPath;
        }
      });
      sortItems(foldersForLevel, 'folder');

      foldersForLevel.forEach(folder => {
        if (addedPaths.has(folder.path)) return; // Skip if already added
        
        const isExpanded = expandedFolders[folder.path] || false;
        items.push({ ...folder, type: 'folder', level, parentPath });
        addedPaths.add(folder.path);

        // If folder is expanded, recursively add its children
        if (isExpanded) {
          // Pass the *original, complete* lists for filtering at the next level
          addItemsRecursive(folders, files, level + 1, folder.path); 
        }
      });

      // Filter and sort files for the current level
      const filesForLevel = currentFiles.filter(file => {
        const fileParentPath = path.dirname(file.path);
         if (parentPath === null) {
           // Top level: Parent directory should not be within *any* listed folder's path
           return !currentFolders.some(f => fileParentPath.startsWith(f.path));
         } else {
           // Nested level: Parent directory must match the parentPath passed in
           return fileParentPath === parentPath;
         }
      });
      sortItems(filesForLevel, 'file');

      filesForLevel.forEach(file => {
         if (addedPaths.has(file.path)) return; // Skip if already added
        items.push({ ...file, type: 'file', level, parentPath });
        addedPaths.add(file.path);
      });
    };

    // Start the recursion with the full lists at the top level (parentPath = null)
    addItemsRecursive(folders, files, 0, null);

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
    announceToScreenReader(`Sorting ${sortDirection === 'asc' ? 'descending' : 'ascending'}`);
  };
  
  // Update change sort field to use onSortChange
  const changeSortBy = (field) => {
    setSortBy(field);
    if (onSortChange) {
      onSortChange(field, sortDirection);
    }
    announceToScreenReader(`Sorting by ${field}`);
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
            announceToScreenReader(`${nextItem.type === 'folder' ? 'Folder' : 'File'}: ${nextItem.name}`);
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
            announceToScreenReader(`${prevItem.type === 'folder' ? 'Folder' : 'File'}: ${prevItem.name}`);
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
            announceToScreenReader(`Expanded folder: ${focusedItem.name}`);
          }
          break;
          
        case 'ArrowLeft':
          e.preventDefault();
          if (focusedItem && focusedItem.type === 'folder' && expandedFolders[focusedItem.path]) {
            toggleFolder(focusedItem.path);
            announceToScreenReader(`Collapsed folder: ${focusedItem.name}`);
          } else if (focusedItem && focusedItem.parentPath) {
            // Move to parent folder
            const parentFolder = folders.find(folder => folder.path === focusedItem.parentPath);
            if (parentFolder) {
              setFocusedItem({ ...parentFolder, type: 'folder' });
              if (itemRefs.current[`folder-${parentFolder.path}`]) {
                itemRefs.current[`folder-${parentFolder.path}`].focus();
              }
              announceToScreenReader(`Moved to parent folder: ${parentFolder.name}`);
            }
          }
          break;
          
        case 'Enter':
          e.preventDefault();
          if (focusedItem) {
            if (focusedItem.type === 'file') {
              onFileSelect(focusedItem);
              announceToScreenReader(`Opening file: ${focusedItem.name}`);
            } else {
              toggleFolder(focusedItem.path);
              announceToScreenReader(`${expandedFolders[focusedItem.path] ? 'Collapsed' : 'Expanded'} folder: ${focusedItem.name}`);
            }
          }
          break;
          
        case ' ': // Space bar
          e.preventDefault();
          if (focusedItem && focusedItem.type === 'file') {
            onFileSelect(focusedItem);
            announceToScreenReader(`Opening file: ${focusedItem.name}`);
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
                announceToScreenReader(`Context menu opened for ${focusedItem.type}: ${focusedItem.name}`);
              }
            }
          }
          break;
          
        case 'Escape':
          if (contextMenu.show) {
            closeContextMenu();
            announceToScreenReader('Context menu closed');
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
            announceToScreenReader(`Moved to first item: ${firstItem.name}`);
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
            announceToScreenReader(`Moved to last item: ${lastItem.name}`);
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
  }, [expandedFolders, focusedItem, flattenedItems, folders, onFileSelect, showInfo, showError]);

  const toggleFolder = (folderPath) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderPath]: !prev[folderPath]
    }));
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
    const newName = prompt('Enter new name:', target.name);
    if (newName && newName !== target.name) {
      onRenameFile(target.path, newName);
    }
  };

  const handleDelete = () => {
    const target = contextMenu.item;
    const confirmed = confirm(`Are you sure you want to delete this ${target.type}?`);
    if (confirmed) {
      onDeleteFile(target.path, target.type === 'folder');
    }
  };

  const handleCopy = () => {
    const target = contextMenu.item;
    // Copy file path to clipboard
    navigator.clipboard.writeText(target.path)
      .then(() => {
        showInfo('Path copied to clipboard');
        announceToScreenReader('Path copied to clipboard');
      })
      .catch(() => {
        showError('Failed to copy path to clipboard');
        announceToScreenReader('Failed to copy path to clipboard');
      });
  };

  const handleNewFile = (parentFolder) => {
    showInfo(`New file will be created in: ${parentFolder ? parentFolder.name : 'root'}`);
    announceToScreenReader(`New file will be created in: ${parentFolder ? parentFolder.name : 'root'}`);
    // TODO: Implement new file creation
  };

  const handleNewFolder = (parentFolder) => {
    showInfo(`New folder will be created in: ${parentFolder ? parentFolder.name : 'root'}`);
    announceToScreenReader(`New folder will be created in: ${parentFolder ? parentFolder.name : 'root'}`);
    // TODO: Implement new folder creation
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

  // Group files and folders by top-level directory
  const topLevelFolders = folders.filter(folder => 
    !folders.some(f => folder.path !== f.path && folder.path.startsWith(f.path))
  );
  const topLevelFiles = files.filter(file => 
    !folders.some(folder => file.path.startsWith(folder.path))
  );

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
    
    // Announce to screen reader
    announceToScreenReader(`Started dragging ${item.type}: ${item.name}`);
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
      showError(`Cannot move ${sourceItem.type} to this location`);
      announceToScreenReader(`Cannot move ${sourceItem.type} to this location`);
      return;
    }
    
    // Call the onMoveFile callback
    if (onMoveFile) {
      onMoveFile(sourceItem, targetItem);
      announceToScreenReader(`Moved ${sourceItem.type} ${sourceItem.name} to ${targetItem.type} ${targetItem.name}`);
    }
  };

  return (
    <div 
      ref={fileExplorerRef}
      className="file-explorer overflow-auto max-h-full relative"
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
      <div className="file-explorer-toolbar bg-surface-200 dark:bg-surface-700 p-2 border-b border-surface-300 dark:border-surface-600 flex items-center justify-between">
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
      <div className="file-explorer-content p-1">
        {topLevelFolders.length === 0 && topLevelFiles.length === 0 ? (
          <div className="p-4 text-surface-500 dark:text-surface-400 text-sm text-center">
            No files or folders to display
          </div>
        ) : (
          <>
            {flattenedItems.map(item => {
              // Assign ref to item for keyboard navigation
              const refKey = `${item.type}-${item.path}`;
              return (
                <div 
                  key={item.path}
                  ref={el => itemRefs.current[refKey] = el}
                  tabIndex={0}
                  onFocus={() => handleFocus(item)}
                  draggable
                  onDragStart={e => handleDragStart(e, item)}
                  onDragOver={e => handleDragOver(e, item)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, item)}
                  className={`${dragOverItem && dragOverItem.path === item.path ? 'bg-primary-100 dark:bg-primary-900' : ''}`}
                >
                  {item.type === 'file' ? (
                    <MemoizedFileItem
                      file={item}
                      currentFilePath={currentFilePath}
                      onFileSelect={onFileSelect}
                      showInfo={showInfo}
                      showError={showError}
                      setSelectedItem={setFocusedItem}
                      onContextMenu={handleContextMenu}
                    />
                  ) : (
                    <MemoizedFolderItem
                      folder={item}
                      expandedFolders={expandedFolders}
                      toggleFolder={toggleFolder}
                      depth={item.level}
                      onContextMenu={handleContextMenu}
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
    </div>
  );
};

export default FileExplorer; 
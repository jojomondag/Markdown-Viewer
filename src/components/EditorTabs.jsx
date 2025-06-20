import React, { useState, useEffect } from 'react';
/**
 * EDITOR TABS COMPONENT
 * 
 * This component handles the tabs in the editor area that let users switch between open files.
 * 
 * Tab interaction fixes implemented:
 * 1. Fixed an issue where tab clicks were being misinterpreted as drag operations
 * 2. Improved detection of drag vs. click by adding delay to click handling
 * 3. Enhanced pointer events to ensure clicks are properly captured
 * 4. Added proper handling for drag and drop operations to update editor content
 * 5. Used state tracking to differentiate between clicks and drags
 * 
 * To prevent simultaneous drag and click operations, we:
 * - Added a delay before processing clicks to ensure they're not the start of a drag
 * - Use a click intent state to track if a click is being processed
 * - Reset click intent when a drag operation starts
 * - Only process tab changes when we're confident it's a click operation
 */

import { IconX, IconEye, IconEyeOff, IconPlus, IconExternalLink } from '@tabler/icons-react';
import useNotification from '../hooks/useNotification';
import SortableTabs from './common/SortableTabs';
import ContextMenu from './common/ContextMenu';



const EditorTabs = ({
  currentFile,
  openFiles,
  onTabChange,
  onTabClose,
  onTabReorder,
  onToggleEditorVisibility,
  isPreviewVisible,
  isEditorFullscreen,
  onToggleFullscreen,
  FullscreenMaximizeIcon,
  FullscreenMinimizeIcon,
  onDetachEditor,
  isEditorDetached
}) => {
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, file: null });
  const { showInfo } = useNotification();

  // Handle context menu
  const handleContextMenu = (e, file) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      file
    });
  };

  // Handle tab click
  const handleTabClick = (e, file) => {
    if (onTabChange) {
      onTabChange(file);
    }
  };

  // Handle tab close
  const handleCloseClick = (e, file) => {
    e.stopPropagation(); // Should already be handled by SortableTab if it calls this, but good to be safe
    if (onTabClose) {
      onTabClose(file);
    }
  };

  // Context menu action handlers
  const handleMenuCloseOthers = () => {
    if (contextMenu.file && onTabClose) {
      openFiles
        .filter(f => f.path !== contextMenu.file.path)
        .forEach(f => onTabClose(f));
      showInfo('Closed other tabs');
    }
    // setContextMenu({ visible: false, x: 0, y: 0, file: null }); // ContextMenu's onClose will handle this
  };

  const handleMenuCloseAll = () => {
    if (onTabClose) {
      openFiles.forEach(f => onTabClose(f));
      showInfo('Closed all tabs');
    }
    // setContextMenu({ visible: false, x: 0, y: 0, file: null });
  };

  // Render tab content function
  const renderTabContent = (file, isActive, isDragging) => {
    const isDirty = file.isDirty;
    
    return (
      <div 
        className={`
          flex-shrink-0 px-2 py-1 border-b-2 text-xs whitespace-nowrap transition-colors duration-150 ease-in-out group relative flex items-center w-full h-full
          ${isActive
            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
            : 'border-transparent hover:border-surface-400 dark:hover:border-surface-500 text-surface-600 dark:text-surface-300 hover:text-surface-800 dark:hover:text-surface-100'}
        `}
        style={{ 
          paddingRight: isDirty ? '1.1rem' : '1.6rem',
          pointerEvents: 'auto' // Ensure the tab content area can receive events
        }}
        title={file.path}
      >
        {/* Tab name - allow pointer events for drag area */}
        <span className="truncate flex-grow text-left mr-1">{file.name}</span>

        {/* Dirty indicator */}
        {isDirty && (
          <span className="ml-1 w-1.5 h-1.5 rounded-full bg-warning-500 flex-shrink-0" />
        )}

        {/* Close button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleCloseClick(e, file);
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="absolute right-0.5 top-1/2 transform -translate-y-1/2 p-0.5 rounded-full text-surface-400 dark:text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700 hover:text-surface-700 dark:hover:text-surface-200 opacity-0 group-hover:opacity-100 flex-shrink-0 focus:outline-none pointer-events-auto z-10"
          title={`Close tab: ${file.name}`}
        >
          <IconX size={12} />
        </button>
      </div>
    );
  };  // Preview toggle button
  const previewToggleButton = typeof onToggleEditorVisibility === 'function' && (
    <button
      title={isPreviewVisible ? "Hide Preview" : "Show Preview"}
      onClick={onToggleEditorVisibility}
      className="p-1.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300 flex-shrink-0 mr-1.5"
      aria-label={isPreviewVisible ? "Hide Preview" : "Show Preview"}
    >
      {isPreviewVisible ? <IconEyeOff size={16} /> : <IconEye size={16} />}
    </button>
  );

  // Fullscreen toggle button
  const fullscreenToggleButton = FullscreenMaximizeIcon && FullscreenMinimizeIcon && typeof onToggleFullscreen === 'function' && (
    <button
      title={isEditorFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
      onClick={onToggleFullscreen}
      className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300 flex-shrink-0 ml-2 mr-1"
      aria-label={isEditorFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
    >
      {isEditorFullscreen ? <FullscreenMinimizeIcon size={16} /> : <FullscreenMaximizeIcon size={16} />}
    </button>
  );
  
  // Detach editor button
  const detachButton = typeof onDetachEditor === 'function' && !window.detachedAPI?.isDetachedWindow() && (
    <button
      className={`p-1.5 rounded flex-shrink-0 ${
        isEditorDetached
          ? 'text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-900'
          : 'text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600'
      }`}
      onClick={onDetachEditor}
      title={isEditorDetached ? "Editor Detached" : "Detach Editor"}
      disabled={!currentFile}
    >
      <IconExternalLink size={16} />
    </button>
  );

  const editorContextMenuItems = contextMenu.file ? [
    { label: 'Close Others', onClick: handleMenuCloseOthers, disabled: openFiles.length <= 1 },
    { label: 'Close All', onClick: handleMenuCloseAll, disabled: openFiles.length === 0 },  ] : [];
  return (
    <>      <div className="editor-tabs-bar-wrapper flex items-center justify-between p-2 w-full bg-surface-100 dark:bg-surface-800 border-b border-surface-300 dark:border-surface-700 relative z-10 shadow-sm pointer-events-auto">
        <div className="flex flex-grow items-center min-w-0 overflow-hidden">
          {fullscreenToggleButton}
          
          <SortableTabs
            items={openFiles}
            getItemId={(file) => file.path}
            onItemClick={handleTabClick}
            onItemContextMenu={handleContextMenu}
            onReorder={onTabReorder}
            renderItem={renderTabContent}
            activeItemId={currentFile?.path}
            className="editor-tabs min-w-0 flex-1 flex items-center gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-surface-400 dark:scrollbar-thumb-surface-600"
            dragConstraints={{ delay: 100, distance: 8, tolerance: 10 }}        
          />        </div>
        {/* Action buttons fixed at right edge */}
        <div className="flex-shrink-0 flex items-center px-2">
          {previewToggleButton}
          {detachButton}
        </div>
      </div>

      <ContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        items={editorContextMenuItems}
        onClose={() => setContextMenu({ visible: false, x: 0, y: 0, file: null })}
        transform="translate(0,0)"
      />
    </>
  );
};

export default EditorTabs;
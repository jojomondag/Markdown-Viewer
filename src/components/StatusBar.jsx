import React, { useMemo } from 'react';
import { IconFile, IconClock, IconAlignJustified, IconLetterCase, IconAlertCircle, IconCornerDownRight } from '@tabler/icons-react';
import { useAppState } from '../context/AppStateContext';

const StatusBar = ({ currentFile, content, isMobile = false, unsavedChanges = false }) => {
  const { state } = useAppState();
  const { cursorPosition } = state.editor;
  
  // Calculate document statistics
  const stats = useMemo(() => {
    if (!content) {
      return { wordCount: 0, charCount: 0, lineCount: 0 };
    }

    // Count words
    const words = content.match(/\S+/g) || [];
    const wordCount = words.length;

    // Count characters
    const charCount = content.length;

    // Count lines
    const lineCount = (content.match(/\n/g) || []).length + 1;

    return { wordCount, charCount, lineCount };
  }, [content]);

  // Format the last modified date
  const formattedDate = useMemo(() => {
    if (!currentFile) return '';
    
    // In a real app, we would get this from the file metadata
    // For now, we'll just show the current date
    const now = new Date();
    return now.toLocaleString();
  }, [currentFile]);

  // Mobile version of the status bar
  if (isMobile) {
    return (
      <div className="status-bar flex items-center justify-between px-2 py-1 text-xs border-t border-surface-300 dark:border-surface-700 bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400">
        <div className="file-info flex items-center overflow-hidden">
          {currentFile ? (
            <>
              <IconFile size={12} className="flex-shrink-0 mr-1" />
              <span className="truncate max-w-[120px]">{currentFile.name}</span>
              {unsavedChanges && (
                <IconAlertCircle size={12} className="ml-1 text-warning-500" aria-label="Unsaved changes" />
              )}
            </>
          ) : (
            <span>No file</span>
          )}
        </div>
        <div className="document-stats flex space-x-2">
          <div className="flex items-center">
            <IconLetterCase size={12} className="mr-1" />
            <span>{stats.wordCount}</span>
          </div>
          <div className="flex items-center">
            <IconAlignJustified size={12} className="mr-1" />
            <span>{stats.lineCount}</span>
          </div>
          {cursorPosition && (
            <div className="flex items-center">
              <IconCornerDownRight size={12} className="mr-1" />
              <span>{cursorPosition.line}:{cursorPosition.column || cursorPosition.ch}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop version of the status bar
  return (
    <div className="status-bar flex items-center justify-between px-4 py-1 text-xs border-t border-surface-300 dark:border-surface-700 bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400">
      <div className="file-info flex items-center">
        {currentFile ? (
          <>
            <IconFile size={14} className="mr-1" />
            <span className="mr-4">{currentFile.path}</span>
            <IconClock size={14} className="mr-1" />
            <span>Last modified: {formattedDate}</span>
            {unsavedChanges && (
              <span className="ml-2 flex items-center text-warning-500">
                <IconAlertCircle size={14} className="mr-1" />
                Unsaved changes
              </span>
            )}
          </>
        ) : (
          <span>No file selected</span>
        )}
      </div>
      <div className="document-stats flex space-x-4">
        <span>{stats.wordCount} words</span>
        <span>{stats.charCount} characters</span>
        <span>{stats.lineCount} lines</span>
        {cursorPosition && (
          <span className="flex items-center">
            <IconCornerDownRight size={14} className="mr-1" />
            Ln {cursorPosition.line}, Col {cursorPosition.column || cursorPosition.ch}
          </span>
        )}
      </div>
    </div>
  );
};

export default StatusBar; 
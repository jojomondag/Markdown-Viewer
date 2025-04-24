import React from 'react';
import { IconClock, IconX, IconFile, IconFileText, IconChevronUp, IconChevronDown } from '@tabler/icons-react';
import { useAppState } from '../context/AppStateContext';

const FileHistory = ({ onFileSelect }) => {
  const { state, clearHistory, updatePreferences } = useAppState();
  const { fileHistory } = state;
  const isCollapsed = state.ui.preferences.recentFilesCollapsed || false;

  if (!fileHistory || fileHistory.length === 0) {
    return (
      <div className="p-4 text-surface-500 dark:text-surface-400 text-sm italic">
        No recent files
      </div>
    );
  }

  // Helper to determine file icon based on file type
  const getFileIcon = (file) => {
    // Safely check if file.name exists and has endsWith method
    if (file.type === 'markdown' || (file.name && typeof file.name === 'string' && file.name.endsWith('.md'))) {
      return <IconFileText size={16} className="text-primary-500" />;
    }
    return <IconFile size={16} className="text-surface-500" />;
  };

  const toggleCollapsed = () => {
    updatePreferences({ recentFilesCollapsed: !isCollapsed });
  };

  return (
    <div className="file-history">
      <div className="flex items-center justify-between p-2 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center text-sm font-medium">
          <IconClock size={16} className="mr-2" />
          Recent Files
        </div>
        <div className="flex items-center">
          <button
            onClick={toggleCollapsed}
            className="p-1 mr-1 text-xs rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500"
            aria-label={isCollapsed ? "Expand" : "Collapse"}
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? <IconChevronDown size={14} /> : <IconChevronUp size={14} />}
          </button>
          <button
            onClick={clearHistory}
            className="p-1 text-xs rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-500"
            aria-label="Clear history"
            title="Clear history"
          >
            <IconX size={14} />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <ul className="mt-1 max-h-60 overflow-y-auto">
          {fileHistory.map((file) => (
            <li key={file.path}>
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-surface-100 dark:hover:bg-surface-700 flex items-center"
                onClick={() => onFileSelect(file)}
                title={file.path}
              >
                <span className="mr-2 flex-shrink-0">{getFileIcon(file)}</span>
                <span className="truncate">{file.name || file.path}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FileHistory; 
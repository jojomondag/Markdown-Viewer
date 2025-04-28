import React from 'react';
import { IconX } from '@tabler/icons-react';

const WorkspaceStateTabs = ({ savedWorkspaceStates, onLoadState, onRemoveState }) => {
  const states = Object.values(savedWorkspaceStates);

  if (states.length === 0) {
    return (
      <div className="min-w-0 flex-1 flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-surface-400 dark:scrollbar-thumb-surface-600 pr-2 min-h-[38px]">
        <span className="text-xs text-surface-500 dark:text-surface-400 italic px-2">No saved states</span>
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1 flex items-center gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-surface-400 dark:scrollbar-thumb-surface-600 pr-2 min-h-[38px]">
      {/* Add a 'Home' or 'Default' tab if needed in the future */}
      {/* <button className="flex-shrink-0 px-3 py-1.5 border-b-2 border-primary-500 text-primary-600 dark:text-primary-400 text-sm whitespace-nowrap">
        Home
      </button> */}
      {states.map((stateData) => (
        <button
          key={stateData.name}
          onClick={() => onLoadState(stateData)}
          className="flex-shrink-0 px-3 py-1.5 border-b-2 border-transparent hover:border-surface-400 dark:hover:border-surface-500 text-surface-600 dark:text-surface-300 hover:text-surface-800 dark:hover:text-surface-100 text-sm whitespace-nowrap transition-colors duration-150 ease-in-out group relative pr-7"
          title={`Load state: ${stateData.name}`}
        >
          {stateData.name}
          <button 
            onClick={(e) => { 
              e.stopPropagation();
              onRemoveState(stateData.name); 
            }}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 p-0.5 rounded-full text-surface-400 dark:text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700 hover:text-surface-700 dark:hover:text-surface-200 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out"
            title={`Remove state: ${stateData.name}`}
          >
            <IconX size={12} />
          </button>
        </button>
      ))}
    </div>
  );
};

export default WorkspaceStateTabs; 
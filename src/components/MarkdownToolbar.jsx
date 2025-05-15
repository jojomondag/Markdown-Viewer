import React, { useState } from 'react';
import { 
  IconBold, 
  IconItalic, 
  IconList, 
  IconListNumbers, 
  IconLink, 
  IconCode, 
  IconBlockquote,
  IconTable,
  IconHeading,
  IconPhoto,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconSearch
} from '@tabler/icons-react';
import { getShortcutTooltip } from '../utils/keyboardShortcuts';
import SearchReplaceDialog from './SearchReplaceDialog';

const MarkdownToolbar = ({ 
  onAction,
  onUndo, 
  onRedo, 
  onSearch, 
  onReplace, 
  onReplaceAll 
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const tools = [
    { 
      id: 'heading', 
      icon: IconHeading, 
      title: 'Add Heading',
      shortcutKey: 'HEADING',
      action: () => onAction('heading')
    },
    { 
      id: 'bold', 
      icon: IconBold, 
      title: 'Bold',
      shortcutKey: 'BOLD',
      action: () => onAction('bold')
    },
    { 
      id: 'italic', 
      icon: IconItalic, 
      title: 'Italic',
      shortcutKey: 'ITALIC',
      action: () => onAction('italic')
    },
    { 
      id: 'list', 
      icon: IconList, 
      title: 'Bulleted List',
      shortcutKey: 'LIST',
      action: () => onAction('unordered-list')
    },
    { 
      id: 'ordered-list', 
      icon: IconListNumbers, 
      title: 'Ordered List',
      shortcutKey: 'ORDERED_LIST',
      action: () => onAction('ordered-list')
    },
    { 
      id: 'link', 
      icon: IconLink, 
      title: 'Add Link',
      shortcutKey: 'LINK',
      action: () => onAction('link')
    },
    { 
      id: 'image', 
      icon: IconPhoto, 
      title: 'Add Image',
      action: () => onAction('image')
    },
    { 
      id: 'code', 
      icon: IconCode, 
      title: 'Code Block',
      shortcutKey: 'CODE',
      action: () => onAction('code')
    },
    { 
      id: 'blockquote', 
      icon: IconBlockquote, 
      title: 'Blockquote',
      action: () => onAction('blockquote')
    },
    { 
      id: 'table', 
      icon: IconTable, 
      title: 'Add Table',
      action: () => onAction('table')
    }
  ];

  return (
    <div className="markdown-toolbar flex justify-between items-center w-full p-1 border-b border-surface-300 dark:border-surface-700 bg-surface-100 dark:bg-surface-800 relative z-5">
      {/* Group for undo/redo and formatting tools - ADD flex-grow HERE */}
      <div className="flex flex-grow items-center space-x-1">
        <button
          title={`Undo ${getShortcutTooltip('UNDO')}`}
          onClick={onUndo}
          className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300"
        >
          <IconArrowBackUp size={18} />
        </button>

        <button
          title={`Redo ${getShortcutTooltip('REDO')}`}
          onClick={onRedo}
          className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300"
        >
          <IconArrowForwardUp size={18} />
        </button>
        
        <div className="h-4 w-px bg-surface-300 dark:bg-surface-700 mx-1"></div>

        {tools.map((tool) => (
          <button
            key={tool.id}
            title={`${tool.title} ${tool.shortcutKey ? getShortcutTooltip(tool.shortcutKey) : ''}`}
            onClick={tool.action}
            className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300"
          >
            <tool.icon size={18} />
          </button>
        ))}
      </div>

      {/* Group for search related tools - this will be pushed to the right by justify-between */}
      <div className="flex items-center space-x-1">
        <div className="h-4 w-px bg-surface-300 dark:bg-surface-700 mx-1"></div>
        
        {/* Search button */}
        <button
          title="Search in Text (Ctrl+F)"
          onClick={() => setIsSearchOpen(true)}
          className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300"
        >
          <IconSearch size={18} />
        </button>
      </div>
      
      {/* Search dialog */}
      {isSearchOpen && (
        <SearchReplaceDialog
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          onSearch={onSearch}
          onReplace={onReplace}
          onReplaceAll={onReplaceAll}
        />
      )}
    </div>
  );
};

export default MarkdownToolbar; 
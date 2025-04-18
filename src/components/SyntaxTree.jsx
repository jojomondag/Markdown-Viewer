import React, { useMemo, useState } from 'react';
import { IconHash, IconChevronRight, IconBookmarks } from '@tabler/icons-react';
import SyntaxTreePresets from './SyntaxTreePresets';

const SyntaxTree = ({ content, onHeadingClick }) => {
  const [activeTab, setActiveTab] = useState('tree');

  // Parse headings from markdown content
  const headings = useMemo(() => {
    if (!content) return [];
    
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const matches = [...content.matchAll(headingRegex)];
    
    return matches.map((match, index) => {
      const level = match[1].length;
      const text = match[2].trim();
      const position = match.index;
      
      return { level, text, position, id: `heading-${index}` };
    });
  }, [content]);

  // Get the indentation for each heading level
  const getIndentation = (level) => {
    return (level - 1) * 16; // 16px per level
  };

  // Get the appropriate heading size based on level
  const getHeadingSize = (level) => {
    switch (level) {
      case 1: return 'text-md font-bold';
      case 2: return 'text-sm font-semibold';
      default: return 'text-xs';
    }
  };

  const handleHeadingClick = (position) => {
    if (onHeadingClick) {
      onHeadingClick(position);
    }
  };
  
  // Handle preset selection
  const handlePresetSelect = (preset) => {
    // Here we would apply the preset to the document or navigate to headings
    if (onHeadingClick && preset.headings && preset.headings.length > 0) {
      // For now, let's just navigate to the first heading in the preset
      onHeadingClick(preset.headings[0].position);
    }
  };

  return (
    <div className="syntax-tree h-full flex flex-col">
      {/* Tab navigation */}
      <div className="flex border-b border-surface-300 dark:border-surface-700">
        <button
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'tree'
              ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
              : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
          }`}
          onClick={() => setActiveTab('tree')}
        >
          Document Tree
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === 'presets'
              ? 'border-b-2 border-primary-500 text-primary-600 dark:text-primary-400'
              : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
          }`}
          onClick={() => setActiveTab('presets')}
        >
          Presets
        </button>
      </div>
      
      {/* Tab content */}
      <div className="overflow-auto flex-grow p-3">
        {activeTab === 'tree' ? (
          headings.length === 0 ? (
            <div className="text-sm text-surface-600 dark:text-surface-400 italic">
              No headings found in the document
            </div>
          ) : (
            <ul className="space-y-1">
              {headings.map((heading) => (
                <li 
                  key={heading.id}
                  className="flex items-center py-1 px-2 hover:bg-surface-200 dark:hover:bg-surface-700 cursor-pointer rounded"
                  style={{ paddingLeft: `${getIndentation(heading.level) + 8}px` }}
                  onClick={() => handleHeadingClick(heading.position)}
                >
                  <IconHash size={16} className="mr-2 text-primary-500 dark:text-primary-400" />
                  <span className={getHeadingSize(heading.level)}>
                    {heading.text}
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : (
          <SyntaxTreePresets content={content} onPresetSelect={handlePresetSelect} />
        )}
      </div>
    </div>
  );
};

export default SyntaxTree; 
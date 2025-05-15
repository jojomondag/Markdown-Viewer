import React, { useState, useEffect, useRef } from 'react';
import { IconSearch, IconArrowRight, IconX, IconArrowUp, IconArrowDown, IconReplace } from '@tabler/icons-react';

const SearchReplaceDialog = ({ isOpen, onClose, onSearch, onReplace, onReplaceAll }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const searchInputRef = useRef(null);
  
  // Focus the search input when the dialog opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);
  
  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (isOpen) {
        if (event.key === 'Escape') {
          onClose();
        } else if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          handleSearch('next');
        } else if (event.key === 'Enter' && event.shiftKey) {
          event.preventDefault();
          handleSearch('prev');
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, searchTerm, matchCase, useRegex, onClose]);
  
  const handleSearch = (direction) => {
    if (searchTerm.trim() === '') return;
    
    onSearch(searchTerm, {
      direction,
      matchCase,
      useRegex
    });
  };
  
  const handleReplace = () => {
    if (searchTerm.trim() === '') return;
    
    onReplace(searchTerm, replaceTerm, {
      matchCase,
      useRegex
    });
  };
  
  const handleReplaceAll = () => {
    if (searchTerm.trim() === '') return;
    
    onReplaceAll(searchTerm, replaceTerm, {
      matchCase,
      useRegex
    });
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="search-replace-dialog absolute top-full mt-1 right-4 bg-white dark:bg-surface-800 shadow-lg rounded-lg border border-surface-300 dark:border-surface-600 w-80 z-50">
      <div className="flex justify-between items-center p-2 border-b border-surface-300 dark:border-surface-700">
        <h3 className="text-sm font-medium">Search & Replace</h3>
        <button 
          onClick={onClose}
          className="p-1 rounded-full hover:bg-surface-200 dark:hover:bg-surface-700"
        >
          <IconX size={16} />
        </button>
      </div>
      
      <div className="p-2 space-y-2">
        {/* Search input */}
        <div className="flex items-center space-x-1">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-2 flex items-center">
              <IconSearch size={16} className="text-surface-500" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full pl-8 py-1 pr-2 text-sm border border-surface-300 dark:border-surface-600 rounded dark:bg-surface-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <button 
            onClick={() => handleSearch('prev')}
            className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700"
            title="Previous match (Shift+Enter)"
          >
            <IconArrowUp size={16} />
          </button>
          <button 
            onClick={() => handleSearch('next')}
            className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700"
            title="Next match (Enter)"
          >
            <IconArrowDown size={16} />
          </button>
        </div>
        
        {/* Replace input */}
        <div className="flex items-center space-x-1">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-2 flex items-center">
              <IconArrowRight size={16} className="text-surface-500" />
            </div>
            <input
              type="text"
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              placeholder="Replace..."
              className="w-full pl-8 py-1 pr-2 text-sm border border-surface-300 dark:border-surface-600 rounded dark:bg-surface-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <button 
            onClick={handleReplace}
            className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700"
            title="Replace current match"
          >
            <IconReplace size={16} />
          </button>
        </div>
        
        {/* Options */}
        <div className="flex items-center space-x-4 text-sm">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={matchCase}
              onChange={(e) => setMatchCase(e.target.checked)}
              className="mr-1"
            />
            Match case
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={useRegex}
              onChange={(e) => setUseRegex(e.target.checked)}
              className="mr-1"
            />
            Use regex
          </label>
        </div>
        
        {/* Actions */}
        <div className="flex justify-end space-x-2 pt-1">
          <button 
            onClick={handleReplaceAll}
            className="px-2 py-1 text-xs bg-primary-600 hover:bg-primary-700 text-white rounded"
          >
            Replace All
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchReplaceDialog; 
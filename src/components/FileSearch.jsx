import React, { useState, useEffect, useRef } from 'react';
import { IconSearch, IconX, IconFilter, IconFileText, IconFolder, IconLoader2 } from '@tabler/icons-react';
import useNotification from '../hooks/useNotification';
import { getDirname } from '../utils/pathUtils';

const FileSearch = ({ files, folders, onFileSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    includeFiles: true,
    includeFolders: true,
    searchContent: false
  });
  const searchInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const { showError } = useNotification();

  // Focus search input on mount
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Handle search term changes with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsLoading(true);
    
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(searchTerm, filters);
    }, 300);
  }, [searchTerm, filters]);

  // Perform search based on search term and filters
  const performSearch = (term, filters) => {
    try {
      const results = [];
      const normalizedTerm = term.toLowerCase();
      
      // Search files
      if (filters.includeFiles && files && files.length > 0) {
        const matchedFiles = files.filter(file => {
          // Always search by filename
          if (file.name.toLowerCase().includes(normalizedTerm)) {
            return true;
          }
          
          // Optionally search by content
          if (filters.searchContent && file.content) {
            return file.content.toLowerCase().includes(normalizedTerm);
          }
          
          return false;
        });
        
        results.push(...matchedFiles.map(file => ({
          ...file,
          type: 'file',
          icon: <IconFileText size={16} className="mr-2 text-secondary-500 dark:text-secondary-400" />
        })));
      }
      
      // Search folders
      if (filters.includeFolders && folders && folders.length > 0) {
        const matchedFolders = folders.filter(folder => 
          folder.name.toLowerCase().includes(normalizedTerm)
        );
        
        results.push(...matchedFolders.map(folder => ({
          ...folder,
          type: 'folder',
          icon: <IconFolder size={16} className="mr-2 text-primary-500 dark:text-primary-400" />
        })));
      }
      
      // Sort results: folders first, then files, both alphabetically
      const sortedResults = results.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        
        return a.name.localeCompare(b.name);
      });
      
      setSearchResults(sortedResults);
    } catch (error) {
      console.error('Error performing search:', error);
      showError('An error occurred while searching');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle filter changes
  const handleFilterChange = (key) => {
    setFilters(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Clear search
  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Handle result click
  const handleResultClick = (result) => {
    if (result.type === 'file' && onFileSelect) {
      onFileSelect(result);
    } else if (result.type === 'folder') {
      // For folders, we could implement folder navigation or expansion
      // For now, let's just highlight the search term in the folder name
      console.log(`Folder selected: ${result.name}`);
    }
  };

  return (
    <div className="file-search h-full flex flex-col">
      <div className="search-header p-2 border-b border-surface-300 dark:border-surface-700">
        <div className="flex items-center relative">
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search files and folders..."
            className="w-full p-2 pl-8 pr-8 text-sm border border-surface-300 dark:border-surface-600 rounded bg-white dark:bg-surface-700"
          />
          <IconSearch 
            size={16} 
            className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-surface-500 dark:text-surface-400" 
          />
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="absolute right-10 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-surface-200 dark:hover:bg-surface-600"
              title="Clear search"
            >
              <IconX size={14} className="text-surface-500 dark:text-surface-400" />
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-surface-200 dark:hover:bg-surface-600 ${
              showFilters ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400' : 'text-surface-500 dark:text-surface-400'
            }`}
            title="Search filters"
          >
            <IconFilter size={14} />
          </button>
        </div>
        
        {showFilters && (
          <div className="filter-options mt-2 p-2 bg-surface-100 dark:bg-surface-800 rounded text-sm">
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.includeFiles}
                  onChange={() => handleFilterChange('includeFiles')}
                  className="mr-1"
                />
                Files
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.includeFolders}
                  onChange={() => handleFilterChange('includeFolders')}
                  className="mr-1"
                />
                Folders
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.searchContent}
                  onChange={() => handleFilterChange('searchContent')}
                  className="mr-1"
                />
                Search in file content
              </label>
            </div>
          </div>
        )}
      </div>
      
      <div className="search-results flex-grow overflow-auto p-2">
        {isLoading ? (
          <div className="flex justify-center items-center py-4">
            <IconLoader2 size={24} className="animate-spin text-primary-500 dark:text-primary-400" />
          </div>
        ) : searchTerm && searchResults.length === 0 ? (
          <div className="text-sm text-surface-600 dark:text-surface-400 italic text-center py-4">
            No results found
          </div>
        ) : (
          <ul className="space-y-1">
            {searchResults.map((result) => (
              <li
                key={`${result.type}-${result.path}`}
                className="py-1 px-2 hover:bg-surface-200 dark:hover:bg-surface-700 cursor-pointer rounded flex items-center"
                onClick={() => handleResultClick(result)}
              >
                {result.icon}
                <span className="text-sm truncate">
                  {result.name}
                </span>
                <span className="text-xs text-surface-500 dark:text-surface-400 ml-2 truncate">
                  {getDirname(result.path)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FileSearch;
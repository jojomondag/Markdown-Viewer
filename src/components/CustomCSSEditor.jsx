import React, { useState, useEffect } from 'react';
import { IconDeviceFloppy, IconReload, IconTrash, IconRefresh, IconCode } from '@tabler/icons-react';
import useNotification from '../hooks/useNotification';

const STORAGE_KEY = 'markdown-viewer-custom-css';
const DEFAULT_CSS = `/* Custom CSS for Markdown Preview */
/* Uncomment or modify these examples, or add your own styles */

/*
.markdown-preview {
  font-family: 'Georgia', serif;
  line-height: 1.8;
}

.markdown-preview h1, .markdown-preview h2, .markdown-preview h3 {
  font-family: 'Arial', sans-serif;
  color: #3B82F6;
}

.markdown-preview a {
  color: #10B981;
  text-decoration: none;
  border-bottom: 1px dotted #10B981;
}

.markdown-preview blockquote {
  border-left: 4px solid #818CF8;
  background-color: rgba(129, 140, 248, 0.1);
  padding: 1rem;
  font-style: italic;
}

.markdown-preview code {
  background-color: #F1F5F9;
  color: #EF4444;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-family: 'Fira Code', monospace;
}

.markdown-preview img {
  border-radius: 4px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.markdown-preview table {
  border-collapse: collapse;
  width: 100%;
}

.markdown-preview table th {
  background-color: #1E40AF;
  color: white;
}

.markdown-preview table td, .markdown-preview table th {
  border: 1px solid #D1D5DB;
  padding: 8px;
}

.markdown-preview table tr:nth-child(even) {
  background-color: #F1F5F9;
}
*/`;

const CustomCSSEditor = ({ onApplyCSS }) => {
  const [css, setCSS] = useState('');
  const [savedStyles, setSavedStyles] = useState([]);
  const [cssApplied, setCssApplied] = useState(false);
  const { showSuccess, showError, showInfo } = useNotification();
  
  // Load saved CSS on mount
  useEffect(() => {
    try {
      // Load current CSS
      const savedCSS = localStorage.getItem(STORAGE_KEY);
      if (savedCSS) {
        setCSS(savedCSS);
      } else {
        setCSS(DEFAULT_CSS);
      }
      
      // Load saved styles list
      const savedStylesList = localStorage.getItem(`${STORAGE_KEY}-list`);
      if (savedStylesList) {
        setSavedStyles(JSON.parse(savedStylesList));
      }
    } catch (error) {
      console.error('Error loading custom CSS:', error);
      showError('Failed to load custom CSS');
    }
  }, [showError]);
  
  // Apply CSS immediately if it's already saved and applied
  useEffect(() => {
    const isApplied = localStorage.getItem(`${STORAGE_KEY}-applied`) === 'true';
    if (isApplied && css) {
      applyCSS();
      setCssApplied(true);
    }
  }, [css]);
  
  // Save CSS to localStorage
  const saveCSS = (name = 'Default Style') => {
    try {
      // Save the current CSS
      localStorage.setItem(STORAGE_KEY, css);
      
      // Check if this style already exists
      const existingIndex = savedStyles.findIndex(style => style.name === name);
      let updatedStyles = [...savedStyles];
      
      const newStyle = {
        id: existingIndex >= 0 ? savedStyles[existingIndex].id : Date.now().toString(),
        name,
        css,
        updatedAt: new Date().toISOString()
      };
      
      if (existingIndex >= 0) {
        // Update existing style
        updatedStyles[existingIndex] = newStyle;
      } else {
        // Add new style
        updatedStyles.push(newStyle);
      }
      
      // Save the updated styles list
      setSavedStyles(updatedStyles);
      localStorage.setItem(`${STORAGE_KEY}-list`, JSON.stringify(updatedStyles));
      
      showSuccess(`Style "${name}" saved`);
    } catch (error) {
      console.error('Error saving custom CSS:', error);
      showError('Failed to save custom CSS');
    }
  };
  
  // Load a saved style
  const loadStyle = (style) => {
    setCSS(style.css);
    showInfo(`Style "${style.name}" loaded`);
  };
  
  // Delete a saved style
  const deleteStyle = (id, name) => {
    try {
      const updatedStyles = savedStyles.filter(style => style.id !== id);
      setSavedStyles(updatedStyles);
      localStorage.setItem(`${STORAGE_KEY}-list`, JSON.stringify(updatedStyles));
      
      showInfo(`Style "${name}" deleted`);
    } catch (error) {
      console.error('Error deleting style:', error);
      showError('Failed to delete style');
    }
  };
  
  // Apply CSS to preview
  const applyCSS = () => {
    if (onApplyCSS) {
      onApplyCSS(css);
      setCssApplied(true);
      localStorage.setItem(`${STORAGE_KEY}-applied`, 'true');
      showSuccess('Custom CSS applied to preview');
    }
  };
  
  // Reset to default CSS
  const resetToDefault = () => {
    setCSS(DEFAULT_CSS);
    showInfo('Reset to default CSS template');
  };
  
  // Remove applied CSS
  const removeCSS = () => {
    if (onApplyCSS) {
      onApplyCSS('');
      setCssApplied(false);
      localStorage.setItem(`${STORAGE_KEY}-applied`, 'false');
      showInfo('Custom CSS removed from preview');
    }
  };
  
  return (
    <div className="custom-css-editor h-full flex flex-col">
      <div className="toolbar flex justify-between items-center p-2 border-b border-surface-300 dark:border-surface-700 bg-surface-100 dark:bg-surface-800">
        <div className="flex items-center">
          <IconCode size={18} className="mr-2 text-primary-500 dark:text-primary-400" />
          <h3 className="text-sm font-medium">Custom CSS Editor</h3>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => saveCSS()}
            className="p-1.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300"
            title="Save CSS"
          >
            <IconDeviceFloppy size={16} />
          </button>
          
          <button
            onClick={applyCSS}
            className={`p-1.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700 ${
              cssApplied 
                ? 'text-primary-600 dark:text-primary-400 bg-primary-100 dark:bg-primary-900' 
                : 'text-surface-600 dark:text-surface-300'
            }`}
            title="Apply CSS to preview"
          >
            <IconReload size={16} />
          </button>
          
          <button
            onClick={removeCSS}
            className="p-1.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300"
            title="Remove applied CSS"
            disabled={!cssApplied}
          >
            <IconTrash size={16} className={!cssApplied ? 'opacity-50' : ''} />
          </button>
          
          <button
            onClick={resetToDefault}
            className="p-1.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300"
            title="Reset to default template"
          >
            <IconRefresh size={16} />
          </button>
        </div>
      </div>
      
      <div className="editor-wrapper flex-grow flex flex-col">
        <textarea
          className="flex-grow p-3 text-sm font-mono bg-white dark:bg-surface-900 border-none outline-none resize-none"
          value={css}
          onChange={(e) => setCSS(e.target.value)}
          placeholder="Add your custom CSS here..."
          spellCheck="false"
        />
      </div>
      
      {savedStyles.length > 0 && (
        <div className="saved-styles p-2 border-t border-surface-300 dark:border-surface-700 bg-surface-100 dark:bg-surface-800">
          <h4 className="text-xs font-medium mb-2">Saved Styles</h4>
          <div className="styles-list max-h-32 overflow-y-auto">
            <ul className="space-y-1">
              {savedStyles.map((style) => (
                <li 
                  key={style.id} 
                  className="flex justify-between items-center p-1.5 text-xs bg-white dark:bg-surface-700 rounded hover:bg-surface-100 dark:hover:bg-surface-600"
                >
                  <button
                    className="font-medium text-left flex-grow truncate"
                    onClick={() => loadStyle(style)}
                    title={`Load "${style.name}"`}
                  >
                    {style.name}
                  </button>
                  
                  <div className="flex">
                    <button
                      onClick={() => deleteStyle(style.id, style.name)}
                      className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-500 text-surface-600 dark:text-surface-300"
                      title={`Delete "${style.name}"`}
                    >
                      <IconTrash size={12} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomCSSEditor; 
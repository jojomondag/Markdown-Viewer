import React, { useState, useEffect } from 'react';
import { IconPlus, IconTrash, IconEdit, IconDeviceFloppy, IconX, IconShare, IconDownload, IconUpload } from '@tabler/icons-react';
import { useAppState } from '../context/AppStateContext';
import useNotification from '../hooks/useNotification';

const SyntaxTreePresets = ({ content, onPresetSelect }) => {
  const [presets, setPresets] = useState([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState(null);
  const [showImportExport, setShowImportExport] = useState(false);
  const [importData, setImportData] = useState('');
  
  const { showSuccess, showError, showInfo } = useNotification();
  
  // Load presets from localStorage on initial render
  useEffect(() => {
    try {
      const savedPresets = localStorage.getItem('syntaxTreePresets');
      if (savedPresets) {
        setPresets(JSON.parse(savedPresets));
      }
    } catch (error) {
      console.error('Error loading presets:', error);
      showError('Failed to load presets');
    }
  }, [showError]);
  
  // Save presets to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('syntaxTreePresets', JSON.stringify(presets));
    } catch (error) {
      console.error('Error saving presets:', error);
      showError('Failed to save presets');
    }
  }, [presets, showError]);
  
  // Save the current document structure as a preset
  const savePreset = () => {
    if (!newPresetName.trim()) {
      showError('Please enter a preset name');
      return;
    }
    
    // Parse headings from the content
    const headings = parseHeadings(content);
    
    if (headings.length === 0) {
      showError('No headings found in the document');
      return;
    }
    
    const newPreset = {
      id: editingPresetId || Date.now().toString(),
      name: newPresetName,
      headings,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    if (isEditing) {
      // Update existing preset
      setPresets(presets.map(preset => 
        preset.id === editingPresetId ? newPreset : preset
      ));
      showSuccess(`Preset "${newPresetName}" updated`);
    } else {
      // Create new preset
      setPresets([...presets, newPreset]);
      showSuccess(`Preset "${newPresetName}" saved`);
    }
    
    // Reset form
    setNewPresetName('');
    setIsCreating(false);
    setIsEditing(false);
    setEditingPresetId(null);
  };
  
  // Delete a preset
  const deletePreset = (id, name) => {
    const confirmed = window.confirm(`Are you sure you want to delete preset "${name}"?`);
    if (!confirmed) return;
    
    setPresets(presets.filter(preset => preset.id !== id));
    showInfo(`Preset "${name}" deleted`);
  };
  
  // Edit a preset
  const startEditPreset = (preset) => {
    setNewPresetName(preset.name);
    setEditingPresetId(preset.id);
    setIsEditing(true);
    setIsCreating(true);
  };
  
  // Load a preset
  const loadPreset = (preset) => {
    if (onPresetSelect) {
      onPresetSelect(preset);
    }
    showInfo(`Preset "${preset.name}" loaded`);
  };
  
  // Parse headings from markdown content
  const parseHeadings = (content) => {
    if (!content) return [];
    
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const matches = [...content.matchAll(headingRegex)];
    
    return matches.map((match, index) => {
      const level = match[1].length;
      const text = match[2].trim();
      const position = match.index;
      
      return { level, text, position, id: `heading-${index}` };
    });
  };
  
  // Export presets
  const exportPresets = () => {
    try {
      const dataStr = JSON.stringify(presets, null, 2);
      const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
      
      const exportFileDefaultName = `syntax-tree-presets-${new Date().toISOString().slice(0, 10)}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      showSuccess('Presets exported successfully');
    } catch (error) {
      console.error('Error exporting presets:', error);
      showError('Failed to export presets');
    }
  };
  
  // Import presets
  const importPresets = () => {
    try {
      const importedPresets = JSON.parse(importData);
      
      if (!Array.isArray(importedPresets)) {
        showError('Invalid preset format');
        return;
      }
      
      // Validate each preset
      const validPresets = importedPresets.filter(preset => 
        preset && 
        preset.id && 
        preset.name && 
        Array.isArray(preset.headings)
      );
      
      if (validPresets.length === 0) {
        showError('No valid presets found in import data');
        return;
      }
      
      // Ask user if they want to replace or merge
      const replace = window.confirm('Replace existing presets? Click OK to replace or Cancel to merge.');
      
      if (replace) {
        setPresets(validPresets);
      } else {
        // Merge presets, avoiding duplicates by ID
        const mergedPresets = [...presets];
        
        validPresets.forEach(newPreset => {
          const existingIndex = mergedPresets.findIndex(p => p.id === newPreset.id);
          
          if (existingIndex >= 0) {
            // Update existing preset
            mergedPresets[existingIndex] = newPreset;
          } else {
            // Add new preset
            mergedPresets.push(newPreset);
          }
        });
        
        setPresets(mergedPresets);
      }
      
      setImportData('');
      setShowImportExport(false);
      showSuccess(`Imported ${validPresets.length} presets`);
    } catch (error) {
      console.error('Error importing presets:', error);
      showError('Failed to import presets: invalid JSON format');
    }
  };
  
  // Share preset - copy to clipboard
  const sharePreset = (preset) => {
    try {
      const presetJson = JSON.stringify([preset], null, 2);
      navigator.clipboard.writeText(presetJson);
      showSuccess(`Preset "${preset.name}" copied to clipboard`);
    } catch (error) {
      console.error('Error sharing preset:', error);
      showError('Failed to copy preset to clipboard');
    }
  };
  
  return (
    <div className="syntax-tree-presets">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-md font-medium">Presets</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowImportExport(!showImportExport)}
            className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300"
            title="Import/Export Presets"
          >
            {showImportExport ? <IconX size={16} /> : <IconShare size={16} />}
          </button>
          
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300"
            title={isCreating ? "Cancel" : "Create New Preset"}
          >
            {isCreating ? <IconX size={16} /> : <IconPlus size={16} />}
          </button>
        </div>
      </div>
      
      {showImportExport && (
        <div className="bg-surface-100 dark:bg-surface-800 p-3 rounded mb-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-medium">Import/Export</h4>
          </div>
          
          <div className="flex space-x-2 mb-2">
            <button
              onClick={exportPresets}
              className="flex-1 py-1 px-2 text-xs bg-secondary-100 text-secondary-700 dark:bg-secondary-900 dark:text-secondary-300 rounded flex items-center justify-center"
              title="Export Presets"
            >
              <IconDownload size={14} className="mr-1" /> Export
            </button>
            
            <button
              onClick={importPresets}
              className="flex-1 py-1 px-2 text-xs bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 rounded flex items-center justify-center"
              title="Import Presets"
              disabled={!importData.trim()}
            >
              <IconUpload size={14} className="mr-1" /> Import
            </button>
          </div>
          
          <div className="relative">
            <textarea
              className="w-full p-2 text-xs border border-surface-300 dark:border-surface-600 rounded bg-white dark:bg-surface-700 h-24"
              placeholder="Paste JSON preset data here..."
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
            />
          </div>
        </div>
      )}
      
      {isCreating && (
        <div className="bg-surface-100 dark:bg-surface-800 p-3 rounded mb-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-medium">{isEditing ? 'Edit Preset' : 'Create New Preset'}</h4>
          </div>
          
          <div className="mb-2">
            <input 
              type="text"
              className="w-full p-2 text-sm border border-surface-300 dark:border-surface-600 rounded bg-white dark:bg-surface-700"
              placeholder="Preset name"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
            />
          </div>
          
          <div className="flex justify-end">
            <button
              onClick={savePreset}
              className="py-1 px-3 text-xs bg-primary-600 text-white rounded flex items-center"
              disabled={!newPresetName.trim()}
            >
              <IconDeviceFloppy size={14} className="mr-1" />
              {isEditing ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      )}
      
      {presets.length === 0 ? (
        <div className="text-sm text-surface-600 dark:text-surface-400 italic">
          No presets saved yet
        </div>
      ) : (
        <ul className="space-y-1">
          {presets.map((preset) => (
            <li 
              key={preset.id}
              className="bg-surface-50 dark:bg-surface-800 p-2 rounded border border-surface-200 dark:border-surface-700"
            >
              <div className="flex justify-between items-center">
                <button
                  className="text-sm font-medium hover:text-primary-600 dark:hover:text-primary-400 flex-grow text-left"
                  onClick={() => loadPreset(preset)}
                >
                  {preset.name}
                </button>
                
                <div className="flex space-x-1">
                  <button
                    onClick={() => sharePreset(preset)}
                    className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300"
                    title="Share Preset"
                  >
                    <IconShare size={14} />
                  </button>
                  
                  <button
                    onClick={() => startEditPreset(preset)}
                    className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300"
                    title="Edit Preset"
                  >
                    <IconEdit size={14} />
                  </button>
                  
                  <button
                    onClick={() => deletePreset(preset.id, preset.name)}
                    className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300"
                    title="Delete Preset"
                  >
                    <IconTrash size={14} />
                  </button>
                </div>
              </div>
              
              <div className="text-xs text-surface-500 dark:text-surface-400 mt-1">
                {preset.headings.length} heading{preset.headings.length !== 1 ? 's' : ''}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SyntaxTreePresets; 
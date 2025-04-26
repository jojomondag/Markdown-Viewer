import React, { createContext, useContext, useState, useEffect } from 'react';

// Default settings
export const DEFAULT_SETTINGS = {
  // Editor preferences
  editor: {
    fontFamily: 'monospace',
    lineNumbers: true,
    wordWrap: true,
    tabSize: 2,
    autoSave: true,
    autoSaveInterval: 1000, // milliseconds
  },
  // UI preferences
  ui: {
    theme: 'system', // 'light', 'dark', or 'system'
    sidebarVisible: true,
    previewVisible: true,
    sidebarWidth: 20, // percentage
    previewWidth: 50, // percentage
  },
  // Markdown preferences
  markdown: {
    defaultSyntaxHighlighting: true,
    renderImages: true,
    renderTables: true,
    renderMath: false,
    renderDiagrams: false,
  }
};

// Create the context
const SettingsContext = createContext(null);

// Custom hook to use the settings context
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  // Initialize state from localStorage or use defaults
  const [settings, setSettings] = useState(() => {
    try {
      const savedSettings = localStorage.getItem('markdown-viewer-settings');
      return savedSettings ? JSON.parse(savedSettings) : DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Failed to load settings from localStorage:', error);
      return DEFAULT_SETTINGS;
    }
  });

  // Save settings to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('markdown-viewer-settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
    }
  }, [settings]);

  // Update a specific setting
  const updateSetting = (category, key, value) => {
    // Prevent updating fontSize via this context
    if (category === 'editor' && key === 'fontSize') {
      console.warn('Editor font size should be updated via AppStateContext');
      return; 
    }
    
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  // Reset settings to defaults
  const resetSettings = () => {
    // Keep the current font size from AppStateContext when resetting?
    // For now, let's just reset other settings.
    // If resetting font size is desired, it should trigger setEditorFontSize from AppStateContext.
    const { editor: { fontSize, ...otherEditorSettings }, ...otherCategories } = DEFAULT_SETTINGS;
    setSettings(prev => ({
      ...otherCategories,
      editor: {
        ...otherEditorSettings,
        // Optionally keep the current non-fontSize settings if needed
        // fontFamily: prev.editor.fontFamily, 
        // etc...
      },
      // Keep other categories as they were unless they should reset too
      // ui: prev.ui 
    }));
    
    // Note: Resetting doesn't currently affect the AppStateContext fontSize.
    // If you want reset to also reset the editor font size, you'd need 
    // to call the `setEditorFontSize` function from AppStateContext here.
    // This might require passing that function down or accessing the context here.
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSetting,
        resetSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export default SettingsContext; 
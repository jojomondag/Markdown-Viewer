import React, { createContext, useContext, useState, useEffect } from 'react';

// Default settings
export const DEFAULT_SETTINGS = {
  // Editor preferences
  editor: {
    fontSize: 14,
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
    setSettings(DEFAULT_SETTINGS);
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
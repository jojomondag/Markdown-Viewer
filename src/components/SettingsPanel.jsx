import React, { useEffect, useRef } from 'react';
import { 
  IconX, 
  IconSettings, 
  IconEdit, 
  IconLayoutDashboard, 
  IconMarkdown,
  IconRotateClockwise2,
} from '@tabler/icons-react';
import { Tabs } from './ui/tabs';
import { Switch } from './ui/switch';
import { Select } from './ui/select';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { useSettings, DEFAULT_SETTINGS } from '../context/SettingsContext';
import { setupFocusTrap, announceToScreenReader } from './AccessibilityHelper';

const SettingsPanel = ({ isOpen, onClose }) => {
  const { settings, updateSetting, resetSettings } = useSettings();
  const modalRef = useRef(null);
  
  // Focus trap and accessibility management
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;
    
    // Announce to screen readers that the modal is open
    announceToScreenReader('Settings panel opened');
    
    // Set up focus trap within modal
    const cleanup = setupFocusTrap(modalRef.current);
    
    // Prevent scrolling of background content
    document.body.classList.add('modal-open');
    
    // Handle escape key to close modal
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscapeKey);
    
    return () => {
      cleanup();
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', handleEscapeKey);
      announceToScreenReader('Settings panel closed');
    };
  }, [isOpen, onClose]);
  
  // Handle settings reset with announcement
  const handleResetSettings = () => {
    resetSettings();
    announceToScreenReader('Settings have been reset to defaults');
  };
  
  if (!isOpen) return null;
  
  // Theme options
  const themeOptions = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System Default' },
  ];
  
  // Font family options
  const fontFamilyOptions = [
    { value: 'monospace', label: 'Monospace' },
    { value: 'sans-serif', label: 'Sans Serif' },
    { value: 'serif', label: 'Serif' },
  ];
  
  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div 
        ref={modalRef}
        className="bg-white dark:bg-surface-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700">
          <h2 id="settings-title" className="text-lg font-semibold flex items-center">
            <IconSettings className="mr-2" aria-hidden="true" />
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-surface-200 dark:hover:bg-surface-700"
            aria-label="Close settings panel"
          >
            <IconX size={20} aria-hidden="true" />
          </button>
        </div>
        
        <div className="flex-grow overflow-y-auto">
          <Tabs defaultValue="editor" className="h-full">
            <Tabs.Tab value="editor" label="Editor" icon={IconEdit}>
              <div className="space-y-4">
                <h3 className="text-lg font-medium mb-2" id="editor-settings-heading">Editor Settings</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-labelledby="editor-settings-heading">
                  <div className="space-y-2">
                    <label id="font-size-label" className="text-sm font-medium">Font Size</label>
                    <div className="flex items-center" aria-labelledby="font-size-label">
                      <Slider
                        min={10}
                        max={24}
                        step={1}
                        value={[settings.editor.fontSize]}
                        onValueChange={(value) => updateSetting('editor', 'fontSize', value[0])}
                        aria-valuemin={10}
                        aria-valuemax={24}
                        aria-valuenow={settings.editor.fontSize}
                      />
                      <span className="ml-2 text-sm">{settings.editor.fontSize}px</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Font Family</label>
                    <Select
                      options={fontFamilyOptions}
                      value={settings.editor.fontFamily}
                      onChange={(value) => updateSetting('editor', 'fontFamily', value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tab Size</label>
                    <Select
                      options={[
                        { value: 2, label: '2 spaces' },
                        { value: 4, label: '4 spaces' },
                        { value: 8, label: '8 spaces' },
                      ]}
                      value={settings.editor.tabSize}
                      onChange={(value) => updateSetting('editor', 'tabSize', Number(value))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Auto-Save Interval</label>
                    <div className="flex items-center">
                      <Slider
                        min={500}
                        max={5000}
                        step={500}
                        value={[settings.editor.autoSaveInterval]}
                        onValueChange={(value) => updateSetting('editor', 'autoSaveInterval', value[0])}
                      />
                      <span className="ml-2 text-sm">{settings.editor.autoSaveInterval / 1000}s</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label id="line-numbers-label" className="text-sm font-medium">Show Line Numbers</label>
                    <Switch
                      checked={settings.editor.lineNumbers}
                      onChange={(value) => updateSetting('editor', 'lineNumbers', value)}
                      aria-labelledby="line-numbers-label"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label id="word-wrap-label" className="text-sm font-medium">Word Wrap</label>
                    <Switch
                      checked={settings.editor.wordWrap}
                      onChange={(value) => updateSetting('editor', 'wordWrap', value)}
                      aria-labelledby="word-wrap-label"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label id="auto-save-label" className="text-sm font-medium">Auto-Save</label>
                    <Switch
                      checked={settings.editor.autoSave}
                      onChange={(value) => updateSetting('editor', 'autoSave', value)}
                      aria-labelledby="auto-save-label"
                    />
                  </div>
                </div>
              </div>
            </Tabs.Tab>
            
            <Tabs.Tab value="ui" label="Interface" icon={IconLayoutDashboard}>
              <div className="space-y-4">
                <h3 className="text-lg font-medium mb-2">Interface Settings</h3>
                
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Theme</label>
                    <Select
                      options={themeOptions}
                      value={settings.ui.theme}
                      onChange={(value) => updateSetting('ui', 'theme', value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Sidebar Width</label>
                    <div className="flex items-center">
                      <Slider
                        min={10}
                        max={40}
                        step={5}
                        value={[settings.ui.sidebarWidth]}
                        onValueChange={(value) => updateSetting('ui', 'sidebarWidth', value[0])}
                      />
                      <span className="ml-2 text-sm">{settings.ui.sidebarWidth}%</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Preview Width</label>
                    <div className="flex items-center">
                      <Slider
                        min={30}
                        max={70}
                        step={5}
                        value={[settings.ui.previewWidth]}
                        onValueChange={(value) => updateSetting('ui', 'previewWidth', value[0])}
                      />
                      <span className="ml-2 text-sm">{settings.ui.previewWidth}%</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Show Sidebar</label>
                    <Switch
                      checked={settings.ui.sidebarVisible}
                      onChange={(value) => updateSetting('ui', 'sidebarVisible', value)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Show Preview</label>
                    <Switch
                      checked={settings.ui.previewVisible}
                      onChange={(value) => updateSetting('ui', 'previewVisible', value)}
                    />
                  </div>
                </div>
              </div>
            </Tabs.Tab>
            
            <Tabs.Tab value="markdown" label="Markdown" icon={IconMarkdown}>
              <div className="space-y-4">
                <h3 className="text-lg font-medium mb-2">Markdown Settings</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Syntax Highlighting in Code Blocks</label>
                    <Switch
                      checked={settings.markdown.defaultSyntaxHighlighting}
                      onChange={(value) => updateSetting('markdown', 'defaultSyntaxHighlighting', value)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Render Images</label>
                    <Switch
                      checked={settings.markdown.renderImages}
                      onChange={(value) => updateSetting('markdown', 'renderImages', value)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Render Tables</label>
                    <Switch
                      checked={settings.markdown.renderTables}
                      onChange={(value) => updateSetting('markdown', 'renderTables', value)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Render Math Expressions</label>
                    <Switch
                      checked={settings.markdown.renderMath}
                      onChange={(value) => updateSetting('markdown', 'renderMath', value)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Render Diagrams</label>
                    <Switch
                      checked={settings.markdown.renderDiagrams}
                      onChange={(value) => updateSetting('markdown', 'renderDiagrams', value)}
                    />
                  </div>
                </div>
              </div>
            </Tabs.Tab>
          </Tabs>
        </div>
        
        <div className="p-4 border-t border-surface-200 dark:border-surface-700 flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleResetSettings} className="flex items-center">
            <IconRotateClockwise2 size={16} className="mr-1" aria-hidden="true" />
            Reset to Defaults
          </Button>
          <Button onClick={onClose}>
            Apply & Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel; 
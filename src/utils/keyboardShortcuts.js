/**
 * Utility for handling keyboard shortcuts in the application
 */

// List of keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  // File operations
  NEW_FILE: 'Ctrl+N',
  OPEN_FILE: 'Ctrl+O',
  SAVE_FILE: 'Ctrl+S',
  SAVE_AS: 'Ctrl+Shift+S',
  
  // Editor operations
  FIND: 'Ctrl+F',
  REPLACE: 'Ctrl+H',
  UNDO: 'Ctrl+Z',
  REDO: 'Ctrl+Shift+Z',
  CUT: 'Ctrl+X',
  COPY: 'Ctrl+C',
  PASTE: 'Ctrl+V',
  SELECT_ALL: 'Ctrl+A',
  
  // Formatting shortcuts
  BOLD: 'Ctrl+B',
  ITALIC: 'Ctrl+I',
  HEADING: 'Ctrl+Alt+H',
  LINK: 'Ctrl+K',
  CODE: 'Ctrl+`',
  LIST: 'Ctrl+L',
  ORDERED_LIST: 'Ctrl+Shift+L',
  
  // View operations
  TOGGLE_PREVIEW: 'Ctrl+P',
  TOGGLE_SIDEBAR: 'Ctrl+\\',
  ZOOM_IN: 'Ctrl+=',
  ZOOM_OUT: 'Ctrl+-',
  RESET_ZOOM: 'Ctrl+0',
  
  // Explorer operations
  TOGGLE_SORT_DIRECTION: 'Ctrl+Alt+S',
};

// Mac-friendly display of keyboard shortcuts
export const formatShortcut = (shortcut) => {
  if (navigator.platform.indexOf('Mac') === 0) {
    return shortcut.replace('Ctrl+', '⌘').replace('Alt+', '⌥').replace('Shift+', '⇧');
  }
  return shortcut;
};

// Register global keyboard shortcuts
export const registerGlobalShortcuts = (handlers) => {
  const handleKeyDown = (event) => {
    // Map the key combination to our shortcut format
    let shortcut = '';
    if (event.ctrlKey || event.metaKey) shortcut += 'Ctrl+';
    if (event.shiftKey) shortcut += 'Shift+';
    if (event.altKey) shortcut += 'Alt+';
    shortcut += event.key.toUpperCase();
    
    // Normalize some special keys
    shortcut = shortcut
      .replace('Ctrl+ARROWUP', 'Ctrl+UP')
      .replace('Ctrl+ARROWDOWN', 'Ctrl+DOWN')
      .replace('Ctrl+ARROWLEFT', 'Ctrl+LEFT')
      .replace('Ctrl+ARROWRIGHT', 'Ctrl+RIGHT')
      .replace('Ctrl+=', 'Ctrl++')
      .replace('Ctrl+ESCAPE', 'Ctrl+ESC');
    
    // Check if we have a handler for this shortcut
    for (const [action, actionShortcut] of Object.entries(KEYBOARD_SHORTCUTS)) {
      if (actionShortcut === shortcut && handlers[action]) {
        event.preventDefault();
        handlers[action](event);
        break;
      }
    }
  };
  
  // Add the event listener
  document.addEventListener('keydown', handleKeyDown);
  
  // Return a function to remove the listener
  return () => {
    document.removeEventListener('keydown', handleKeyDown);
  };
};

// Display keyboard shortcuts in tooltip format
export const getShortcutTooltip = (action) => {
  const shortcut = KEYBOARD_SHORTCUTS[action];
  if (!shortcut) return '';
  
  return `(${formatShortcut(shortcut)})`;
}; 
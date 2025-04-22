import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { newFilesInProgress } from '../components/FileExplorer';

// Define initial state
const initialState = {
  // File history - tracks recently opened files
  fileHistory: [],
  
  // Open files - tracks currently open files in tabs
  openFiles: [],
  
  // UI state
  ui: {
    // Tracks open/closed states of panels, dialogs, etc.
    openPanels: {
      sidebar: true,
      preview: true,
      settings: false,
    },
    // UI preferences that aren't in settings
    preferences: {
      selectedSidebarTab: 'files',
      explorerSortBy: 'name',
      explorerSortDirection: 'asc',
    },
  },
  
  // Editor state
  editor: {
    // Current cursor position
    cursorPosition: { line: 0, ch: 0 },
    // Selection ranges
    selections: [],
    // Scroll position
    scrollPosition: { top: 0, left: 0 },
    // Unsaved changes tracking
    unsavedChanges: false,
  },
  
  // Error state
  errors: [],
  
  // Loading states
  loading: {
    files: false,
    folders: false,
    content: false,
  },
};

// Define action types
const ActionTypes = {
  // File history actions
  ADD_TO_HISTORY: 'ADD_TO_HISTORY',
  CLEAR_HISTORY: 'CLEAR_HISTORY',
  
  // Open files actions
  ADD_OPEN_FILE: 'ADD_OPEN_FILE',
  REMOVE_OPEN_FILE: 'REMOVE_OPEN_FILE',
  UPDATE_OPEN_FILE: 'UPDATE_OPEN_FILE',
  SET_FILE_DIRTY: 'SET_FILE_DIRTY',
  CLEAR_OPEN_FILES: 'CLEAR_OPEN_FILES',
  
  // UI state actions
  TOGGLE_PANEL: 'TOGGLE_PANEL',
  SET_PANEL: 'SET_PANEL',
  SET_SIDEBAR_TAB: 'SET_SIDEBAR_TAB',
  UPDATE_PREFERENCES: 'UPDATE_PREFERENCES',
  
  // Editor state actions
  SET_CURSOR_POSITION: 'SET_CURSOR_POSITION',
  SET_SELECTIONS: 'SET_SELECTIONS',
  SET_SCROLL_POSITION: 'SET_SCROLL_POSITION',
  SET_UNSAVED_CHANGES: 'SET_UNSAVED_CHANGES',
  
  // Error state actions
  ADD_ERROR: 'ADD_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  
  // Loading state actions
  SET_LOADING: 'SET_LOADING',
  
  // Reset all state
  RESET_STATE: 'RESET_STATE',
};

// Reducer function to handle state updates
function appStateReducer(state, action) {
  switch (action.type) {
    // File history cases
    case ActionTypes.ADD_TO_HISTORY:
      // Add file to history, avoid duplicates, limit to 10 entries
      return {
        ...state,
        fileHistory: [
          action.payload,
          ...state.fileHistory.filter(file => file.path !== action.payload.path)
        ].slice(0, 10),
      };
      
    case ActionTypes.CLEAR_HISTORY:
      return {
        ...state,
        fileHistory: [],
      };
    
    // Open files cases
    case ActionTypes.ADD_OPEN_FILE:
      // Check if file is already open
      if (state.openFiles.some(file => file.path === action.payload.path)) {
        return state;
      }
      return {
        ...state,
        openFiles: [...state.openFiles, { ...action.payload, isDirty: false }],
      };
      
    case ActionTypes.REMOVE_OPEN_FILE:
      return {
        ...state,
        openFiles: state.openFiles.filter(file => file.path !== action.payload.path),
      };
      
    case ActionTypes.UPDATE_OPEN_FILE:
      return {
        ...state,
        openFiles: state.openFiles.map(file => {
          if (file.path === action.payload.path) {
            // Remove path from payload to avoid duplication
            const { path, ...updates } = action.payload;
            return { ...file, ...updates };
          }
          return file;
        }),
      };
      
    case ActionTypes.SET_FILE_DIRTY:
      return {
        ...state,
        openFiles: state.openFiles.map(file => 
          file.path === action.payload.path 
            ? { ...file, isDirty: action.payload.isDirty } 
            : file
        ),
      };
      
    case ActionTypes.CLEAR_OPEN_FILES:
      return {
        ...state,
        openFiles: [],
      };
    
    // UI state cases
    case ActionTypes.TOGGLE_PANEL:
      return {
        ...state,
        ui: {
          ...state.ui,
          openPanels: {
            ...state.ui.openPanels,
            [action.payload]: !state.ui.openPanels[action.payload],
          },
        },
      };
      
    case ActionTypes.SET_PANEL:
      return {
        ...state,
        ui: {
          ...state.ui,
          openPanels: {
            ...state.ui.openPanels,
            [action.payload.panel]: action.payload.value,
          },
        },
      };
      
    case ActionTypes.SET_SIDEBAR_TAB:
      return {
        ...state,
        ui: {
          ...state.ui,
          preferences: {
            ...state.ui.preferences,
            selectedSidebarTab: action.payload,
          },
        },
      };
      
    case ActionTypes.UPDATE_PREFERENCES:
      return {
        ...state,
        ui: {
          ...state.ui,
          preferences: {
            ...state.ui.preferences,
            ...action.payload,
          },
        },
      };
    
    // Editor state cases
    case ActionTypes.SET_CURSOR_POSITION:
      return {
        ...state,
        editor: {
          ...state.editor,
          cursorPosition: action.payload,
        },
      };
      
    case ActionTypes.SET_SELECTIONS:
      return {
        ...state,
        editor: {
          ...state.editor,
          selections: action.payload,
        },
      };
      
    case ActionTypes.SET_SCROLL_POSITION:
      return {
        ...state,
        editor: {
          ...state.editor,
          scrollPosition: action.payload,
        },
      };
      
    case ActionTypes.SET_UNSAVED_CHANGES:
      return {
        ...state,
        editor: {
          ...state.editor,
          unsavedChanges: action.payload,
        },
      };
    
    // Error state cases
    case ActionTypes.ADD_ERROR:
      return {
        ...state,
        errors: [...state.errors, action.payload],
      };
      
    case ActionTypes.CLEAR_ERROR:
      return {
        ...state,
        errors: state.errors.filter((_, index) => index !== action.payload),
      };
    
    // Loading state cases
    case ActionTypes.SET_LOADING:
      return {
        ...state,
        loading: {
          ...state.loading,
          [action.payload.key]: action.payload.value,
        },
      };
    
    // Reset all state
    case ActionTypes.RESET_STATE:
      return initialState;
      
    default:
      return state;
  }
}

// Create context
const AppStateContext = createContext();

// Create provider component
export const AppStateProvider = ({ children }) => {
  // Initialize state from localStorage or use defaults
  const [state, dispatch] = useReducer(appStateReducer, initialState, (initial) => {
    try {
      const savedState = localStorage.getItem('markdown-viewer-app-state');
      return savedState ? JSON.parse(savedState) : initial;
    } catch (error) {
      console.error('Failed to load app state from localStorage:', error);
      return initial;
    }
  });

  // Save state to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('markdown-viewer-app-state', JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save app state to localStorage:', error);
    }
  }, [state]);

  // Create action creators
  const addToHistory = (file) => dispatch({ 
    type: ActionTypes.ADD_TO_HISTORY, 
    payload: file 
  });
  
  const clearHistory = () => dispatch({ 
    type: ActionTypes.CLEAR_HISTORY 
  });
  
  // Open files actions
  const addOpenFile = (file) => {
    // Check if this is a temporary file being created/renamed
    if (file && file.path && newFilesInProgress.has(file.path)) {
      console.log(`Not adding temporary file to open tabs: ${file.path}`);
      return; // Don't dispatch the action for temporary files
    }
    
    dispatch({
      type: ActionTypes.ADD_OPEN_FILE,
      payload: file
    });
  };
  
  const removeOpenFile = (file) => dispatch({
    type: ActionTypes.REMOVE_OPEN_FILE,
    payload: file
  });
  
  const updateOpenFile = (oldPath, updates) => {
    // If the updates contain a new path, we need to properly update the open file
    if (updates.path && updates.path !== oldPath) {
      // First, get a copy of the current file with the old path
      const file = state.openFiles.find(f => f.path === oldPath);
      if (file) {
        // Then dispatch an action to remove the file with the old path
        dispatch({
          type: ActionTypes.REMOVE_OPEN_FILE,
          payload: { path: oldPath }
        });
        
        // Finally, add the file with the new path and updates
        dispatch({
          type: ActionTypes.ADD_OPEN_FILE,
          payload: { ...file, ...updates }
        });
        
        return;
      }
    }
    
    // Otherwise, do a regular update
    dispatch({
      type: ActionTypes.UPDATE_OPEN_FILE,
      payload: { path: oldPath, ...updates }
    });
  };
  
  const setFileDirty = (file, isDirty) => dispatch({
    type: ActionTypes.SET_FILE_DIRTY,
    payload: { path: file.path, isDirty }
  });
  
  const clearOpenFiles = () => dispatch({
    type: ActionTypes.CLEAR_OPEN_FILES
  });
  
  const togglePanel = (panel) => dispatch({ 
    type: ActionTypes.TOGGLE_PANEL, 
    payload: panel 
  });
  
  const setPanel = (panel, value) => dispatch({ 
    type: ActionTypes.SET_PANEL, 
    payload: { panel, value } 
  });
  
  const setSidebarTab = (tab) => dispatch({ 
    type: ActionTypes.SET_SIDEBAR_TAB, 
    payload: tab 
  });
  
  const updatePreferences = (preferences) => dispatch({
    type: ActionTypes.UPDATE_PREFERENCES,
    payload: preferences
  });
  
  const setCursorPosition = (position) => dispatch({ 
    type: ActionTypes.SET_CURSOR_POSITION, 
    payload: position 
  });
  
  const setSelections = (selections) => dispatch({ 
    type: ActionTypes.SET_SELECTIONS, 
    payload: selections 
  });
  
  const setScrollPosition = (position) => dispatch({ 
    type: ActionTypes.SET_SCROLL_POSITION, 
    payload: position 
  });
  
  const setUnsavedChanges = (hasUnsavedChanges) => dispatch({ 
    type: ActionTypes.SET_UNSAVED_CHANGES, 
    payload: hasUnsavedChanges 
  });
  
  const addError = (error) => dispatch({ 
    type: ActionTypes.ADD_ERROR, 
    payload: error 
  });
  
  const clearError = (index) => dispatch({ 
    type: ActionTypes.CLEAR_ERROR, 
    payload: index 
  });
  
  const setLoading = (key, value) => dispatch({ 
    type: ActionTypes.SET_LOADING, 
    payload: { key, value } 
  });
  
  const resetState = () => dispatch({ 
    type: ActionTypes.RESET_STATE 
  });

  return (
    <AppStateContext.Provider
      value={{
        state,
        // Action creators
        addToHistory,
        clearHistory,
        // Open files actions
        addOpenFile,
        removeOpenFile,
        updateOpenFile,
        setFileDirty,
        clearOpenFiles,
        // UI actions
        togglePanel,
        setPanel,
        setSidebarTab,
        updatePreferences,
        // Editor actions
        setCursorPosition,
        setSelections,
        setScrollPosition,
        setUnsavedChanges,
        // Error actions
        addError,
        clearError,
        // Loading actions
        setLoading,
        // Reset
        resetState,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
};

// Custom hook to use the app state context
export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};

export default AppStateContext;
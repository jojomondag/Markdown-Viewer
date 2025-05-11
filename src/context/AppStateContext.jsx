import React, { createContext, useContext, useReducer, useEffect } from 'react';

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
    // Session-specific UI state for explorer
    activeRootFolders: [],       // <-- NEW: For currently open root folders
    activeExpandedNodes: {},     // <-- NEW: For currently expanded nodes in explorer
    itemOrder: {},               // <-- ADDED: For custom item order in explorer
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
    // Font size
    fontSize: 14,
  },
  
  // Error state
  errors: [],
  
  // Loading states
  loading: {
    files: false,
    folders: false,
    content: false,
  },
  
  // Holds the collection of explicitly saved named workspace states
  savedWorkspaceStates: {},

  // Used to trigger and manage the loading process of a named workspace state
  pendingWorkspaceLoad: null, // Will hold the data of the state to be loaded

  activeNamedWorkspaceName: null, // <-- NEW: Tracks the currently loaded named workspace
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
  REORDER_OPEN_FILES: 'REORDER_OPEN_FILES',
  
  // UI state actions
  TOGGLE_PANEL: 'TOGGLE_PANEL',
  SET_PANEL: 'SET_PANEL',
  SET_SIDEBAR_TAB: 'SET_SIDEBAR_TAB',
  UPDATE_PREFERENCES: 'UPDATE_PREFERENCES',
  SET_ACTIVE_ROOT_FOLDERS: 'SET_ACTIVE_ROOT_FOLDERS',     // <-- NEW
  SET_ACTIVE_EXPANDED_NODES: 'SET_ACTIVE_EXPANDED_NODES', // <-- NEW
  
  // Item Order Actions
  SET_ITEM_ORDER: 'SET_ITEM_ORDER',
  UPDATE_ITEM_ORDER_FOR_PARENT: 'UPDATE_ITEM_ORDER_FOR_PARENT',
  REMOVE_FROM_ITEM_ORDER: 'REMOVE_FROM_ITEM_ORDER',

  // More granular root folder and expanded nodes actions
  ADD_ROOT_FOLDER: 'ADD_ROOT_FOLDER',
  REMOVE_ROOT_FOLDER: 'REMOVE_ROOT_FOLDER',
  TOGGLE_EXPANDED_NODE: 'TOGGLE_EXPANDED_NODE',

  // Explorer Sort Action
  SET_EXPLORER_SORT: 'SET_EXPLORER_SORT',
  
  // Editor state actions
  SET_CURSOR_POSITION: 'SET_CURSOR_POSITION',
  SET_SELECTIONS: 'SET_SELECTIONS',
  SET_SCROLL_POSITION: 'SET_SCROLL_POSITION',
  SET_UNSAVED_CHANGES: 'SET_UNSAVED_CHANGES',
  SET_EDITOR_FONT_SIZE: 'SET_EDITOR_FONT_SIZE',
  
  // Error state actions
  ADD_ERROR: 'ADD_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  
  // Loading state actions
  SET_LOADING: 'SET_LOADING',
  
  // Reset all state
  RESET_STATE: 'RESET_STATE',

  // Named Workspace State Actions
  SAVE_NAMED_WORKSPACE: 'SAVE_NAMED_WORKSPACE',
  REMOVE_NAMED_WORKSPACE: 'REMOVE_NAMED_WORKSPACE',
  RENAME_WORKSPACE: 'RENAME_WORKSPACE',  // <-- NEW ACTION for renaming
  SET_PENDING_WORKSPACE_LOAD: 'SET_PENDING_WORKSPACE_LOAD',
  CLEAR_PENDING_WORKSPACE_LOAD: 'CLEAR_PENDING_WORKSPACE_LOAD',

  // Active Named Workspace Actions <-- NEW
  SET_ACTIVE_NAMED_WORKSPACE: 'SET_ACTIVE_NAMED_WORKSPACE',
  CLEAR_ACTIVE_NAMED_WORKSPACE: 'CLEAR_ACTIVE_NAMED_WORKSPACE',
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
      // The payload should contain: { oldPath: string, updates: { path: string, name: string, ... } }
      return {
        ...state,
        openFiles: state.openFiles.map(file => {
          // Identify the file using the oldPath from the payload
          if (file.path === action.payload.oldPath) {
            // Apply all updates from the payload.updates object
            return { ...file, ...action.payload.updates };
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
    
    case ActionTypes.REORDER_OPEN_FILES:
      const { oldIndex, newIndex } = action.payload;
      // Ensure indices are valid (basic check)
      if (oldIndex < 0 || oldIndex >= state.openFiles.length || newIndex < 0 || newIndex >= state.openFiles.length) {
        console.warn("[AppStateContext] Invalid indices for REORDER_OPEN_FILES:", oldIndex, newIndex);
        return state;
      }
      // Manual array move implementation:
      const filesToMove = [...state.openFiles];
      const [movedItem] = filesToMove.splice(oldIndex, 1);
      filesToMove.splice(newIndex, 0, movedItem);
      return { ...state, openFiles: filesToMove };
    
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
    
    // --- NEW: Explorer UI state cases ---
    case ActionTypes.SET_ACTIVE_ROOT_FOLDERS:
      return {
        ...state,
        ui: {
          ...state.ui,
          activeRootFolders: action.payload,
        },
      };
    case ActionTypes.SET_ACTIVE_EXPANDED_NODES:
      return {
        ...state,
        ui: {
          ...state.ui,
          activeExpandedNodes: action.payload,
        },
      };
    // --- END: Explorer UI state cases ---

    // --- BEGIN: Item Order cases ---
    case ActionTypes.SET_ITEM_ORDER:
      return {
        ...state,
        ui: {
          ...state.ui,
          itemOrder: action.payload,
        },
      };
    case ActionTypes.UPDATE_ITEM_ORDER_FOR_PARENT:
      return {
        ...state,
        ui: {
          ...state.ui,
          itemOrder: {
            ...state.ui.itemOrder,
            [action.payload.parentPath]: action.payload.orderedPaths,
          },
        },
      };
    case ActionTypes.REMOVE_FROM_ITEM_ORDER:
      const newItemOrder = { ...state.ui.itemOrder };
      const { itemPath: pathToRemove, parentPath, isDirectory } = action.payload;

      if (newItemOrder[parentPath]) {
        newItemOrder[parentPath] = newItemOrder[parentPath].filter(
          p => p !== pathToRemove
        );
        if (newItemOrder[parentPath].length === 0) {
          delete newItemOrder[parentPath];
        }
      }
      // If it's a directory, also remove its own order key and potentially descendant keys
      if (isDirectory) {
        const keysToDelete = Object.keys(newItemOrder).filter(
          key => key === pathToRemove || key.startsWith(pathToRemove + '/')
        );
        keysToDelete.forEach(key => delete newItemOrder[key]);
      }
      return { ...state, ui: { ...state.ui, itemOrder: newItemOrder } };
    // --- END: Item Order cases ---

    // --- BEGIN: Granular Root Folder & Expanded Nodes cases ---
    case ActionTypes.ADD_ROOT_FOLDER:
      // Avoid duplicates
      if (state.ui.activeRootFolders.includes(action.payload)) {
        return state;
      }
      return {
        ...state,
        ui: {
          ...state.ui,
          activeRootFolders: [...state.ui.activeRootFolders, action.payload],
        },
      };
    case ActionTypes.REMOVE_ROOT_FOLDER:
      return {
        ...state,
        ui: {
          ...state.ui,
          activeRootFolders: state.ui.activeRootFolders.filter(p => p !== action.payload),
        },
      };
    case ActionTypes.TOGGLE_EXPANDED_NODE:
      return {
        ...state,
        ui: {
          ...state.ui,
          activeExpandedNodes: {
            ...state.ui.activeExpandedNodes,
            [action.payload]: !state.ui.activeExpandedNodes[action.payload],
          },
        },
      };
    // --- END: Granular Root Folder & Expanded Nodes cases ---
    
    // --- BEGIN: Explorer Sort case ---
    case ActionTypes.SET_EXPLORER_SORT:
      return {
        ...state,
        ui: {
          ...state.ui,
          preferences: {
            ...state.ui.preferences,
            explorerSortBy: action.payload.sortBy,
            explorerSortDirection: action.payload.direction,
          },
        },
      };
    // --- END: Explorer Sort case ---
    
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

    case ActionTypes.SET_EDITOR_FONT_SIZE:
      // Clamp font size between reasonable limits (e.g., 8px to 36px)
      const newSize = Math.max(8, Math.min(action.payload, 36));
      return {
        ...state,
        editor: {
          ...state.editor,
          fontSize: newSize,
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
      // Keep saved workspace states when resetting the rest
      return { ...initialState, savedWorkspaceStates: state.savedWorkspaceStates };

    // --- BEGIN: Named Workspace State cases ---
    case ActionTypes.SAVE_NAMED_WORKSPACE:
      return {
        ...state,
        savedWorkspaceStates: {
          ...state.savedWorkspaceStates,
          [action.payload.name]: action.payload.data,
        },
        activeNamedWorkspaceName: action.payload.name, // <-- Ensure the active workspace is set
      };
    case ActionTypes.REMOVE_NAMED_WORKSPACE:
      const newSavedStates = { ...state.savedWorkspaceStates };
      const removedName = action.payload.name || action.payload; // Support both object and string formats
      
      // If this is part of a rename, check if the workspace with this name still exists
      // If not, it may have already been removed or renamed in a previous operation
      const isRenameOperation = action.payload.isRename === true;
      if (isRenameOperation && !newSavedStates[removedName]) {
        console.log(`[AppStateContext] Workspace "${removedName}" already removed, skipping removal during rename.`);
        return state; // Don't modify state if this is a rename and the workspace is already gone
      }
      
      // Remove the workspace
      delete newSavedStates[removedName];
      
      // Check if the removed workspace was active
      const isRemovedActive = state.activeNamedWorkspaceName === removedName;
      
      return {
        ...state,
        savedWorkspaceStates: newSavedStates,
        // If we're removing the active workspace and it's not part of a rename, clear it
        activeNamedWorkspaceName: (isRemovedActive && !isRenameOperation) ? null : state.activeNamedWorkspaceName,
      };
    case ActionTypes.SET_PENDING_WORKSPACE_LOAD:
      return {
        ...state,
        pendingWorkspaceLoad: action.payload, // Payload is the state data to load
      };
    case ActionTypes.CLEAR_PENDING_WORKSPACE_LOAD:
      return {
        ...state,
        pendingWorkspaceLoad: null,
      };
    // --- END: Named Workspace State cases ---

    // --- BEGIN: Active Named Workspace cases --- <-- NEW
    case ActionTypes.SET_ACTIVE_NAMED_WORKSPACE:
      return {
        ...state,
        activeNamedWorkspaceName: action.payload, // Payload is the name of the active workspace
      };
    case ActionTypes.CLEAR_ACTIVE_NAMED_WORKSPACE:
      return {
        ...state,
        activeNamedWorkspaceName: null,
      };
    // --- END: Active Named Workspace cases ---

    // --- NEW: Case to handle renaming a workspace in a single atomic operation ---
    case ActionTypes.RENAME_WORKSPACE:
      const { oldName, newName, data } = action.payload;
      
      // Early validation
      if (!oldName || !newName || oldName === newName || !state.savedWorkspaceStates[oldName]) {
        console.warn(`[AppStateContext] Invalid rename operation: ${oldName} -> ${newName}`);
        return state;
      }
      
      // Check if the new name already exists
      if (state.savedWorkspaceStates[newName]) {
        console.warn(`[AppStateContext] Cannot rename: A workspace named "${newName}" already exists.`);
        return state;
      }
      
      // Create a new copy of the saved states
      const updatedStates = { ...state.savedWorkspaceStates };
      
      // Remove the old workspace
      delete updatedStates[oldName];
      
      // Add the workspace with the new name
      updatedStates[newName] = data;
      
      // Check if this workspace is the active one
      const isActive = state.activeNamedWorkspaceName === oldName;
      
      // Update localStorage directly to ensure atomic update
      try {
        localStorage.setItem('savedMdViewerWorkspaceStates', JSON.stringify(updatedStates));
        
        // Also update the active workspace name in localStorage if necessary
        if (isActive) {
          localStorage.setItem('lastActiveMdViewerWorkspaceName', newName);
        }
      } catch (e) {
        console.error("[AppStateContext] Failed to update workspace states in localStorage during rename:", e);
      }
      
      return {
        ...state,
        savedWorkspaceStates: updatedStates,
        // Update the active workspace name if necessary
        activeNamedWorkspaceName: isActive ? newName : state.activeNamedWorkspaceName,
      };
    // --- END: Rename workspace case ---

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
    let loadedState = { ...initial };
    try {
      // Load main app state
      const savedAppState = localStorage.getItem('markdown-viewer-app-state');
      if (savedAppState) {
        const parsedAppState = JSON.parse(savedAppState);
        // Merge carefully, avoid overwriting nested objects completely if structure changes
        loadedState = { 
          ...initial, 
          ...parsedAppState, 
          ui: { ...initial.ui, ...(parsedAppState.ui || {}) }, 
          editor: { ...initial.editor, ...(parsedAppState.editor || {}) },
          loading: { ...initial.loading, ...(parsedAppState.loading || {}) }
          // Exclude savedWorkspaceStates and pendingWorkspaceLoad from this merge
        };
      }

      // Load saved workspace states separately
      const savedWorkspaces = localStorage.getItem('savedMdViewerWorkspaceStates');
      if (savedWorkspaces) {
        const parsedWorkspaces = JSON.parse(savedWorkspaces);
        // Basic validation
        if (typeof parsedWorkspaces === 'object' && parsedWorkspaces !== null && !Array.isArray(parsedWorkspaces)) {
            loadedState.savedWorkspaceStates = parsedWorkspaces;
        } else {
            console.warn("Invalid format for saved workspace states in localStorage. Ignoring.");
        }
      }
      
    } catch (error) {
      console.error('Failed to load state from localStorage:', error);
      // Return initial state in case of error during parsing
      return initial;
    }
    // Ensure pending load is always null on initial load
    loadedState.pendingWorkspaceLoad = null; 
    return loadedState;
  });

  // Save state to localStorage when it changes
  useEffect(() => {
    try {
      // Separate main state from saved workspaces for persistence
      const { savedWorkspaceStates, pendingWorkspaceLoad, ...stateToSave } = state;
      
      // Save main application state
      localStorage.setItem('markdown-viewer-app-state', JSON.stringify(stateToSave));
      
      // Save the collection of named workspace states separately
      localStorage.setItem('savedMdViewerWorkspaceStates', JSON.stringify(savedWorkspaceStates || {}));

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
    
    // Otherwise, do a regular update
    dispatch({
      type: ActionTypes.UPDATE_OPEN_FILE,
      payload: { oldPath, updates }
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
  
  const setEditorFontSize = (size) => dispatch({ 
    type: ActionTypes.SET_EDITOR_FONT_SIZE, 
    payload: size 
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

  const reorderOpenFiles = (oldIndex, newIndex) => dispatch({ 
    type: ActionTypes.REORDER_OPEN_FILES, 
    payload: { oldIndex, newIndex } 
  });

  // --- NEW: Action creators for explorer UI state ---
  const setActiveRootFolders = (folderPaths) => dispatch({
    type: ActionTypes.SET_ACTIVE_ROOT_FOLDERS,
    payload: folderPaths
  });

  const setActiveExpandedNodes = (nodes) => dispatch({
    type: ActionTypes.SET_ACTIVE_EXPANDED_NODES,
    payload: nodes
  });

  // Item Order Action Creators
  const setItemOrder = (itemOrderMap) => dispatch({
    type: ActionTypes.SET_ITEM_ORDER,
    payload: itemOrderMap,
  });

  const updateItemOrderForParent = (parentPath, orderedPaths) => dispatch({
    type: ActionTypes.UPDATE_ITEM_ORDER_FOR_PARENT,
    payload: { parentPath, orderedPaths },
  });

  const removeFromItemOrder = (itemPath, parentPath, isDirectory) => dispatch({
    type: ActionTypes.REMOVE_FROM_ITEM_ORDER,
    payload: { itemPath, parentPath, isDirectory },
  });

  // Granular Root Folder & Expanded Nodes Action Creators
  const addRootFolder = (folderPath) => dispatch({
    type: ActionTypes.ADD_ROOT_FOLDER,
    payload: folderPath,
  });

  const removeRootFolder = (folderPath) => dispatch({
    type: ActionTypes.REMOVE_ROOT_FOLDER,
    payload: folderPath,
  });

  const toggleExpandedNode = (nodePath) => dispatch({
    type: ActionTypes.TOGGLE_EXPANDED_NODE,
    payload: nodePath,
  });
  
  // Explorer Sort Action Creator
  const setExplorerSort = (sortBy, direction) => dispatch({
    type: ActionTypes.SET_EXPLORER_SORT,
    payload: { sortBy, direction },
  });

  // Named Workspace Action Creators
  const saveNamedWorkspace = (workspaceName, workspaceData) => dispatch({
    type: ActionTypes.SAVE_NAMED_WORKSPACE,
    payload: { name: workspaceName, data: workspaceData },
  });

  const removeNamedWorkspace = (workspaceName, isRename = false) => dispatch({
    type: ActionTypes.REMOVE_NAMED_WORKSPACE,
    payload: { name: workspaceName, isRename }
  });

  const renameWorkspace = (oldName, newName, workspaceData) => dispatch({
    type: ActionTypes.RENAME_WORKSPACE,
    payload: { oldName, newName, data: workspaceData }
  });

  const loadNamedWorkspace = (workspaceData) => dispatch({ // Takes the data to load
    type: ActionTypes.SET_PENDING_WORKSPACE_LOAD,
    payload: workspaceData,
  });

  const clearPendingWorkspaceLoad = () => dispatch({
    type: ActionTypes.CLEAR_PENDING_WORKSPACE_LOAD,
  });

  // --- NEW: Action creators for active named workspace ---
  const setActiveNamedWorkspace = (workspaceName) => dispatch({
    type: ActionTypes.SET_ACTIVE_NAMED_WORKSPACE,
    payload: workspaceName,
  });

  const clearActiveNamedWorkspace = () => dispatch({
    type: ActionTypes.CLEAR_ACTIVE_NAMED_WORKSPACE,
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
        reorderOpenFiles,
        // UI actions
        togglePanel,
        setPanel,
        setSidebarTab,
        updatePreferences,
        setActiveRootFolders,
        setActiveExpandedNodes,
        // Item Order
        setItemOrder,
        updateItemOrderForParent,
        removeFromItemOrder,
        // Granular Root/Expanded
        addRootFolder,
        removeRootFolder,
        toggleExpandedNode,
        // Explorer Sort
        setExplorerSort,
        // Editor actions
        setCursorPosition,
        setSelections,
        setScrollPosition,
        setUnsavedChanges,
        setEditorFontSize,
        // Error actions
        addError,
        clearError,
        // Loading actions
        setLoading,
        // Reset
        resetState,
        // Named Workspaces
        saveNamedWorkspace,
        removeNamedWorkspace,
        renameWorkspace,
        loadNamedWorkspace,
        clearPendingWorkspaceLoad,
        // Active Named Workspace <-- NEW
        setActiveNamedWorkspace,
        clearActiveNamedWorkspace,
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
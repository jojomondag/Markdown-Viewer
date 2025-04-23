import path from 'path-browserify'; // retained for fallback in browser environment
import { joinPaths, getDirname, getBasename } from './pathUtils';

/**
 * Move a file or folder to a new location
 * @param {string} sourcePath - Path of the file/folder to move
 * @param {string} targetPath - Destination path
 * @param {boolean} isDirectory - Whether the item is a directory
 * @returns {Promise<boolean>} - Success status
 */
export const moveItem = async (sourcePath, targetPath, isDirectory) => {
  try {
    if (window.electron) {
      // Use Electron's IPC for file operations
      return await window.electron.moveItem(sourcePath, targetPath, isDirectory);
    } else {
      // For browser-based usage, we can't directly move files
      console.warn('File operations in browser mode are simulated and do not affect actual files');
      return true;
    }
  } catch (error) {
    console.error('Error moving item:', error);
    throw error;
  }
};

/**
 * Copy a file or folder to a new location
 * @param {string} sourcePath - Path of the file/folder to copy
 * @param {string} targetPath - Destination path
 * @param {boolean} isDirectory - Whether the item is a directory
 * @returns {Promise<boolean>} - Success status
 */
export const copyItem = async (sourcePath, targetPath, isDirectory) => {
  try {
    if (window.electron) {
      // Use Electron's IPC for file operations
      return await window.electron.copyItem(sourcePath, targetPath, isDirectory);
    } else {
      console.warn('File operations in browser mode are simulated and do not affect actual files');
      return true;
    }
  } catch (error) {
    console.error('Error copying item:', error);
    throw error;
  }
};

/**
 * Rename a file or folder
 * @param {string} sourcePath - Original path
 * @param {string} newName - New name (not path)
 * @param {boolean} isDirectory - Whether the item is a directory
 * @returns {Promise<boolean>} - Success status
 */
export const renameItem = async (sourcePath, newName, isDirectory) => {
  try {
    if (window.electron) {
      // Use Electron's IPC for file operations
      return await window.electron.renameItem(sourcePath, newName, isDirectory);
    } else {
      console.warn('File operations in browser mode are simulated and do not affect actual files');
      return true;
    }
  } catch (error) {
    console.error('Error renaming item:', error);
    throw error;
  }
};

/**
 * Checks if a drag and drop operation is valid
 * Prevents dropping an item onto itself or onto its descendant
 * 
 * @param {Object} sourceItem - The item being dragged
 * @param {Object} targetItem - The potential drop target
 * @returns {boolean} - Whether the drop is valid
 */
export const isValidDrop = (sourceItem, targetItem) => {
  // Can't drop onto self
  if (sourceItem.path === targetItem.path) {
    return false;
  }
  
  // Can't drop a folder onto its own descendant
  if (sourceItem.type === 'folder' && targetItem.path.startsWith(sourceItem.path + '/')) {
    return false;
  }
  
  return true;
};

/**
 * Creates the destination path for a drag and drop operation
 * 
 * @param {Object} sourceItem - The item being dragged
 * @param {Object} targetItem - The drop target
 * @returns {string} - The new path for the source item
 */
export const createDropDestination = (sourceItem, targetItem) => {
  // If dropping onto a folder, the new path is inside that folder
  if (targetItem.type === 'folder') {
    return joinPaths(targetItem.path, sourceItem.name);
  }
  
  // If dropping onto a file, the new path is in the same directory as that file
  const targetDir = getDirname(targetItem.path);
  return joinPaths(targetDir, sourceItem.name);
};

/**
 * Gets the parent directory path for a file or folder
 * 
 * @param {string} itemPath - The path of the file or folder
 * @returns {string} - The parent directory path
 */
export const getParentDir = (itemPath) => {
  return getDirname(itemPath);
};

/**
 * Extracts the name from a path
 * 
 * @param {string} itemPath - The path of the file or folder
 * @returns {string} - The name of the file or folder
 */
export const getNameFromPath = (itemPath) => {
  return getBasename(itemPath);
};

export default {
  moveItem,
  copyItem,
  renameItem,
  isValidDrop,
  createDropDestination,
  getParentDir,
  getNameFromPath
};
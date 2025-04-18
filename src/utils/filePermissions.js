/**
 * Utility functions for testing file system permissions
 */

/**
 * Test if the application has read access to a file
 * @param {string} filePath - Path to the file
 * @returns {Promise<{success: boolean, message: string}>} Result of the test
 */
export const testFileReadAccess = async (filePath) => {
  try {
    // In browser environments, use the File System Access API
    if (window.showOpenFilePicker) {
      try {
        // Try to get a file handle for reading
        const fileHandle = await window.open(filePath, { mode: 'read' });
        await fileHandle.getFile();
        return { 
          success: true, 
          message: 'Read permission granted for file' 
        };
      } catch (error) {
        return { 
          success: false, 
          message: `Cannot read file: ${error.message}` 
        };
      }
    } 
    // For Electron or other environments with Node.js fs access
    else if (window.electron) {
      const result = await window.electron.testFileReadAccess(filePath);
      return result;
    } 
    else {
      // Fallback for environments without direct file system access
      return { 
        success: false, 
        message: 'File system read access API not available in this environment' 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      message: `Error testing file read access: ${error.message}` 
    };
  }
};

/**
 * Test if the application has write access to a file
 * @param {string} filePath - Path to the file
 * @returns {Promise<{success: boolean, message: string}>} Result of the test
 */
export const testFileWriteAccess = async (filePath) => {
  try {
    // In browser environments, use the File System Access API
    if (window.showSaveFilePicker) {
      try {
        // Try to get a file handle for writing
        const fileHandle = await window.open(filePath, { mode: 'readwrite' });
        const writable = await fileHandle.createWritable();
        await writable.close();
        return { 
          success: true, 
          message: 'Write permission granted for file' 
        };
      } catch (error) {
        return { 
          success: false, 
          message: `Cannot write to file: ${error.message}` 
        };
      }
    } 
    // For Electron or other environments with Node.js fs access
    else if (window.electron) {
      const result = await window.electron.testFileWriteAccess(filePath);
      return result;
    } 
    else {
      // Fallback for environments without direct file system access
      return { 
        success: false, 
        message: 'File system write access API not available in this environment' 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      message: `Error testing file write access: ${error.message}` 
    };
  }
};

/**
 * Test if the application has read access to a directory
 * @param {string} dirPath - Path to the directory
 * @returns {Promise<{success: boolean, message: string}>} Result of the test
 */
export const testDirReadAccess = async (dirPath) => {
  try {
    // In browser environments, use the File System Access API
    if (window.showDirectoryPicker) {
      try {
        // Try to get a directory handle
        const dirHandle = await window.open(dirPath);
        // Try to list files in the directory
        let hasEntries = false;
        for await (const entry of dirHandle.values()) {
          hasEntries = true;
          break;
        }
        return { 
          success: true, 
          message: 'Read permission granted for directory' 
        };
      } catch (error) {
        return { 
          success: false, 
          message: `Cannot read directory: ${error.message}` 
        };
      }
    } 
    // For Electron or other environments with Node.js fs access
    else if (window.electron) {
      const result = await window.electron.testDirReadAccess(dirPath);
      return result;
    } 
    else {
      // Fallback for environments without direct file system access
      return { 
        success: false, 
        message: 'Directory read access API not available in this environment' 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      message: `Error testing directory read access: ${error.message}` 
    };
  }
};

/**
 * Test if the application has write access to a directory
 * @param {string} dirPath - Path to the directory
 * @returns {Promise<{success: boolean, message: string}>} Result of the test
 */
export const testDirWriteAccess = async (dirPath) => {
  try {
    // In browser environments, use the File System Access API
    if (window.showDirectoryPicker) {
      try {
        // Try to get a directory handle for writing
        const dirHandle = await window.open(dirPath, { mode: 'readwrite' });
        // Try to create a temporary file to test write permission
        const tempFileName = `.temp_${Date.now()}`;
        const fileHandle = await dirHandle.getFileHandle(tempFileName, { create: true });
        // Clean up - remove the temporary file
        await dirHandle.removeEntry(tempFileName);
        return { 
          success: true, 
          message: 'Write permission granted for directory' 
        };
      } catch (error) {
        return { 
          success: false, 
          message: `Cannot write to directory: ${error.message}` 
        };
      }
    } 
    // For Electron or other environments with Node.js fs access
    else if (window.electron) {
      const result = await window.electron.testDirWriteAccess(dirPath);
      return result;
    } 
    else {
      // Fallback for environments without direct file system access
      return { 
        success: false, 
        message: 'Directory write access API not available in this environment' 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      message: `Error testing directory write access: ${error.message}` 
    };
  }
};

/**
 * Comprehensive test of file system permissions for a given path
 * @param {string} path - Path to test
 * @param {boolean} isDirectory - Whether the path is a directory
 * @returns {Promise<{read: {success: boolean, message: string}, write: {success: boolean, message: string}}>} Test results
 */
export const testPermissions = async (path, isDirectory = false) => {
  const readTest = isDirectory 
    ? await testDirReadAccess(path)
    : await testFileReadAccess(path);
    
  const writeTest = isDirectory
    ? await testDirWriteAccess(path)
    : await testFileWriteAccess(path);
    
  return {
    read: readTest,
    write: writeTest
  };
};

export default {
  testFileReadAccess,
  testFileWriteAccess,
  testDirReadAccess,
  testDirWriteAccess,
  testPermissions
}; 
import React, { useState } from 'react';
import { IconShieldCheck, IconShieldX, IconFolder, IconRefresh, IconFile } from '@tabler/icons-react';
import useNotification from '../hooks/useNotification';
import { testPermissions } from '../utils/filePermissions';

const FilePermissionsPanel = ({ currentFile, currentFolder }) => {
  const [permissionsStatus, setPermissionsStatus] = useState({
    file: null,
    folder: null,
    lastChecked: null
  });
  const [isChecking, setIsChecking] = useState(false);
  const { showSuccess, showError, showInfo } = useNotification();

  // Test file permissions
  const checkFilePermissions = async (filePath) => {
    if (!filePath) {
      showError('No file selected');
      return;
    }

    setIsChecking(true);
    
    try {
      const results = await testPermissions(filePath, false);
      setPermissionsStatus(prev => ({
        ...prev,
        file: results,
        lastChecked: new Date()
      }));
      
      if (results.read.success && results.write.success) {
        showSuccess('File permissions: Read and write access granted');
      } else if (results.read.success) {
        showInfo('File permissions: Read-only access');
      } else {
        showError('File permissions: No access');
      }
    } catch (error) {
      console.error('Permission check error:', error);
      showError(`Error checking file permissions: ${error.message}`);
      setPermissionsStatus(prev => ({
        ...prev,
        file: {
          read: { success: false, message: error.message },
          write: { success: false, message: error.message }
        },
        lastChecked: new Date()
      }));
    } finally {
      setIsChecking(false);
    }
  };

  // Test folder permissions
  const checkFolderPermissions = async (folderPath) => {
    if (!folderPath) {
      showError('No folder selected');
      return;
    }

    setIsChecking(true);
    
    try {
      const results = await testPermissions(folderPath, true);
      setPermissionsStatus(prev => ({
        ...prev,
        folder: results,
        lastChecked: new Date()
      }));
      
      if (results.read.success && results.write.success) {
        showSuccess('Folder permissions: Read and write access granted');
      } else if (results.read.success) {
        showInfo('Folder permissions: Read-only access');
      } else {
        showError('Folder permissions: No access');
      }
    } catch (error) {
      console.error('Permission check error:', error);
      showError(`Error checking folder permissions: ${error.message}`);
      setPermissionsStatus(prev => ({
        ...prev,
        folder: {
          read: { success: false, message: error.message },
          write: { success: false, message: error.message }
        },
        lastChecked: new Date()
      }));
    } finally {
      setIsChecking(false);
    }
  };

  // Check both file and folder permissions
  const checkAllPermissions = async () => {
    if (currentFile) {
      await checkFilePermissions(currentFile.path);
    }
    
    if (currentFolder) {
      await checkFolderPermissions(currentFolder);
    }
  };

  // Render permission status
  const renderPermissionStatus = (status, type) => {
    if (!status) return null;
    
    return (
      <div className="mb-4 p-3 bg-surface-100 dark:bg-surface-800 rounded-md">
        <h4 className="text-sm font-medium mb-2 flex items-center">
          {type === 'file' ? (
            <>
              <IconFile size={16} className="mr-2 text-primary-500 dark:text-primary-400" />
              File Permissions
            </>
          ) : (
            <>
              <IconFolder size={16} className="mr-2 text-primary-500 dark:text-primary-400" />
              Folder Permissions
            </>
          )}
        </h4>
        
        <div className="space-y-2 text-xs">
          <div className={`flex items-center ${status.read.success ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400'}`}>
            {status.read.success ? (
              <IconShieldCheck size={16} className="mr-2" />
            ) : (
              <IconShieldX size={16} className="mr-2" />
            )}
            <div>
              <div className="font-medium">
                {status.read.success ? 'Read: ✓' : 'Read: ✗'}
              </div>
              <div className="text-surface-600 dark:text-surface-400">
                {status.read.message}
              </div>
            </div>
          </div>
          
          <div className={`flex items-center ${status.write.success ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400'}`}>
            {status.write.success ? (
              <IconShieldCheck size={16} className="mr-2" />
            ) : (
              <IconShieldX size={16} className="mr-2" />
            )}
            <div>
              <div className="font-medium">
                {status.write.success ? 'Write: ✓' : 'Write: ✗'}
              </div>
              <div className="text-surface-600 dark:text-surface-400">
                {status.write.message}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col p-4">
      <h3 className="text-lg font-medium mb-4">File System Permissions</h3>
      
      <div className="bg-surface-50 dark:bg-surface-900 p-3 rounded-md mb-4 text-sm">
        <p>This panel allows you to check file system permissions for the current file and folder.</p>
        {permissionsStatus.lastChecked && (
          <p className="text-xs text-surface-500 dark:text-surface-400 mt-2">
            Last checked: {permissionsStatus.lastChecked.toLocaleTimeString()}
          </p>
        )}
      </div>
      
      <div className="flex-grow overflow-auto">
        {permissionsStatus.file && renderPermissionStatus(permissionsStatus.file, 'file')}
        {permissionsStatus.folder && renderPermissionStatus(permissionsStatus.folder, 'folder')}
        
        {!permissionsStatus.file && !permissionsStatus.folder && (
          <div className="text-center text-surface-600 dark:text-surface-400 py-8">
            No permission checks performed yet.
            <br />
            Click the button below to check permissions.
          </div>
        )}
      </div>
      
      <div className="mt-4 flex gap-2">
        {currentFile && (
          <button
            className="flex-1 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-800 py-2 rounded-md flex items-center justify-center text-sm"
            onClick={() => checkFilePermissions(currentFile.path)}
            disabled={isChecking}
          >
            <IconFile size={16} className="mr-2" />
            Check File
          </button>
        )}
        
        {currentFolder && (
          <button
            className="flex-1 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-800 py-2 rounded-md flex items-center justify-center text-sm"
            onClick={() => checkFolderPermissions(currentFolder)}
            disabled={isChecking}
          >
            <IconFolder size={16} className="mr-2" />
            Check Folder
          </button>
        )}
        
        <button
          className="flex-1 bg-surface-200 dark:bg-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-300 dark:hover:bg-surface-600 py-2 rounded-md flex items-center justify-center text-sm"
          onClick={checkAllPermissions}
          disabled={isChecking || (!currentFile && !currentFolder)}
        >
          <IconRefresh size={16} className={`mr-2 ${isChecking ? 'animate-spin' : ''}`} />
          {isChecking ? 'Checking...' : 'Check All'}
        </button>
      </div>
    </div>
  );
};

export default FilePermissionsPanel; 
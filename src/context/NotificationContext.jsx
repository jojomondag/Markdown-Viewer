import React, { createContext, useContext, useCallback } from 'react';

// Default duration for notifications (in milliseconds)
export const DEFAULT_DURATION = 5000;

// Notification types
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
};

// Create the context
const NotificationContext = createContext(null);

// Custom hook to use the notification context
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  // Dummy functions that do nothing but preserve API
  const addNotification = useCallback(() => {
    return '0'; // Return a dummy ID
  }, []);

  const removeNotification = useCallback(() => {
    // Do nothing
  }, []);

  const showSuccess = useCallback(() => {
    // Do nothing
    return '0'; // Return a dummy ID
  }, []);

  const showError = useCallback(() => {
    // Do nothing
    return '0'; // Return a dummy ID 
  }, []);

  const showInfo = useCallback(() => {
    // Do nothing
    return '0'; // Return a dummy ID
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications: [],
        addNotification,
        removeNotification,
        showSuccess,
        showError,
        showInfo,
      }}
    >
      {children}
      {/* No notification container */}
    </NotificationContext.Provider>
  );
};

export default NotificationContext; 
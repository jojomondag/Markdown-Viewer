import React, { createContext, useContext, useState, useCallback } from 'react';
import Notification from '../components/Notification';

// Define notification types
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
};

// Create the context
const NotificationContext = createContext();

// Custom hook to use the notification context
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

// Notification provider component
export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  // Add a new notification
  const addNotification = useCallback((message, type = NOTIFICATION_TYPES.INFO, duration = 3000) => {
    const id = Date.now();
    
    setNotifications(prev => [...prev, { id, message, type, duration }]);
    
    // Auto-remove notification after duration
    if (duration !== 0) {
      setTimeout(() => {
        removeNotification(id);
      }, duration);
    }
    
    return id;
  }, []);

  // Show a success notification
  const showSuccess = useCallback((message, duration) => {
    return addNotification(message, NOTIFICATION_TYPES.SUCCESS, duration);
  }, [addNotification]);

  // Show an error notification
  const showError = useCallback((message, duration) => {
    return addNotification(message, NOTIFICATION_TYPES.ERROR, duration);
  }, [addNotification]);

  // Show an info notification
  const showInfo = useCallback((message, duration) => {
    return addNotification(message, NOTIFICATION_TYPES.INFO, duration);
  }, [addNotification]);

  // Remove a notification by ID
  const removeNotification = useCallback((id) => {
    setNotifications(prev => {
      // Mark the notification for removal (will trigger animation)
      return prev.map(notification => 
        notification.id === id 
          ? { ...notification, isExiting: true } 
          : notification
      );
      
      // The actual removal will happen in the Notification component after animation
    });
    
    // After animation duration, actually remove from state
    setTimeout(() => {
      setNotifications(prev => prev.filter(notification => notification.id !== id));
    }, 300); // Match animation duration
  }, []);

  // Value to be provided to consumers
  const value = {
    notifications,
    addNotification,
    showSuccess,
    showError,
    showInfo,
    removeNotification
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {notifications.map(notification => (
          <Notification
            key={notification.id}
            message={notification.message}
            type={notification.type}
            isExiting={notification.isExiting}
            onClose={() => removeNotification(notification.id)}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export default NotificationContext; 
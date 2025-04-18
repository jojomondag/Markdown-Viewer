import React, { createContext, useContext, useState, useCallback } from 'react';
import Notification from '../components/Notification';

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
  const [notifications, setNotifications] = useState([]);

  // Add a new notification
  const addNotification = useCallback((message, type = NOTIFICATION_TYPES.INFO, duration = DEFAULT_DURATION) => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type, duration }]);
    return id;
  }, []);

  // Remove a notification by id
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  // Shorthand functions for different notification types
  const showSuccess = useCallback((message, duration = DEFAULT_DURATION) => {
    return addNotification(message, NOTIFICATION_TYPES.SUCCESS, duration);
  }, [addNotification]);

  const showError = useCallback((message, duration = DEFAULT_DURATION) => {
    return addNotification(message, NOTIFICATION_TYPES.ERROR, duration);
  }, [addNotification]);

  const showInfo = useCallback((message, duration = DEFAULT_DURATION) => {
    return addNotification(message, NOTIFICATION_TYPES.INFO, duration);
  }, [addNotification]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        showSuccess,
        showError,
        showInfo,
      }}
    >
      {children}
      {/* Notification container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {notifications.map(notification => (
          <Notification
            key={notification.id}
            message={notification.message}
            type={notification.type}
            duration={notification.duration}
            onClose={() => removeNotification(notification.id)}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export default NotificationContext; 
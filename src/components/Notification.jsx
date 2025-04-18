import React, { useEffect, useState } from 'react';
import { IconX, IconCircleCheck, IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';
import { NOTIFICATION_TYPES, DEFAULT_DURATION } from '../context/NotificationContext';

const Notification = ({ message, type = NOTIFICATION_TYPES.INFO, duration = DEFAULT_DURATION, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    // Auto-hide the notification after the specified duration
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for fade-out animation before removing
    }, duration);
    
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  // Early exit if not visible
  if (!isVisible) return null;
  
  // Determine icon and color based on notification type
  const getTypeStyles = () => {
    switch (type) {
      case NOTIFICATION_TYPES.SUCCESS:
        return {
          icon: <IconCircleCheck size={20} />,
          bgColor: 'bg-green-100 dark:bg-green-900/30',
          textColor: 'text-green-800 dark:text-green-200',
          borderColor: 'border-green-500'
        };
      case NOTIFICATION_TYPES.ERROR:
        return {
          icon: <IconAlertCircle size={20} />,
          bgColor: 'bg-red-100 dark:bg-red-900/30',
          textColor: 'text-red-800 dark:text-red-200',
          borderColor: 'border-red-500'
        };
      case NOTIFICATION_TYPES.INFO:
      default:
        return {
          icon: <IconInfoCircle size={20} />,
          bgColor: 'bg-blue-100 dark:bg-blue-900/30',
          textColor: 'text-blue-800 dark:text-blue-200',
          borderColor: 'border-blue-500'
        };
    }
  };
  
  const { icon, bgColor, textColor, borderColor } = getTypeStyles();
  
  return (
    <div 
      className={`
        flex items-start p-3 rounded-md shadow-md border-l-4 
        ${borderColor} ${bgColor} ${textColor}
        transform transition-all duration-300 ease-in-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        max-w-md
      `}
    >
      <div className="flex-shrink-0 mr-2">
        {icon}
      </div>
      <div className="flex-1 mr-2">
        <p className="text-sm font-medium">{message}</p>
      </div>
      <button 
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 300);
        }}
        className="flex-shrink-0 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
      >
        <IconX size={16} />
      </button>
    </div>
  );
};

export default Notification; 
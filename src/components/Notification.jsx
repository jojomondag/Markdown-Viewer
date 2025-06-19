import React, { useState, useEffect } from 'react';
import { IconX, IconCheck, IconAlertTriangle, IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';

const Notification = ({ type = 'info', message, onClose, autoHide = true, duration = 3000 }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (autoHide) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 0); // Immediate close without animation
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [autoHide, duration, onClose]);

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          borderColor: 'border-l-green-500',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          textColor: 'text-green-800 dark:text-green-200',
          icon: <IconCheck className="text-green-500" size={20} />
        };
      case 'warning':
        return {
          borderColor: 'border-l-yellow-500',
          bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
          textColor: 'text-yellow-800 dark:text-yellow-200',
          icon: <IconAlertTriangle className="text-yellow-500" size={20} />
        };
      case 'error':
        return {
          borderColor: 'border-l-red-500',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          textColor: 'text-red-800 dark:text-red-200',
          icon: <IconAlertCircle className="text-red-500" size={20} />
        };
      default: // info
        return {
          borderColor: 'border-l-blue-500',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          textColor: 'text-blue-800 dark:text-blue-200',
          icon: <IconInfoCircle className="text-blue-500" size={20} />
        };
    }
  };

  const { borderColor, bgColor, textColor, icon } = getTypeStyles();

  return (
    <div 
      className={`
        flex items-start p-3 rounded-md shadow-md border-l-4 
        ${borderColor} ${bgColor} ${textColor}
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
          setTimeout(onClose, 0);
        }}
        className="flex-shrink-0 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
      >
        <IconX size={16} />
      </button>
    </div>
  );
};

export default Notification; 
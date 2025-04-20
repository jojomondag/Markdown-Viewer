import React from 'react';
import { Modal } from './modal';

/**
 * Generic confirmation dialog
 */
const ConfirmDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            type="button"
            className="px-4 py-2 border border-surface-300 dark:border-surface-600 rounded-md text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700"
            onClick={onClose}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isDanger 
                ? 'bg-error-500 hover:bg-error-600 text-white focus:ring-error-500' 
                : 'bg-primary-500 hover:bg-primary-600 text-white focus:ring-primary-500'
            }`}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </>
      }
    >
      <div className="py-2">
        <p className="text-surface-800 dark:text-surface-200">
          {message}
        </p>
      </div>
    </Modal>
  );
};

export { ConfirmDialog }; 
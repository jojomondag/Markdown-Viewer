import React, { useEffect } from 'react';

/**
 * AccessibilityHelper component enhances keyboard navigation and screen reader support
 * It adds a skip link for keyboard users to bypass navigation and adds ARIA roles
 */
const AccessibilityHelper = () => {
  // Set up keyboard focus trap for modal dialogs
  useEffect(() => {
    // Add a class to the body when a modal is open
    const handleModalStateChange = () => {
      const hasOpenModal = document.querySelector('[role="dialog"][aria-modal="true"]');
      if (hasOpenModal) {
        document.body.classList.add('modal-open');
      } else {
        document.body.classList.remove('modal-open');
      }
    };

    // Watch for changes in the DOM for modal dialogs
    const observer = new MutationObserver(handleModalStateChange);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <>
      {/* Skip to content link - hidden until focused */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-primary-500 focus:text-white"
      >
        Skip to main content
      </a>
      
      {/* Announce important updates to screen readers */}
      <div 
        id="sr-announcer" 
        className="sr-only" 
        role="status" 
        aria-live="polite"
        aria-atomic="true"
      />
    </>
  );
};

/**
 * Helper function to announce messages to screen readers
 * @param {string} message - Message to announce to screen readers
 */
export const announceToScreenReader = (message) => {
  const announcer = document.getElementById('sr-announcer');
  if (announcer) {
    announcer.textContent = message;
  }
};

/**
 * Helper function to focus first focusable element in a container
 * @param {HTMLElement} container - Container element to search for focusable elements
 */
export const focusFirstElement = (container) => {
  if (!container) return;
  
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  if (focusableElements.length > 0) {
    focusableElements[0].focus();
  }
};

/**
 * Helper function to set up keyboard trap in modal dialogs
 * @param {HTMLElement} modalElement - Modal element to trap focus within
 * @returns {Function} Cleanup function to remove event listeners
 */
export const setupFocusTrap = (modalElement) => {
  if (!modalElement) return () => {};
  
  const focusableElements = modalElement.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  if (focusableElements.length === 0) return () => {};
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  // Focus first element when modal opens
  firstElement.focus();
  
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };
  
  modalElement.addEventListener('keydown', handleKeyDown);
  
  return () => {
    modalElement.removeEventListener('keydown', handleKeyDown);
  };
};

export default AccessibilityHelper; 
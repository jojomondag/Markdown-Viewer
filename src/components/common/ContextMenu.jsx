import React, { useEffect, useRef } from 'react';

const ContextMenu = ({
  visible,
  x,
  y,
  items,
  onClose,
  menuClassName = "fixed z-50 rounded-md shadow-lg bg-white dark:bg-surface-800 ring-1 ring-black ring-opacity-5 focus:outline-none",
  itemClassName = "px-3 py-1 text-xs text-left text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded focus:outline-none",
  itemsContainerClassName = "py-1 px-1 flex flex-row gap-1",
  transform = "translate(-20px, -100%)" // Default transform to position menu relative to cursor
}) => {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('contextmenu', handleClickOutside, true); // Close on subsequent right-click
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside, true);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside, true);
    };
  }, [visible, onClose]);

  if (!visible || !items || items.length === 0) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className={menuClassName}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: transform,
      }}
      onClick={(e) => e.stopPropagation()} // Prevent click inside from closing if it propagates
    >
      <div className={itemsContainerClassName}>
        {items.map((item, index) => (
          <button
            key={item.label || index}
            className={`${itemClassName} ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={(e) => {
              if (item.disabled) return;
              e.stopPropagation(); // Prevent menu closing logic if we handle it here
              item.onClick(e);
              onClose(); // Close menu after action
            }}
            disabled={item.disabled}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ContextMenu; 
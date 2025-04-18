import React from "react";
import { IconChevronDown } from '@tabler/icons-react';

const Select = React.forwardRef(
  ({ 
    className = "", 
    options = [], 
    value, 
    onChange, 
    placeholder = "Select an option", 
    disabled = false,
    ...props 
  }, ref) => {
    return (
      <div className="relative">
        <select
          className={`
            flex h-10 w-full appearance-none rounded-md border border-surface-200 dark:border-surface-700 
            bg-white dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:cursor-not-allowed disabled:opacity-50
            ${className}
          `}
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          disabled={disabled}
          ref={ref}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <IconChevronDown 
          className="absolute right-3 top-2.5 h-5 w-5 pointer-events-none text-surface-500" 
        />
      </div>
    );
  }
);

Select.displayName = "Select";

export { Select }; 
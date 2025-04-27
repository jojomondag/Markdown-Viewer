import React, { useState } from "react";

const Tabs = ({ 
  children, 
  defaultValue, 
  value, 
  onValueChange,
  className = "",
  orientation = "horizontal", // or "vertical"
}) => {
  // Use controlled or uncontrolled state
  const [selectedTab, setSelectedTab] = useState(defaultValue);
  const activeTab = value !== undefined ? value : selectedTab;

  const handleTabChange = (newValue) => {
    if (value === undefined) {
      setSelectedTab(newValue);
    }
    if (onValueChange) {
      onValueChange(newValue);
    }
  };

  // Find the active content
  const activeContent = React.Children.toArray(children).find(
    (child) => child.props.value === activeTab
  )?.props.children;

  // Group children into tabs and content
  const tabsList = React.Children.toArray(children).map((child) => {
    if (child.type !== Tab) return null;
    
    const { value, label, icon: Icon } = child.props;
    const isActive = value === activeTab;
    
    return (
      <button
        key={value}
        role="tab"
        aria-selected={isActive}
        className={`
          flex items-center px-3 py-1.5 text-sm font-medium transition-colors
          ${isActive 
            ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 border-b-2 border-primary-500'
            : 'text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700'
          }
          ${orientation === "vertical" 
            ? "w-full justify-start border-l-2 border-b-0 rounded-none" 
            : "border-b-2 rounded-t-md"
          }
        `}
        onClick={() => handleTabChange(value)}
      >
        {Icon && <Icon size={16} className="mr-2" />}
        {label}
      </button>
    );
  });

  return (
    <div className={`flex flex-col ${className}`}>
      <div 
        role="tablist"
        className={`
          flex border-b border-surface-300 dark:border-surface-700
          ${orientation === "vertical" 
            ? "flex-col border-r border-b-0 w-48 flex-shrink-0" 
            : "flex-row"
          }
        `}
      >
        {tabsList}
      </div>
      <div className="tab-content p-4 flex-grow overflow-hidden">
        {activeContent}
      </div>
    </div>
  );
};

const Tab = ({ value, label, icon, children }) => {
  return children;
};

Tabs.Tab = Tab;

export { Tabs, Tab }; 
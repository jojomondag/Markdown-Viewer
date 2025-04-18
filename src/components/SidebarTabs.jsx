import React, { useState, useEffect } from 'react';
import { IconFolder, IconListTree, IconBell, IconBookmarks, IconSearch, IconBrush, IconFileExport, IconShield } from '@tabler/icons-react';

const SidebarTabs = ({ children, activeTab: externalActiveTab, onTabChange, ...rest }) => {
  const [internalActiveTab, setInternalActiveTab] = useState('files');
  
  // Sync with external state if provided
  useEffect(() => {
    if (externalActiveTab) {
      setInternalActiveTab(externalActiveTab);
    }
  }, [externalActiveTab]);

  const tabs = [
    { id: 'files', label: 'Files', icon: IconFolder },
    { id: 'search', label: 'Search', icon: IconSearch },
    { id: 'syntax', label: 'Syntax Tree', icon: IconListTree },
    { id: 'presets', label: 'Presets', icon: IconBookmarks },
    { id: 'styles', label: 'Styles', icon: IconBrush },
    { id: 'export', label: 'Export', icon: IconFileExport },
    { id: 'permissions', label: 'Permissions', icon: IconShield },
    { id: 'notifications', label: 'Notifications', icon: IconBell },
  ];
  
  // Handle tab change
  const handleTabChange = (tabId) => {
    setInternalActiveTab(tabId);
    if (onTabChange) {
      onTabChange(tabId);
    }
  };

  // Use internal state if no external state is provided
  const activeTab = externalActiveTab || internalActiveTab;

  // Filter children based on active tab
  const activeContent = React.Children.toArray(children).find(
    (child) => child.props.id === activeTab
  );

  return (
    <div className="h-full flex flex-col">
      <div className="tabs flex overflow-x-auto border-b border-surface-300 dark:border-surface-700">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`
                flex-shrink-0 flex items-center px-3 py-2 text-sm font-medium 
                ${
                  activeTab === tab.id
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                    : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
                }
              `}
              onClick={() => handleTabChange(tab.id)}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              <Icon size={18} className="mr-1" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
      <div className="tab-content flex-grow overflow-hidden">
        {activeContent}
      </div>
    </div>
  );
};

// Pane component for tab content
SidebarTabs.Pane = ({ children, id }) => {
  return (
    <div id={id} role="tabpanel" className="h-full overflow-auto">
      {children}
    </div>
  );
};

export default SidebarTabs; 
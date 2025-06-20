import React from 'react';
import MarkdownViewerIcon from './MarkdownViewerIcon';

const IconDemo = () => {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">MarkdownViewerIcon Demo</h2>
      
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Different Sizes</h3>
        <div className="flex items-center space-x-4">
          <MarkdownViewerIcon size={16} />
          <MarkdownViewerIcon size={24} />
          <MarkdownViewerIcon size={32} />
          <MarkdownViewerIcon size={48} />
        </div>
      </div>
      
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">With Custom Colors</h3>
        <div className="flex items-center space-x-4">
          <MarkdownViewerIcon size={32} className="text-blue-500" />
          <MarkdownViewerIcon size={32} className="text-green-500" />
          <MarkdownViewerIcon size={32} className="text-red-500" />
          <MarkdownViewerIcon size={32} className="text-purple-500" />
        </div>
      </div>
      
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">In Button Context</h3>
        <div className="space-x-2">
          <button className="flex items-center space-x-2 px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            <MarkdownViewerIcon size={16} />
            <span>Open Markdown</span>
          </button>
          
          <button className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded hover:bg-gray-50">
            <MarkdownViewerIcon size={16} className="text-gray-600" />
            <span>View Document</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IconDemo; 
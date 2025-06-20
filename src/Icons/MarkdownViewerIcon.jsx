import React from 'react';
import MarkdownViewerSvg from './MarkdownViewer.svg';

const MarkdownViewerIcon = ({ size = 24, className = '', ...props }) => {
  return (
    <MarkdownViewerSvg 
      width={size} 
      height={size} 
      className={className}
      {...props}
    />
  );
};

export default MarkdownViewerIcon; 
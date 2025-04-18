import React, { useState } from 'react';
import { IconFileDownload, IconFilePdf, IconFileText, IconSettings, IconPhoto } from '@tabler/icons-react';
import useNotification from '../hooks/useNotification';

const ExportPanel = ({ currentFile, markdownContent, onExport }) => {
  const [exportType, setExportType] = useState('html');
  const [exportOptions, setExportOptions] = useState({
    includeStyles: true,
    includeImages: true,
    pageSize: 'a4',
    orientation: 'portrait'
  });
  const [showOptions, setShowOptions] = useState(false);
  const { showSuccess, showError } = useNotification();

  const handleExportTypeChange = (type) => {
    setExportType(type);
  };

  const handleOptionChange = (option, value) => {
    setExportOptions(prev => ({
      ...prev,
      [option]: value
    }));
  };

  const handleExport = async () => {
    if (!currentFile || !markdownContent) {
      showError('No file selected for export');
      return;
    }

    try {
      if (onExport) {
        await onExport(exportType, exportOptions);
      } else {
        // Fallback implementation if onExport prop is not provided
        const fileName = currentFile.name.replace(/\.[^/.]+$/, '') + (exportType === 'pdf' ? '.pdf' : '.html');
        showSuccess(`Export to ${exportType.toUpperCase()} not implemented: ${fileName}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      showError(`Failed to export as ${exportType.toUpperCase()}: ${error.message}`);
    }
  };

  return (
    <div className="export-panel h-full flex flex-col">
      <div className="p-3 border-b border-surface-300 dark:border-surface-700 bg-surface-100 dark:bg-surface-800">
        <h3 className="text-sm font-medium mb-2 flex items-center">
          <IconFileDownload size={18} className="mr-2 text-primary-500 dark:text-primary-400" />
          Export Document
        </h3>
        
        {currentFile ? (
          <p className="text-xs text-surface-600 dark:text-surface-400 mb-2">
            Exporting: <span className="font-medium">{currentFile.name}</span>
          </p>
        ) : (
          <p className="text-xs text-warning-600 dark:text-warning-400 mb-2">
            No file selected
          </p>
        )}
      </div>

      <div className="flex-grow p-3 overflow-y-auto">
        <div className="export-types flex flex-col gap-2 mb-4">
          <h4 className="text-xs font-medium mb-1">Export Format</h4>
          
          <div className="flex gap-2">
            <button
              className={`flex-1 flex items-center justify-center p-2 rounded border ${
                exportType === 'html'
                  ? 'bg-primary-50 dark:bg-primary-900 border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400'
                  : 'border-surface-300 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800'
              }`}
              onClick={() => handleExportTypeChange('html')}
            >
              <IconFileText size={18} className="mr-2" />
              HTML
            </button>
            
            <button
              className={`flex-1 flex items-center justify-center p-2 rounded border ${
                exportType === 'pdf'
                  ? 'bg-primary-50 dark:bg-primary-900 border-primary-200 dark:border-primary-800 text-primary-600 dark:text-primary-400'
                  : 'border-surface-300 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800'
              }`}
              onClick={() => handleExportTypeChange('pdf')}
            >
              <IconFilePdf size={18} className="mr-2" />
              PDF
            </button>
          </div>
        </div>
        
        <div className="options-toggle mb-3">
          <button
            className="flex items-center text-xs w-full justify-between p-2 rounded border border-surface-300 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800"
            onClick={() => setShowOptions(!showOptions)}
          >
            <span className="flex items-center">
              <IconSettings size={14} className="mr-2" />
              Export Options
            </span>
            <span className="text-surface-500 dark:text-surface-400">
              {showOptions ? '▼' : '▶'}
            </span>
          </button>
        </div>
        
        {showOptions && (
          <div className="export-options p-2 mb-4 bg-surface-100 dark:bg-surface-800 rounded text-xs">
            <div className="option-item mb-2">
              <label className="flex items-center mb-1">
                <input
                  type="checkbox"
                  checked={exportOptions.includeStyles}
                  onChange={(e) => handleOptionChange('includeStyles', e.target.checked)}
                  className="mr-2"
                />
                Include Custom Styles
              </label>
              <p className="text-surface-500 dark:text-surface-400 text-xs ml-5">
                Apply custom CSS to the exported document
              </p>
            </div>
            
            <div className="option-item mb-2">
              <label className="flex items-center mb-1">
                <input
                  type="checkbox"
                  checked={exportOptions.includeImages}
                  onChange={(e) => handleOptionChange('includeImages', e.target.checked)}
                  className="mr-2"
                />
                Include Images
              </label>
              <p className="text-surface-500 dark:text-surface-400 text-xs ml-5">
                Download and embed images in the exported document
              </p>
            </div>
            
            {exportType === 'pdf' && (
              <>
                <div className="option-item mb-2">
                  <label className="block mb-1">Page Size</label>
                  <select
                    value={exportOptions.pageSize}
                    onChange={(e) => handleOptionChange('pageSize', e.target.value)}
                    className="w-full p-1 text-xs border border-surface-300 dark:border-surface-600 rounded bg-white dark:bg-surface-700"
                  >
                    <option value="a4">A4</option>
                    <option value="letter">Letter</option>
                    <option value="legal">Legal</option>
                  </select>
                </div>
                
                <div className="option-item mb-2">
                  <label className="block mb-1">Orientation</label>
                  <div className="flex gap-2">
                    <button
                      className={`flex-1 flex items-center justify-center p-1 rounded border ${
                        exportOptions.orientation === 'portrait'
                          ? 'bg-primary-50 dark:bg-primary-900 border-primary-200 dark:border-primary-800'
                          : 'border-surface-300 dark:border-surface-700'
                      }`}
                      onClick={() => handleOptionChange('orientation', 'portrait')}
                    >
                      Portrait
                    </button>
                    <button
                      className={`flex-1 flex items-center justify-center p-1 rounded border ${
                        exportOptions.orientation === 'landscape'
                          ? 'bg-primary-50 dark:bg-primary-900 border-primary-200 dark:border-primary-800'
                          : 'border-surface-300 dark:border-surface-700'
                      }`}
                      onClick={() => handleOptionChange('orientation', 'landscape')}
                    >
                      Landscape
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      
      <div className="export-actions p-3 border-t border-surface-300 dark:border-surface-700 bg-surface-100 dark:bg-surface-800">
        <button
          className="w-full p-2 bg-primary-600 hover:bg-primary-700 text-white rounded flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleExport}
          disabled={!currentFile || !markdownContent}
        >
          <IconFileDownload size={16} className="mr-2" />
          Export as {exportType.toUpperCase()}
        </button>
      </div>
    </div>
  );
};

export default ExportPanel; 
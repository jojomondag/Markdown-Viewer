import { marked } from 'marked';

/**
 * Service for exporting markdown content to various formats
 */
class ExportService {
  /**
   * Export markdown content as HTML
   * @param {string} markdown - The markdown content to export
   * @param {Object} options - Export options
   * @param {boolean} options.includeStyles - Whether to include custom styles
   * @param {boolean} options.includeImages - Whether to include images
   * @param {string} options.customCSS - Custom CSS to include
   * @returns {Promise<string>} - HTML content
   */
  async exportAsHTML(markdown, options = {}) {
    try {
      const { includeStyles = true, includeImages = true, customCSS = '' } = options;
      
      // Convert markdown to HTML
      const htmlContent = marked.parse(markdown);
      
      // Create a full HTML document
      let html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Markdown Export</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }
                pre {
                    background-color: #f5f5f5;
                    padding: 16px;
                    overflow: auto;
                    border-radius: 4px;
                }
                code {
                    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
                    background-color: rgba(0, 0, 0, 0.05);
                    padding: 0.2em 0.4em;
                    border-radius: 3px;
                }
                blockquote {
                    border-left: 4px solid #ddd;
                    padding-left: 16px;
                    color: #666;
                    margin-left: 0;
                }
                img {
                    max-width: 100%;
                    height: auto;
                }
                table {
                    border-collapse: collapse;
                    width: 100%;
                    margin-bottom: 16px;
                }
                table, th, td {
                    border: 1px solid #ddd;
                }
                th, td {
                    padding: 12px;
                    text-align: left;
                }
                th {
                    background-color: #f2f2f2;
                }
                a {
                    color: #0366d6;
                    text-decoration: none;
                }
                a:hover {
                    text-decoration: underline;
                }
                h1, h2, h3, h4, h5, h6 {
                    margin-top: 24px;
                    margin-bottom: 16px;
                    font-weight: 600;
                    line-height: 1.25;
                }
                h1 {
                    border-bottom: 1px solid #eaecef;
                    padding-bottom: 0.3em;
                }
                h2 {
                    border-bottom: 1px solid #eaecef;
                    padding-bottom: 0.3em;
                }
                /* Custom Styles */
                ${includeStyles && customCSS ? customCSS : ''}
            </style>
        </head>
        <body>
            <div class="markdown-content">
                ${htmlContent}
            </div>
        </body>
        </html>
      `;
      
      // Handle image embedding if required
      if (includeImages) {
        // This would ideally fetch and embed images using data URLs
        // For this example, we'll skip implementation details
        // In a real app, would require fetching each image and converting to base64
      }
      
      return html;
    } catch (error) {
      console.error('HTML export error:', error);
      throw new Error(`Failed to export as HTML: ${error.message}`);
    }
  }
  
  /**
   * Export markdown content as PDF
   * @param {string} markdown - The markdown content to export
   * @param {Object} options - Export options
   * @param {boolean} options.includeStyles - Whether to include custom styles
   * @param {boolean} options.includeImages - Whether to include images
   * @param {string} options.pageSize - PDF page size (a4, letter, etc.)
   * @param {string} options.orientation - PDF orientation (portrait, landscape)
   * @param {string} options.customCSS - Custom CSS to include
   * @returns {Promise<Blob>} - PDF blob
   */
  async exportAsPDF(markdown, options = {}) {
    try {
      // First export as HTML
      const html = await this.exportAsHTML(markdown, options);
      
      // Note: PDF generation typically requires a library like jsPDF or 
      // integration with an external service like html-pdf, PrintJS, or using 
      // the browser's native print-to-PDF capability.
      
      // For this implementation, we'll show how to use browser print functionality
      // This would typically be triggered from the UI
      
      // In an actual implementation, you would use proper PDF library here
      // or open the HTML in a new window and trigger print
      const printWindow = window.open('', '_blank');
      printWindow.document.write(html);
      printWindow.document.close();
      
      // Allow the window to load fully before printing
      return new Promise((resolve, reject) => {
        printWindow.onload = () => {
          try {
            // Configure print options
            const printOptions = {
              pageSize: options.pageSize || 'a4',
              orientation: options.orientation || 'portrait'
            };
            
            // In a real implementation with proper PDF library:
            // const pdfBlob = await generatePDF(html, printOptions);
            // return pdfBlob;
            
            // For this example, we're just simulating the output
            printWindow.print();
            printWindow.onafterprint = () => {
              printWindow.close();
              resolve(new Blob(['PDF data would be here'], { type: 'application/pdf' }));
            };
          } catch (error) {
            printWindow.close();
            reject(error);
          }
        };
      });
    } catch (error) {
      console.error('PDF export error:', error);
      throw new Error(`Failed to export as PDF: ${error.message}`);
    }
  }
  
  /**
   * Save content as a file and trigger download
   * @param {string|Blob} content - The content to save
   * @param {string} filename - The filename
   * @param {string} mimeType - The MIME type of the file
   */
  downloadFile(content, filename, mimeType = 'text/html') {
    try {
      // Create a blob from the content
      const blob = content instanceof Blob 
        ? content 
        : new Blob([content], { type: mimeType });
      
      // Create a URL for the blob
      const url = URL.createObjectURL(blob);
      
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      
      // Append the link to the document
      document.body.appendChild(link);
      
      // Trigger the download
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }
}

export default new ExportService(); 
import React, { useMemo, useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react';
import { marked } from 'marked';

// Configure marked options with custom renderer for media
const renderer = new marked.Renderer();

// Custom image rendering with lazy loading and lightbox capability
renderer.image = function(href, title, text) {
  return `
    <div class="image-container">
      <img 
        src="${href}" 
        alt="${text || ''}" 
        title="${title || text || ''}" 
        class="markdown-image" 
        loading="lazy" 
        data-lightbox="${href}"
        onclick="if(this.parentNode.classList.contains('image-container')) { this.parentNode.classList.toggle('expanded'); }"
      />
      ${text ? `<figcaption>${text}</figcaption>` : ''}
    </div>
  `;
};

// Custom link rendering to handle video and audio links
renderer.link = function(href, title, text) {
  // Check if the link is a video file
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
  const isVideo = videoExtensions.some(ext => href?.toLowerCase().endsWith(ext));
  
  // Check if the link is an audio file
  const audioExtensions = ['.mp3', '.wav', '.ogg', '.aac'];
  const isAudio = audioExtensions.some(ext => href?.toLowerCase().endsWith(ext));
  
  // Check if it's a YouTube or Vimeo link
  const isYouTube = href?.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  const isVimeo = href?.match(/(?:vimeo\.com\/)([0-9]+)/);
  
  if (isVideo) {
    return `
      <div class="video-container">
        <video controls preload="metadata" class="markdown-video">
          <source src="${href}" type="video/${href.split('.').pop()}">
          ${text || 'Your browser does not support the video tag.'}
        </video>
      </div>
    `;
  } else if (isAudio) {
    return `
      <div class="audio-container">
        <audio controls class="markdown-audio">
          <source src="${href}" type="audio/${href.split('.').pop()}">
          ${text || 'Your browser does not support the audio tag.'}
        </audio>
      </div>
    `;
  } else if (isYouTube && isYouTube[1]) {
    const youtubeId = isYouTube[1];
    return `
      <div class="youtube-container">
        <iframe 
          width="560" 
          height="315" 
          src="https://www.youtube.com/embed/${youtubeId}" 
          title="${title || text || 'YouTube video'}" 
          frameborder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowfullscreen
          class="markdown-embed"
        ></iframe>
      </div>
    `;
  } else if (isVimeo && isVimeo[1]) {
    const vimeoId = isVimeo[1];
    return `
      <div class="vimeo-container">
        <iframe 
          src="https://player.vimeo.com/video/${vimeoId}" 
          width="560" 
          height="315" 
          frameborder="0" 
          allow="autoplay; fullscreen; picture-in-picture" 
          allowfullscreen
          class="markdown-embed"
        ></iframe>
      </div>
    `;
  } else {
    // Regular link
    return `<a href="${href}" title="${title || ''}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  }
};

// Configure marked options
marked.setOptions({
  breaks: true,        // Convert \n to <br>
  gfm: true,           // GitHub Flavored Markdown
  headerIds: true,     // Generate IDs for headings
  mangle: false,       // Don't escape HTML
  sanitize: false,     // Don't sanitize HTML
  renderer: renderer   // Use our custom renderer
});

// Zoom levels in percentage
const ZOOM_LEVELS = [50, 67, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300];
const DEFAULT_ZOOM_INDEX = 4; // 100%
const MIN_ZOOM_INDEX = 0;
const MAX_ZOOM_INDEX = ZOOM_LEVELS.length - 1;

// Function to handle lightbox interactions
const addLightboxFunctionality = (container) => {
  if (!container) return;
  
  // Find all images
  const images = container.querySelectorAll('img.markdown-image');
  
  // Add click listener for lightbox functionality
  images.forEach(img => {
    img.addEventListener('click', (e) => {
      // Toggle expanded state for the image container
      const container = e.target.closest('.image-container');
      if (container) {
        container.classList.toggle('expanded');
      }
    });
  });
};

const MarkdownPreview = forwardRef(({ 
  content, 
  onScroll, 
  customCSS = '',
  inScrollSync = false,
  scrollSource = null
}, ref) => {
  // Create ref for the preview container
  const previewRef = useRef(null);
  
  // State for zoom level
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const currentZoom = ZOOM_LEVELS[zoomIndex];
  
  // State for lightbox
  const [lightboxImage, setLightboxImage] = useState(null);
  
  // Effect to set up lightbox functionality after content changes
  useEffect(() => {
    addLightboxFunctionality(previewRef.current);
  }, [content]);
  
  // Expose methods to parent components
  useImperativeHandle(ref, () => ({
    // Method to scroll to a specific percentage of the content
    scrollToPosition: (scrollPercentage) => {
      if (previewRef.current) {
        const { scrollHeight, clientHeight } = previewRef.current;
        const maxScrollTop = scrollHeight - clientHeight;
        const targetScrollTop = maxScrollTop * scrollPercentage;
        
        // Scroll to the calculated position
        previewRef.current.scrollTop = targetScrollTop;
        
        // Store the position for future restorations
        previewRef.current._lastScrollPosition = targetScrollTop;
        
        // Set up an interval to ensure scroll position is maintained
        const checkScrollInterval = setInterval(() => {
          if (previewRef.current && Math.abs(previewRef.current.scrollTop - targetScrollTop) > 5) {
            // If position changed significantly, reset it
            previewRef.current.scrollTop = targetScrollTop;
          }
        }, 50);
        
        // Clear the interval after a reasonable time
        setTimeout(() => {
          clearInterval(checkScrollInterval);
          
          // Final check before giving up
          if (previewRef.current && Math.abs(previewRef.current.scrollTop - targetScrollTop) > 5) {
            previewRef.current.scrollTop = targetScrollTop;
          }
        }, 250);
      }
    },
    
    // Get current scroll information
    getScrollInfo: () => {
      if (previewRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = previewRef.current;
        const maxScrollTop = scrollHeight - clientHeight;
        const scrollPercentage = maxScrollTop > 0 ? scrollTop / maxScrollTop : 0;
        
        return {
          scrollTop,
          scrollHeight,
          clientHeight,
          scrollPercentage
        };
      }
      return null;
    },
    
    // Get the DOM element
    getElement: () => previewRef.current,
    
    // Zoom methods
    zoomIn: () => {
      setZoomIndex(prevIndex => 
        prevIndex < MAX_ZOOM_INDEX ? prevIndex + 1 : prevIndex
      );
      return ZOOM_LEVELS[zoomIndex < MAX_ZOOM_INDEX ? zoomIndex + 1 : zoomIndex];
    },
    
    zoomOut: () => {
      setZoomIndex(prevIndex => 
        prevIndex > MIN_ZOOM_INDEX ? prevIndex - 1 : prevIndex
      );
      return ZOOM_LEVELS[zoomIndex > MIN_ZOOM_INDEX ? zoomIndex - 1 : zoomIndex];
    },
    
    resetZoom: () => {
      setZoomIndex(DEFAULT_ZOOM_INDEX);
      return ZOOM_LEVELS[DEFAULT_ZOOM_INDEX];
    },
    
    setZoomLevel: (zoomPercent) => {
      const nearestIndex = ZOOM_LEVELS.findIndex(level => level >= zoomPercent);
      const newIndex = nearestIndex === -1 ? MAX_ZOOM_INDEX : nearestIndex;
      setZoomIndex(newIndex);
      return ZOOM_LEVELS[newIndex];
    },
    
    getZoomLevel: () => ZOOM_LEVELS[zoomIndex],
    
    // Print the preview content
    print: () => {
      const printWindow = window.open('', '_blank');
      
      // Get the current content HTML
      const content = previewRef.current.innerHTML;
      
      // Create a styled HTML document for printing
      const printContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Markdown Print</title>
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
              font-family: monospace;
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
            
            h1, h2, h3, h4, h5, h6 {
              margin-top: 24px;
              margin-bottom: 16px;
              font-weight: 600;
              line-height: 1.25;
            }
            
            h1 {
              font-size: 2em;
              border-bottom: 1px solid #eaecef;
              padding-bottom: 0.3em;
            }
            
            h2 {
              font-size: 1.5em;
              border-bottom: 1px solid #eaecef;
              padding-bottom: 0.3em;
            }
            
            hr {
              height: 1px;
              background-color: #ddd;
              border: none;
              margin: 24px 0;
            }
            
            /* Custom styles for print */
            @media print {
              body {
                font-size: 12pt;
              }
              
              pre, code {
                font-size: 11pt;
              }
              
              a {
                text-decoration: underline;
                color: #000;
              }
              
              h1 {
                font-size: 22pt;
              }
              
              h2 {
                font-size: 18pt;
              }
              
              h3 {
                font-size: 15pt;
              }
            }
          </style>
        </head>
        <body>
          <div class="markdown-print">
            ${content}
          </div>
          <script>
            // Auto-print when the page is loaded
            window.onload = function() {
              window.print();
              // Close the window after printing (some browsers may not do this automatically)
              setTimeout(function() {
                window.close();
              }, 500);
            };
          </script>
        </body>
        </html>
      `;
      
      printWindow.document.write(printContent);
      printWindow.document.close();
    }
  }));
  
  // Handle scroll events in the preview
  const handleScroll = (e) => {
    if (onScroll && previewRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = previewRef.current;
      const maxScrollTop = scrollHeight - clientHeight;
      const scrollPercentage = maxScrollTop > 0 ? scrollTop / maxScrollTop : 0;
      
      // Only track and sync meaningful scroll positions (not near zero)
      // This prevents conflicting with editor when there are resets
      if (scrollTop > 5 || (scrollPercentage > 0.01 && scrollHeight > 100)) {
        // Track the last scroll position
        previewRef.current._lastScrollPosition = scrollTop;
        
        onScroll(scrollPercentage);
      }
    }
  };
  
  // Add effect to restore scroll position after content changes
  useEffect(() => {
    // After content changes, try to restore the scroll position if we have one
    if (previewRef.current && previewRef.current._lastScrollPosition) {
      const lastPosition = previewRef.current._lastScrollPosition;
      
      // Only apply if we were meaningfully scrolled
      if (lastPosition > 10) {
        setTimeout(() => {
          if (previewRef.current) {
            previewRef.current.scrollTop = lastPosition;
          }
        }, 50);
      }
    }
  }, [content]);
  
  // Handle zoom with keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle if preview is focused or in viewport
      if (!previewRef.current) return;
      
      // Check if the preview is in the viewport
      const rect = previewRef.current.getBoundingClientRect();
      const isInViewport = 
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth;
        
      if (!isInViewport && document.activeElement !== previewRef.current) return;
      
      // Zoom in: Ctrl/Cmd + Plus
      if ((e.ctrlKey || e.metaKey) && e.key === '=') {
        e.preventDefault();
        setZoomIndex(prevIndex => 
          prevIndex < MAX_ZOOM_INDEX ? prevIndex + 1 : prevIndex
        );
      }
      
      // Zoom out: Ctrl/Cmd + Minus
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        setZoomIndex(prevIndex => 
          prevIndex > MIN_ZOOM_INDEX ? prevIndex - 1 : prevIndex
        );
      }
      
      // Reset zoom: Ctrl/Cmd + 0
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setZoomIndex(DEFAULT_ZOOM_INDEX);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Memoize the parsed HTML to avoid unnecessary rendering
  const html = useMemo(() => {
    return content ? marked.parse(content) : '';
  }, [content]);

  return (
    <>
      <div 
        ref={previewRef}
        className="markdown-preview h-full overflow-auto p-3 prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-700 rounded"
        style={{ 
          fontSize: `${currentZoom}%`, 
          lineHeight: 1.6 
        }}
        dangerouslySetInnerHTML={{ __html: html }}
        onScroll={handleScroll}
        tabIndex={0} // Make the preview focusable for keyboard events
      />
      
      {/* Add custom CSS for media elements */}
      <style dangerouslySetInnerHTML={{
        __html: `
        /* Image container styling */
        .image-container {
          display: inline-block;
          margin: 0.5rem 0;
          position: relative;
          max-width: 100%;
          transition: all 0.3s ease;
        }
        
        .image-container.expanded {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.8);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
          padding: 2rem;
        }
        
        .image-container.expanded img {
          max-width: 90%;
          max-height: 90%;
          margin: auto;
          object-fit: contain;
          cursor: zoom-out;
          box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
        }
        
        .image-container img {
          max-width: 100%;
          height: auto;
          cursor: zoom-in;
        }
        
        .image-container figcaption {
          text-align: center;
          font-style: italic;
          margin-top: 0.5rem;
        }
        
        .image-container.expanded figcaption {
          position: absolute;
          bottom: 1rem;
          left: 0;
          width: 100%;
          text-align: center;
          color: white;
          background: rgba(0, 0, 0, 0.5);
          padding: 0.5rem;
        }
        
        /* Video container styling */
        .video-container {
          position: relative;
          padding-bottom: 56.25%; /* 16:9 aspect ratio */
          height: 0;
          overflow: hidden;
          max-width: 100%;
          margin: 1rem 0;
        }
        
        .video-container video,
        .video-container iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
        
        /* Audio container styling */
        .audio-container {
          width: 100%;
          margin: 1rem 0;
        }
        
        .audio-container audio {
          width: 100%;
        }
        
        /* YouTube and Vimeo container styling */
        .youtube-container,
        .vimeo-container {
          position: relative;
          padding-bottom: 56.25%; /* 16:9 aspect ratio */
          height: 0;
          overflow: hidden;
          max-width: 100%;
          margin: 1rem 0;
        }
        
        .youtube-container iframe,
        .vimeo-container iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
        
        /* Custom CSS applied by user */
        ${customCSS}
      `}} />
    </>
  );
});

MarkdownPreview.displayName = 'MarkdownPreview';

export default MarkdownPreview; 
import React, { useMemo, useRef, useImperativeHandle, forwardRef, useState, useEffect } from 'react';
import { marked } from 'marked';
// Assuming path functions are available (e.g., from preload or bundled)
// If not, adjust access method (e.g., window.api.path.resolve)
// const path = require('path'); 

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
  // *** ADD CHECK: Ensure href is a string before processing ***
  if (typeof href !== 'string') {
    // If href is not a string, just render the text content safely.
    // You might want to log a warning here if needed.
    console.warn(`[MarkdownPreview Renderer] Encountered non-string href:`, href, `for text:`, text);
    // Render the text without a link tag, or use a span if preferred
    return text || ''; 
  }

  // Check if the link is a video file
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
  const isVideo = videoExtensions.some(ext => href.toLowerCase().endsWith(ext));
  
  // Check if the link is an audio file
  const audioExtensions = ['.mp3', '.wav', '.ogg', '.aac'];
  const isAudio = audioExtensions.some(ext => href.toLowerCase().endsWith(ext));
  
  // Check if it's a YouTube or Vimeo link
  const isYouTube = href.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  const isVimeo = href.match(/(?:vimeo\.com\/)([0-9]+)/);
  
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
    // Regular link - **REMOVED onclick here**
    // The event listener below will handle clicks.
    return `<a 
              href="${href}" 
              title="${title || ''}" 
            >
              ${text}
            </a>`;
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
  scrollSource = null,
  currentFilePath
}, ref) => {
  // Create ref for the preview container
  const previewRef = useRef(null);
  
  // State for zoom level
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const currentZoom = ZOOM_LEVELS[zoomIndex];
  
  // State for lightbox
  const [lightboxImage, setLightboxImage] = useState(null);
  
  // Effect to set up lightbox and link click handler
  useEffect(() => {
    const container = previewRef.current;
    if (!container) return;

    // --- Lightbox Setup (existing) ---
    const images = container.querySelectorAll('img.markdown-image');
    const imageClickHandler = (e) => {
      const imgContainer = e.target.closest('.image-container');
      if (imgContainer) {
        imgContainer.classList.toggle('expanded');
      }
    };
    images.forEach(img => {
      img.addEventListener('click', imageClickHandler);
    });

    // --- Link Click Handler Setup --- 
    const linkClickHandler = (event) => {
        // Find the link element
        const link = event.target.closest('a[href]');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        // Check if we're in Electron
        const isElectron = !!(window.api || window.electronAPI);
        
        // For regular web mode, allow default behavior for http(s) links
        if (!isElectron && (href.startsWith('http') || href.startsWith('https') || href.startsWith('www'))) {
            // Let the browser handle it naturally
            return;
        }
        
        // Prevent default for Electron or special links
        event.preventDefault();

        try {
            let urlToOpen = href;
            let isExternal = false;

            // Check if it's an external link (http/https)
            if (href.startsWith('http://') || href.startsWith('https://')) {
                isExternal = true;
            } 
            // Check if it starts with www.
            else if (href.startsWith('www.')) {
                isExternal = true;
                urlToOpen = 'https://' + href; // Prepend https://
            }

            if (isExternal) {
                // Try multiple ways to open the link
                console.log(`External link detected: ${urlToOpen}`);
                if (window.api && typeof window.api.openExternalLink === 'function') {
                    console.log(`Using window.api.openExternalLink to open URL`);
                    window.api.openExternalLink(urlToOpen)
                        .then(result => console.log(`openExternalLink result:`, result))
                        .catch(err => console.error(`openExternalLink error:`, err));
                } else if (window.electronAPI && typeof window.electronAPI.openExternalLink === 'function') {
                    console.log(`Using window.electronAPI.openExternalLink to open URL`);
                    window.electronAPI.openExternalLink(urlToOpen)
                        .then(result => console.log(`electronAPI.openExternalLink result:`, result))
                        .catch(err => console.error(`electronAPI.openExternalLink error:`, err));
                } else {
                    // Fallback to window.open with _blank target
                    console.log("Using fallback method to open URL:", urlToOpen);
                    const newWindow = window.open(urlToOpen, '_blank', 'noopener,noreferrer');
                    if (newWindow) newWindow.opener = null; // Security best practice
                }
            } 
            // Check if it's likely a file path
            else if (currentFilePath && !href.startsWith('#')) {
                // Try to resolve the path if path API is available
                let absolutePath = href;
                
                if (window.api?.pathDirname && window.api?.pathResolve) {
                    const currentDir = window.api.pathDirname(currentFilePath);
                    absolutePath = window.api.pathResolve(currentDir, href);
                }
                
                // Try multiple ways to open the file
                if (window.api && typeof window.api.openFile === 'function') {
                    window.api.openFile(absolutePath);
                } else if (window.electronAPI && typeof window.electronAPI.openFile === 'function') {
                    window.electronAPI.openFile(absolutePath);
                } else if (!isElectron) {
                    // For web mode, either try to navigate to the file or show a message
                    console.log(`Web mode - navigating to file path: ${href}`);
                    window.location.href = href;
                } else {
                    console.warn(`Unable to open file: ${absolutePath} - API not available`);
                }
            } else if (href.startsWith('#')) {
                // Handle anchor links within the document
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth' });
                }
            } else {
                console.warn(`Unhandled link type or missing currentFilePath: ${href}`);
            }
        } catch (error) {
            console.error(`Error handling link click for ${href}:`, error);
            
            // Last resort fallback - try regular navigation
            try {
                if (href.startsWith('http') || href.startsWith('www')) {
                    const urlToOpen = href.startsWith('www') ? 'https://' + href : href;
                    window.open(urlToOpen, '_blank', 'noopener,noreferrer');
                }
            } catch (fallbackError) {
                console.error('Fallback navigation also failed:', fallbackError);
            }
        }
    };

    container.addEventListener('click', linkClickHandler);

    // Cleanup function
    return () => {
      images.forEach(img => {
        img.removeEventListener('click', imageClickHandler);
      });
      container.removeEventListener('click', linkClickHandler);
    };
  }, [content, currentFilePath]); // Re-run if content or current file path changes
  
  // Expose methods to parent components
  useImperativeHandle(ref, () => ({
    // Scroll to a specific position
    scrollToPosition: (scrollPercentage) => {
      if (!previewRef.current) return;
      
      try {
        const container = previewRef.current;
        const totalHeight = container.scrollHeight - container.clientHeight;
        const targetPosition = Math.max(0, Math.min(totalHeight, totalHeight * scrollPercentage));
        
        // Set scrolling flag to prevent feedback loops
        isScrollingRef.current = true;
        
        // Scroll to position
        container.scrollTop = targetPosition;
        
        // After a delay, release the scrolling lock
        setTimeout(() => {
          isScrollingRef.current = false;
        }, 100);
      } catch (error) {
        console.error('Error scrolling preview:', error);
        isScrollingRef.current = false;
      }
    },
    
    // Get scroll information
    getScrollInfo: () => {
      if (previewRef.current) {
        const container = previewRef.current;
        const scrollPercentage = container.scrollTop / (container.scrollHeight - container.clientHeight);
        return {
          scrollPercentage: isNaN(scrollPercentage) ? 0 : scrollPercentage,
          scrollTop: container.scrollTop,
          scrollHeight: container.scrollHeight,
          clientHeight: container.clientHeight
        };
      }
      return { scrollPercentage: 0, scrollTop: 0, scrollHeight: 0, clientHeight: 0 };
    },
    
    // Get preview container element
    getContainer: () => previewRef.current,
    
    // Get current zoom level
    getZoom: () => currentZoom,
    
    // Set zoom level by index
    setZoomByIndex: (index) => {
      const newIndex = Math.max(MIN_ZOOM_INDEX, Math.min(MAX_ZOOM_INDEX, index));
      setZoomIndex(newIndex);
      return ZOOM_LEVELS[newIndex];
    },
    
    // Increase zoom level
    zoomIn: () => {
      if (zoomIndex < MAX_ZOOM_INDEX) {
        setZoomIndex(zoomIndex + 1);
        return ZOOM_LEVELS[zoomIndex + 1];
      }
      return currentZoom;
    },
    
    // Decrease zoom level
    zoomOut: () => {
      if (zoomIndex > MIN_ZOOM_INDEX) {
        setZoomIndex(zoomIndex - 1);
        return ZOOM_LEVELS[zoomIndex - 1];
      }
      return currentZoom;
    },
    
    // Reset zoom to default
    resetZoom: () => {
      setZoomIndex(DEFAULT_ZOOM_INDEX);
      return ZOOM_LEVELS[DEFAULT_ZOOM_INDEX];
    },
    
    // Force a refresh of the content
    refreshContent: () => {
      // Use a state update hack to force re-render
      if (previewRef.current) {
        try {
          // First force a reflow
          previewRef.current.style.display = 'none';
          previewRef.current.offsetHeight; // Forces a reflow
          
          // Then restore display and force another reflow
          setTimeout(() => {
            if (previewRef.current) {
              previewRef.current.style.display = '';
              previewRef.current.offsetHeight; // Forces another reflow
              
              // If there are images, reload them
              const images = previewRef.current.querySelectorAll('img');
              images.forEach(img => {
                const src = img.getAttribute('src');
                if (src) {
                  img.setAttribute('src', src + '?t=' + new Date().getTime());
                }
              });
            }
          }, 10);
        } catch (error) {
          console.error('Error refreshing preview content:', error);
        }
      }
    },
    
    // Force layout recalculation
    refreshLayout: () => {
      if (previewRef.current) {
        try {
          // Force a reflow by accessing offsetHeight
          const height = previewRef.current.offsetHeight;
          
          // Re-apply the zoom transformations to trigger a recalculation
          const currentStyle = previewRef.current.style.transform;
          previewRef.current.style.transform = 'none';
          
          // Force reflow again
          previewRef.current.offsetHeight;
          
          // Restore the transform
          setTimeout(() => {
            if (previewRef.current) {
              previewRef.current.style.transform = currentStyle;
            }
          }, 10);
        } catch (error) {
          console.error('Error refreshing preview layout:', error);
        }
      }
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
        className="markdown-preview prose max-w-none w-full flex-grow"
        style={{ 
          zoom: currentZoom / 100,
          paddingBottom: "2rem",
          paddingLeft: "0.65rem"
        }}
        onScroll={handleScroll}
      >
        <div 
          className="w-full overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
      
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
        
        /* Dark mode heading styles */
        .dark .markdown-preview h1,
        .dark .markdown-preview h2,
        .dark .markdown-preview h3,
        .dark .markdown-preview h4,
        .dark .markdown-preview h5,
        .dark .markdown-preview h6 {
          color: white !important;
        }
        
        .dark .markdown-preview h1,
        .dark .markdown-preview h2 {
          border-bottom-color: #2d3748 !important;
        }
        
        /* Custom scrollbar styling for preview */
        .markdown-preview::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        
        .markdown-preview::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .markdown-preview::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.3);
          border-radius: 3px;
        }
        
        .markdown-preview::-webkit-scrollbar-thumb:hover {
          background-color: rgba(156, 163, 175, 0.5);
        }
        
        /* Dark mode scrollbars */
        .dark .markdown-preview::-webkit-scrollbar-thumb {
          background-color: rgba(75, 85, 99, 0.3);
        }
        
        .dark .markdown-preview::-webkit-scrollbar-thumb:hover {
          background-color: rgba(75, 85, 99, 0.5);
        }
        
        /* Custom CSS applied by user */
        ${customCSS}
      `}} />
    </>
  );
});

MarkdownPreview.displayName = 'MarkdownPreview';

export default MarkdownPreview; 
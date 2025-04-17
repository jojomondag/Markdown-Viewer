//The sidebar-side-button should fold the entire sidebar if pressed and unfold it if pressed again
const sidebarSideButton = document.querySelector('.sidebar-side-button');

sidebarSideButton.addEventListener('click', () => {
  const sidebar = document.querySelector('.sidebar');
  sidebar.classList.toggle('sidebar-folded');
  
  // Change button text based on sidebar state
  if (sidebar.classList.contains('sidebar-folded')) {
    sidebarSideButton.textContent = '>';
  } else {
    sidebarSideButton.textContent = '<';
  }
});

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded');
});

// Get DOM elements
const sidebarMain = document.querySelector('.sidebar-main');
const mainContainer = document.querySelector('.main-container');

if (!sidebarMain) {
  console.error('Could not find sidebar-main element');
}

if (!mainContainer) {
  console.error('Could not find main-container element');
}

//Load folder button functionality
const loadFolderButton = document.querySelector('.sidebar-footer-button');

if (!loadFolderButton) {
  console.error('Could not find sidebar-footer-button element');
}

loadFolderButton.addEventListener('click', async () => {
    try {
        // Open folder selection dialog
        const filePaths = await window.api.openFileDialog();
        if (filePaths.length === 0) return; // User canceled
        
        const rootFolder = filePaths[0];
        console.log('Selected folder:', rootFolder);
        
        // Scan directory for markdown files
        const scanResult = await window.api.scanDirectory(rootFolder);
        console.log('Scan result:', scanResult);
        
        // Clear previous content
        sidebarMain.innerHTML = '';
        
        // Create folder structure
        const folderStructure = createFolderStructure(rootFolder, scanResult.folders);
        sidebarMain.appendChild(folderStructure);
        
        // Add markdown files to sidebar and automatically expand root folder
        if (scanResult.markdownFiles.length > 0) {
            displayMarkdownFiles(scanResult.markdownFiles);
            
            // Auto-expand the root folder
            const rootFolderElement = document.querySelector('.folder');
            if (rootFolderElement) {
                const folderContent = rootFolderElement.querySelector('.folder-content');
                const folderIcon = rootFolderElement.querySelector('.folder-icon');
                if (folderContent) {
                    folderContent.classList.add('expanded');
                    if (folderIcon) {
                        folderIcon.textContent = '📂';
                    }
                }
            }
        } else {
            mainContainer.innerHTML = '<div class="no-files">No markdown files found</div>';
        }
    } catch (error) {
        console.error('Error loading folder:', error);
        mainContainer.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
});

// After loading the root folder, we recursively scan through it and all its subfolders
// to collect all .md markdown files throughout the entire directory structure, and their folder paths.

// We display the folder paths in the sidebar
// We also display the .md files in the main-container

/**
 * Creates a folder element for the sidebar
 * @param {string} folderPath - Path to the folder
 * @param {string} folderName - Name of the folder to display
 * @param {boolean} isRoot - Whether this is the root folder
 * @returns {HTMLElement} - The folder element
 */
function createFolderElement(folderPath, folderName, isRoot = false) {
    console.log('Creating folder element for:', folderPath);
    
    const folderElement = document.createElement('div');
    folderElement.classList.add('folder');
    
    const folderHeader = document.createElement('div');
    folderHeader.classList.add('folder-header');
    
    const folderIcon = document.createElement('span');
    folderIcon.classList.add('folder-icon');
    folderIcon.textContent = '📁';
    
    const folderTitle = document.createElement('span');
    folderTitle.classList.add('folder-title');
    folderTitle.textContent = isRoot ? 'Root: ' + folderName : folderName;
    
    folderHeader.appendChild(folderIcon);
    folderHeader.appendChild(folderTitle);
    folderElement.appendChild(folderHeader);
    
    // Add folder content container
    const folderContent = document.createElement('div');
    folderContent.classList.add('folder-content');
    folderElement.appendChild(folderContent);
    
    // Add click event to toggle folder content
    folderHeader.addEventListener('click', () => {
        folderContent.classList.toggle('expanded');
        folderIcon.textContent = folderContent.classList.contains('expanded') ? '📂' : '📁';
    });
    
    // Store the normalized path as a data attribute (replace backslashes with forward slashes)
    const normalizedPath = folderPath.replace(/\\/g, '/');
    folderElement.setAttribute('data-path', normalizedPath);
    console.log('Folder element created with data-path:', normalizedPath);
    
    return folderElement;
}

/**
 * Creates the folder structure in the sidebar
 * @param {string} rootPath - Path to the root folder
 * @param {Array} folders - Array of folder objects from the scan
 * @returns {HTMLElement} - The root folder element
 */
function createFolderStructure(rootPath, folders) {
    // Extract the root folder name from path
    const rootName = rootPath.split(/[/\\]/).pop();
    
    // Create root folder element
    const rootElement = createFolderElement(rootPath, rootName, true);
    const rootContent = rootElement.querySelector('.folder-content');
    
    // Create folder map for quick lookup
    const folderMap = new Map();
    folderMap.set(rootPath, rootContent);
    
    // Sort folders by path depth to ensure parent folders are created first
    const sortedFolders = [...folders].sort((a, b) => {
        return a.relativePath.split(/[/\\]/).length - b.relativePath.split(/[/\\]/).length;
    });
    
    // Create folder elements
    for (const folder of sortedFolders) {
        const parentPath = folder.path.substring(0, folder.path.length - folder.name.length - 1);
        const parentElement = folderMap.get(parentPath);
        
        if (parentElement) {
            const folderElement = createFolderElement(folder.path, folder.name);
            parentElement.appendChild(folderElement);
            folderMap.set(folder.path, folderElement.querySelector('.folder-content'));
        }
    }
    
    return rootElement;
}

/**
 * Creates a markdown file element
 * @param {object} file - File object from the scan
 * @returns {HTMLElement} - The file element
 */
function createFileElement(file) {
    const fileElement = document.createElement('div');
    fileElement.classList.add('file');
    
    const fileIcon = document.createElement('span');
    fileIcon.classList.add('file-icon');
    fileIcon.textContent = '📄';
    
    const fileName = document.createElement('span');
    fileName.classList.add('file-name');
    fileName.textContent = file.name;
    
    fileElement.appendChild(fileIcon);
    fileElement.appendChild(fileName);
    
    // Store the normalized path as a data attribute (replace backslashes with forward slashes)
    const normalizedPath = file.path.replace(/\\/g, '/');
    fileElement.setAttribute('data-path', normalizedPath);
    
    // Add click event to display markdown content
    fileElement.addEventListener('click', () => {
        displayMarkdownContent(file);
    });
    
    return fileElement;
}

/**
 * Displays the markdown files in the sidebar and main container
 * @param {Array} files - Array of markdown file objects from the scan
 */
function displayMarkdownFiles(files) {
    console.log('Displaying markdown files:', files.length);
    
    // Group files by folder
    const filesByFolder = new Map();
    
    for (const file of files) {
        console.log('Processing file:', file.name, 'in folder:', file.folder);
        if (!filesByFolder.has(file.folder)) {
            filesByFolder.set(file.folder, []);
        }
        filesByFolder.get(file.folder).push(file);
    }
    
    console.log('Files grouped by folders:', filesByFolder.size);
    
    // Get all folder elements before we start searching
    const allFolderElements = document.querySelectorAll('.folder');
    console.log('Total folder elements found:', allFolderElements.length);
    
    // Log all folder elements and their paths
    allFolderElements.forEach(el => {
        console.log('Folder element path:', el.getAttribute('data-path'));
    });
    
    // Add files to their respective folders
    for (const [folderPath, folderFiles] of filesByFolder) {
        console.log('Adding files to folder:', folderPath);
        
        // Try to find the folder element by data-path attribute
        let folderElement = null;
        
        // Normalize the path for comparison (handle backslashes)
        const normalizedFolderPath = folderPath.replace(/\\/g, '/');
        
        // Find the folder element by comparing normalized paths
        for (const el of allFolderElements) {
            const elPath = el.getAttribute('data-path')?.replace(/\\/g, '/');
            if (elPath === normalizedFolderPath) {
                folderElement = el;
                break;
            }
        }
        
        if (folderElement) {
            console.log('Found folder element for:', folderPath);
            const folderContent = folderElement.querySelector('.folder-content');
            
            // Create file list for this folder
            const fileList = document.createElement('div');
            fileList.classList.add('file-list');
            
            // Add each file to the list
            for (const file of folderFiles) {
                console.log('Creating file element for:', file.name);
                const fileElement = createFileElement(file);
                fileList.appendChild(fileElement);
            }
            
            // Ensure folder is expanded to show files
            folderContent.classList.add('expanded');
            
            // Update folder icon to show it's expanded
            const folderIcon = folderElement.querySelector('.folder-icon');
            if (folderIcon) {
                folderIcon.textContent = '📂';
            }
            
            // Append the file list to the folder content
            folderContent.appendChild(fileList);
            console.log('Added', folderFiles.length, 'files to folder:', folderPath);
        } else {
            console.error('Could not find folder element for path:', folderPath);
        }
    }
    
    // Display the first markdown file by default
    if (files.length > 0) {
        displayMarkdownContent(files[0]);
    }
}

/**
 * Displays the content of a markdown file in the main container
 * @param {object} file - File object from the scan
 */
async function displayMarkdownContent(file) {
    try {
        // Load the markdown file content
        const content = await window.api.readMarkdownFile(file.path);
        
        // In a real application, you would convert markdown to HTML here
        // For this example, we'll just display the raw markdown
        const escapedContent = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        mainContainer.innerHTML = `
            <div class="markdown-header">
                <h2>${file.name}</h2>
                <div class="file-path">${file.path}</div>
            </div>
            <div class="markdown-content">
                <pre>${escapedContent}</pre>
            </div>
        `;
        
        // Highlight the selected file
        document.querySelectorAll('.file').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Normalize the path for comparison
        const normalizedPath = file.path.replace(/\\/g, '/');
        const fileElements = document.querySelectorAll('.file');
        
        // Find the file element with the matching normalized path
        let selectedFile = null;
        for (const el of fileElements) {
            if (el.getAttribute('data-path') === normalizedPath) {
                selectedFile = el;
                break;
            }
        }
        
        if (selectedFile) {
            selectedFile.classList.add('selected');
            
            // Ensure the parent folder is expanded to show the selected file
            const parentFolder = selectedFile.closest('.folder-content');
            if (parentFolder) {
                parentFolder.classList.add('expanded');
                const folderIcon = parentFolder.parentElement.querySelector('.folder-icon');
                if (folderIcon) {
                    folderIcon.textContent = '📂';
                }
            }
        } else {
            console.error('Could not find file element for path:', file.path);
        }
    } catch (error) {
        console.error('Error displaying markdown content:', error);
        mainContainer.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
}


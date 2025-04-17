const fs = require('fs');
const path = require('path');

/**
 * Recursively scans a directory for markdown files
 * @param {string} directoryPath - Path to scan
 * @returns {Promise<Object>} - Object with folders and markdownFiles arrays
 */
async function scanDirectoryForMarkdownFiles(directoryPath) {
  const result = {
    folders: [],
    markdownFiles: []
  };
  
  async function scan(dir, relativePath = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.join(relativePath, entry.name);
      
      if (entry.isDirectory()) {
        result.folders.push({
          path: fullPath,
          name: entry.name,
          relativePath: relPath
        });
        await scan(fullPath, relPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        result.markdownFiles.push({
          path: fullPath,
          name: entry.name,
          relativePath: relPath,
          folder: dir
        });
      }
    }
  }
  
  await scan(directoryPath);
  return result;
}

/**
 * Reads a markdown file from disk
 * @param {string} filePath - Path to the markdown file
 * @returns {Promise<string>} - Content of the markdown file
 */
async function readMarkdownFile(filePath) {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error('Error reading markdown file:', error);
    throw error;
  }
}

module.exports = {
  scanDirectoryForMarkdownFiles,
  readMarkdownFile
}; 
# Troubleshooting Markdown Viewer

This document provides solutions to common issues you might encounter when setting up and running the Markdown Viewer application.

## Rollup Native Module Error

The error `Cannot find module @rollup/rollup-win32-x64-msvc` is a common issue with Rollup's native dependencies. Here's how to fix it:

### Solution 1: Clean Installation

1. Close all running instances of the application and VS Code
2. Open a PowerShell terminal as Administrator
3. Navigate to your project directory:
   ```
   cd C:\Users\Josef\Desktop\Viewer
   ```
4. Remove the problematic folders:
   ```
   Remove-Item -Path node_modules -Recurse -Force
   Remove-Item -Path package-lock.json -Force
   ```
5. Install dependencies without optional packages:
   ```
   npm install --no-optional
   ```
6. Install a specific older version of Rollup:
   ```
   npm install rollup@3.29.4 --save-dev
   ```

### Solution 2: Fix Vite Configuration

Create or update your `vite.config.js` in the project root:

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      '@codemirror/basic-setup',
      '@codemirror/commands',
      '@codemirror/lang-markdown',
      '@codemirror/search',
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/fold'
    ],
    exclude: ['@rollup/rollup-win32-x64-msvc']
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
  server: {
    port: 3000
  }
});
```

### Solution 3: Use Older Node.js Version

The issue might be related to Node.js version compatibility. Try using Node.js 18.x LTS instead of the latest version:

1. Install Node.js 18.x LTS from https://nodejs.org/
2. After installation, run:
   ```
   npm cache clean --force
   npm install
   ```

## Missing Icon Components

If you encounter errors related to missing icon components:

1. Replace `IconUnfold` with `IconChevronDown` in MarkdownEditor.jsx
2. Replace icons from lucide-react with @tabler/icons-react in Notification.jsx

## Missing Environment File

If the environment.js file is missing, create it in src/utils/ with this content:

```javascript
/**
 * Environment detection utilities
 */

/**
 * Check if the app is running in Electron
 * @returns {boolean} True if running in Electron
 */
export const isElectron = () => {
  return window?.electron !== undefined;
};

/**
 * Detect if running in development mode
 * @returns {boolean} True if in development mode
 */
export const isDevelopment = () => {
  return import.meta.env.DEV === true;
};

/**
 * Detect operating system
 * @returns {string} 'windows', 'mac', 'linux', or 'unknown'
 */
export const getOS = () => {
  const userAgent = window.navigator.userAgent;
  
  if (userAgent.indexOf('Windows') !== -1) return 'windows';
  if (userAgent.indexOf('Mac') !== -1) return 'mac';
  if (userAgent.indexOf('Linux') !== -1) return 'linux';
  
  return 'unknown';
};

export default {
  isElectron,
  isDevelopment,
  getOS
};
```

## Electronic Debug Flag Issue

If you see an error about `--debug` flag being invalid:

1. Open package.json
2. Change the electron:dev script from:
   ```
   "electron:dev": "concurrently \"vite\" \"electron . --debug\""
   ```
   To:
   ```
   "electron:dev": "concurrently \"vite\" \"electron . --inspect\""
   ```

## Starting with a Fresh Installation

If all else fails, creating a fresh project might be the best solution:

1. Create a new directory:
   ```
   mkdir MarkdownViewer-Fresh
   cd MarkdownViewer-Fresh
   ```

2. Initialize a new Vite React project:
   ```
   npm create vite@latest . -- --template react
   npm install
   ```

3. Copy your source files from the old project
4. Install necessary dependencies one by one to avoid conflicts

## Common Commands for Development

- To run only the Vite development server (without Electron):
  ```
  npm run dev
  ```

- To build the project:
  ```
  npm run build
  ```

- To run in Electron development mode:
  ```
  npm run electron:dev
  ``` 
# Electron Viewer App

A simple Electron application using the latest Electron version.

## Features

- Modern Electron architecture with proper security settings
- Separation of main and renderer processes
- Context isolation and secure IPC setup

## Development

### Prerequisites

- Node.js (latest LTS version recommended)
- npm (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone [your-repo-url]
cd viewer

# Install dependencies
npm install
```

### Running the Application

```bash
# Start the application
npm start

# Start with development tools
npm run dev
```

## Project Structure

- `main.js` - Main process file
- `preload.js` - Preload script for secure communication
- `index.html` - Main application UI
- `renderer.js` - Renderer process script

## Building for Production

To add packaging and distribution capabilities, consider adding electron-builder or electron-forge to your project.

## License

ISC 
# Markdown Viewer

A modern Markdown viewer and editor application with real-time preview capabilities, two-way file synchronization, and an intuitive file navigation system.

## Features

- **File System Integration**: Two-way communication between local files and the application with auto-save capabilities
- **Navigation System**: Collapsible sidebar with recursive file explorer to navigate through your markdown files
- **Markdown Editor**: Advanced code editor with syntax highlighting, line numbers, and other features
- **Real-time Preview**: Instantly see how your markdown will render as you type
- **Syntax Tree**: Navigate through document headings using a tree structure
- **Modern UI**: Built with Skeleton UI, Tailwind CSS, and Tabler icons

## Technology Stack

- Electron - Desktop application framework
- React - UI library
- Vite - Build tool
- Tailwind CSS - Utility-first CSS framework
- Skeleton UI - Component library
- CodeMirror - Code editing component
- Marked - Markdown parsing

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/markdown-viewer.git
cd markdown-viewer

# Install dependencies
npm install

# Start the application in development mode
npm run electron:dev
```

## Usage

1. Click the "Open Folder" button to select a directory of markdown files
2. Navigate the file explorer to find and select markdown files
3. Edit the content in the editor pane on the left
4. See the live preview of your markdown on the right
5. Use the Syntax Tree tab to navigate through document headings

## Development

```bash
# Run in development mode
npm run electron:dev

# Build the application
npm run build
```

## License

ISC

## Credits

Built with ❤️ using Electron, React, and other open source technologies. 
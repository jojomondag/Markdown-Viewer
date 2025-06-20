# Markdown Viewer

![Application Preview](Repo%20Images/Preview%201.png)

A powerful, cross-platform desktop application for viewing and editing Markdown files with a rich set of features designed for productivity and ease of use.

<div align="center">
  <img src="assets/icon-256.png" alt="Markdown Viewer" width="256" height="256">
</div>

## ✨ Features

### 📝 Editing & Preview
- **Live Split-Pane View**: Edit and preview Markdown simultaneously with real-time rendering
- **CodeMirror Editor**: Advanced code editor with syntax highlighting, line numbers, and code folding
- **Rich Markdown Support**: Full GitHub Flavored Markdown (GFM) support
- **Media Support**: Embedded images, videos (MP4, WebM, OGG), audio files, YouTube/Vimeo videos
- **Synchronized Scrolling**: Keep editor and preview in sync while scrolling

### 🗂️ File Management
- **File Explorer**: Tree-view file browser with drag-and-drop support
- **Multiple Tabs**: Work with multiple files simultaneously
- **File History**: Quick access to recently opened files
- **Workspace Management**: Save and restore workspace states
- **File Operations**: Create, rename, delete, copy, and move files and folders

### 🎨 Customization
- **Themes**: Light and dark theme support
- **Font Size**: Adjustable editor font size
- **Layout Control**: Show/hide panels, adjust split pane sizes
- **Zoom Controls**: Preview zoom in/out functionality

### 🔍 Advanced Features
- **Search & Replace**: Powerful find and replace functionality in editor
- **File Search**: Search across files in your workspace
- **Detached Windows**: Open editors in separate windows for multi-monitor setups
- **Auto-Save**: Automatic workspace state persistence
- **Print Support**: Print preview functionality

### ⌨️ Productivity
- **Keyboard Shortcuts**: Comprehensive keyboard shortcuts for all major functions
- **Markdown Toolbar**: Quick access to common Markdown formatting
- **Accessibility**: Screen reader support and keyboard navigation

## 🚀 Installation

### Pre-built Releases
Download the latest release for your platform from the [Releases page](https://github.com/jojomondag/Viewer/releases):

- **Windows**: `.exe` installer or portable version
- **macOS**: `.dmg` file
- **Linux**: `.AppImage` or `.deb` package

### Building from Source

#### Prerequisites
- Node.js (version 16 or higher)
- npm or yarn

#### Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/jojomondag/Viewer.git
   cd Viewer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Development mode:
   ```bash
   npm run electron:dev
   ```

4. Build for production:
   ```bash
   npm run build
   npm run dist
   ```

## 🖥️ Usage

### Getting Started
1. **Open a Folder**: Click the folder icon or use `Ctrl+O` to open a directory containing Markdown files
2. **Create Files**: Right-click in the explorer to create new files or folders
3. **Edit**: Click any Markdown file to start editing
4. **Preview**: The preview pane automatically updates as you type

### Keyboard & Mouse Shortcuts
| Action | Keyboard Shortcut | Mouse Shortcut |
|--------|-------------------|----------------|
| Open Folder | `Ctrl+O` | Click folder icon |
| New File | `Ctrl+N` | Right-click → New File |
| Save File | `Ctrl+S` | - |
| Find | `Ctrl+F` | - |
| Replace | `Ctrl+H` | - |
| Toggle Preview | `Ctrl+Shift+P` | Click preview toggle button |
| Toggle Sidebar | `Ctrl+B` | Click sidebar toggle button |
| New Tab | `Ctrl+T` | Click + tab button |
| Close Tab | `Ctrl+W` | Click × on tab |
| Open File | - | Double-click file in explorer |
| Rename File | - | Right-click → Rename |
| Delete File | - | Right-click → Delete |
| Create Folder | - | Right-click → New Folder |
| Zoom In/Out | `Ctrl+Plus/Minus` | Mouse wheel + Ctrl |
| Switch Tabs | `Ctrl+Tab` | Click tab |

### Markdown Toolbar
The toolbar provides quick access to common Markdown formatting:
- **Bold** (`Ctrl+B`): Make text bold
- **Italic** (`Ctrl+I`): Make text italic
- **Code** (`Ctrl+``): Inline code
- **Headings**: H1-H6 headers
- **Lists**: Ordered and unordered lists
- **Links** (`Ctrl+K`): Insert links
- **Images**: Insert images
- **Code Blocks**: Fenced code blocks
- **Tables**: Insert tables

## 🛠️ Development

### Project Structure
```
Viewer/
├── electron/           # Electron main process files
│   ├── main.js        # Main Electron process
│   └── preload.js     # Preload script for security
├── src/               # React application source
│   ├── components/    # React components
│   ├── context/       # React contexts
│   ├── hooks/         # Custom React hooks
│   ├── utils/         # Utility functions
│   └── App.jsx        # Main App component
├── assets/            # Application icons and assets
├── scripts/           # Build and utility scripts
└── package.json       # Dependencies and scripts
```

### Technologies Used
- **Electron**: Cross-platform desktop app framework
- **React**: User interface library
- **CodeMirror**: Code editor component
- **Marked**: Markdown parser and renderer
- **Tailwind CSS**: Utility-first CSS framework
- **Webpack**: Module bundler

### Available Scripts
- `npm run start`: Start Electron app
- `npm run electron:dev`: Development mode with hot reload
- `npm run build`: Build for production
- `npm run dist`: Create distributable packages
- `npm run dist:win`: Build Windows installer
- `npm run dist:mac`: Build macOS app
- `npm run dist:linux`: Build Linux packages

### Contributing
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Commit your changes: `git commit -am 'Add some feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

## 🔧 Configuration

### Settings
The application stores settings in your system's user data directory:
- **Windows**: `%USERPROFILE%\Documents\MarkdownViewer`
- **macOS**: `~/Library/Application Support/MarkdownViewer`
- **Linux**: `~/.config/MarkdownViewer`

### Customization
- **Themes**: Toggle between light and dark themes
- **Font Size**: Adjust editor font size in settings
- **Layout**: Customize panel visibility and sizes
- **Workspace**: Save different workspace configurations

## 📋 System Requirements
- **Windows**: Windows 10 or later
- **macOS**: macOS 10.13 or later
- **Linux**: Ubuntu 18.04+ or equivalent


## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.

## 🙏 Acknowledgments

- [CodeMirror](https://codemirror.net/) for the excellent code editor
- [Marked](https://marked.js.org/) for Markdown parsing
- [Electron](https://electronjs.org/) for enabling cross-platform desktop apps
- [Tabler Icons](https://tabler-icons.io/) for the beautiful icon set

---

**Built with ❤️ for the Markdown community** 
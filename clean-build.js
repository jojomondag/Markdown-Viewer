#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Parse command line arguments
const args = process.argv.slice(2);
const fastMode = args.includes('--fast');
const autoStart = args.includes('--start');

// ANSI color codes for better terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

/**
 * Execute a command and log it to the console
 */
function execute(command, description) {
  console.log(`${colors.blue}${colors.bright}→ ${description}${colors.reset}`);
  console.log(`${colors.cyan}  $ ${command}${colors.reset}`);
  
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`${colors.green}✓ Done${colors.reset}\n`);
    return true;
  } catch (error) {
    console.error(`${colors.red}✗ Failed: ${error.message}${colors.reset}\n`);
    return false;
  }
}

/**
 * Remove a directory if it exists
 */
function removeDir(dir, description) {
  if (fs.existsSync(dir)) {
    console.log(`${colors.yellow}${colors.bright}→ ${description}${colors.reset}`);
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`${colors.green}✓ Removed ${dir}${colors.reset}\n`);
    } catch (error) {
      console.error(`${colors.red}✗ Failed to remove ${dir}: ${error.message}${colors.reset}\n`);
    }
  }
}

// Print header
console.log(`\n${colors.magenta}${colors.bright}==========================================`);
console.log(`      CLEAN BUILD PROCESS STARTED`);
if (fastMode) {
  console.log(`      (FAST MODE - SKIPPING NODE_MODULES)`);
}
console.log(`==========================================${colors.reset}\n`);

// Clean up build artifacts
removeDir(path.join(__dirname, 'build'), 'Removing build directory');

// Clean webpack cache
removeDir(path.join(os.tmpdir(), '.webpack-cache'), 'Removing webpack cache');

// Clean npm cache for project
if (!fastMode) {
  if (execute('npm cache clean --force', 'Cleaning npm cache')) {
    console.log(`${colors.yellow}Note: This only cleans the local npm cache${colors.reset}\n`);
  }

  // Delete node_modules 
  removeDir(path.join(__dirname, 'node_modules'), 'Removing node_modules directory');

  // Install dependencies fresh
  execute('npm install', 'Installing fresh dependencies');
} else {
  console.log(`${colors.yellow}${colors.bright}→ Skipping npm cache and node_modules in fast mode${colors.reset}\n`);
}

// Build the project
execute('npm run build', 'Building the application');

// Final message
console.log(`${colors.magenta}${colors.bright}==========================================`);
console.log(`      CLEAN BUILD COMPLETED!`);
console.log(`==========================================${colors.reset}`);

// Start the application if requested
if (autoStart) {
  console.log(`\n${colors.blue}${colors.bright}→ Starting the application...${colors.reset}`);
  execute('npm start', 'Starting the application');
} else {
  console.log(`\nRun ${colors.cyan}npm start${colors.reset} to start the application`);
} 
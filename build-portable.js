#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Markdown Viewer Portable Build Process...\n');

// Function to run commands and log output
function runCommand(command, description) {
    console.log(`📋 ${description}...`);
    try {
        const output = execSync(command, { 
            stdio: 'inherit', 
            cwd: process.cwd(),
            shell: true 
        });
        console.log(`✅ ${description} completed\n`);
        return true;
    } catch (error) {
        console.error(`❌ ${description} failed:`, error.message);
        return false;
    }
}

// Function to copy files
function copyFile(src, dest, description) {
    try {
        console.log(`📁 ${description}...`);
        
        // Ensure destination directory exists
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        
        fs.copyFileSync(src, dest);
        console.log(`✅ ${description} completed\n`);
        return true;
    } catch (error) {
        console.error(`❌ ${description} failed:`, error.message);
        return false;
    }
}

// Function to clean directory
function cleanDirectory(dirPath, description) {
    try {
        console.log(`🧹 ${description}...`);
        if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
        console.log(`✅ ${description} completed\n`);
        return true;
    } catch (error) {
        console.error(`❌ ${description} failed:`, error.message);
        return false;
    }
}

// Main build process
async function buildPortableApp() {
    console.log('Following Erik Martin Jordan blog post method:\n');
    console.log('https://erikmartinjordan.com/electron-builder-custom-icon\n');
    
    // Step 1: Clean existing build artifacts
    cleanDirectory('./dist', 'Cleaning existing dist folder');
    
    // Step 2: Kill any running instances
    console.log('🔄 Stopping any running Markdown Viewer instances...');
    try {
        execSync('taskkill /F /IM "Markdown Viewer.exe" 2>nul', { stdio: 'ignore' });
    } catch (error) {
        // Ignore if no process found
    }
    console.log('✅ Process cleanup completed\n');
    
    // Step 3: Run webpack build
    if (!runCommand('npm run build', 'Running webpack build')) {
        process.exit(1);
    }
    
    // Step 4: Setup icons in /build folder (following blog post)
    console.log('🎨 Setting up icons in /build folder (blog post method)...');
    
    // Ensure build directory exists
    if (!fs.existsSync('./build')) {
        fs.mkdirSync('./build', { recursive: true });
    }
    
    // Copy icons from assets to build folder
    copyFile('./assets/icon.ico', './build/icon.ico', 'Copying icon.ico to /build folder');
    copyFile('./assets/icon.png', './build/icon.png', 'Copying icon.png to /build folder');
    
    // Step 5: Build portable executable using exact blog post command
    console.log('🔨 Building portable executable with electron-builder...');
    console.log('Using command: npx electron-builder build --win portable\n');
    
    if (!runCommand('npx electron-builder build --win portable', 'Building portable executable')) {
        process.exit(1);
    }
    
    // Step 6: Copy executable to root directory
    const builtExeName = 'Markdown Viewer 1.0.0.exe';
    const srcPath = `./dist/${builtExeName}`;
    const destPath = `./${builtExeName}`;
    
    if (fs.existsSync(srcPath)) {
        copyFile(srcPath, destPath, `Copying ${builtExeName} to root directory`);
    } else {
        console.error(`❌ Built executable not found at: ${srcPath}`);
        process.exit(1);
    }
    
    // Step 7: Skip creating portable folder (not needed - .exe is already portable)
    
    // Final summary
    console.log('🎉 BUILD COMPLETED SUCCESSFULLY!\n');
    console.log('📁 Files created:');
    console.log(`   • ${builtExeName} (Root directory) - This is your portable executable`);
    console.log('\n🚀 To test the application:');
    console.log(`   & ".\\${builtExeName}"`);
    console.log('\n🔧 Icon embedding method:');
    console.log('   • Icons placed in /build folder for auto-detection');
    console.log('   • Following Erik Martin Jordan blog post method');
    console.log('   • electron-builder automatically detects and embeds icons');
    
    console.log('\n✨ Your portable Markdown Viewer with custom icon is ready!');
}

// Run the build process
buildPortableApp().catch(error => {
    console.error('❌ Build process failed:', error);
    process.exit(1);
}); 
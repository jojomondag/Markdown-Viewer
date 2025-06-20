#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

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

function getCurrentVersion() {
    try {
        const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
        return packageJson.version;
    } catch (error) {
        console.error('❌ Could not read version from package.json:', error.message);
        return null;
    }
}

async function createRelease() {
    console.log('🚀 Creating GitHub Release for Markdown Viewer\n');
    
    // Get current version
    const version = getCurrentVersion();
    if (!version) {
        process.exit(1);
    }
    
    console.log(`📦 Current version: ${version}\n`);
    
    // Check if working directory is clean
    console.log('🔍 Checking git status...');
    try {
        const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' });
        if (gitStatus.trim()) {
            console.log('⚠️  Warning: You have uncommitted changes:');
            console.log(gitStatus);
            console.log('Consider committing them before creating a release.\n');
        } else {
            console.log('✅ Working directory is clean\n');
        }
    } catch (error) {
        console.error('❌ Could not check git status:', error.message);
    }
    
    // Build the portable executable
    console.log('🔨 Building portable executable...');
    if (!runCommand('npm run build-portable', 'Building portable executable')) {
        process.exit(1);
    }
    
    // Check if executable was created
    const exeName = `Markdown Viewer ${version}.exe`;
    if (!fs.existsSync(exeName)) {
        console.error(`❌ Expected executable not found: ${exeName}`);
        console.log('🔍 Available files:');
        try {
            const files = fs.readdirSync('.').filter(f => f.endsWith('.exe'));
            files.forEach(file => console.log(`   • ${file}`));
        } catch (e) {}
        process.exit(1);
    }
    
    console.log(`✅ Found executable: ${exeName}\n`);
    
    // Create git tag
    const tagName = `v${version}`;
    console.log(`🏷️  Creating git tag: ${tagName}`);
    
    try {
        // Check if tag already exists
        execSync(`git rev-parse ${tagName}`, { stdio: 'ignore' });
        console.log(`⚠️  Tag ${tagName} already exists. Deleting and recreating...`);
        runCommand(`git tag -d ${tagName}`, `Deleting existing tag ${tagName}`);
        runCommand(`git push origin :${tagName}`, `Deleting remote tag ${tagName}`);
    } catch (error) {
        // Tag doesn't exist, which is what we want
        console.log(`✅ Tag ${tagName} doesn't exist yet - good!\n`);
    }
    
    if (!runCommand(`git tag ${tagName}`, `Creating tag ${tagName}`)) {
        process.exit(1);
    }
    
    // Push tag to trigger GitHub Actions
    if (!runCommand(`git push origin ${tagName}`, `Pushing tag to GitHub`)) {
        process.exit(1);
    }
    
    console.log('🎉 RELEASE PROCESS STARTED!\n');
    console.log('📋 What happens next:');
    console.log('   1. GitHub Actions will detect the new tag');
    console.log('   2. It will build for Windows, macOS, and Linux');
    console.log('   3. A GitHub release will be created automatically');
    console.log(`   4. Your ${exeName} will be available for download\n`);
    
    console.log('🔗 Check the progress at:');
    console.log('   https://github.com/jojomondag/Viewer/actions\n');
    
    console.log('📦 Once complete, the release will be available at:');
    console.log(`   https://github.com/jojomondag/Viewer/releases/tag/${tagName}\n`);
    
    console.log('✨ Release creation initiated successfully!');
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log('🚀 Markdown Viewer Release Creator\n');
    console.log('Usage: npm run create-release\n');
    console.log('This script will:');
    console.log('  1. Build the portable executable');
    console.log('  2. Create a git tag with the current version');
    console.log('  3. Push the tag to trigger GitHub Actions');
    console.log('  4. GitHub Actions will create the release automatically\n');
    process.exit(0);
}

createRelease().catch(error => {
    console.error('❌ Release creation failed:', error);
    process.exit(1);
}); 
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Check if the file exists in the parent directory structure
const possiblePaths = [
    '../moonscape-website/src/components/HAHToolsTimelineSection.tsx',
    '../moonscape-website/components/HAHToolsTimelineSection.tsx',
    '../moonscape-website/app/components/HAHToolsTimelineSection.tsx',
    '../../moonscape-website/src/components/HAHToolsTimelineSection.tsx',
    '../nftiers-web-app/src/components/HAHToolsTimelineSection.tsx',
    '../hashinal-wc/src/components/HAHToolsTimelineSection.tsx',
    '../openconvai-eliza/src/components/HAHToolsTimelineSection.tsx'
];

console.log('Checking for HAHToolsTimelineSection.tsx file...\n');

for (const filePath of possiblePaths) {
    const absolutePath = path.resolve(__dirname, '..', filePath);
    console.log(`Checking: ${absolutePath}`);
    
    if (fs.existsSync(absolutePath)) {
        console.log(`✓ Found file at: ${absolutePath}\n`);
        
        // Read first few lines
        const content = fs.readFileSync(absolutePath, 'utf8');
        const lines = content.split('\n').slice(0, 50);
        console.log('First 50 lines of the file:');
        lines.forEach((line, i) => console.log(`${i + 1}: ${line}`));
        
        process.exit(0);
    }
}

console.log('\nFile not found in any checked location.');
console.log('\nChecking parent directory structure:');
const parentDir = path.resolve(__dirname, '../..');
const dirs = fs.readdirSync(parentDir).filter(f => {
    try {
        return fs.statSync(path.join(parentDir, f)).isDirectory() && !f.startsWith('.');
    } catch (e) {
        return false;
    }
});
console.log('Directories in parent:', dirs.join(', '));
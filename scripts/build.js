#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('Building Claude Code Router...');

try {
  // Build the main CLI application
  console.log('Building CLI application...');
  execSync('esbuild src/cli.ts --bundle --platform=node --outfile=dist/cli.js', { stdio: 'inherit' });
  
  // Copy the tiktoken WASM file
  console.log('Copying tiktoken WASM file...');
  execSync('shx cp node_modules/tiktoken/tiktoken_bg.wasm dist/tiktoken_bg.wasm', { stdio: 'inherit' });
  
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
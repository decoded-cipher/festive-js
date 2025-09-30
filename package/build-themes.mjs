#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { minify } from 'terser';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));

// Ensure themes directory exists
const themesDir = 'dist/themes';
if (!existsSync(themesDir)) {
  mkdirSync(themesDir, { recursive: true });
}

// Function to recursively find all theme index.js files
function findThemeFiles(dir) {
  const themeFiles = [];
  
  if (!existsSync(dir)) {
    console.warn(`Themes directory not found: ${dir}`);
    return themeFiles;
  }

  const items = readdirSync(dir);
  
  for (const item of items) {
    const itemPath = join(dir, item);
    const stat = statSync(itemPath);
    
    if (stat.isDirectory()) {
      const indexPath = join(itemPath, 'index.js');
      if (existsSync(indexPath)) {
        themeFiles.push({
          name: item,
          path: indexPath
        });
      }
    }
  }
  
  return themeFiles;
}

// Build themes
async function buildThemes() {
  const themeFiles = findThemeFiles('themes');
  
  if (themeFiles.length === 0) {
    console.log('No theme files found in themes/ directory');
    return;
  }

  console.log(`Building ${themeFiles.length} theme(s)...`);

  for (const theme of themeFiles) {
    try {
      console.log(`Building theme: ${theme.name}`);
      
      // Read theme file
      const themeCode = readFileSync(theme.path, 'utf-8');
      
      // Minify the code
      const minified = await minify(themeCode, {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.warn', 'console.error'],
        },
        mangle: true,
        format: {
          comments: false,
        },
      });

      // Write minified theme
      const outputPath = join(themesDir, `${theme.name}.min.js`);
      writeFileSync(outputPath, minified.code);
      
      console.log(`✓ Built ${theme.name}.min.js`);
    } catch (error) {
      console.error(`✗ Failed to build ${theme.name}:`, error.message);
    }
  }
  
  console.log('Theme building complete!');
}

buildThemes().catch(console.error);
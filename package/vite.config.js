
import { defineConfig } from "vite";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

// Plugin to minify CSS in template literals
const minifyCSSInJS = () => {
  return {
    name: 'minify-css-in-js',
    generateBundle(options, bundle) {
      if (process.env.BUILD_MODE === 'min') {
        Object.keys(bundle).forEach(fileName => {
          const chunk = bundle[fileName];
          if (chunk.type === 'chunk' && chunk.code) {
            // Minify CSS within template literals
            chunk.code = chunk.code.replace(/`([^`]*(?:\s+[^`]*)*)`/g, (match, css) => {
              if (css.includes('{') && css.includes('}')) {
                // This looks like CSS, minify it
                const minified = css
                  .replace(/\s*{\s*/g, '{')
                  .replace(/\s*}\s*/g, '}')
                  .replace(/\s*;\s*/g, ';')
                  .replace(/\s*:\s*/g, ':')
                  .replace(/\s*,\s*/g, ',')
                  .replace(/\s+/g, ' ')
                  .replace(/^\s+|\s+$/g, '')
                  .replace(/\n/g, '');
                return '`' + minified + '`';
              }
              return match;
            });
          }
        });
      }
    }
  };
};

const banner = `/*!
 * ${pkg.name} v${pkg.version}
 * Copyright (c) 2025 ${pkg.author}
 * Licensed under the ${pkg.license} License
 * Built: ${new Date().toISOString()}
 */
`;

const isMinified = process.env.BUILD_MODE === 'min';

export default defineConfig({
  plugins: [minifyCSSInJS()],
  build: {
    outDir: "dist",
    emptyOutDir: false,
    minify: isMinified ? "esbuild" : false,
    sourcemap: false,
    lib: {
      entry: "entry.glob.js",
      name: "Festive",
      fileName: () => isMinified ? "core.min.js" : "core.js",
      formats: ["iife"]
    },
    rollupOptions: {
      treeshake: true,
      output: {
        banner: isMinified ? "" : banner,
        extend: true,
        compact: isMinified,
        generatedCode: {
          constBindings: true
        }
      }
    },
    target: "es2018",
    cssCodeSplit: false
  },
  esbuild: isMinified ? { 
    drop: ["console", "debugger"],
    minifyWhitespace: true,
    minifyIdentifiers: true,
    minifySyntax: true,
    keepNames: false
  } : undefined
});

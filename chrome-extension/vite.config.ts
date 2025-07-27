import { defineConfig } from 'vite'
import { resolve } from 'path'
import { copyFileSync, cpSync } from 'fs'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/background.ts'),
        content: resolve(__dirname, 'src/content/content.ts'),
        popup: resolve(__dirname, 'src/popup/popup.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    },
    outDir: 'dist',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  plugins: [
    {
      name: 'copy-static-files',
      writeBundle() {
        // Copy static files after build
        copyFileSync('src/manifest.json', 'dist/manifest.json');
        copyFileSync('src/popup.html', 'dist/popup.html');
        cpSync('src/_locales', 'dist/_locales', { recursive: true });
        cpSync('src/icons', 'dist/icons', { recursive: true });
        
        // Copy Turndown library for content script
        copyFileSync('node_modules/turndown/lib/turndown.browser.umd.js', 'dist/turndown.browser.es.js');
      }
    }
  ]
})
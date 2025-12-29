import { defineConfig } from 'vite'
import { resolve } from 'path'
import { copyFileSync, cpSync } from 'fs'

// Content script用の別ビルドかどうかをチェック
const isContentBuild = process.env.BUILD_TARGET === 'content'

export default defineConfig({
  build: isContentBuild ? {
    // Content script用ビルド（IIFE形式、全依存関係をインライン化）
    rollupOptions: {
      input: resolve(__dirname, 'src/content/content.ts'),
      output: {
        format: 'iife',
        entryFileNames: 'content.js',
        inlineDynamicImports: true
      }
    },
    outDir: 'dist',
    emptyOutDir: false // 既存ファイルを保持
  } : {
    // Background/Popup用ビルド（ESモジュール形式）
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/background.ts'),
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
  plugins: isContentBuild ? [] : [
    {
      name: 'copy-static-files',
      writeBundle() {
        // Copy static files after build
        copyFileSync('src/manifest.json', 'dist/manifest.json');
        copyFileSync('src/popup.html', 'dist/popup.html');
        cpSync('src/icons', 'dist/icons', { recursive: true });

        // Copy Turndown library for content script
        copyFileSync('node_modules/turndown/lib/turndown.browser.umd.js', 'dist/turndown.browser.es.js');
        // Copy zip.js library for content script
        copyFileSync('src/zip.js', 'dist/zip.min.js');
      }
    }
  ]
})

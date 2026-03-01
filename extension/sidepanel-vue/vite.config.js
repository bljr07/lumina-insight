import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: '../sidepanel',
    emptyOutDir: true,
    cssCodeSplit: false, // Ensures CSS isn't injected dynamically via js
    modulePreload: { polyfill: false }, // Avoids inline script injection
    rollupOptions: {
      output: {
        entryFileNames: `index.js`,
        chunkFileNames: `index.js`,
        assetFileNames: `index.[ext]`,
        inlineDynamicImports: true // Forces everything into one JS file to prevent MV3 eval chunking
      }
    }
  }
})

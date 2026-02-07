import { defineConfig } from 'vite'
import { resolve } from 'path'
import { copyFileSync, existsSync, mkdirSync, renameSync, readFileSync, readdirSync, writeFileSync } from 'fs'

export default defineConfig({
  build: {
    outDir: 'dist',
    minify: 'esbuild',
    esbuild: {
      drop: ['console', 'debugger'],
    },
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        content: resolve(__dirname, 'src/content/content.ts'),
        auth: resolve(__dirname, 'src/content/auth.ts'),
        'website-auth': resolve(__dirname, 'src/content/website-auth-sync.ts'),
        background: resolve(__dirname, 'src/background/background.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'content') return 'content.js'
          if (chunkInfo.name === 'auth') return 'auth.js'
          if (chunkInfo.name === 'website-auth') return 'website-auth.js'
          if (chunkInfo.name === 'background') return 'background.js'
          if (chunkInfo.name === 'popup') return 'assets/popup.js'
          return 'assets/[name].js'
        },
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('popup.html')) return 'popup.html'
          return 'assets/[name].[ext]'
        },
      },
    },
    emptyOutDir: true,
  },
  plugins: [
    {
      name: 'copy-manifest',
      closeBundle() {
        const manifestPath = resolve(__dirname, 'manifest.json')
        const distPath = resolve(__dirname, 'dist', 'manifest.json')
        if (existsSync(manifestPath)) {
          copyFileSync(manifestPath, distPath)
          console.log('✓ Copied manifest.json to dist/')
        }
        
        // Copy icons to dist so the packed extension has them
        const iconsSrc = resolve(__dirname, 'icons')
        const iconsDest = resolve(__dirname, 'dist', 'icons')
        if (existsSync(iconsSrc)) {
          mkdirSync(iconsDest, { recursive: true })
          for (const name of readdirSync(iconsSrc)) {
            if (name.endsWith('.png')) {
              copyFileSync(resolve(iconsSrc, name), resolve(iconsDest, name))
            }
          }
          console.log('✓ Copied icons to dist/')
        }
        
        // Move popup.html to root if it's in a subdirectory
        const popupInSubdir = resolve(__dirname, 'dist', 'src', 'popup', 'popup.html')
        const popupInRoot = resolve(__dirname, 'dist', 'popup.html')
        if (existsSync(popupInSubdir)) {
          renameSync(popupInSubdir, popupInRoot)
          console.log('✓ Moved popup.html to dist/ root')
        }
        
        // Update popup.html to reference the correct popup.js path
        if (existsSync(popupInRoot)) {
          const popupHtmlContent = readFileSync(popupInRoot, 'utf-8')
          const updatedContent = popupHtmlContent.replace(
            /src="[^"]*popup[^"]*"/,
            'src="./assets/popup.js"'
          )
          writeFileSync(popupInRoot, updatedContent)
          console.log('✓ Updated popup.html script reference')
        }
      },
    },
  ],
})

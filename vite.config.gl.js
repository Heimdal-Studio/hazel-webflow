// Second build pass: the standalone GL bundle (dist/gl.js). Run via
// `npm run build` (vite build && vite build -c vite.config.gl.js).
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    minify: true,
    emptyOutDir: false,
    rollupOptions: {
      input: './src/gl/embed.js',
      output: {
        format: 'iife',
        entryFileNames: 'gl.js',
      },
    },
  },
})

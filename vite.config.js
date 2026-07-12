import fs from 'node:fs'
import { defineConfig } from 'vite'
import eslintPlugin from 'vite-plugin-eslint2'

export default defineConfig(({ command }) => {
  const isDev = command === 'serve'
  return {
    plugins: isDev
      ? [
          eslintPlugin({
            cache: false,
            emitWarning: true,
            emitError: false,
          }),
        ]
      : [],
    server: {
      host: 'localhost',
      port: 4012,
      cors: '*',
      // Safari blocks http://localhost fetches from the https Webflow site (mixed
      // content, no localhost exemption) — dev must be https. Certs via mkcert.
      https: {
        key: fs.readFileSync('certs/localhost-key.pem'),
        cert: fs.readFileSync('certs/localhost.pem'),
      },
      hmr: {
        host: 'localhost',
        protocol: 'wss',
        overlay: false,
      },
    },
    build: {
      minify: false,
      manifest: true,
      rollupOptions: {
        input: './src/main.js',
        output: {
          format: 'umd',
          entryFileNames: 'main.js',
          esModule: false,
          compact: false,
          globals: {
            jquery: '$',
            gsap: 'gsap',
          },
        },
        external: ['jquery', 'gsap'],
      },
    },
  }
})

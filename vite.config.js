import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// GitHub Pages base path: https://hellowalle.github.io/my-web/
export default defineConfig({
  base: '/my-web/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        friction: resolve(__dirname, 'friction.html'),
      },
    },
  },
})

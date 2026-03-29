import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
    }),
  ],
  // LA LÍNEA MODIFICADA PARA POLARIS FUEL:
  // Cambia '/wallet-manager/' por './' (con el punto delante)
base: './',
  build: {
    // 1. Esto evita que F12 pueda reconstruir tu código original
    sourcemap: false, 
    
    // 2. Esto comprime el código al máximo nivel posible
    minify: 'terser',
    terserOptions: {
      compress: {
        // 3. Elimina todos los console.log para no dar pistas
        drop_console: true, 
        drop_debugger: true
      },
      format: {
        // 4. Elimina todos tus comentarios del código compilado
        comments: false, 
      }
    }
  }
})
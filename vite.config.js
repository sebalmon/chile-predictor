import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    rollupOptions: {
      output: {
        // Separa vendors grandes en chunks propios: el bundle de la app
        // ya no carga firebase entero de entrada y se cachea aparte entre deploys.
        manualChunks: {
          'firebase-app': ['firebase/app', 'firebase/auth'],
          'firebase-firestore': ['firebase/firestore'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})

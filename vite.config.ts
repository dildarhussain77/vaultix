import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/vaultix/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Vaultix',
        short_name: 'Vaultix',
        description: 'Zero-Knowledge Credential Manager',
        theme_color: '#121212',
        background_color: '#121212',
        display: 'standalone',
        icons: [
          {
            src: 'https://cdn.iconscout.com/icon/free/png-256/free-vault-icon-download-in-svg-png-gif-file-formats--locker-money-box-bank-safe-security-pack-crime-icons-1614275.png',
            sizes: '256x256',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})

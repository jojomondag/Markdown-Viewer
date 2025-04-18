import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      '@codemirror/basic-setup',
      '@codemirror/commands',
      '@codemirror/lang-markdown',
      '@codemirror/search',
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/fold'
    ]
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
  server: {
    port: 3000
  }
}); 
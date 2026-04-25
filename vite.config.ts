import { defineConfig } from 'vite-plus';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  fmt: {},
  lint: { options: { typeAware: true, typeCheck: true } },
  server: {
    proxy: {
      '/schoolsoft': {
        target: 'https://sms.schoolsoft.se',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/schoolsoft/, ''),
      },
    },
  },
});

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { getAppVersionMetadata } from './scripts/app-version';

export default defineConfig(() => {
  const appVersion = getAppVersionMetadata();
  const versionLabel = `AI留学生えいご対話　Version ${appVersion.version}　Build ${appVersion.build}`;

  return {
    base: './',
    plugins: [
      {
        name: 'learner-version-footer',
        transformIndexHtml(html) {
          const style = `<style id="app-version-style">.setup-footer::after{content:${JSON.stringify(versionLabel)};margin-left:.9em;font:inherit;font-weight:500;color:inherit;opacity:.78}</style>`;
          if (!html.includes('</head>')) throw new Error('VERSION_INDEX_HEAD_ANCHOR_NOT_FOUND');
          return html.replace('</head>', `${style}</head>`);
        },
      },
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

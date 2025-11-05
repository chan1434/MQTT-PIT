import { defineConfig } from 'vite';
import { qwikVite } from '@builder.io/qwik/optimizer';
import { qwikCity } from '@builder.io/qwik-city/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig(() => {
  return {
    plugins: [
      qwikCity(),
      qwikVite(),
      nodePolyfills()
    ],
    server: {
      https: true,
      port: 5173
    },
    preview: {
      https: true,
      port: 4173
    }
  };
});


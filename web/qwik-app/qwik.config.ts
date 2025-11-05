import { defineConfig } from '@builder.io/qwik';
import { qwikCity } from '@builder.io/qwik-city/vite';

export default defineConfig(() => {
  return {
    ...qwikCity(),
    serviceWorker: {
      register: true,
      globPatterns: ['**/*']
    }
  };
});


/**
 * This is the base config for vite.
 * When building, the adapter config is used which loads this file and extends it.
 * 
 * HTTPS Configuration:
 * This config enables HTTPS by default for security and PWA requirements.
 * SSL certificates should be in ./certs/ directory.
 * Run 'npm run generate-certs' if certificates are missing.
 */
import { defineConfig, type UserConfig } from "vite";
import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { visualizer } from "rollup-plugin-visualizer";
import pkg from "./package.json";
import fs from "fs";
import path from "path";

type PkgDep = Record<string, string>;
const { dependencies = {}, devDependencies = {} } = pkg as any as {
  dependencies: PkgDep;
  devDependencies: PkgDep;
  [key: string]: unknown;
};
errorOnDuplicatesPkgDeps(devDependencies, dependencies);

/**
 * Note that Vite normally starts from `index.html` but the qwikCity plugin makes start at `src/entry.ssr.tsx` instead.
 */
export default defineConfig(({ command, mode }): UserConfig => {
  // Check for SSL certificates
  const keyPath = path.resolve(__dirname, './certs/localhost-key.pem');
  const certPath = path.resolve(__dirname, './certs/localhost-cert.pem');
  const certsExist = fs.existsSync(keyPath) && fs.existsSync(certPath);
  
  // HTTPS is REQUIRED for this application (skip check in analyze mode)
  if (command === 'serve' && !certsExist && mode !== 'analyze') {
    console.error('');
    console.error('❌ SSL Certificates Not Found!');
    console.error('   HTTPS is REQUIRED for this application.');
    console.error('');
    console.error('   Please run: npm run generate-certs');
    console.error('');
    console.error('   This will create self-signed SSL certificates.');
    console.error('   The certificates will be stored in ./certs/');
    console.error('');
    throw new Error('SSL certificates required. Run: npm run generate-certs');
  }
  
  const plugins = [qwikCity(), qwikVite(), tsconfigPaths({ root: "." })];
  
  // Add bundle analyzer in analyze mode
  if (mode === 'analyze') {
    plugins.push(
      visualizer({
        filename: 'stats.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
        template: 'treemap', // sunburst, treemap, network
      }) as any
    );
  }
  
  return {
    plugins,
    // This tells Vite which dependencies to pre-build in dev mode.
    optimizeDeps: {
      // Put problematic deps that break bundling here, mostly those with binaries.
      // For example ['better-sqlite3'] if you use that in server functions.
      exclude: [],
    },
    
    // Build optimizations
    build: {
      target: 'es2020',
      minify: 'esbuild',
      cssMinify: true,
      reportCompressedSize: true,
      chunkSizeWarningLimit: 500,
      rollupOptions: {
        output: {
          // Refined bundle splitting for better parallel loading
          manualChunks: {
            'qwik-core': ['@builder.io/qwik'],
            'qwik-city': ['@builder.io/qwik-city'],
          },
          // Critical CSS extraction
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return 'assets/[name]-[hash][extname]';
            }
            return 'assets/[name]-[hash][extname]';
          },
        },
      },
    },

    /**
     * This is an advanced setting. It improves the bundling of your server code. To use it, make sure you understand when your consumed packages are dependencies or dev dependencies. (otherwise things will break in production)
     */
    // ssr:
    //   command === "build" && mode === "production"
    //     ? {
    //         // All dev dependencies should be bundled in the server build
    //         noExternal: Object.keys(devDependencies),
    //         // Anything marked as a dependency will not be bundled
    //         // These should only be production binary deps (including deps of deps), CLI deps, and their module graph
    //         // If a dep-of-dep needs to be external, add it here
    //         // For example, if something uses `bcrypt` but you don't have it as a dep, you can write
    //         // external: [...Object.keys(dependencies), 'bcrypt']
    //         external: Object.keys(dependencies),
    //       }
    //     : undefined,

    server: {
      headers: {
        // Don't cache the server response in dev mode
        "Cache-Control": "public, max-age=0",
      },
      // HTTPS is always enabled (required for PWA and security)
      https: certsExist ? {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      } : undefined,
      port: 5174, // Standard HTTPS development port
      host: true, // Allow external connections
      strictPort: false, // Allow fallback if 5174 is busy
    },
    preview: {
      headers: {
        // Do cache the server response in preview (non-adapter production build)
        "Cache-Control": "public, max-age=600",
      },
      https: certsExist ? {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      } : undefined,
      port: 5174,
      strictPort: false,
    },
  };
});

// *** utils ***

/**
 * Function to identify duplicate dependencies and throw an error
 * @param {Object} devDependencies - List of development dependencies
 * @param {Object} dependencies - List of production dependencies
 */
function errorOnDuplicatesPkgDeps(
  devDependencies: PkgDep,
  dependencies: PkgDep,
) {
  let msg = "";
  // Create an array 'duplicateDeps' by filtering devDependencies.
  // If a dependency also exists in dependencies, it is considered a duplicate.
  const duplicateDeps = Object.keys(devDependencies).filter(
    (dep) => dependencies[dep],
  );

  // include any known qwik packages
  const qwikPkg = Object.keys(dependencies).filter((value) =>
    /qwik/i.test(value),
  );

  // any errors for missing "qwik-city-plan"
  // [PLUGIN_ERROR]: Invalid module "@qwik-city-plan" is not a valid package
  msg = `Move qwik packages ${qwikPkg.join(", ")} to devDependencies`;

  if (qwikPkg.length > 0) {
    throw new Error(msg);
  }

  // Format the error message with the duplicates list.
  // The `join` function is used to represent the elements of the 'duplicateDeps' array as a comma-separated string.
  msg = `
    Warning: The dependency "${duplicateDeps.join(", ")}" is listed in both "devDependencies" and "dependencies".
    Please move the duplicated dependencies to "devDependencies" only and remove it from "dependencies"
  `;

  // Throw an error with the constructed message.
  if (duplicateDeps.length > 0) {
    throw new Error(msg);
  }
}

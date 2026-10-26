import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The build inlines everything into one HTML file, which is what gets published as the artifact.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: { target: 'es2022', assetsInlineLimit: 100000000, chunkSizeWarningLimit: 4000 },
  server: { port: 5173 },
});

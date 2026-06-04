import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Bundle the workspace shared package; keep node_modules external.
  noExternal: [/@tahaddi\/shared/],
  skipNodeModulesBundle: true,
});

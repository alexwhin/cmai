import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  shims: true,
  minify: false,
  splitting: false,
  treeshake: true,
  target: "node18",
  outDir: "dist",
  silent: true,
  metafile: true,
  onSuccess: async () => {
    // Suppress specific bundler warnings that are not actionable
    console.log("Build completed successfully");
    return;
  },
});

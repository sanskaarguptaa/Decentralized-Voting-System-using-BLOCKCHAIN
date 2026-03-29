import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      buffer: fileURLToPath(new URL("./src/buffer-polyfill.js", import.meta.url)),
      process: fileURLToPath(new URL("./src/process-polyfill.js", import.meta.url)),
      util: "util",
      stream: "stream-browserify",
      crypto: "crypto-browserify",
    },
  }
});

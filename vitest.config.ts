import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// points @/ to ./.. parent dir  
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
});
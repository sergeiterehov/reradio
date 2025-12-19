/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tsconfigPaths from "vite-tsconfig-paths";
import { readFileSync } from "node:fs";

// https://vite.dev/config/
export default defineConfig({
  test: {},
  plugins: [
    react(),
    tsconfigPaths(),
    {
      name: "binary-import",
      transform(_src, id) {
        const suffix = "?hex";

        if (!id.endsWith(suffix)) return;

        const data = readFileSync(id.replace(suffix, ""), "binary");
        return `export default ${JSON.stringify(Buffer.from(data, "ascii").toString("hex"))};`;
      },
    },
  ],
});

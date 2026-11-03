import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  esbuild: { jsx: "automatic" }, // renderiza componentes no servidor nos testes (o tsconfig usa "preserve" por causa do Next)
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 }, // dois arquivos de teste em paralelo + build recém-compilado: 5 s já falhou uma vez sem bug real
  fullyParallel: false,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3101", locale: "pt-BR", timezoneId: "America/Sao_Paulo" },
  webServer: {
    command: "bash scripts/servir-teste.sh",
    url: "http://127.0.0.1:3101/api/saude",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});

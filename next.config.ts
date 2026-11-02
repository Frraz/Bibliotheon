import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  output: "standalone",
  // Binário nativo: não pode ser empacotado pelo bundler.
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
  // SITE_URL vale igual no build e na execução (canonical, sitemap, OG, JSON-LD): é fixado no build.
  env: { SITE_URL: process.env.SITE_URL ?? "http://localhost:3000" },
  // Dados de produção (banco, mídia) nunca entram no pacote, mesmo que algum caminho dinâmico os toque.
  outputFileTracingExcludes: { "*": ["./data/**", "./seeds/**", "./.claude/**", "./docs/**"] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

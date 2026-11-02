import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/painel", "/entrar", "/api/", "/ir/", "/prototipo"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

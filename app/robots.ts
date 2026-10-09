import type { MetadataRoute } from "next";

/** Nothing on Saudade is meant for search engines (CLIENT_GUIDE §7). */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}

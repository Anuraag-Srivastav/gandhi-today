import type { MetadataRoute } from "next";

const SITE_URL = "https://www.gandhisays.in";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/about`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/quiz`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}

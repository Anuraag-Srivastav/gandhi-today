import type { MetadataRoute } from "next";
import { publishedAnswers } from "@/content/answers";

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
    ...(publishedAnswers.length > 0 ? [{
      url: `${SITE_URL}/answers`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    }] : []),
    ...publishedAnswers.map((answer) => ({
      url: `${SITE_URL}/answers/${answer.slug}`,
      lastModified: answer.publishedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}

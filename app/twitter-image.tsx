import { ImageResponse } from "next/og";
import { SocialPreview } from "@/lib/social-preview";

export const alt = "Gandhi Says — historical sources and careful interpretation for present-day questions";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(<SocialPreview />, size);
}

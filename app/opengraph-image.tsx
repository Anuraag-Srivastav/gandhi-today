import { ImageResponse } from "next/og";
import { SocialIconPreview } from "@/lib/social-preview";

export const alt = "Gandhi Says charkha symbol";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<SocialIconPreview />, size);
}

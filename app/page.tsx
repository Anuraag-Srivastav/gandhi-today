import { Chat } from "@/components/Chat";
import { archiveImageVisible } from "@/lib/archive-image";

export default function Home() {
  // Pre-sized WebP: native lazy loading avoids an image-component client bundle.
  // eslint-disable-next-line @next/next/no-img-element
  return <Chat archiveTexture={archiveImageVisible ? <img
    src="/assets/archive/gandhi-note-texture.webp" alt="" aria-hidden="true"
    width={1240} height={685} loading="lazy" decoding="async" fetchPriority="low"
    className="pointer-events-none absolute top-0 right-0 -z-10 h-auto w-40 opacity-[0.05]"
  /> : null} />;
}

import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "What would Gandhi say today?",
  description:
    "What Gandhi actually wrote, where he's been criticised, and how his principles might apply today, with sources.",
  openGraph: { description: "What Gandhi actually wrote, where he's been criticised, and how his principles might apply today, with sources." },
  twitter: { description: "What Gandhi actually wrote, where he's been criticised, and how his principles might apply today, with sources." },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${sourceSerif.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}

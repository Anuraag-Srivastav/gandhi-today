import Link from "next/link";
import type { ReactNode } from "react";

function CharkhaMark() {
  return <svg viewBox="0 0 48 48" width="38" height="38" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" /><circle cx="24" cy="24" r="3" fill="currentColor" /><path d="M24 4v40M4 24h40M10 10l28 28M38 10 10 38" stroke="currentColor" /></svg>;
}

export function PublicPageFrame({ children }: { children: ReactNode }) {
  return <div className="khadi-grain min-h-dvh">
    <a href="#main-content" className="absolute -top-20 z-50 bg-paper p-3 focus:top-2">Skip to content</a>
    <div className="flag-bar h-1 w-full" />
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3 py-5">
        <Link href="/" className="flex items-center gap-2.5 text-[1.55rem]" aria-label="Gandhi Says home">
          <span className="text-saffron"><CharkhaMark /></span>
          <span className="font-display font-semibold">Gandhi Says<span className="font-ui block text-xs font-normal text-ink-soft">Ideas worth examining</span></span>
        </Link>
        <nav aria-label="Main navigation" className="font-ui flex items-center gap-1 text-xs text-ink-soft">
          <Link href="/answers" className="inline-flex min-h-11 items-center px-2 underline underline-offset-4 hover:text-saffron-deep">Answers</Link>
          <Link href="/quiz" className="inline-flex min-h-11 items-center px-2 underline underline-offset-4 hover:text-saffron-deep">Quiz</Link>
          <Link href="/about" className="inline-flex min-h-11 items-center px-2 underline underline-offset-4 hover:text-saffron-deep">About</Link>
        </nav>
      </header>
      <main id="main-content">{children}</main>
      <footer className="font-ui py-6 text-xs leading-5 text-ink-soft">Historical claims are linked to sources. Present-day applications are identified as interpretation.</footer>
    </div>
  </div>;
}

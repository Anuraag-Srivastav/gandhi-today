/** Shared paper-and-saffron shell for inquiries and the independent quiz. */
import Link from "next/link";
import type { ReactNode } from "react";

export function SiteFrame({ children, quiz = false }: { children: ReactNode; quiz?: boolean }) {
  return <div className="khadi-grain site-shell"><a href="#main-content" className="skip-link">Skip to content</a><div className="flag-bar site-flag" /><div className="site-width">
    <header className="site-nav"><Link href="/" className="site-brand" aria-label="Gandhi Says home"><svg viewBox="0 0 48 48" width="38" height="38" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" /><circle cx="24" cy="24" r="3" fill="currentColor" /><path d="M24 4v40M4 24h40M10 10l28 28M38 10 10 38" stroke="currentColor" /></svg><span>Gandhi Says<small>Ideas worth examining</small></span></Link><Link href={quiz ? "/" : "/quiz"} className="quiet-link">{quiz ? "← Ask a question" : "Try the quiz →"}</Link></header>
    <main id="main-content">{children}</main><footer className="site-footer">A space for thoughtful inquiry. Generated answers are not authentic Gandhi quotations; source passages are identified separately.</footer>
  </div></div>;
}

import type { Metadata } from "next";
import Link from "next/link";
import { PublicPageFrame } from "@/components/PublicPageFrame";
import { publishedAnswers } from "@/content/answers";

const description = "Reviewed, sourced answers about Gandhi’s recorded views, with modern interpretation clearly separated from historical evidence.";

export const metadata: Metadata = {
  title: "Reviewed answers about Gandhi | Gandhi Says",
  description,
  alternates: { canonical: "/answers" },
  openGraph: { title: "Reviewed answers about Gandhi", description, url: "/answers", type: "website" },
  twitter: { card: "summary_large_image", title: "Reviewed answers about Gandhi", description },
};

export default function AnswersPage() {
  return <PublicPageFrame>
    <section className="paper-card rounded-[28px] border border-earth/10 px-5 py-7 sm:px-8 sm:py-9">
      <p className="font-ui text-[11px] tracking-[0.2em] text-earth uppercase">Reviewed answers</p>
      <h1 className="font-display mt-2 text-4xl font-semibold leading-tight text-ink sm:text-5xl">History first. Interpretation marked.</h1>
      <p className="mt-4 max-w-2xl text-[16px] leading-7 text-ink-soft">These permanent pages are reviewed before publication. Each separates what the historical source supports from what is inferred for the present.</p>
      <div className="mt-7 grid gap-4">
        {publishedAnswers.map((answer) => <article key={answer.slug} className="rounded-2xl border border-earth/15 bg-khadi/45 p-5">
          <h2 className="font-display text-2xl font-semibold leading-snug"><Link href={`/answers/${answer.slug}`} className="underline decoration-earth/30 underline-offset-4 hover:decoration-saffron">{answer.title}</Link></h2>
          <p className="mt-2 text-[15px] leading-7 text-ink-soft">{answer.summary}</p>
          <Link href={`/answers/${answer.slug}`} className="font-ui mt-3 inline-flex min-h-11 items-center text-xs text-saffron-deep underline underline-offset-4">Read the reviewed answer →</Link>
        </article>)}
      </div>
    </section>
  </PublicPageFrame>;
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicPageFrame } from "@/components/PublicPageFrame";
import { getPublishedAnswer, publishedAnswers } from "@/content/answers";

export const dynamicParams = false;

export function generateStaticParams() {
  return publishedAnswers.map(({ slug }) => ({ slug }));
}

type AnswerPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: AnswerPageProps): Promise<Metadata> {
  const { slug } = await params;
  const answer = getPublishedAnswer(slug);
  if (!answer) notFound();
  const url = `/answers/${answer.slug}`;
  return {
    title: `${answer.title} | Gandhi Says`,
    description: answer.summary,
    alternates: { canonical: url },
    openGraph: { title: answer.title, description: answer.summary, url, type: "article", publishedTime: answer.publishedAt, images: ["/opengraph-image"] },
    twitter: { card: "summary_large_image", title: answer.title, description: answer.summary, images: ["/twitter-image"] },
  };
}

export default async function AnswerPage({ params }: AnswerPageProps) {
  const { slug } = await params;
  const answer = getPublishedAnswer(slug);
  if (!answer || !answer.shortAnswer || !answer.publishedAt) notFound();

  const canonicalUrl = `https://www.gandhisays.in/answers/${answer.slug}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: answer.title,
    description: answer.summary,
    datePublished: answer.publishedAt,
    dateModified: answer.publishedAt,
    mainEntityOfPage: canonicalUrl,
    publisher: { "@type": "Organization", name: "Gandhi Says", url: "https://www.gandhisays.in" },
  };

  return <PublicPageFrame>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <article className="paper-card rounded-[28px] border border-earth/10 px-5 py-7 sm:px-8 sm:py-9">
      <Link href="/answers" className="font-ui inline-flex min-h-11 items-center text-xs text-ink-soft underline underline-offset-4">← All reviewed answers</Link>
      <p className="font-ui mt-3 text-[11px] tracking-[0.2em] text-earth uppercase">Historical answer</p>
      <h1 className="font-display mt-2 text-4xl font-semibold leading-tight text-ink sm:text-5xl">{answer.title}</h1>
      <p className="mt-4 text-[16px] leading-7 text-ink-soft">{answer.summary}</p>

      <section className="mt-7 rounded-2xl border-l-2 border-saffron bg-khadi/60 px-5 py-5" aria-labelledby="short-answer">
        <h2 id="short-answer" className="font-ui text-xs tracking-[0.16em] text-saffron-deep uppercase">The short answer</h2>
        <p className="mt-3 text-[17px] leading-8 text-ink">{answer.shortAnswer}</p>
      </section>

      <div className="mt-8 space-y-7">
        {answer.sections.map((section) => <section key={section.heading}>
          <p className="font-ui text-[11px] tracking-[0.16em] text-earth uppercase">{section.kind === "interpretation" ? "Modern interpretation boundary" : "Historical evidence"}</p>
          <h2 className="font-display mt-1 text-2xl font-semibold text-ink">{section.heading}</h2>
          <p className="mt-2 text-[16px] leading-8 text-ink-soft">{section.body}</p>
        </section>)}
      </div>

      <section className="mt-9 border-t border-earth/15 pt-6" aria-labelledby="sources">
        <h2 id="sources" className="font-display text-2xl font-semibold text-ink">Sources and claims supported</h2>
        <ol className="mt-4 grid gap-4">
          {answer.sources.map((source) => <li key={source.url} className="rounded-xl border border-earth/15 p-4 text-[15px] leading-6">
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-saffron-deep underline underline-offset-4">{source.title} ↗</a>
            <p className="mt-1 text-sm text-ink-soft">{[source.author, source.date, source.locator].filter(Boolean).join(" · ")}</p>
            <p className="mt-2 text-sm text-ink-soft"><span className="font-ui text-xs text-earth">Supports:</span> {source.claimSupported}</p>
          </li>)}
        </ol>
      </section>
    </article>
  </PublicPageFrame>;
}

/** Archival context, separate from generated answers and gated by image rights. */
import Link from "next/link";
import { ARCHIVE_IMAGE, archiveImageVisible } from "@/lib/archive-image";

export const metadata = { title: "About | Gandhi Says" };

const transcription = `Sinhagadh
near Poona
24. 4. 20
Dear Sir,
will you please
circulate the
enclosed to the
Press & oblige.
Yours truly,
M. K. Gandhi
The Manager
The A. P.
Bombay`;

export default function AboutPage() {
  return <div className="khadi-grain min-h-dvh">
    <div className="flag-bar h-1.5 w-full" />
    <main className="mx-auto w-full max-w-3xl px-5 py-5 sm:px-8">
      <Link href="/" className="font-ui inline-flex min-h-11 items-center text-xs text-ink-soft underline underline-offset-4">Back to questions</Link>
      <section className="paper-card rounded-[28px] border border-earth/10 px-5 py-6 sm:px-8">
        <h1 className="font-display text-3xl text-ink">What a historical source looks like</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">Historical answers on this site point to documents like this one. Answers about present-day questions are interpretations of his principles, not his words.</p>
        <div className={`mt-5 grid items-start gap-6 ${archiveImageVisible ? "md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" : ""}`}>
        {archiveImageVisible && <figure className="min-w-0">
          <a href="/assets/archive/gandhi-note-full.webp" target="_blank" rel="noopener noreferrer" aria-label="Open full-size letter (opens in a new tab)" className="block rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-saffron">
          {/* Pre-sized WebP needs no runtime optimisation or client component. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/archive/gandhi-note-full.webp" width={1400} height={2194} loading="lazy" decoding="async"
            alt="Handwritten note signed M. K. Gandhi, dated 24 April 1920, requesting that an enclosure be circulated to the press."
            className="mx-auto h-auto max-h-[420px] w-auto max-w-full object-contain" />
          </a>
          <a href="/assets/archive/gandhi-note-full.webp" target="_blank" rel="noopener noreferrer" className="font-ui inline-flex min-h-11 items-center text-xs text-ink-soft underline underline-offset-4">Open full-size letter (new tab)</a>
          <figcaption className="font-ui mt-3 text-xs leading-5 text-ink-soft">
            <span>Note from M. K. Gandhi, Sinhagad, near Poona, 24 April 1920, asking the manager of &quot;the A. P.&quot; in Bombay to circulate an enclosed statement to the press.</span>
            <span className="block">{ARCHIVE_IMAGE.credit}{ARCHIVE_IMAGE.licence ? ` · ${ARCHIVE_IMAGE.licence}` : ""}</span>
          </figcaption>
        </figure>}
        <div className="min-w-0">
        <h2 className="font-ui text-sm text-earth">Transcription</h2>
        <p className="mt-3 whitespace-pre-line text-[15px] leading-7 text-ink">{transcription}</p>
        </div>
        </div>
      </section>
    </main>
  </div>;
}

# Archival letter presentation

`ARCHIVE_IMAGE` is server-only configuration in `lib/archive-image.ts`:

- `enabled`: true by default following the site owner's publication instruction;
  set `ARCHIVE_IMAGE_ENABLED=false` to disable.
- `credit`: "Image supplied by the site owner" by default; override with
  `ARCHIVE_IMAGE_CREDIT` (whitespace is trimmed).
- `licence`: empty unless `ARCHIVE_IMAGE_LICENCE` is supplied.

An enabled image without credit fails config loading and therefore the build.
The credit identifies who supplied the image, not a photographer or rights holder.
No public-domain licence claim is added. Disabled pages contain neither derived
image URL in HTML or CSS.
The WebP assets remain directly accessible static files; the gate controls rendering.

Keep the source at `assets/archive/source/gandhi-note-1920.jpg`, outside `public`.
Do not import it into application code. Generate the two public WebPs using
`node scripts/derive-archive-image.cjs` (or pass the source path). The deterministic
crop uses the supplied 1460 × 2288 original and strips metadata during encoding.
Only body handwriting is used for decoration; the complete letter is confined
to `/about`. Neither image is social metadata, branding, or answer content.

The texture is a server-rendered slot, omitted when disabled and removed when
a conversation starts. It is lazy, low-priority, clipped to the header at 5%
opacity. There is no dark theme. The enabled header eyebrow uses the existing
`ink-soft` token rather than `earth` to maintain AA text contrast over the texture.
The decorative image is limited to a 160px-wide header detail so it does not
become the largest contentful paint element. Both pre-encoded images use native
lazy loading, avoiding image-component JavaScript.

Run `scripts/archive-browser-check.cjs` against a production build with
`PLAYWRIGHT_MODULE` pointing to Playwright. For the enabled fixture build use
`ARCHIVE_IMAGE_ENABLED=true ARCHIVE_IMAGE_CREDIT='Test credit'
ARCHIVE_IMAGE_LICENCE='Test licence'` and run tests with
`ARCHIVE_TEST_ENABLED=true`. These are local test values, never production credit.

## Acceptance evidence (23 September 2026)

- Enabled-without-credit production build fails naming `ARCHIVE_IMAGE.credit`.
- Disabled production build passes; rendered HTML/CSS contain no derived image
  references. Disabled browser checks pass at 375px and 1280px, as do the existing
  copy and answer-microcopy browser checks.
- Enabled fixture passes at 375px and 1280px: exact caption/alt/transcription,
  header-only texture, no image once conversation starts, no sideways scrolling,
  original JPG URL returns 404. Minimum sampled header text contrast: 4.70:1.
- Texture: 1240 × 685, 43,206 bytes. Full: 1400 × 2194, 111,362 bytes.
- Crop inspected visually: no date, place, signature, salutation closing or address.
- Local Lighthouse mobile comparison: baseline 3,178.94 ms LCP; final enabled
  build 3,256.81 ms (+77.88 ms). This is a single-run local comparison, not a
  production field-performance guarantee. Earlier candidates exceeded the limit
  and were revised before delivery.
- All 89 existing unit tests pass; no prompt, retrieval, routing or answer changes.

export type AnswerSection = {
  kind: "historical" | "interpretation" | "context";
  heading: string;
  body: string;
};

export type AnswerSource = {
  title: string;
  author?: string;
  date?: string;
  locator?: string;
  url: string;
  claimSupported: string;
};

export type AnswerRecord = {
  title: string;
  slug: string;
  summary: string;
  shortAnswer?: string;
  sections: AnswerSection[];
  sources: AnswerSource[];
  status: "draft" | "published";
  publishedAt?: string;
};

/**
 * Editorial content source for permanent answer pages.
 * Draft records deliberately contain no answer prose or citations until review is complete.
 */
export const answerRecords: readonly AnswerRecord[] = [
  {
    title: "Why did Gandhi spin his own cloth?",
    slug: "why-gandhi-spun-his-own-cloth",
    summary:
      "Adopting hand-woven cloth brought Gandhi and the Sabarmati Ashram into contact with weavers’ hardships. He then pursued spinning to reduce their remaining dependence on mills.",
    shortAnswer:
      "Gandhi and other members of the Sabarmati Ashram first adopted hand-woven cloth made from Indian yarn. That experience revealed the hardships facing weavers. Because the yarn still came from mills, they then pursued hand-spinning to reduce that dependence and make self-reliance more practical.",
    sections: [
      {
        kind: "historical",
        heading: "What Gandhi recorded",
        body:
          "In his autobiography, Gandhi said the Sabarmati Ashram first resolved to wear hand-woven cloth made only from Indian yarn. That choice brought its members into direct contact with weavers and taught them about obstacles to obtaining yarn, fraud, and growing indebtedness.",
      },
      {
        kind: "historical",
        heading: "Why spinning followed",
        body:
          "The ashram still depended on Indian mills for yarn. Gandhi wrote that this made its members feel like agents of those mills rather than independent producers. They therefore sought to spin their own yarn as well as weave their cloth. In the same account, he connected relief from mass poverty with the establishment of swaraj.",
      },
      {
        kind: "interpretation",
        heading: "Where interpretation begins",
        body:
          "The historical record supports an economic and political explanation for spinning. It does not, by itself, prove that Gandhi required every person in every circumstance to make their own clothes. Applying this example to present-day consumption, technology, or employment is a modern interpretation.",
      },
    ],
    sources: [
      {
        title: "An Autobiography or The Story of My Experiments with Truth",
        author: "M. K. Gandhi",
        locator: "Part V, Chapter XL, “The Birth of Khadi”",
        url: "https://www.mkgandhi.in/autobio/chap163.htm",
        claimSupported:
          "The ashram’s hand-woven-cloth pledge, what members learned about weavers, their continued dependence on mills, and the decision to spin yarn.",
      },
    ],
    status: "published",
    publishedAt: "2026-10-02",
  },
  {
    title: "What did Gandhi believe about wealth and possessions?",
    slug: "gandhi-on-wealth-and-possessions",
    summary:
      "Examine non-possession and trusteeship without conflating them or turning trusteeship into a fixed donation rule.",
    sections: [],
    sources: [],
    status: "draft",
  },
  {
    title: "What did non-violence require for Gandhi?",
    slug: "gandhi-on-non-violence",
    summary:
      "Distinguish Gandhi’s ethical ideal, political method, immediate protection, and claims that changed with context.",
    sections: [],
    sources: [],
    status: "draft",
  },
  {
    title: "How might Gandhi think about meaningful work?",
    slug: "gandhi-on-meaningful-work",
    summary:
      "Compare bread labour, service, vocation, and economic obligation without turning Gandhi into a source of modern career advice.",
    sections: [],
    sources: [],
    status: "draft",
  },
  {
    title: "How might Gandhi judge personal ambition?",
    slug: "gandhi-on-ambition",
    summary:
      "Examine ambition through self-rule, status, service, and attachment without treating achievement as inherently forbidden.",
    sections: [],
    sources: [],
    status: "draft",
  },
  {
    title: "How might Gandhi’s ideas apply to social media?",
    slug: "gandhi-and-social-media",
    summary:
      "Apply truth, non-violence, and self-rule to modern platforms while marking every technology-specific conclusion as interpretation.",
    sections: [],
    sources: [],
    status: "draft",
  },
];

const duplicateSlugs = answerRecords
  .map(({ slug }) => slug)
  .filter((slug, index, slugs) => slugs.indexOf(slug) !== index);

if (duplicateSlugs.length > 0) {
  throw new Error(`Answer slugs must be unique: ${duplicateSlugs.join(", ")}`);
}

export const publishedAnswers = answerRecords.filter((answer) => {
  if (answer.status !== "published") return false;
  if (!answer.shortAnswer || answer.sections.length === 0 || answer.sources.length === 0 || !answer.publishedAt) {
    throw new Error(`Published answer "${answer.slug}" is missing reviewed content, sources, or a publication date.`);
  }
  return true;
});

export function getPublishedAnswer(slug: string) {
  return publishedAnswers.find((answer) => answer.slug === slug);
}

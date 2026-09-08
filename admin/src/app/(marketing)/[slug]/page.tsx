import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { marked } from "marked";

/*
 * Legal pages (Terms, Privacy, Refund) are authored as Markdown in `admin/public/*.md` and
 * rendered here so editing the Markdown is the only step — no code change, no copy duplicated
 * into TSX. `revalidate` below means a running deployment picks up an edited file within the
 * window; `next dev` re-reads on every request.
 *
 * Slugs match the in-Markdown cross-links (`/privacy`, `/refund-policy`).
 */
const PAGES = {
  terms: { file: "tos.md", title: "Terms of Service" },
  privacy: { file: "privacy.md", title: "Privacy Policy" },
  "refund-policy": { file: "refund.md", title: "Refund Policy" },
} as const;

type Slug = keyof typeof PAGES;

export const dynamicParams = false;
export const revalidate = 300;

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

async function loadHtml(slug: Slug): Promise<string> {
  const md = await readFile(path.join(process.cwd(), "public", PAGES[slug].file), "utf8");
  return marked.parse(md, { async: false });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = PAGES[slug as Slug];
  if (!page) return {};
  return { title: page.title, alternates: { canonical: `/${slug}` } };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(slug in PAGES)) notFound();

  // ponytail: content is first-party Markdown committed to this repo, not user input — no sanitizer.
  const html = await loadHtml(slug as Slug);

  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <article className="legal-doc" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

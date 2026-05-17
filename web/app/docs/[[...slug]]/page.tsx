import { source } from "@/lib/source";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMDXComponents } from "@/mdx-components";

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDXContent = page.data.body;
  const isIndex = !params.slug || params.slug.length === 0;

  return (
    <article>
      {!isIndex && (
        <Link
          href="/docs"
          className="docs-back mb-4 inline-block text-xs uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
        >
          ← all docs
        </Link>
      )}
      <h1>{page.data.title}</h1>
      {page.data.description && (
        <p className="docs-description">{page.data.description}</p>
      )}
      <MDXContent components={getMDXComponents()} />
    </article>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
  };
}

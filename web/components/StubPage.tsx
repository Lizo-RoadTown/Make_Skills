"use client";
import Link from "next/link";

type Props = {
  title: string;
  pillar: string;
  blurb: string;
  bullets: string[];
  references?: { label: string; href: string; external?: boolean }[];
};

export function StubPage({ title, pillar, blurb, bullets, references }: Props) {
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900 px-6 py-3">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          {pillar}
        </div>
        <h1 className="text-lg font-semibold text-zinc-200">{title}</h1>
      </header>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-10 text-zinc-300">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-amber-300">
            Placeholder — direction set, build queued. The roadmap and design
            proposals already cover what this becomes.
          </div>
          <p className="mt-6 leading-relaxed">{blurb}</p>
          <h2 className="mt-8 text-base font-semibold text-zinc-200">
            What this becomes
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-sm">
            {bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
          {references && references.length > 0 && (
            <>
              <h2 className="mt-8 text-base font-semibold text-zinc-200">
                Where it&apos;s tracked
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                {references.map((r, i) => (
                  <li key={i}>
                    {r.external ? (
                      <a
                        href={r.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        {r.label} ↗
                      </a>
                    ) : (
                      <Link
                        href={r.href}
                        className="text-blue-400 hover:underline"
                      >
                        {r.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

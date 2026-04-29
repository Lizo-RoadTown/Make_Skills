import { DocsLayout } from "fumadocs-ui/layouts/docs";
import "fumadocs-ui/style.css";
import type { ReactNode } from "react";
import { source } from "@/lib/source";
import { RootProvider } from "fumadocs-ui/provider/next";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootProvider>
      <DocsLayout
        tree={source.pageTree}
        nav={{
          title: "Make_Skills",
          url: "/docs",
        }}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}

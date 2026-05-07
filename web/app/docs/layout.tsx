/**
 * Docs layout — keeps the parent Make_Skills sidebar visible.
 *
 * Fumadocs's `DocsLayout` replaces the parent shell with its own nav
 * + sidebar, which strips the Make_Skills sidebar and breaks unified
 * navigation. We use only `RootProvider` (needed for theming + MDX
 * component context) and let docs render under the parent sidebar
 * with the existing `.roadmap-md` typography rules.
 */
import "fumadocs-ui/style.css";
import type { ReactNode } from "react";
import { RootProvider } from "fumadocs-ui/provider/next";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      theme={{
        defaultTheme: "dark",
        enableSystem: false,
        forcedTheme: "dark",
      }}
    >
      <div className="roadmap-md mx-auto max-w-3xl px-8 py-6">
        {children}
      </div>
    </RootProvider>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import "highlight.js/styles/github-dark.css";

export const metadata: Metadata = {
  title: "Make_Skills",
  description: "Personal agent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full overflow-hidden bg-zinc-900 text-zinc-100">
        {children}
      </body>
    </html>
  );
}

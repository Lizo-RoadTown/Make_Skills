import type { Metadata } from "next";
import "./globals.css";
import "highlight.js/styles/github-dark.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Make_Skills",
  description: "Personal agent platform — humancensys.com",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="h-full overflow-hidden bg-zinc-900 text-zinc-100">
        <div className="flex h-full">
          <Sidebar />
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}

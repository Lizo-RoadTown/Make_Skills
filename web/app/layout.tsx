import type { Metadata } from "next";
import "./globals.css";
import "highlight.js/styles/github-dark.css";
import { Sidebar } from "@/components/Sidebar";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";

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
    <html lang="en" className="h-full antialiased dark">
      <body className="h-full bg-zinc-900 text-zinc-100">
        <AuthSessionProvider>
          <div className="flex h-full">
            <Sidebar />
            <main className="flex-1 min-w-0 h-full overflow-auto">
              {children}
            </main>
          </div>
        </AuthSessionProvider>
      </body>
    </html>
  );
}

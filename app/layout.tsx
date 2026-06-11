import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Ollama Chat Lab",
  description: "A local playground for testing Ollama language models.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

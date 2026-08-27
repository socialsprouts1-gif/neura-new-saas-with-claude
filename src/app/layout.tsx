import type { Metadata } from "next";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Neura Chat — AI-Powered WhatsApp Automation Platform",
  description: "Automate customer support, lead generation, sales, follow-ups, and engagement with AI-powered WhatsApp workflows.",
  keywords: "WhatsApp automation, AI chatbot, WhatsApp marketing, CRM, lead generation",
  // src/app/icon.svg is picked up automatically; naming it here as well
  // covers the browsers that ask for a link tag rather than the convention.
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "Neura Chat — AI-Powered WhatsApp Automation Platform",
    description:
      "Automate customer support, lead generation, sales, follow-ups, and engagement with AI-powered WhatsApp workflows.",
    images: ["/logo.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before first paint. Without it the dark
            default renders and then snaps to light on hydration. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="antialiased bg-[var(--app-bg)] text-[var(--color-white)]">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WhatsFlow AI — AI-Powered WhatsApp Automation Platform",
  description: "Automate customer support, lead generation, sales, follow-ups, and engagement with AI-powered WhatsApp workflows.",
  keywords: "WhatsApp automation, AI chatbot, WhatsApp marketing, CRM, lead generation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#050508] text-white">
        {children}
      </body>
    </html>
  );
}

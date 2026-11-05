import Link from "next/link";
import type { Metadata } from "next";
import { Bell, Monitor, Smartphone, Wifi, Zap } from "lucide-react";
import InstallApp from "@/components/InstallApp";

// The page a "Download the app" link points at.
//
// Written for somebody who expected an APK and is about to be told
// there isn't one. So it does not explain what a PWA is — it says
// "install", shows a button, and the install happens. The word
// "progressive web app" appears nowhere, because nobody outside this
// industry has ever wanted one by name.

export const metadata: Metadata = {
  title: "Get the Neura Chat app",
  description:
    "Install Neura Chat on your phone, tablet or computer. Runs from your home screen, no app store, no download.",
};

const POINTS = [
  { icon: Smartphone, title: "On your phone", body: "An icon on your home screen. Opens full screen, no browser bar." },
  { icon: Monitor, title: "On your computer", body: "Its own window on Windows and Mac, separate from your browser tabs." },
  { icon: Zap, title: "Always current", body: "Updates arrive the moment we ship them. Nothing to download again." },
  { icon: Wifi, title: "Honest offline", body: "No signal gets a clear screen, not a broken one. Nothing is lost." },
];

export default function AppPage() {
  return (
    <main className="marketing min-h-dvh px-5 py-16 sm:py-24">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-192.png"
            alt=""
            className="w-16 h-16 rounded-2xl border border-white/10"
          />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Get the app</h1>
            <p className="text-white/50 text-sm mt-1">Phone, tablet or computer. Takes a few seconds.</p>
          </div>
        </div>

        <div className="glass-card p-6 sm:p-7 mb-8">
          <InstallApp className="mb-1" />
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-10">
          {POINTS.map((point) => (
            <div key={point.title} className="rounded-2xl border border-white/8 bg-white/4 p-5">
              <point.icon className="w-5 h-5 text-accent mb-3" />
              <h2 className="text-[15px] font-semibold mb-1">{point.title}</h2>
              <p className="text-[13px] text-white/45 leading-relaxed">{point.body}</p>
            </div>
          ))}
        </div>

        {/* --- the three ways, written out ------------------------------- */}
        <h2 className="text-lg font-semibold mb-4">If the button did not appear</h2>
        <div className="space-y-4 mb-10">
          <Platform title="Android — Chrome">
            Tap the <span className="text-white/80">⋮</span> menu, then{" "}
            <span className="text-white/80">Add to Home screen</span> or{" "}
            <span className="text-white/80">Install app</span>.
          </Platform>
          <Platform title="iPhone and iPad — Safari">
            Tap <span className="text-white/80">Share</span> at the bottom, scroll down, then{" "}
            <span className="text-white/80">Add to Home Screen</span>. It has to be Safari —
            Chrome on iPhone cannot install apps.
          </Platform>
          <Platform title="Windows and Mac — Chrome or Edge">
            Click the install icon at the right-hand end of the address bar, or open the{" "}
            <span className="text-white/80">⋮</span> menu and choose{" "}
            <span className="text-white/80">Install Neura Chat</span>.
          </Platform>
        </div>

        {/* --- the question everybody asks -------------------------------- */}
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 mb-10">
          <h2 className="text-[15px] font-semibold mb-2 flex items-center gap-2">
            <Bell className="w-4 h-4 text-white/40" />
            Is there an APK?
          </h2>
          <p className="text-[13.5px] text-white/60 leading-relaxed">
            No, and you do not want one. An APK only runs on Android — never on a computer or an
            iPhone — and installing one outside the Play Store makes Android warn your customers
            that the file is unsafe. Installing from here puts the same app on every device, with
            no warning and no file to keep up to date.
          </p>
        </div>

        <p className="text-sm text-white/40">
          <Link href="/" className="text-accent-ink hover:underline">
            Back to Neura Chat
          </Link>
        </p>
      </div>
    </main>
  );
}

function Platform({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[14px] font-medium mb-1">{title}</h3>
      <p className="text-[13.5px] text-white/60 leading-relaxed">{children}</p>
    </div>
  );
}

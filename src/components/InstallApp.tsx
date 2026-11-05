"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Download, Share, Plus } from "lucide-react";

// Installing the app, on whichever device somebody is holding.
//
// Three platforms, three completely different stories, and the usual
// mistake is writing instructions for one and hoping. Android gets a
// real button; iPhone gets a sentence pointing at the Share menu,
// because Apple does not allow the button; desktop gets the icon in the
// address bar.
//
// Which one you see is decided by what the browser offers, not by
// guessing from the user agent — a guess is wrong for every iPad since
// 2019, which reports itself as a Mac.

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const register = () => {
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      // Not fatal. The site works without it; only installing and the
      // offline page are lost.
      console.warn("Service worker did not register", error);
    });
  };

  // Waiting for `load` unconditionally is the usual version of this, and
  // it never runs: React hydrates after the page has loaded, so the
  // event being listened for has already happened. Caught by checking
  // whether a worker was actually registered rather than whether the
  // code looked right.
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

const STANDALONE = "(display-mode: standalone)";

/**
 * Whether this is already running as an installed app.
 *
 * Read through useSyncExternalStore rather than set from an effect:
 * it is a fact about the browser, not state this component owns, and
 * reading it in an effect means one render showing the wrong answer
 * before the right one arrives.
 */
function subscribeInstalled(onChange: () => void): () => void {
  const query = window.matchMedia(STANDALONE);
  query.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    query.removeEventListener("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

function readInstalled(): boolean {
  return (
    window.matchMedia(STANDALONE).matches ||
    // Safari's own, older flag. Still the only one iOS sets.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Safari on an iPhone or iPad, which is the only place Apple's
 * instructions apply — and the only browser that cannot offer a button.
 *
 * Cached because it cannot change without a reload, and getSnapshot is
 * called on every render.
 */
let iosCache: boolean | null = null;

function readIsIOS(): boolean {
  if (iosCache !== null) return iosCache;
  const ua = window.navigator.userAgent;
  // An iPad has reported itself as a Mac since iPadOS 13, so the touch
  // point count is what tells them apart.
  const touchApple = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);
  iosCache = touchApple && safari;
  return iosCache;
}

/** Nothing to subscribe to: the answer cannot change without a reload. */
function subscribeNever(): () => void {
  return () => {};
}

export default function InstallApp({ className = "" }: { className?: string }) {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);

  // false on the server, where there is no browser to ask.
  const installed = useSyncExternalStore(subscribeInstalled, readInstalled, () => false);
  const isIOS = useSyncExternalStore(subscribeNever, readIsIOS, () => false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      // Stop Chrome's own mini-banner so there is one way in, not two.
      event.preventDefault();
      setPrompt(event as InstallEvent);
    };
    const onInstalled = () => setPrompt(null);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <p className={`inline-flex items-center gap-2 text-sm text-accent-ink ${className}`}>
        <Check className="w-4 h-4" />
        Installed — you are using the app
      </p>
    );
  }

  if (prompt) {
    return (
      <button
        type="button"
        onClick={() => {
          void prompt.prompt();
          void prompt.userChoice.finally(() => setPrompt(null));
        }}
        className={`btn-primary ${className}`}
      >
        <Download className="w-4 h-4" />
        Install the app
      </button>
    );
  }

  if (isIOS) {
    return (
      <p className={`text-sm text-white/70 leading-relaxed ${className}`}>
        To install: tap{" "}
        <Share className="w-4 h-4 inline-block -mt-0.5 text-white/80" />{" "}
        <span className="text-white/80">Share</span> at the bottom of Safari, then{" "}
        <Plus className="w-4 h-4 inline-block -mt-0.5 text-white/80" />{" "}
        <span className="text-white/80">Add to Home Screen</span>.
      </p>
    );
  }

  // Desktop Chrome and Edge before the prompt fires, or a browser that
  // does not support installing at all. Naming the icon beats a button
  // that might do nothing.
  return (
    <p className={`text-sm text-white/70 leading-relaxed ${className}`}>
      To install, click the install icon at the right of your browser&apos;s address bar. On a
      phone, open this page in Chrome or Safari.
    </p>
  );
}

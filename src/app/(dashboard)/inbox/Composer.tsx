"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";

// Posts through the authenticated send endpoint rather than a server action,
// so outbound sending has one code path shared with any future API client.
export default function Composer({ orgId, contactId }: { orgId: string; contactId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, contactId, body: text }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error ?? `Send failed (${res.status})`);
        return;
      }

      setBody("");
      router.refresh();
    } catch {
      setError("Network error — the message was not sent.");
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={send} className="border-t border-white/8 p-4 bg-[#0A0A0F]/60">
      {error && (
        <p className="text-xs text-red-400 mb-2" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 bg-white/5 border border-white/12 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00FF87]/50"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="btn-primary px-4 disabled:opacity-40"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      <p className="text-[11px] text-white/30 mt-2">
        Free-form replies are only delivered inside WhatsApp&apos;s 24-hour customer service
        window. Outside it, use an approved template.
      </p>
    </form>
  );
}

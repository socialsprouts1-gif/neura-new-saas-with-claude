"use client";

import { MessageSquare } from "lucide-react";
import ActionForm, { Field, TextareaField } from "@/components/ui/ActionForm";
import type { Slot } from "@/lib/appointments";
import { saveBookingBot } from "../appointment-actions";

/**
 * The booking conversation's words, and the switch that turns it on.
 *
 * The preview beside it is what a customer would actually be offered right
 * now — the quickest way to notice that every day has been closed, or that
 * the notice period has swallowed the whole horizon.
 */
export default function BotEditor({
  enabled,
  keywords,
  messages,
  canManage,
  nextSlots,
  timezone,
  hasServices,
}: {
  enabled: boolean;
  keywords: string[];
  messages: {
    location: string;
    greeting: string;
    confirmation: string;
    noSlots: string;
    cancelled: string;
  };
  canManage: boolean;
  nextSlots: Slot[];
  timezone: string;
  hasServices: boolean;
}) {
  if (!canManage) {
    return (
      <div className="glass-card p-6">
        <p className="text-sm text-white/50">Only owners and admins can change the booking bot.</p>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-4 items-start">
      <ActionForm action={saveBookingBot} submitLabel="Save booking bot" className="glass-card p-6">
        <h3 className="font-semibold mb-1">The booking conversation</h3>
        <p className="text-xs text-white/45 mb-5 leading-relaxed">
          When a customer sends one of the words below, they get a menu of what you offer, then the
          days that have something free, then the times on the day they picked. Tapping a time books
          it. Nobody on your side has to be awake for any of it.
        </p>

        <div className="space-y-4">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              name="is_enabled"
              defaultChecked={enabled}
              className="accent-[var(--accent)] w-4 h-4"
            />
            <span className="text-sm text-white/80">
              Let customers book on WhatsApp
              {!hasServices && (
                <span className="block text-[11px] text-[#FACC15]">
                  Add a service on the Services tab first — there is nothing to offer yet.
                </span>
              )}
            </span>
          </label>

          <Field
            label="Words that start a booking"
            name="trigger_keywords"
            defaultValue={keywords.join(", ")}
            placeholder="book, appointment, schedule"
            hint="Separated by commas. Matched as whole words, so “book” does not fire on “bookkeeping”. Single words only — a phrase would never match."
          />

          <Field
            label="Default location"
            name="location"
            defaultValue={messages.location}
            placeholder="Shop 4, MG Road"
            hint="Used for any service that has none of its own."
          />

          <TextareaField
            label="Opening line"
            name="greeting"
            rows={2}
            defaultValue={messages.greeting}
            placeholder="Happy to book you in. What would you like to book?"
          />

          <TextareaField
            label="Confirmation"
            name="confirmation"
            rows={3}
            defaultValue={messages.confirmation}
            hint="Placeholders: {{date}} {{time}} {{service}} {{duration}} {{name}} {{location}}. One it does not know is left as it is, rather than becoming a gap."
          />

          <TextareaField
            label="When nothing is free"
            name="no_slots_message"
            rows={2}
            defaultValue={messages.noSlots}
          />

          <TextareaField
            label="When they change their mind"
            name="cancelled_message"
            rows={2}
            defaultValue={messages.cancelled}
            hint="Sent when a customer taps “Not now” or types cancel mid-booking."
          />
        </div>
      </ActionForm>

      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-accent-ink" />
          <h4 className="font-semibold text-sm">What a customer sees now</h4>
        </div>

        {nextSlots.length === 0 ? (
          <p className="text-xs text-white/50 leading-relaxed">
            Nothing free. Check the Availability tab — every day may be closed, the shortest notice
            may be longer than the horizon, or the next fortnight may be fully booked.
          </p>
        ) : (
          <>
            <p className="text-xs text-white/45 mb-3 leading-relaxed">
              The next times on offer, in {timezone}.
            </p>
            <ul className="space-y-1.5">
              {nextSlots.map((slot) => (
                <li
                  key={slot.startsAt}
                  className="flex items-center justify-between text-xs rounded-lg bg-white/4 border border-white/8 px-3 py-2"
                >
                  <span className="text-white/60">{slot.dateLabel}</span>
                  <span className="text-white font-medium tabular-nums">{slot.timeLabel}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

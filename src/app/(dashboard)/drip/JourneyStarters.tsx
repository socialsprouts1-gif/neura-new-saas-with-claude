"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ChevronDown, Loader2, Sparkles, Wand2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { buildJourneyFromStarter } from "../journey-actions";
import {
  JOURNEY_STARTERS,
  describeStarter,
  industries,
  type JourneyStarter,
} from "@/lib/journey-starters";
import { APPOINTMENT_EVENTS, describeDuration } from "@/lib/drip";
import type { AppointmentTypeChoice, NumberChoice } from "./DripBuilder";

// Ready-made journeys, by trade.
//
// The point of this screen is that somebody can read the actual messages
// before anything is created. A "dental follow-up template" that hides its
// words behind a Use button is something nobody switches on, because the
// first thing they would have to do is check what it says to their own
// customers — so it may as well show them up front.

export default function JourneyStarters({
  numbers,
  appointmentTypes,
}: {
  numbers: NumberChoice[];
  appointmentTypes: AppointmentTypeChoice[];
}) {
  const trades = useMemo(() => industries(), []);
  const [trade, setTrade] = useState<string>(trades[0] ?? "");
  const [chosen, setChosen] = useState<JourneyStarter | null>(null);

  const shown = JOURNEY_STARTERS.filter(
    (starter) => starter.industry === trade || starter.industry === "Any business"
  );

  return (
    <div className="rounded-3xl border border-white/10 bg-white/3 p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
          <Sparkles className="w-4.5 h-4.5 text-accent-ink" />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold">Start from a ready-made journey</h2>
          <p className="text-xs text-white/50 mt-0.5 leading-relaxed max-w-2xl">
            Pick what you do. The messages, the gaps and the WhatsApp templates are all written —
            they go to Meta for approval and the sequence waits as a draft until you switch it on.
          </p>
        </div>
      </div>

      {/* The trade picker. Chips rather than a dropdown: the list is the
          answer to "is my kind of business in here", and a closed dropdown
          does not answer it. */}
      <div className="flex flex-wrap gap-2 mb-4">
        {trades.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setTrade(name)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              trade === name
                ? "border-accent/50 bg-accent/15 text-accent-ink"
                : "border-white/12 bg-white/4 text-white/60 hover:border-white/25"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {shown.map((starter) => (
          <StarterCard key={starter.key} starter={starter} onUse={() => setChosen(starter)} />
        ))}
      </div>

      {chosen && (
        <UseStarter
          starter={chosen}
          numbers={numbers}
          appointmentTypes={appointmentTypes}
          onClose={() => setChosen(null)}
        />
      )}
    </div>
  );
}

function StarterCard({ starter, onUse }: { starter: JourneyStarter; onUse: () => void }) {
  const [open, setOpen] = useState(false);
  const event = APPOINTMENT_EVENTS.find((entry) => entry.key === starter.event);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 p-4 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-snug">{starter.name}</h3>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/8 text-white/60">
              {starter.industry}
            </span>
            <span className="text-[11px] text-white/45">{describeStarter(starter)}</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-white/50 mt-2.5 leading-relaxed">{starter.description}</p>

      <p className="text-[11px] text-white/40 mt-2">
        Starts: <span className="text-white/60">{event?.label.toLowerCase() ?? starter.event}</span>
      </p>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 text-[11px] font-medium text-white/55 hover:text-white/80 mt-3 transition-colors"
      >
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        {open ? "Hide the messages" : "Read the messages"}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {starter.steps.map((step, index) => (
            <div key={step.slug} className="rounded-xl bg-white/5 border border-white/8 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-4 h-4 rounded-full bg-accent/15 text-accent-ink text-[10px] font-bold flex items-center justify-center">
                  {index + 1}
                </span>
                <span className="text-[11px] text-white/45">
                  {index === 0
                    ? "straight away"
                    : `after ${describeDuration(
                        starter.steps.slice(0, index).reduce((sum, s) => sum + s.waitMinutes, 0)
                      )}`}
                </span>
              </div>
              <p className="text-[12px] text-white/75 whitespace-pre-line leading-relaxed">
                {step.body}
              </p>
              {step.footer && (
                <p className="text-[11px] text-white/35 mt-1.5 italic">{step.footer}</p>
              )}
            </div>
          ))}
          <p className="text-[11px] text-white/40 leading-relaxed">
            You can change every word of this afterwards — but the words have to be approved by
            Meta, so edit before you switch it on rather than after.
          </p>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-white/8 flex justify-end">
        <button type="button" onClick={onUse} className="btn-primary text-xs">
          <Wand2 className="w-3.5 h-3.5" />
          Use this
        </button>
      </div>
    </div>
  );
}

function UseStarter({
  starter,
  numbers,
  appointmentTypes,
  onClose,
}: {
  starter: JourneyStarter;
  numbers: NumberChoice[];
  appointmentTypes: AppointmentTypeChoice[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [service, setService] = useState("");
  const [number, setNumber] = useState("");

  const field =
    "w-full bg-white/5 border border-white/12 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-accent/50 transition-all";
  const label = "block text-xs font-medium text-white/70 mb-1.5";

  const create = async () => {
    setBusy(true);
    const body = new FormData();
    body.set("starter", starter.key);
    if (service) body.set("appointment_type_id", service);
    if (number) body.set("connection_id", number);

    const result = await buildJourneyFromStarter(body).catch(() => ({
      ok: false as const,
      error: "That could not be created just now.",
      message: undefined,
    }));
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error ?? "That could not be created.");
      return;
    }
    toast.success(result.message ?? "Created as a draft.");
    onClose();
    router.refresh();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={starter.name}
      description="Created as a draft. Nothing is sent to anybody until you switch it on."
      dismissable={!busy}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="btn-secondary text-sm">
            Cancel
          </button>
          <button type="button" onClick={create} disabled={busy} className="btn-primary text-sm">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {busy ? "Creating…" : "Create the journey"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={label}>Which service is it for?</label>
          <select className={field} value={service} onChange={(e) => setService(e.target.value)}>
            <option value="">Every appointment</option>
            {appointmentTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          {appointmentTypes.length === 0 && (
            <p className="text-[11px] text-white/40 mt-1.5">
              You have no services set up yet, so this will run for every appointment.
            </p>
          )}
        </div>

        <div>
          <label className={label}>Which number sends it?</label>
          <select className={field} value={number} onChange={(e) => setNumber(e.target.value)}>
            <option value="">Default number</option>
            {numbers.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/4 p-3.5">
          <p className="text-xs text-white/60 leading-relaxed">
            What happens next:
          </p>
          <ol className="text-xs text-white/50 mt-2 space-y-1.5 leading-relaxed list-decimal pl-4">
            <li>
              {starter.steps.length} WhatsApp template
              {starter.steps.length === 1 ? "" : "s"} are created and sent to Meta for approval.
              That usually takes minutes.
            </li>
            <li>The sequence appears below as a draft, wired to them.</li>
            <li>You read it, change anything you want, and switch it on.</li>
          </ol>
        </div>
      </div>
    </Modal>
  );
}

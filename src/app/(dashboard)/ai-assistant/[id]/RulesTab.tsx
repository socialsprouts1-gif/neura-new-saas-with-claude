"use client";

import { useState } from "react";
import { Brain, Clock, Repeat } from "lucide-react";
import { saveAssistantRules } from "@/app/(dashboard)/portal-actions";
import { DAY_LABELS, TIMEZONES } from "@/lib/working-hours";
import type { AiAssistant } from "@/types/portal";
import {
  SaveForm,
  SectionCard,
  Select,
  SliderRow,
  TextArea,
  TextInput,
  Toggle,
} from "./EditorControls";

export default function RulesTab({ assistant }: { assistant: AiAssistant }) {
  const [memoryTurns, setMemoryTurns] = useState(assistant.memory_turns);
  const [useKnowledge, setUseKnowledge] = useState(assistant.use_knowledge_base);
  const [stopOnHuman, setStopOnHuman] = useState(assistant.stop_on_human);

  const [hoursOn, setHoursOn] = useState(assistant.working_hours_enabled);
  const [days, setDays] = useState<number[]>(assistant.working_days ?? []);

  const [followupOn, setFollowupOn] = useState(assistant.followup_enabled);
  const [maxFollowups, setMaxFollowups] = useState(assistant.max_followups);

  const toggleDay = (day: number) =>
    setDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort()
    );

  return (
    // One form across all three cards: the rules read as a single policy,
    // and saving a working-hours change without the message that goes with
    // it would leave the assistant silent at 6pm.
    <SaveForm action={saveAssistantRules} label="Save agent rules">
      <input type="hidden" name="id" value={assistant.id} />
      {days.map((day) => (
        <input key={day} type="hidden" name="working_days" value={day} />
      ))}

      <div className="space-y-5">
        <SectionCard
          title="Memory & Knowledge"
          description="How much of the conversation the assistant carries, and what it may draw on."
          icon={<Brain className="w-4.5 h-4.5" />}
        >
          <SliderRow
            name="memory_turns"
            label="Messages remembered"
            value={memoryTurns}
            onChange={setMemoryTurns}
            min={1}
            max={50}
            step={1}
            format={(value) => `${value} messages`}
            scale={["answers each message alone", "follows a long thread"]}
          />
          <p className="text-[11px] text-white/35 mt-2 leading-relaxed">
            Every remembered message is sent again with each reply, so a deeper memory costs more
            per answer. Twenty is enough for almost every support conversation.
          </p>

          <div className="mt-4 divide-y divide-white/8 border-t border-white/8">
            <Toggle
              name="use_knowledge_base"
              checked={useKnowledge}
              onChange={setUseKnowledge}
              label="Use knowledge base"
              description="Send the entries from the Knowledge Base tab with every reply, as the assistant's only source of fact about your business."
            />
            <Toggle
              name="stop_on_human"
              checked={stopOnHuman}
              onChange={setStopOnHuman}
              label="Stand down when a human replies"
              description="As soon as someone on your team sends a message from the inbox, the bot pauses on that chat until you resume it."
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Working Hours"
          description="When the assistant is on duty. Outside these hours it sends your off-hours message, or nothing at all."
          icon={<Clock className="w-4.5 h-4.5" />}
        >
          <div className="border-b border-white/8 pb-1 mb-4">
            <Toggle
              name="working_hours_enabled"
              checked={hoursOn}
              onChange={setHoursOn}
              label="Only reply during working hours"
              description="Off means the assistant answers around the clock."
            />
          </div>

          <fieldset disabled={!hoursOn} className={hoursOn ? "" : "opacity-40"}>
            <div className="grid md:grid-cols-3 gap-4">
              <Select
                label="Timezone"
                name="working_hours_timezone"
                defaultValue={assistant.working_hours_timezone}
                options={TIMEZONES.map((zone) => ({
                  value: zone,
                  label: zone.replace(/_/g, " "),
                }))}
              />
              <TextInput
                label="Opens"
                name="working_hours_start"
                type="time"
                defaultValue={assistant.working_hours_start}
              />
              <TextInput
                label="Closes"
                name="working_hours_end"
                type="time"
                defaultValue={assistant.working_hours_end}
                hint="A closing time before the opening one runs overnight."
              />
            </div>

            <div className="mt-4">
              <span className="block text-xs font-medium text-white/70 mb-2">Working days</span>
              <div className="flex flex-wrap gap-1.5">
                {DAY_LABELS.map((label, day) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleDay(day)}
                    aria-pressed={days.includes(day)}
                    className={`w-12 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      days.includes(day)
                        ? "border-accent/50 bg-accent/12 text-accent-ink"
                        : "border-white/10 bg-white/3 text-white/45 hover:border-white/20"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <TextArea
                label="Off-hours message"
                name="off_hours_message"
                rows={3}
                defaultValue={assistant.off_hours_message}
                placeholder="Thanks for messaging! We're closed right now — someone will reply when we open at 9am."
                hint="Leave this empty and the assistant simply stays quiet outside working hours, and the chat waits for a human."
              />
            </div>
          </fieldset>
        </SectionCard>

        <SectionCard
          title="Follow-up"
          description="Nudge a conversation that went quiet before the 24-hour reply window closes."
          icon={<Repeat className="w-4.5 h-4.5" />}
        >
          <div className="border-b border-white/8 pb-1 mb-4">
            <Toggle
              name="followup_enabled"
              checked={followupOn}
              onChange={setFollowupOn}
              label="Follow up on silent conversations"
              description="Sends your message when a customer stops replying mid-conversation."
            />
          </div>

          <fieldset disabled={!followupOn} className={followupOn ? "" : "opacity-40"}>
            <div className="grid md:grid-cols-2 gap-4">
              <TextInput
                label="Wait before following up"
                name="followup_delay_minutes"
                type="number"
                min={1}
                max={10080}
                defaultValue={String(assistant.followup_delay_minutes)}
                hint="In minutes. 60 = an hour, 1440 = a day."
              />
              <SliderRow
                name="max_followups"
                label="How many follow-ups"
                value={maxFollowups}
                onChange={setMaxFollowups}
                min={0}
                max={5}
                step={1}
                format={(value) => (value === 1 ? "once" : `${value} times`)}
                scale={["never", "five times"]}
              />
            </div>

            <div className="mt-4">
              <TextArea
                label="Follow-up message"
                name="followup_message"
                rows={3}
                defaultValue={assistant.followup_message}
                placeholder="Still there? Happy to help if you have any other questions."
              />
            </div>
          </fieldset>

          <p className="text-[11px] text-white/35 mt-4 leading-relaxed">
            Saved and ready, but not yet sending: follow-ups need the scheduled job runner, which
            is the next thing being built. Nothing goes out until then.
          </p>
        </SectionCard>
      </div>
    </SaveForm>
  );
}

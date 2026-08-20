"use client";

import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import BrandLogo from "@/components/ui/BrandLogo";
import ActionForm, { Field } from "@/components/ui/ActionForm";
import { Badge, type Tone } from "@/components/ui/primitives";
import {
  CAPABILITY_HELP,
  CAPABILITY_LABEL,
  type IntegrationDef,
} from "@/lib/integrations";
import { connectIntegration, disconnectIntegration } from "../portal-actions";

const CAPABILITY_TONE: Record<IntegrationDef["capability"], Tone> = {
  live: "green",
  via_webhook: "blue",
  credentials: "amber",
};

export default function IntegrationCard({
  def,
  connected,
  canManage,
}: {
  def: IntegrationDef;
  connected: boolean;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const configurable = def.fields.length > 0;

  return (
    <div className="glass-card p-5 flex flex-col">
      <div className="flex items-start gap-3.5">
        <BrandLogo slug={def.slug} brand={def.brand} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">{def.name}</h3>
            {connected && <Badge tone="green">connected</Badge>}
          </div>
          <p className="text-[11px] text-white/35 mt-0.5">{def.category}</p>
        </div>
      </div>

      <p className="text-sm text-white/55 mt-3 flex-1">{def.description}</p>

      <div className="mt-3">
        <Badge tone={CAPABILITY_TONE[def.capability]}>{CAPABILITY_LABEL[def.capability]}</Badge>
        <p className="text-[11px] text-white/35 mt-2 leading-relaxed">
          {CAPABILITY_HELP[def.capability]}
        </p>
      </div>

      <div className="mt-4 pt-4 border-t border-white/8">
        {!configurable ? (
          <p className="text-xs text-white/40 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-[#00FF87]" />
            Always on — configure it below the catalogue.
          </p>
        ) : connected ? (
          canManage ? (
            <ActionForm action={disconnectIntegration} submitLabel="Disconnect" compact>
              <input type="hidden" name="provider" value={def.slug} />
            </ActionForm>
          ) : (
            <p className="text-xs text-white/40">Connected. Ask an admin to change it.</p>
          )
        ) : canManage ? (
          <>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="btn-secondary text-xs py-2 px-3.5 w-full justify-center"
              aria-expanded={open}
            >
              Connect
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
              <div className="mt-4">
                {def.prerequisite && (
                  <p className="text-[11px] text-[#FACC15] bg-[#FACC15]/8 border border-[#FACC15]/20 rounded-lg p-2.5 mb-3 leading-relaxed">
                    {def.prerequisite}
                  </p>
                )}
                <ActionForm action={connectIntegration} submitLabel="Save connection" compact>
                  <input type="hidden" name="provider" value={def.slug} />
                  <div className="space-y-3">
                    {def.fields.map((f) => (
                      <Field
                        key={f.name}
                        name={f.name}
                        label={f.label}
                        type={f.type}
                        required={f.required}
                        placeholder={f.placeholder}
                        hint={f.hint}
                      />
                    ))}
                  </div>
                </ActionForm>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-white/40">Only owners and admins can connect integrations.</p>
        )}
      </div>
    </div>
  );
}

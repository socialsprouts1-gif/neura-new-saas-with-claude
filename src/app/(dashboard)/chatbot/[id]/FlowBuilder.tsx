"use client";

import { useCallback, useMemo, useRef, useState, type DragEvent } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Copy, Trash2, Save, Search } from "lucide-react";
import {
  NODE_DEFS,
  NODE_GROUPS,
  RUNTIME_LABEL,
  nodeDef,
  type FlowEdge,
  type FlowNode,
  type FlowNodeKind,
  type NodeField,
} from "@/types/flow";
import { saveFlowGraph } from "../../portal-actions";

// The visual builder. Nodes carry their own configuration form rather than
// opening a side panel: a flow is read by scanning left to right, and having
// to click each node to see what it says defeats that.

type NodeData = { kind: FlowNodeKind; values: Record<string, unknown> };
type BuilderNode = Node<NodeData, "flowNode">;

let idCounter = 0;
function newId(kind: string): string {
  idCounter += 1;
  return `${kind}_${Date.now().toString(36)}${idCounter}`;
}

// --- field editors ---------------------------------------------------------

const inputClass =
  "w-full bg-white/4 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-white/25 focus:outline-none focus:border-[#00FF87]/40 nodrag";

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: NodeField;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  switch (field.kind) {
    case "textarea":
      return (
        <textarea
          className={`${inputClass} resize-none`}
          rows={3}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "number":
      return (
        <input
          type="number"
          className={inputClass}
          value={String(value ?? "")}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      );

    case "select":
      return (
        <select
          className={inputClass}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value} className="bg-[#0A0A0F]">
              {o.label}
            </option>
          ))}
        </select>
      );

    case "toggle":
      return (
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={`nodrag relative w-9 h-5 rounded-full transition-colors ${
            value ? "bg-[#00FF87]" : "bg-white/15"
          }`}
          aria-pressed={Boolean(value)}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-[#050508] transition-all ${
              value ? "left-4.5" : "left-0.5"
            }`}
          />
        </button>
      );

    case "keywords":
      return (
        <input
          className={inputClass}
          placeholder={field.placeholder ?? "price, cost, pricing"}
          value={(Array.isArray(value) ? value : []).join(", ")}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean)
            )
          }
        />
      );

    case "variable":
      return (
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-white/30 font-mono">{"{{"}</span>
          <input
            className={inputClass}
            placeholder={field.placeholder}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value.replace(/[^\w.]/g, ""))}
          />
          <span className="text-[10px] text-white/30 font-mono">{"}}"}</span>
        </div>
      );

    case "buttons":
      return <ButtonsEditor value={value} onChange={onChange} max={field.max ?? 3} />;

    case "sections":
      return <SectionsEditor value={value} onChange={onChange} />;

    default:
      return (
        <input
          className={inputClass}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

type ButtonEntry = { id: string; title: string };

function ButtonsEditor({
  value,
  onChange,
  max,
}: {
  value: unknown;
  onChange: (next: unknown) => void;
  max: number;
}) {
  const buttons: ButtonEntry[] = Array.isArray(value) ? (value as ButtonEntry[]) : [];

  const update = (index: number, title: string) => {
    const next = buttons.map((b, i) => (i === index ? { ...b, title } : b));
    onChange(next);
  };

  return (
    <div className="space-y-1.5">
      {buttons.map((button, index) => (
        <div key={button.id} className="flex items-center gap-1.5">
          <input
            className={inputClass}
            maxLength={20}
            placeholder={`Button ${index + 1}`}
            value={button.title}
            onChange={(e) => update(index, e.target.value)}
          />
          <button
            type="button"
            className="nodrag text-white/30 hover:text-red-400 flex-shrink-0"
            onClick={() => onChange(buttons.filter((_, i) => i !== index))}
            aria-label="Remove button"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      {buttons.length < max && (
        <button
          type="button"
          className="nodrag w-full text-[11px] text-[#00D4FF] border border-dashed border-[#00D4FF]/30 rounded-lg py-1.5 hover:bg-[#00D4FF]/5"
          onClick={() => onChange([...buttons, { id: newId("btn"), title: "" }])}
        >
          + Add button
        </button>
      )}
    </div>
  );
}

type RowEntry = { id: string; title: string; description?: string };
type SectionEntry = { title: string; rows: RowEntry[] };

function SectionsEditor({ value, onChange }: { value: unknown; onChange: (next: unknown) => void }) {
  const sections: SectionEntry[] = Array.isArray(value) ? (value as SectionEntry[]) : [];

  const patch = (index: number, next: Partial<SectionEntry>) =>
    onChange(sections.map((s, i) => (i === index ? { ...s, ...next } : s)));

  const rowCount = sections.reduce((total, s) => total + s.rows.length, 0);

  return (
    <div className="space-y-2">
      {sections.map((section, sIndex) => (
        <div key={sIndex} className="border border-white/8 rounded-lg p-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <input
              className={inputClass}
              maxLength={24}
              placeholder="Section title"
              value={section.title}
              onChange={(e) => patch(sIndex, { title: e.target.value })}
            />
            <button
              type="button"
              className="nodrag text-white/30 hover:text-red-400 flex-shrink-0"
              onClick={() => onChange(sections.filter((_, i) => i !== sIndex))}
              aria-label="Remove section"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {section.rows.map((row, rIndex) => (
            <div key={row.id} className="flex items-center gap-1.5 pl-2">
              <input
                className={inputClass}
                maxLength={24}
                placeholder={`Row ${rIndex + 1}`}
                value={row.title}
                onChange={(e) =>
                  patch(sIndex, {
                    rows: section.rows.map((r, i) =>
                      i === rIndex ? { ...r, title: e.target.value } : r
                    ),
                  })
                }
              />
              <button
                type="button"
                className="nodrag text-white/30 hover:text-red-400 flex-shrink-0"
                onClick={() =>
                  patch(sIndex, { rows: section.rows.filter((_, i) => i !== rIndex) })
                }
                aria-label="Remove row"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {/* WhatsApp caps a list at 10 rows across every section, so the
              limit is enforced on the total rather than per section. */}
          {rowCount < 10 && (
            <button
              type="button"
              className="nodrag w-full text-[11px] text-[#00D4FF] py-1 hover:underline"
              onClick={() =>
                patch(sIndex, { rows: [...section.rows, { id: newId("row"), title: "" }] })
              }
            >
              + Add row
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        className="nodrag w-full text-[11px] text-[#00D4FF] border border-dashed border-[#00D4FF]/30 rounded-lg py-1.5 hover:bg-[#00D4FF]/5"
        onClick={() => onChange([...sections, { title: "", rows: [{ id: newId("row"), title: "" }] }])}
      >
        + Add section
      </button>
      {rowCount >= 10 && (
        <p className="text-[10px] text-amber-400/70">
          10 rows is WhatsApp&apos;s maximum for a list.
        </p>
      )}
    </div>
  );
}

// --- the node --------------------------------------------------------------

function FlowNodeCard({ id, data, selected }: NodeProps<BuilderNode>) {
  const { setNodes, setEdges } = useReactFlow<BuilderNode, Edge>();
  const def = nodeDef(data.kind);

  const setValue = useCallback(
    (name: string, value: unknown) => {
      setNodes((nodes) =>
        nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, values: { ...n.data.values, [name]: value } } } : n
        )
      );
    },
    [id, setNodes]
  );

  const remove = useCallback(() => {
    setNodes((nodes) => nodes.filter((n) => n.id !== id));
    setEdges((edges) => edges.filter((e) => e.source !== id && e.target !== id));
  }, [id, setNodes, setEdges]);

  const duplicate = useCallback(() => {
    setNodes((nodes) => {
      const source = nodes.find((n) => n.id === id);
      if (!source) return nodes;
      return [
        ...nodes,
        {
          ...source,
          id: newId(source.data.kind),
          position: { x: source.position.x + 60, y: source.position.y + 60 },
          selected: false,
        },
      ];
    });
  }, [id, setNodes]);

  if (!def) return null;

  // Outlets are derived from the node's own configuration, so adding a
  // button immediately gives you somewhere to connect it from.
  const outlets: { id: string; label: string }[] =
    def.dynamicHandles === "buttons"
      ? (Array.isArray(data.values.buttons) ? (data.values.buttons as ButtonEntry[]) : [])
          .filter((b) => b.title.trim())
          .map((b) => ({ id: b.id, label: b.title }))
      : def.dynamicHandles === "rows"
        ? (Array.isArray(data.values.sections) ? (data.values.sections as SectionEntry[]) : [])
            .flatMap((s) => s.rows)
            .filter((r) => r.title.trim())
            .map((r) => ({ id: r.id, label: r.title }))
        : (def.handles ?? []);

  const isTrigger = def.group === "Trigger";

  return (
    <div
      className={`w-[280px] rounded-xl border bg-[#0A0A0F] shadow-xl transition-colors ${
        selected ? "border-[#00FF87]/60" : "border-white/12"
      }`}
      style={{ boxShadow: selected ? `0 0 0 1px ${def.accent}55` : undefined }}
    >
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-2.5 !h-2.5 !bg-[#00FF87] !border-2 !border-[#0A0A0F]"
        />
      )}

      <header
        className="flex items-center gap-2 px-3 py-2 rounded-t-xl border-b border-white/8"
        style={{ background: `${def.accent}14` }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: def.accent }} />
        <span className="text-[11px] font-semibold flex-1 truncate">{def.label}</span>
        <button type="button" onClick={duplicate} className="nodrag text-white/30 hover:text-white/70" aria-label="Duplicate">
          <Copy className="w-3 h-3" />
        </button>
        <button type="button" onClick={remove} className="nodrag text-white/30 hover:text-red-400" aria-label="Delete">
          <Trash2 className="w-3 h-3" />
        </button>
      </header>

      {def.runtime !== "ready" && (
        <div className="mx-3 mt-2 text-[10px] leading-relaxed text-amber-300/80 bg-amber-400/8 border border-amber-400/20 rounded-lg px-2 py-1.5">
          <span className="font-semibold">{RUNTIME_LABEL[def.runtime]}.</span> {def.runtimeNote}
        </div>
      )}

      <div className="p-3 space-y-2.5">
        {def.fields.map((field) => (
          <div key={field.name}>
            <label className="block text-[10px] font-medium text-white/45 mb-1">{field.label}</label>
            <FieldEditor
              field={field}
              value={data.values[field.name]}
              onChange={(next) => setValue(field.name, next)}
            />
            {field.hint && <p className="text-[9px] text-white/25 mt-1">{field.hint}</p>}
          </div>
        ))}
        {def.fields.length === 0 && (
          <p className="text-[11px] text-white/35">{def.description}</p>
        )}
      </div>

      {/* One outlet per path. A node with named outlets gets a labelled row
          each; everything else gets a single handle on the right edge. */}
      {outlets.length > 0 ? (
        <div className="border-t border-white/8">
          {outlets.map((outlet, index) => (
            <div
              key={outlet.id}
              className="relative flex items-center justify-end px-3 py-1.5 text-[10px] text-white/50 border-b border-white/5 last:border-0"
            >
              <span className="truncate">{outlet.label}</span>
              <Handle
                type="source"
                id={outlet.id}
                position={Position.Right}
                style={{ top: "50%" }}
                className="!w-2.5 !h-2.5 !bg-[#00D4FF] !border-2 !border-[#0A0A0F]"
                data-index={index}
              />
            </div>
          ))}
        </div>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-2.5 !h-2.5 !bg-[#00D4FF] !border-2 !border-[#0A0A0F]"
        />
      )}
    </div>
  );
}

const nodeTypes = { flowNode: FlowNodeCard };

// --- the builder -----------------------------------------------------------

interface BuilderProps {
  flowId: string;
  initialName: string;
  initialActive: boolean;
  initialNodes: FlowNode[];
  initialEdges: FlowEdge[];
}

function Builder({ flowId, initialName, initialActive, initialNodes, initialEdges }: BuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<BuilderNode>(
    initialNodes.map((n) => ({
      id: n.id,
      type: "flowNode" as const,
      position: n.position ?? { x: 0, y: 0 },
      data: { kind: n.kind, values: n.data ?? {} },
    }))
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    initialEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      animated: true,
      style: { stroke: "#00D4FF66" },
    }))
  );

  const [name, setName] = useState(initialName);
  const [active, setActive] = useState(initialActive);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((current) =>
        addEdge({ ...connection, animated: true, style: { stroke: "#00D4FF66" } }, current)
      ),
    [setEdges]
  );

  const addNode = useCallback(
    (kind: FlowNodeKind, position: { x: number; y: number }) => {
      const def = nodeDef(kind);
      if (!def) return;
      setNodes((current) => [
        ...current,
        {
          id: newId(kind),
          type: "flowNode" as const,
          position,
          data: { kind, values: { ...def.defaults } },
        },
      ]);
    },
    [setNodes]
  );

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData("application/neura-node") as FlowNodeKind;
      if (!kind) return;
      addNode(kind, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
    },
    [addNode, screenToFlowPosition]
  );

  const onSave = useCallback(async () => {
    setSaving(true);
    setStatus(null);

    const payloadNodes: FlowNode[] = nodes.map((n) => ({
      id: n.id,
      kind: n.data.kind,
      position: n.position,
      data: n.data.values,
    }));
    const payloadEdges: FlowEdge[] = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
    }));

    const result = await saveFlowGraph({
      id: flowId,
      name,
      isActive: active,
      nodes: payloadNodes,
      edges: payloadEdges,
    });

    setSaving(false);
    setStatus({ ok: result.ok, text: result.error ?? result.message ?? "Saved." });
  }, [flowId, name, active, nodes, edges]);

  const palette = useMemo(() => {
    const term = query.trim().toLowerCase();
    return NODE_GROUPS.map((group) => ({
      group,
      items: NODE_DEFS.filter(
        (d) =>
          d.group === group &&
          (!term || d.label.toLowerCase().includes(term) || d.description.toLowerCase().includes(term))
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  return (
    <div className="flex h-full min-h-0">
      {/* Palette */}
      <aside className="w-64 border-r border-white/8 flex flex-col flex-shrink-0 min-h-0 bg-[#08080C]">
        <div className="p-3 border-b border-white/8">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-white/30 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              className="w-full bg-white/4 border border-white/10 rounded-lg pl-8 pr-2.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#00FF87]/40"
              placeholder="Search components…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {palette.map(({ group, items }) => (
            <div key={group}>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-2">
                {group} ({items.length})
              </div>
              <div className="space-y-1.5">
                {items.map((def) => (
                  <button
                    key={def.kind}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/neura-node", def.kind);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    // Click also adds, dropped near the middle: dragging is
                    // fiddly on a trackpad and this is the same action.
                    onClick={() => addNode(def.kind, { x: 260 + Math.random() * 120, y: 120 + Math.random() * 200 })}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-white/8 bg-white/3 hover:border-white/20 hover:bg-white/6 transition-colors text-left cursor-grab active:cursor-grabbing"
                    title={def.description}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: def.accent }}
                    />
                    <span className="text-[11px] font-medium truncate">{def.label}</span>
                    {def.runtime !== "ready" && (
                      <span className="ml-auto text-[9px] text-amber-400/70 flex-shrink-0">!</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Canvas */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-white/8 flex-shrink-0">
          <input
            className="bg-white/4 border border-white/10 rounded-lg px-3 py-1.5 text-sm font-medium text-white focus:outline-none focus:border-[#00FF87]/40 min-w-0"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bot name"
          />

          <button
            type="button"
            onClick={() => setActive((v) => !v)}
            className="flex items-center gap-2 text-xs"
          >
            <span
              className={`relative w-9 h-5 rounded-full transition-colors ${
                active ? "bg-[#00FF87]" : "bg-white/15"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-[#050508] transition-all ${
                  active ? "left-4.5" : "left-0.5"
                }`}
              />
            </span>
            <span className={active ? "text-[#00FF87]" : "text-white/45"}>
              {active ? "Active" : "Draft"}
            </span>
          </button>

          <div className="text-[11px] text-white/35">
            {nodes.length} node{nodes.length === 1 ? "" : "s"} · {edges.length} connection
            {edges.length === 1 ? "" : "s"}
          </div>

          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="btn-primary text-sm ml-auto disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save"}
          </button>

          {status && (
            <span className={`text-xs ${status.ok ? "text-[#00FF87]" : "text-red-400"}`}>
              {status.text}
            </span>
          )}
        </header>

        <div ref={wrapper} className="flex-1 min-h-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: false }}
            defaultEdgeOptions={{ animated: true }}
            colorMode="dark"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#ffffff14" />
            <Controls className="!bg-[#0A0A0F] !border !border-white/10 [&_button]:!bg-transparent [&_button]:!border-white/10 [&_button]:!fill-white/60" />
            <MiniMap
              pannable
              zoomable
              className="!bg-[#0A0A0F] !border !border-white/10"
              nodeColor={(n) => nodeDef((n.data as NodeData).kind)?.accent ?? "#ffffff30"}
              maskColor="#05050899"
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

export default function FlowBuilder(props: BuilderProps) {
  return (
    <ReactFlowProvider>
      <Builder {...props} />
    </ReactFlowProvider>
  );
}

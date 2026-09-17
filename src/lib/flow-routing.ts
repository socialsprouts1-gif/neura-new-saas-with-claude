// Which of a workspace's WhatsApp numbers may act on a given flow.
//
// Pure by design: no fetch, no env, no server-only, so it can be tested.
//
// A flow belongs to exactly one WhatsApp Business Account. A workspace with
// two numbers usually has two accounts, and picking the wrong one produces
// two errors that name neither the number nor the account: 100/33 when
// uploading the flow's JSON, 131009 when sending it. Deciding this in one
// pure function means the rule is checkable without a Meta round trip.

export interface NumberOnAccount {
  id: string;
  wabaId: string;
  status: string;
  isDefault: boolean;
}

export type Routing =
  | { ok: true; connectionId: string; wabaId: string }
  | { ok: false; reason: "none-connected" | "account-not-connected" };

/**
 * Picks the number to act on for a flow.
 *
 * `wabaId` null means the flow predates the column being filled in: it is
 * routed to the default so it keeps working, and the caller records what it
 * learns so the next call routes properly.
 */
export function routeFlow(
  connections: readonly NumberOnAccount[],
  wabaId: string | null | undefined
): Routing {
  const active = connections.filter((connection) => connection.status === "active");
  if (active.length === 0) return { ok: false, reason: "none-connected" };

  const eligible = wabaId ? active.filter((connection) => connection.wabaId === wabaId) : active;

  // Deliberately not falling back to the default when the flow's own
  // account has no active number. The default is a number on some other
  // account, and using it is exactly the mistake being prevented.
  if (eligible.length === 0) return { ok: false, reason: "account-not-connected" };

  const chosen = eligible.find((connection) => connection.isDefault) ?? eligible[0];
  return { ok: true, connectionId: chosen.id, wabaId: chosen.wabaId };
}

/** The accounts to walk when importing everything Meta knows about. */
export function accountsToSync(connections: readonly NumberOnAccount[]): string[] {
  const seen = new Set<string>();
  for (const connection of connections) {
    if (connection.status === "active") seen.add(connection.wabaId);
  }
  return [...seen];
}

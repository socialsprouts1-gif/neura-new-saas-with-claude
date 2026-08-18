import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Service-role client for trusted server-only code that has no user
// session to scope RLS to — currently just the WhatsApp webhook handler,
// which authenticates the request itself via the Meta signature instead.
// This bypasses RLS entirely: never import it into client components or
// anything that forwards caller-controlled org/user IDs unchecked.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

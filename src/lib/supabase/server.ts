import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

// For use in Server Components, Route Handlers, and Server Actions. Reads
// the caller's session from cookies, so all queries run under that user's
// RLS policies.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component with no response to write to
            // (e.g. rendering, not a Server Action). Session refresh for
            // those requests is handled by middleware.ts instead.
          }
        },
      },
    }
  );
}

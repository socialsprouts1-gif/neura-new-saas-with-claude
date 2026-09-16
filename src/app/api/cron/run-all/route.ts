import { NextResponse, type NextRequest } from "next/server";
import { isCronAuthorised } from "@/lib/cron-auth";

// One URL that drives every scheduled job.
//
// The four jobs have separate routes because they fail separately and a
// campaign queue stuck behind a slow invoice run is a bad trade. But a
// person setting up a pinger has to paste a URL into a box, and asking
// them to do it four times means three of them eventually get forgotten —
// usually the three nobody notices until a customer does.
//
// So this exists for the setup, not for the architecture: one address,
// every job, and a per-job report so a failure still names itself.

export const dynamic = "force-dynamic";

/** In order, cheapest first, so a slow job cannot delay the queue. */
const JOBS = [
  "dispatch-campaigns",
  "resume-flows",
  "appointment-reminders",
  "recurring-invoices",
  "billing-emails",
] as const;

interface JobResult {
  job: string;
  ok: boolean;
  status: number;
  detail?: unknown;
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // This route reaches the others over HTTP, and they only accept a
    // bearer token or Vercel's own header — which a request this route
    // makes to itself will never carry. Without a secret every job below
    // would answer 401 and this would report four failures with no
    // explanation, so say the real reason once instead.
    return NextResponse.json(
      {
        error:
          "CRON_SECRET is not set. Set it in the environment and use it as the Authorization: Bearer token, or call each /api/cron/* route directly.",
      },
      { status: 503 }
    );
  }

  const origin = request.nextUrl.origin;
  const results: JobResult[] = [];

  for (const job of JOBS) {
    try {
      const response = await fetch(`${origin}/api/cron/${job}`, {
        headers: { authorization: `Bearer ${secret}` },
        cache: "no-store",
      });

      // Read the body either way: a failing job's reason is the only
      // thing that makes this report worth more than a status code.
      const detail = await response.json().catch(() => null);
      results.push({ job, ok: response.ok, status: response.status, detail });
    } catch (error) {
      // One unreachable job must not stop the rest. A campaign queue that
      // stops draining because the invoice run timed out is exactly the
      // coupling the separate routes exist to avoid.
      results.push({
        job,
        ok: false,
        status: 0,
        detail: error instanceof Error ? error.message : "Job could not be reached.",
      });
    }
  }

  const failed = results.filter((result) => !result.ok);

  // 207 rather than 500 when only some failed: a pinger that retries the
  // whole batch over one bad job would re-run the three that worked.
  return NextResponse.json(
    { ran: results.length, failed: failed.length, results },
    { status: failed.length === 0 ? 200 : failed.length === results.length ? 500 : 207 }
  );
}

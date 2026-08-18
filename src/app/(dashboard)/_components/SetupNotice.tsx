const REQUIRED_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "META_APP_SECRET",
  "META_ACCESS_TOKEN",
  "TOKEN_ENCRYPTION_KEY",
];

export default function SetupNotice() {
  return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center p-6">
      <div className="glass-card p-8 max-w-lg">
        <h1 className="text-xl font-bold mb-2">Setup required</h1>
        <p className="text-white/60 text-sm mb-6">
          Neura Chat can&apos;t reach Supabase because its environment variables
          aren&apos;t set on this deployment. Add them, then redeploy.
        </p>

        <ul className="space-y-1.5 mb-6">
          {REQUIRED_VARS.map((name) => (
            <li key={name} className="font-mono text-xs text-[#00FF87]">
              {name}
            </li>
          ))}
        </ul>

        <p className="text-white/40 text-xs">
          See <span className="font-mono text-white/60">.env.local.example</span> for
          what each value is and where to find it.
        </p>
      </div>
    </div>
  );
}

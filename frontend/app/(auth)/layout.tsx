export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* ── Background gradient blobs ── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Green blob top-left */}
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-[hsl(var(--green))] opacity-[0.07] blur-[100px]" />
        {/* Purple blob bottom-right */}
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-[hsl(var(--purple))] opacity-[0.07] blur-[100px]" />
      </div>

      {/* ── Auth Card ── */}
      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--green))]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-[hsl(var(--primary-foreground))]"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <h1 className="gradient-text text-2xl font-bold tracking-tight">NotifyTechAI</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Multi-tenant WhatsApp platform</p>
        </div>

        {/* Page content (login/register form) */}
        {children}
      </div>
    </div>
  );
}

export function SessionCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-[var(--shadow-sm)] p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-[hsl(var(--muted))]" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-[hsl(var(--muted))] rounded-md w-3/5" />
          <div className="h-3 bg-[hsl(var(--muted))] rounded-md w-2/5" />
        </div>
        <div className="h-6 w-20 bg-[hsl(var(--muted))] rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="h-12 bg-[hsl(var(--muted))] rounded-lg" />
        <div className="h-12 bg-[hsl(var(--muted))] rounded-lg" />
      </div>
      <div className="h-9 bg-[hsl(var(--muted))] rounded-lg" />
    </div>
  );
}

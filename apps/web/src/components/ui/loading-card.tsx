export function LoadingCard() {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 shadow-[var(--shadow)] backdrop-blur-xl">
      <div className="h-4 w-28 animate-pulse rounded-full bg-white/10" />
      <div className="mt-4 h-10 w-2/3 animate-pulse rounded-2xl bg-white/10" />
      <div className="mt-6 grid gap-3">
        <div className="h-16 animate-pulse rounded-3xl bg-white/7" />
        <div className="h-16 animate-pulse rounded-3xl bg-white/7" />
        <div className="h-16 animate-pulse rounded-3xl bg-white/7" />
      </div>
    </div>
  );
}

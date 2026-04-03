export function LoadingCard() {
  return (
    <div className="premium-panel rounded-[32px] p-8 lg:p-10">
      <div className="h-3 w-32 animate-pulse rounded-full bg-white/10" />
      <div className="mt-5 h-12 w-2/3 animate-pulse rounded-[22px] bg-white/10" />
      <div className="mt-7 grid gap-4">
        <div className="h-20 animate-pulse rounded-[26px] bg-white/7" />
        <div className="h-20 animate-pulse rounded-[26px] bg-white/7" />
        <div className="h-20 animate-pulse rounded-[26px] bg-white/7" />
      </div>
    </div>
  );
}

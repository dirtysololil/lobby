export function LoadingCard() {
  return (
    <div className="premium-panel rounded-[24px] p-5 lg:p-6">
      <div className="h-3 w-24 animate-pulse rounded-full bg-white/10" />
      <div className="mt-4 h-8 w-1/2 animate-pulse rounded-[12px] bg-white/10" />
      <div className="mt-5 grid gap-3">
        <div className="h-[58px] animate-pulse rounded-[16px] bg-white/7" />
        <div className="h-[58px] animate-pulse rounded-[16px] bg-white/7" />
        <div className="h-[58px] animate-pulse rounded-[16px] bg-white/7" />
      </div>
    </div>
  );
}

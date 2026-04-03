export function LoadingCard() {
  return (
    <div className="premium-panel rounded-[20px] p-4">
      <div className="h-3 w-24 animate-pulse rounded-full bg-white/10" />
      <div className="mt-3 h-7 w-1/2 animate-pulse rounded-[10px] bg-white/10" />
      <div className="mt-4 grid gap-2.5">
        <div className="h-[50px] animate-pulse rounded-[14px] bg-white/7" />
        <div className="h-[50px] animate-pulse rounded-[14px] bg-white/7" />
        <div className="h-[50px] animate-pulse rounded-[14px] bg-white/7" />
      </div>
    </div>
  );
}

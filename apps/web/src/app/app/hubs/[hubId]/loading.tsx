function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-[16px] border border-white/6 bg-white/[0.03] px-3 py-3">
      <div className="h-9 w-9 animate-pulse rounded-[13px] bg-white/8" />
      <div className="min-w-0 flex-1">
        <div className="h-3.5 w-28 animate-pulse rounded bg-white/8" />
        <div className="mt-2 h-3 w-40 animate-pulse rounded bg-white/6" />
      </div>
    </div>
  );
}

export default function HubLoading() {
  return (
    <div className="h-full min-h-0 overflow-y-auto px-3 py-3">
      <div className="grid gap-3">
        <section className="premium-panel rounded-[22px] p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                <div className="h-6 w-16 animate-pulse rounded-full bg-white/8" />
                <div className="h-6 w-20 animate-pulse rounded-full bg-white/8" />
                <div className="h-6 w-24 animate-pulse rounded-full bg-white/8" />
              </div>
              <div className="mt-4 h-8 w-56 animate-pulse rounded bg-white/10" />
              <div className="mt-3 h-4 w-full max-w-2xl animate-pulse rounded bg-white/6" />
            </div>

            <div className="grid min-w-[240px] grid-cols-2 gap-2 xl:w-[280px]">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[16px] border border-white/6 bg-white/[0.03] px-3 py-3"
                >
                  <div className="h-3 w-20 animate-pulse rounded bg-white/8" />
                  <div className="mt-2 h-5 w-10 animate-pulse rounded bg-white/10" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="premium-panel rounded-[22px] p-4">
            <div className="h-4 w-36 animate-pulse rounded bg-white/8" />
            <div className="mt-4 grid gap-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <SkeletonRow key={index} />
              ))}
            </div>
          </section>

          <div className="grid gap-3">
            <section className="premium-panel rounded-[22px] p-4">
              <div className="h-4 w-28 animate-pulse rounded bg-white/8" />
              <div className="mt-4 grid gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <SkeletonRow key={index} />
                ))}
              </div>
            </section>

            <section className="premium-panel rounded-[22px] p-4">
              <div className="h-4 w-24 animate-pulse rounded bg-white/8" />
              <div className="mt-3 h-4 w-full animate-pulse rounded bg-white/6" />
              <div className="mt-4 h-10 w-full animate-pulse rounded-[14px] bg-white/8" />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

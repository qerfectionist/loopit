/** Pulsating skeleton placeholder — drop-in while content loads */
export const SkeletonCard = () => (
  <div className="rounded-2xl bg-bg-secondary border border-border overflow-hidden animate-pulse">
    {/* Cover */}
    <div className="h-36 bg-bg-tertiary" />
    {/* Body */}
    <div className="p-3.5 space-y-2.5">
      <div className="h-3.5 bg-bg-tertiary rounded-md w-4/5" />
      <div className="h-3 bg-bg-tertiary rounded-md w-2/3" />
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-bg-tertiary" />
          <div className="h-2.5 bg-bg-tertiary rounded w-14" />
        </div>
        <div className="h-2.5 bg-bg-tertiary rounded w-10" />
      </div>
    </div>
  </div>
);

/** Skeleton for a match card */
export const SkeletonMatchCard = () => (
  <div className="rounded-2xl bg-bg-secondary border border-border p-4 animate-pulse space-y-3">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-bg-tertiary shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-bg-tertiary rounded w-1/2" />
        <div className="h-3 bg-bg-tertiary rounded w-1/3" />
      </div>
      <div className="h-5 w-16 bg-bg-tertiary rounded-full" />
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div className="h-20 bg-bg-tertiary rounded-xl" />
      <div className="h-20 bg-bg-tertiary rounded-xl" />
    </div>
  </div>
);

interface VaultSkeletonProps {
  viewMode: 'list' | 'grid'
}

/** Placeholder rows/cards shown during the initial folder load. */
export function VaultSkeleton({ viewMode }: VaultSkeletonProps) {
  if (viewMode === 'list') {
    return (
      <div className="flex h-full flex-col">
        {/* Fake Header */}
        <div className="border-border/40 bg-background sticky top-0 z-10 grid grid-cols-[40px_40px_1fr] gap-2 border-b px-4 py-2.5 sm:px-6 md:grid-cols-[40px_40px_1fr_160px_140px_80px]">
          <div className="bg-muted h-4 w-4 rounded"></div>
          <div></div>
          <div className="bg-muted h-3 w-10 rounded"></div>
        </div>

        {/* Fake Rows */}
        <div className="flex-1 overflow-hidden px-4 sm:px-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="border-border/20 grid h-[52px] grid-cols-[40px_40px_1fr] items-center gap-2 border-b md:grid-cols-[40px_40px_1fr_160px_140px_80px]"
            >
              <div className="bg-muted/70 h-4 w-4 rounded"></div>
              <div className="bg-muted/70 h-8 w-8 rounded-md"></div>
              <div className="space-y-2">
                <div className="bg-muted/70 h-3 w-1/3 rounded"></div>
              </div>
              <div className="hidden md:block"></div>
              <div className="bg-muted/50 hidden h-3 w-16 rounded md:block"></div>
              <div className="bg-muted/50 hidden h-3 w-10 rounded md:block"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Grid View Skeleton
  return (
    <div className="h-full overflow-auto p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-2.5 rounded-xl border border-transparent p-4"
          >
            <div className="bg-muted/70 h-16 w-16 rounded-xl"></div>
            <div className="w-full space-y-2">
              <div className="bg-muted/70 mx-auto h-3 w-3/4 rounded"></div>
              <div className="bg-muted/50 mx-auto h-2 w-1/2 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

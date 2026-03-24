import { ShimmerBlock } from "@/components/ui/shimmer-block";

function DashboardHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <ShimmerBlock className="h-8 w-64 max-w-full" />
      <ShimmerBlock className="h-4 w-40 max-w-full" />
    </div>
  );
}

function DashboardStatsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={`dashboard-stat-skeleton-${index}`}
          className="rounded-xl border bg-card p-5 shadow-sm"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <ShimmerBlock className="h-3.5 w-24" />
              <ShimmerBlock className="h-7 w-28" />
            </div>
            <ShimmerBlock className="h-10 w-10 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

function UpcomingBookingCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ShimmerBlock className="h-9 w-9 rounded-lg" />
          <ShimmerBlock className="h-3.5 w-28" />
        </div>
        <div className="flex items-center gap-2">
          <ShimmerBlock className="h-6 w-16 rounded-full" />
          <ShimmerBlock className="h-8 w-8 rounded-md" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ShimmerBlock className="h-4 w-4 rounded-sm" />
          <ShimmerBlock className="h-4 w-40" />
          <ShimmerBlock className="ml-auto h-5 w-16 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <ShimmerBlock className="h-3.5 w-3.5 rounded-sm" />
          <ShimmerBlock className="h-4 w-36" />
        </div>
        <div className="flex items-start gap-2">
          <ShimmerBlock className="mt-0.5 h-3.5 w-3.5 rounded-sm" />
          <div className="flex-1 space-y-2">
            <ShimmerBlock className="h-4 w-full" />
            <ShimmerBlock className="h-4 w-5/6" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ShimmerBlock className="h-3.5 w-3.5 rounded-sm" />
          <ShimmerBlock className="h-4 w-32" />
        </div>
      </div>
    </div>
  );
}

function TodaySummarySkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="space-y-4">
        <ShimmerBlock className="h-3.5 w-32" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={`today-summary-skeleton-${index}`}
              className="rounded-xl border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <ShimmerBlock className="h-3.5 w-20" />
                  <ShimmerBlock className="h-7 w-24" />
                </div>
                <ShimmerBlock className="h-10 w-10 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <ShimmerBlock className="h-3.5 w-20" />
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`quick-action-skeleton-${index}`}
                className="flex flex-col items-center gap-2 rounded-lg p-2.5"
              >
                <ShimmerBlock className="h-9 w-9 rounded-lg" />
                <ShimmerBlock className="h-3 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartPanelSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <ShimmerBlock className="mb-4 h-5 w-36" />
      <div className="h-[220px] min-h-[220px] w-full min-w-0">
        <div className="flex h-full flex-col justify-between gap-4">
          <div className="flex-1 rounded-lg border border-border/50 p-4">
            <div className="flex h-full items-end gap-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <ShimmerBlock
                  key={`chart-bar-skeleton-${index}`}
                  className={`flex-1 rounded-md ${
                    index % 4 === 0
                      ? "h-[82%]"
                      : index % 4 === 1
                        ? "h-[56%]"
                        : index % 4 === 2
                          ? "h-[68%]"
                          : "h-[42%]"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <ShimmerBlock
                key={`chart-axis-skeleton-${index}`}
                className="h-3 w-full"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardChartsSkeleton() {
  return (
    <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ChartPanelSkeleton />
      <ChartPanelSkeleton />
    </div>
  );
}

function RecentBookingsTableSkeleton() {
  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="space-y-2">
          <ShimmerBlock className="h-5 w-32" />
          <ShimmerBlock className="h-4 w-40" />
        </div>
        <ShimmerBlock className="h-4 w-20" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="px-6 py-3 text-left">
                <ShimmerBlock className="h-3.5 w-14" />
              </th>
              <th className="hidden px-4 py-3 text-left sm:table-cell">
                <ShimmerBlock className="h-3.5 w-14" />
              </th>
              <th className="hidden px-4 py-3 text-left md:table-cell">
                <ShimmerBlock className="h-3.5 w-20" />
              </th>
              <th className="hidden px-4 py-3 text-left md:table-cell">
                <ShimmerBlock className="h-3.5 w-16" />
              </th>
              <th className="px-4 py-3 text-left">
                <ShimmerBlock className="h-3.5 w-14" />
              </th>
              <th className="hidden px-6 py-3 text-right sm:table-cell">
                <ShimmerBlock className="ml-auto h-3.5 w-12" />
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, index) => (
              <tr
                key={`recent-bookings-skeleton-${index}`}
                className="border-b last:border-0"
              >
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <ShimmerBlock className="h-8 w-8 rounded-full" />
                    <div className="space-y-2">
                      <ShimmerBlock className="h-4 w-28" />
                      <ShimmerBlock className="h-3 w-20" />
                    </div>
                  </div>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <ShimmerBlock className="h-4 w-24" />
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <ShimmerBlock className="h-4 w-24" />
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  <ShimmerBlock className="h-4 w-20" />
                </td>
                <td className="px-4 py-3">
                  <ShimmerBlock className="h-5 w-16 rounded-full" />
                </td>
                <td className="hidden px-6 py-3 sm:table-cell">
                  <ShimmerBlock className="ml-auto h-4 w-24" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <DashboardHeaderSkeleton />
      <DashboardStatsGridSkeleton />
      <div className="grid gap-4 sm:grid-cols-2">
        <UpcomingBookingCardSkeleton />
        <TodaySummarySkeleton />
      </div>
      <DashboardChartsSkeleton />
      <RecentBookingsTableSkeleton />
    </div>
  );
}

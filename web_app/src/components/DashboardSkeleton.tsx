import { Skeleton } from "@/components/ui/skeleton";

export const DashboardSkeleton = () => (
    <div className="animate-fade-in">
        {/* Stats bar skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-4 lg:mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-card rounded-xl border border-border p-5">
                    <Skeleton className="h-3 w-20 mb-3" />
                    <Skeleton className="h-7 w-16 mb-2" />
                    <Skeleton className="h-2.5 w-24" />
                </div>
            ))}
        </div>

        {/* Main grid skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* Heatmap */}
            <div className="bg-card rounded-xl border border-border p-6">
                <Skeleton className="h-5 w-40 mb-2" />
                <Skeleton className="h-3 w-60 mb-5" />
                <div className="flex gap-1">
                    {Array.from({ length: 12 }).map((_, wi) => (
                        <div key={wi} className="flex flex-col gap-1">
                            {Array.from({ length: 7 }).map((_, di) => (
                                <Skeleton key={di} className="w-3.5 h-3.5 rounded-sm" />
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            {/* Knowledge Graph */}
            <div className="bg-card rounded-xl border border-border p-6">
                <Skeleton className="h-5 w-40 mb-2" />
                <Skeleton className="h-3 w-56 mb-4" />
                <div className="aspect-[16/10] rounded-lg bg-muted/30 flex items-center justify-center">
                    <div className="flex gap-8">
                        {[32, 48, 40, 36, 44].map((s, i) => (
                            <Skeleton key={i} className="rounded-full" style={{ width: s, height: s }} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Ghost Mode */}
            <div className="bg-card rounded-xl border border-border p-6">
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-3 w-48 mb-5" />
                <div className="flex items-end gap-2 h-28">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="flex-1 rounded-t" style={{ height: `${30 + Math.random() * 60}%` }} />
                    ))}
                </div>
            </div>

            {/* Skill Radar + Nudges */}
            <div className="space-y-4 lg:space-y-6">
                <div className="bg-card rounded-xl border border-border p-6">
                    <Skeleton className="h-5 w-28 mb-2" />
                    <Skeleton className="h-3 w-44 mb-4" />
                    <Skeleton className="h-40 w-full rounded-lg" />
                </div>
                <div className="bg-card rounded-xl border border-border p-6">
                    <Skeleton className="h-5 w-36 mb-2" />
                    <Skeleton className="h-3 w-48 mb-4" />
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full rounded-lg mb-2" />
                    ))}
                </div>
            </div>
        </div>

        {/* Growth */}
        <div className="bg-card rounded-xl border border-border p-6 mt-4 lg:mt-6">
            <Skeleton className="h-5 w-36 mb-2" />
            <Skeleton className="h-3 w-52 mb-4" />
            <Skeleton className="h-44 w-full rounded-lg" />
        </div>
    </div>
);

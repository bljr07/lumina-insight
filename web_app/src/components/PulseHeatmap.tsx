import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { mockHeatmapData } from "@/lib/mockData";

const dayLabels = ["Mon", "", "Wed", "", "Fri", "", "Sun"];
const monthLabels = ["Jan", "Feb", "Mar"];

const intensityClasses = [
  "bg-muted",
  "bg-lumina-success/20",
  "bg-lumina-success/40",
  "bg-lumina-success/70",
  "bg-lumina-success",
];

export const PulseHeatmap = () => {
  const { data: heatmapData = [] } = useQuery({
    queryKey: ["pulse-heatmap"],
    queryFn: async () => {
      const res = await fetch("/api/pulse-heatmap");
      if (!res.ok) throw new Error("Failed to fetch heatmap");
      return res.json();
    },
    initialData: mockHeatmapData,
    retry: 1,
  });

  return (
    <div className="bg-card rounded-xl border border-border p-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Pulse Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Your learning energy over the past 12 weeks</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Less</span>
          {intensityClasses.map((cls, i) => (
            <div key={i} className={cn("w-3 h-3 rounded-sm", cls)} />
          ))}
          <span>More</span>
        </div>
      </div>

      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-1 mr-2 pt-6">
          {dayLabels.map((label, i) => (
            <div key={i} className="h-3.5 flex items-center text-[10px] text-muted-foreground leading-none">
              {label}
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        <div>
          {/* Month labels */}
          <div className="flex mb-1.5">
            {monthLabels.map((m, i) => (
              <div key={i} className="text-[10px] text-muted-foreground" style={{ width: `${100 / 3}%` }}>
                {m}
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            {heatmapData.map((week: number[], wi: number) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((val: number, di: number) => (
                  <div
                    key={di}
                    className={cn(
                      "w-3.5 h-3.5 rounded-sm transition-colors hover:ring-1 hover:ring-primary/50 cursor-pointer",
                      intensityClasses[val]
                    )}
                    title={`Week ${wi + 1}, Day ${di + 1}: Intensity ${val}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Burnout zones */}
      <div className="mt-5 flex gap-3">
        <div className="flex-1 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-xs font-medium text-destructive">Energy Burnout Zone</p>
          <p className="text-[11px] text-muted-foreground mt-1">Week 5–6: Database normalization overload detected</p>
        </div>
        <div className="flex-1 rounded-lg bg-lumina-success/10 border border-lumina-success/20 p-3">
          <p className="text-xs font-medium text-lumina-success">Flow State Peak</p>
          <p className="text-[11px] text-muted-foreground mt-1">Week 9–10: Strong momentum in API design patterns</p>
        </div>
      </div>
    </div>
  );
};

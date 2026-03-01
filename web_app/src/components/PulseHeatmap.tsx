import { useState } from "react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { mockHeatmapData } from "@/lib/mockData";
import { motion, AnimatePresence } from "framer-motion";

const dayLabels = ["Mon", "", "Wed", "", "Fri", "", "Sun"];
const monthLabels = ["Jan", "Feb", "Mar"];
const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const intensityClasses = [
  "bg-muted",
  "bg-lumina-success/20",
  "bg-lumina-success/40",
  "bg-lumina-success/70",
  "bg-lumina-success",
];

const intensityLabels = ["No activity", "Light study", "Moderate study", "Focused study", "Deep work"];
const mockTopics = [
  ["REST APIs", "HTTP Methods"],
  ["SQL Joins", "Normalization"],
  ["Docker Basics", "Containers"],
  ["Auth & JWT", "OAuth2"],
  ["Microservices", "API Gateway"],
  ["CI/CD Pipeline", "GitHub Actions"],
  ["Load Balancing", "Caching"],
  ["System Design", "Scalability"],
];

// Generate a mock date from week/day indices (12 weeks back from "today")
function getMockDate(weekIdx: number, dayIdx: number): string {
  const now = new Date();
  const weeksAgo = 11 - weekIdx;
  const d = new Date(now);
  d.setDate(d.getDate() - weeksAgo * 7 - (6 - dayIdx));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getMockHours(val: number): string {
  if (val === 0) return "0h";
  return `${(val * 1.2 + Math.random() * 0.5).toFixed(1)}h`;
}

export const PulseHeatmap = () => {
  const [tooltip, setTooltip] = useState<{ weekIdx: number; dayIdx: number; x: number; y: number } | null>(null);

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

  const handleMouseEnter = (weekIdx: number, dayIdx: number, e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const parent = e.currentTarget.closest(".heatmap-container")?.getBoundingClientRect();
    if (parent) {
      setTooltip({
        weekIdx,
        dayIdx,
        x: rect.left - parent.left + rect.width / 2,
        y: rect.top - parent.top - 8,
      });
    }
  };

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

      <div className="flex gap-1 relative heatmap-container">
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
                  <motion.div
                    key={di}
                    className={cn(
                      "w-3.5 h-3.5 rounded-sm transition-all hover:ring-2 hover:ring-primary/50 hover:scale-125 cursor-pointer",
                      intensityClasses[val]
                    )}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: wi * 0.03 + di * 0.01, duration: 0.2, ease: "easeOut" }}
                    onMouseEnter={(e) => handleMouseEnter(wi, di, e)}
                    onMouseLeave={() => setTooltip(null)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Tooltip */}
        <AnimatePresence>
          {tooltip && (
            <motion.div
              className="absolute z-10 bg-card border border-border rounded-lg px-3 py-2 shadow-xl pointer-events-none"
              style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)" }}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <p className="text-xs font-medium text-foreground">{getMockDate(tooltip.weekIdx, tooltip.dayIdx)} · {dayNames[tooltip.dayIdx]}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Study time: <span className="text-foreground font-medium">{getMockHours(heatmapData[tooltip.weekIdx]?.[tooltip.dayIdx] || 0)}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                Level: <span className="text-foreground">{intensityLabels[heatmapData[tooltip.weekIdx]?.[tooltip.dayIdx] || 0]}</span>
              </p>
              {(heatmapData[tooltip.weekIdx]?.[tooltip.dayIdx] || 0) > 0 && (
                <p className="text-[10px] text-primary mt-0.5">
                  📚 {mockTopics[(tooltip.weekIdx + tooltip.dayIdx) % mockTopics.length].join(", ")}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
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

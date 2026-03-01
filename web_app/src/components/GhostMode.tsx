import { Ghost, TrendingDown, TrendingUp, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { mockGhostMode } from "@/lib/mockData";
import { motion } from "framer-motion";

interface GhostData {
  label: string;
  current: string;
  past: string;
  change: number;
  improving: boolean;
}

interface TimelinePoint {
  month: string;
  score: number;
}

const barVariants = {
  hidden: { scaleY: 0 },
  visible: (i: number) => ({
    scaleY: 1,
    transition: {
      type: "spring",
      stiffness: 180,
      damping: 14,
      delay: 0.2 + i * 0.08,
    },
  }),
};

const rowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 20,
      delay: 0.6 + i * 0.1,
    },
  }),
};

export const GhostMode = () => {
  const { data } = useQuery({
    queryKey: ["ghost-mode"],
    queryFn: async () => {
      const res = await fetch("/api/ghost-mode");
      if (!res.ok) throw new Error("Failed to fetch ghost mode data");
      return res.json();
    },
    initialData: mockGhostMode,
    retry: 1,
  });

  const ghostData: GhostData[] = data?.ghostData || [];
  const timelinePoints: TimelinePoint[] = data?.timelinePoints || [];

  const maxScore = Math.max(...timelinePoints.map((p) => p.score), 1);

  return (
    <div className="bg-card rounded-xl border border-border p-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
      <div className="flex items-center gap-2 mb-1">
        <Ghost className="w-5 h-5 text-lumina-ghost" />
        <h2 className="text-lg font-semibold text-foreground">Ghost Mode</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5">Racing against your past self — not others</p>

      {/* Mini sparkline */}
      <div className="mb-6">
        <div className="flex items-end gap-1 h-16">
          {timelinePoints.map((point, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <motion.div
                className="w-full rounded-t-sm bg-lumina-ghost/30 hover:bg-lumina-ghost/50 transition-colors relative"
                style={{ height: `${(point.score / maxScore) * 100}%`, originY: 1 }}
                variants={barVariants}
                custom={i}
                initial="hidden"
                animate="visible"
              >
                {i === timelinePoints.length - 1 && (
                  <motion.div
                    className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-semibold text-lumina-ghost"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                  >
                    {point.score}
                  </motion.div>
                )}
              </motion.div>
              <span className="text-[9px] text-muted-foreground">{point.month}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          <span className="text-lumina-ghost font-medium">Mastery Velocity:</span> +{timelinePoints[timelinePoints.length - 1].score - timelinePoints[0].score} pts since {timelinePoints[0].month}
        </p>
      </div>

      {/* Comparison cards */}
      <div className="space-y-2">
        {ghostData.map((item, i) => (
          <motion.div
            key={item.label}
            variants={rowVariants}
            custom={i}
            initial="hidden"
            animate="visible"
            whileHover={{ x: 4, transition: { type: "spring", stiffness: 400, damping: 15 } }}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-default"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm text-foreground">{item.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground line-through">{item.past}</span>
              <span className="text-sm font-medium text-foreground">{item.current}</span>
              <div className={`flex items-center gap-0.5 text-xs font-medium ${item.improving ? "text-lumina-success" : "text-lumina-warning"}`}>
                {item.improving ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                {Math.abs(item.change)}%
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

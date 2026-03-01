import { useState } from "react";
import { Coffee, BookOpen, Zap, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { mockNudges } from "@/lib/mockData";
import { motion } from "framer-motion";
import { BreakTimer } from "@/components/BreakTimer";
import { BridgingExercise } from "@/components/BridgingExercise";
import { FocusMode } from "@/components/FocusMode";

const typeStyles: Record<string, string> = {
  wellbeing: "border-lumina-warning/20 bg-lumina-warning/5",
  bridge: "border-lumina-info/20 bg-lumina-info/5",
  flow: "border-lumina-success/20 bg-lumina-success/5",
};

const typeIconStyles: Record<string, string> = {
  wellbeing: "text-lumina-warning bg-lumina-warning/10",
  bridge: "text-lumina-info bg-lumina-info/10",
  flow: "text-lumina-success bg-lumina-success/10",
};

const iconMap: Record<string, any> = {
  Coffee,
  BookOpen,
  Zap,
};

const nudgeVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 200,
      damping: 18,
      delay: 0.1 + i * 0.12,
    },
  }),
};

export const ContextualNudges = () => {
  const [breakTimerOpen, setBreakTimerOpen] = useState(false);
  const [bridgingOpen, setBridgingOpen] = useState(false);
  const [focusActive, setFocusActive] = useState(false);

  const { data: nudges = [] } = useQuery({
    queryKey: ["nudges"],
    queryFn: async () => {
      const res = await fetch("/api/nudges");
      if (!res.ok) throw new Error("Failed to fetch nudges");
      return res.json();
    },
    initialData: mockNudges,
    retry: 1,
  });

  const handleAction = (nudge: any) => {
    if (nudge.type === "wellbeing") {
      setBreakTimerOpen(true);
    } else if (nudge.type === "bridge") {
      setBridgingOpen(true);
    } else if (nudge.type === "flow") {
      setFocusActive(true);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 animate-fade-in" style={{ animationDelay: "0.25s" }}>
      <h2 className="text-lg font-semibold text-foreground mb-1">Contextual Nudges</h2>
      <p className="text-sm text-muted-foreground mb-5">Empathetic interventions, not corrections</p>

      <div className="space-y-3">
        {nudges.map((nudge: any, i: number) => {
          const Icon = iconMap[nudge.icon];
          return (
            <motion.div
              key={i}
              variants={nudgeVariants}
              custom={i}
              initial="hidden"
              animate="visible"
              whileHover={{ scale: 1.02, transition: { type: "spring", stiffness: 400, damping: 15 } }}
              className={cn("rounded-lg border p-4 transition-all cursor-default", typeStyles[nudge.type] || typeStyles.wellbeing)}
            >
              <div className="flex items-start gap-3">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", typeIconStyles[nudge.type] || typeIconStyles.wellbeing)}>
                  {Icon && <Icon className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-medium text-foreground">{nudge.title}</h3>
                    <span className="text-[10px] text-muted-foreground">{nudge.time}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{nudge.message}</p>
                  <button
                    onClick={() => handleAction(nudge)}
                    className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer"
                  >
                    {nudge.action}
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Struggle normalization */}
      <motion.div
        className="mt-4 rounded-lg bg-muted/50 border border-border p-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <p className="text-xs text-muted-foreground italic">
          "85% of successful students spent more than 2 hours on this specific JOIN optimization.{" "}
          <span className="text-foreground font-medium not-italic">You are exactly where you need to be.</span>"
        </p>
      </motion.div>

      {/* Dialogs */}
      <BreakTimer open={breakTimerOpen} onClose={() => setBreakTimerOpen(false)} />
      <BridgingExercise open={bridgingOpen} onClose={() => setBridgingOpen(false)} />
      <FocusMode active={focusActive} onExit={() => setFocusActive(false)} />
    </div>
  );
};

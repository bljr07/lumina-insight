import { Battery, Brain, Flame, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { mockStats } from "@/lib/mockData";
import { motion } from "framer-motion";

const iconMap: Record<string, any> = {
  Flame,
  Battery,
  Brain,
  Clock,
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 18,
      delay: i * 0.1,
    },
  }),
};

export const StatsBar = () => {
  const { data: stats = [] } = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    initialData: mockStats,
    retry: 1,
  });

  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map((stat: any, i: number) => {
        const Icon = iconMap[stat.icon];
        return (
          <motion.div
            key={stat.label}
            variants={cardVariants}
            custom={i}
            initial="hidden"
            animate="visible"
            whileHover={{ y: -4, transition: { type: "spring", stiffness: 400, damping: 15 } }}
            className="bg-card rounded-xl border border-border p-4 hover:glow-border transition-all duration-300 cursor-default"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-7 h-7 rounded-lg ${stat.bg} flex items-center justify-center`}>
                {Icon && <Icon className={`w-3.5 h-3.5 ${stat.color}`} />}
              </div>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
          </motion.div>
        );
      })}
    </div>
  );
};

import { Battery, Brain, Flame, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const iconMap: Record<string, any> = {
  Flame,
  Battery,
  Brain,
  Clock,
};

export const StatsBar = () => {
  const { data: stats = [], isLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    }
  });

  if (isLoading) return <div className="h-24 animate-pulse bg-muted rounded-xl" />;

  return (
    <div className="grid grid-cols-4 gap-4 animate-fade-in">
      {stats.map((stat: any) => {
        const Icon = iconMap[stat.icon];
        return (
          <div
            key={stat.label}
            className="bg-card rounded-xl border border-border p-4 hover:glow-border transition-all duration-300"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-7 h-7 rounded-lg ${stat.bg} flex items-center justify-center`}>
                {Icon && <Icon className={`w-3.5 h-3.5 ${stat.color}`} />}
              </div>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
          </div>
        );
      })}
    </div>
  );
};

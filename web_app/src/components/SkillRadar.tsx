import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { mockSkillRadar } from "@/lib/mockData";

export const SkillRadar = () => {
  const { data: skillData = [] } = useQuery({
    queryKey: ["skill-radar"],
    queryFn: async () => {
      const res = await fetch("/api/skill-radar");
      if (!res.ok) throw new Error("Failed to fetch skills");
      return res.json();
    },
    initialData: mockSkillRadar,
    retry: 1,
  });

  return (
    <div className="bg-card rounded-xl border border-border p-6 animate-fade-in" style={{ animationDelay: "0.3s" }}>
      <h2 className="text-lg font-semibold text-foreground mb-1">Skill Radar</h2>
      <p className="text-sm text-muted-foreground mb-4">Your diverse strengths — beyond grades</p>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="72%" data={skillData}>
            <PolarGrid stroke="hsl(228 10% 20%)" />
            <PolarAngleAxis
              dataKey="skill"
              tick={{ fill: "hsl(220 10% 50%)", fontSize: 11, fontFamily: "Space Grotesk" }}
            />
            <Radar
              name="Skills"
              dataKey="value"
              stroke="hsl(38 92% 55%)"
              fill="hsl(38 92% 55%)"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <div className="rounded-lg bg-primary/5 border border-primary/10 p-2.5 text-center">
          <p className="text-xl font-bold text-primary">92</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Resilience</p>
        </div>
        <div className="rounded-lg bg-lumina-info/5 border border-lumina-info/10 p-2.5 text-center">
          <p className="text-xl font-bold text-lumina-info">88</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Consistency</p>
        </div>
      </div>
    </div>
  );
};

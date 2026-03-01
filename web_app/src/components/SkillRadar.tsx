import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { mockSkillRadar } from "@/lib/mockData";
import { motion } from "framer-motion";

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
        <p className="text-sm font-medium text-foreground">{data.skill}</p>
        <p className="text-xs text-primary font-semibold">{data.value}/100</p>
      </div>
    );
  }
  return null;
};

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

  // Find top 2 skills for highlight cards
  const sorted = [...skillData].sort((a: any, b: any) => b.value - a.value);
  const top = sorted[0];
  const second = sorted[1];

  return (
    <motion.div
      className="bg-card rounded-xl border border-border p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.3 }}
    >
      <h2 className="text-lg font-semibold text-foreground mb-1">Skill Radar</h2>
      <p className="text-sm text-muted-foreground mb-4">Your diverse strengths — beyond grades</p>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="72%" data={skillData}>
            <PolarGrid stroke="hsl(228 10% 20%)" strokeDasharray="3 3" />
            <PolarAngleAxis
              dataKey="skill"
              tick={{ fill: "hsl(220 10% 55%)", fontSize: 11, fontFamily: "Space Grotesk" }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Radar
              name="Skills"
              dataKey="value"
              stroke="hsl(38 92% 55%)"
              fill="hsl(38 92% 55%)"
              fillOpacity={0.15}
              strokeWidth={2}
              dot={{
                r: 3,
                fill: "hsl(38 92% 55%)",
                strokeWidth: 0,
              }}
              activeDot={{
                r: 5,
                fill: "hsl(38 92% 60%)",
                stroke: "hsl(38 92% 55% / 0.4)",
                strokeWidth: 3,
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Dynamic highlight cards */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <motion.div
          className="rounded-lg bg-primary/5 border border-primary/10 p-2.5 text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6, type: "spring", stiffness: 200, damping: 15 }}
        >
          <p className="text-xl font-bold text-primary">{top?.value}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{top?.skill}</p>
        </motion.div>
        <motion.div
          className="rounded-lg bg-lumina-info/5 border border-lumina-info/10 p-2.5 text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7, type: "spring", stiffness: 200, damping: 15 }}
        >
          <p className="text-xl font-bold text-lumina-info">{second?.value}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{second?.skill}</p>
        </motion.div>
      </div>
    </motion.div>
  );
};

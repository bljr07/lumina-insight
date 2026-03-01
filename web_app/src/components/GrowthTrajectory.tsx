import { useState } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceDot,
} from "recharts";
import { motion } from "framer-motion";
import { TrendingUp, Star } from "lucide-react";

const trajectoryData = [
    { month: "Aug", score: 15, label: "" },
    { month: "Sep", score: 28, label: "First project" },
    { month: "Oct", score: 38, label: "" },
    { month: "Nov", score: 45, label: "Mid-terms" },
    { month: "Dec", score: 52, label: "" },
    { month: "Jan", score: 58, label: "REST APIs mastered" },
    { month: "Feb", score: 68, label: "" },
    { month: "Mar", score: 78, label: "Current" },
];

const milestones = trajectoryData.filter((d) => d.label);

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
                <p className="text-sm font-medium text-foreground">{data.month}</p>
                <p className="text-xs text-primary font-semibold">Mastery: {data.score}%</p>
                {data.label && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">🏆 {data.label}</p>
                )}
            </div>
        );
    }
    return null;
};

export const GrowthTrajectory = () => {
    return (
        <motion.div
            className="bg-card rounded-xl border border-border p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.3 }}
        >
            <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-5 h-5 text-lumina-success" />
                <h2 className="text-lg font-semibold text-foreground">Growth Trajectory</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-5">Your long-term learning arc with key milestones</p>

            <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trajectoryData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <CartesianGrid stroke="hsl(228 10% 18%)" strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="month"
                            tick={{ fill: "hsl(220 10% 55%)", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            domain={[0, 100]}
                            tick={{ fill: "hsl(220 10% 55%)", fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Line
                            type="monotone"
                            dataKey="score"
                            stroke="hsl(38 92% 55%)"
                            strokeWidth={2.5}
                            dot={false}
                            activeDot={{ r: 5, fill: "hsl(38 92% 55%)", stroke: "hsl(38 92% 55% / 0.3)", strokeWidth: 4 }}
                        />
                        {/* Milestone dots */}
                        {milestones.map((m) => (
                            <ReferenceDot
                                key={m.month}
                                x={m.month}
                                y={m.score}
                                r={4}
                                fill="hsl(38 92% 55%)"
                                stroke="hsl(228 12% 8%)"
                                strokeWidth={2}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Milestone pills */}
            <div className="flex flex-wrap gap-2 mt-4">
                {milestones.map((m) => (
                    <div
                        key={m.month}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/5 border border-primary/10 text-xs"
                    >
                        <Star className="w-3 h-3 text-primary" />
                        <span className="text-muted-foreground">{m.month}:</span>
                        <span className="text-foreground font-medium">{m.label}</span>
                    </div>
                ))}
            </div>
        </motion.div>
    );
};

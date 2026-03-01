export type Stat = {
  icon: "Flame" | "Battery" | "Brain" | "Clock";
  label: string;
  value: string;
  sub: string;
  color: string;
  bg: string;
};

export type SkillPoint = {
  skill: string;
  value: number;
  fullMark: number;
};

export type KnowledgeNode = {
  id: number;
  label: string;
  x: number;
  y: number;
  size: number;
  mastery: number;
};

export type KnowledgeGraph = {
  nodes: KnowledgeNode[];
  edges: number[][];
};

export type Nudge = {
  icon: "Coffee" | "BookOpen" | "Zap";
  type: string;
  title: string;
  message: string;
  action: string;
  time: string;
};

export type GhostRow = {
  label: string;
  current: string;
  past: string;
  change: number;
  improving: boolean;
};

export type TimelinePoint = {
  month: string;
  score: number;
};

export type GhostModeData = {
  ghostData: GhostRow[];
  timelinePoints: TimelinePoint[];
};

export const mockStats: Stat[] = [
  {
    icon: "Flame",
    label: "Study Streak",
    value: "12 days",
    sub: "+3 from last week",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: "Battery",
    label: "Cognitive Load",
    value: "62%",
    sub: "Optimal zone",
    color: "text-lumina-success",
    bg: "bg-lumina-success/10",
  },
  {
    icon: "Brain",
    label: "Concepts Mastered",
    value: "24 / 38",
    sub: "63% complete",
    color: "text-lumina-info",
    bg: "bg-lumina-info/10",
  },
  {
    icon: "Clock",
    label: "Avg. Focus Session",
    value: "47 min",
    sub: "up 8 min vs last month",
    color: "text-lumina-warning",
    bg: "bg-lumina-warning/10",
  },
];

export const mockSkillRadar: SkillPoint[] = [
  { skill: "Consistency", value: 88, fullMark: 100 },
  { skill: "Resilience", value: 92, fullMark: 100 },
  { skill: "Syntax", value: 65, fullMark: 100 },
  { skill: "Logic", value: 78, fullMark: 100 },
  { skill: "Debugging", value: 82, fullMark: 100 },
  { skill: "Architecture", value: 70, fullMark: 100 },
];

export const mockHeatmapData: number[][] = Array.from({ length: 12 }, (_, week) =>
  Array.from({ length: 7 }, (_, day) => (week + day) % 5)
);

export const mockKnowledgeGraph: KnowledgeGraph = {
  nodes: [
    { id: 1, label: "Java", x: 50, y: 45, size: 40, mastery: 0.85 },
    { id: 2, label: "OOP", x: 30, y: 25, size: 32, mastery: 0.78 },
    { id: 3, label: "Data\nStructures", x: 72, y: 28, size: 34, mastery: 0.72 },
    { id: 4, label: "APIs", x: 25, y: 65, size: 30, mastery: 0.6 },
    { id: 5, label: "Databases", x: 70, y: 68, size: 36, mastery: 0.55 },
    { id: 6, label: "Spring\nBoot", x: 48, y: 80, size: 28, mastery: 0.4 },
  ],
  edges: [
    [1, 2],
    [1, 3],
    [1, 4],
    [1, 5],
    [4, 6],
    [5, 6],
  ],
};

export const mockNudges: Nudge[] = [
  {
    icon: "Coffee",
    type: "wellbeing",
    title: "Break suggested",
    message: "You usually perform better after a short reset.",
    action: "Take a break",
    time: "2 min ago",
  },
  {
    icon: "BookOpen",
    type: "bridge",
    title: "Prerequisite bridge",
    message: "Review this quick refresher before continuing.",
    action: "Start refresher",
    time: "15 min ago",
  },
  {
    icon: "Zap",
    type: "flow",
    title: "Flow state detected",
    message: "You are in momentum. Try a harder challenge next.",
    action: "Challenge me",
    time: "1 hr ago",
  },
];

export const mockGhostMode: GhostModeData = {
  ghostData: [
    { label: "Logic Error Resolution", current: "12 min", past: "18 min", change: -33, improving: true },
    { label: "Recursive Functions", current: "8 min", past: "22 min", change: -64, improving: true },
    { label: "API Integration", current: "15 min", past: "12 min", change: 25, improving: false },
  ],
  timelinePoints: [
    { month: "Oct", score: 42 },
    { month: "Nov", score: 55 },
    { month: "Dec", score: 48 },
    { month: "Jan", score: 63 },
    { month: "Feb", score: 71 },
    { month: "Now", score: 78 },
  ],
};

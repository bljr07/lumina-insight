import { useQuery } from "@tanstack/react-query";
import { mockKnowledgeGraph } from "@/lib/mockData";
import { motion } from "framer-motion";

interface Node {
  id: number;
  label: string;
  x: number;
  y: number;
  size: number;
  mastery: number;
}

const nodeVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: (i: number) => ({
    scale: 1,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 15,
      delay: 0.3 + i * 0.08,
    },
  }),
};

const edgeVariants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: (i: number) => ({
    pathLength: 1,
    opacity: 1,
    transition: {
      duration: 0.6,
      delay: 0.1 + i * 0.05,
      ease: "easeOut",
    },
  }),
};

const glowVariants = {
  idle: (mastery: number) => ({
    scale: [1, 1.3, 1],
    opacity: [mastery * 0.2, mastery * 0.35, mastery * 0.2],
    transition: {
      duration: 2.5 + Math.random(),
      repeat: Infinity,
      ease: "easeInOut",
    },
  }),
};

export const KnowledgeGraph = () => {
  const { data } = useQuery({
    queryKey: ["knowledge-graph"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge-graph");
      if (!res.ok) throw new Error("Failed to fetch knowledge graph");
      return res.json();
    },
    initialData: mockKnowledgeGraph,
    retry: 1,
  });

  const nodes: Node[] = data?.nodes || [];
  const edges: number[][] = data?.edges || [];

  return (
    <div className="bg-card rounded-xl border border-border p-6 animate-fade-in" style={{ animationDelay: "0.15s" }}>
      <h2 className="text-lg font-semibold text-foreground mb-1">Knowledge Graph</h2>
      <p className="text-sm text-muted-foreground mb-4">
        How your concepts connect — brighter nodes = higher mastery
      </p>

      <div className="relative w-full aspect-[16/10] rounded-lg bg-muted/30 overflow-hidden">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Edges with animated draw-in */}
          {edges.map(([from, to], i) => {
            const a = nodes.find((n) => n.id === from);
            const b = nodes.find((n) => n.id === to);
            if (!a || !b) return null;
            return (
              <motion.line
                key={`edge-${i}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="hsl(228 15% 25%)"
                strokeWidth="0.4"
                strokeDasharray="1 0.8"
                variants={edgeVariants}
                custom={i}
                initial="hidden"
                animate="visible"
              />
            );
          })}

          {/* Nodes with bouncy spring entrance */}
          {nodes.map((node, i) => (
            <motion.g
              key={node.id}
              className="cursor-pointer"
              variants={nodeVariants}
              custom={i}
              initial="hidden"
              animate="visible"
              style={{ originX: `${node.x}%`, originY: `${node.y}%` }}
              whileHover={{ scale: 1.15, transition: { type: "spring", stiffness: 400, damping: 10 } }}
            >
              {/* Breathing glow */}
              <motion.circle
                cx={node.x}
                cy={node.y}
                r={node.size / 6 + 1.5}
                fill={`hsl(38 92% 55% / ${node.mastery * 0.2})`}
                variants={glowVariants}
                custom={node.mastery}
                animate="idle"
              />
              {/* Node circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r={node.size / 6}
                fill={`hsl(38 ${60 + node.mastery * 32}% ${30 + node.mastery * 30}% / 0.9)`}
                stroke={`hsl(38 92% 55% / ${node.mastery})`}
                strokeWidth="0.3"
              />
              {/* Label */}
              {node.label.split("\n").map((line: string, li: number) => (
                <text
                  key={li}
                  x={node.x}
                  y={node.y + node.size / 6 + 3 + li * 3.5}
                  textAnchor="middle"
                  fill="hsl(40 15% 75%)"
                  fontSize="2.8"
                  fontFamily="Space Grotesk"
                >
                  {line}
                </text>
              ))}
            </motion.g>
          ))}
        </svg>

        {/* Insight overlay */}
        <motion.div
          className="absolute bottom-3 left-3 right-3 rounded-lg surface-glass border border-border p-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.5 }}
        >
          <p className="text-xs text-muted-foreground">
            <span className="text-lumina-warning font-medium">Insight:</span> Your struggle with{" "}
            <span className="text-foreground font-medium">Microservices</span> is linked to a{" "}
            <span className="text-primary font-medium">45% gap</span> in Database fundamentals.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

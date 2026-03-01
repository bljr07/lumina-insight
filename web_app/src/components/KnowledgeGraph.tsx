import { useQuery } from "@tanstack/react-query";

interface Node {
  id: number;
  label: string;
  x: number;
  y: number;
  size: number;
  mastery: number;
}

export const KnowledgeGraph = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["knowledge-graph"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge-graph");
      if (!res.ok) throw new Error("Failed to fetch knowledge graph");
      return res.json();
    }
  });

  if (isLoading) return <div className="h-64 animate-pulse bg-muted rounded-xl" />;

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
          {/* Edges */}
          {edges.map(([from, to], i) => {
            const a = nodes.find((n) => n.id === from);
            const b = nodes.find((n) => n.id === to);
            if (!a || !b) return null;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="hsl(228 15% 25%)"
                strokeWidth="0.4"
                strokeDasharray="1 0.8"
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => (
            <g key={node.id} className="cursor-pointer">
              {/* Glow */}
              <circle
                cx={node.x}
                cy={node.y}
                r={node.size / 6 + 1.5}
                fill={`hsl(38 92% 55% / ${node.mastery * 0.2})`}
                className="animate-pulse-glow"
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
            </g>
          ))}
        </svg>

        {/* Insight overlay */}
        <div className="absolute bottom-3 left-3 right-3 rounded-lg surface-glass border border-border p-3">
          <p className="text-xs text-muted-foreground">
            <span className="text-lumina-warning font-medium">Insight:</span> Your struggle with{" "}
            <span className="text-foreground font-medium">Microservices</span> is linked to a{" "}
            <span className="text-primary font-medium">45% gap</span> in Database fundamentals.
          </p>
        </div>
      </div>
    </div>
  );
};

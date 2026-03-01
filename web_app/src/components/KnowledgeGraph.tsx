import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { mockKnowledgeGraph } from "@/lib/mockData";
import { motion, AnimatePresence } from "framer-motion";
import { X, BookOpen, ExternalLink } from "lucide-react";

interface Node {
  id: number;
  label: string;
  x: number;
  y: number;
  size: number;
  mastery: number;
}

interface NodeDetail {
  subtopics: string[];
  resources: { title: string; type: string }[];
  timeSpent: string;
  lastStudied: string;
}

// Mock details for each node
const nodeDetails: Record<number, NodeDetail> = {
  1: { subtopics: ["GET/POST/PUT/DELETE", "Status Codes", "Versioning", "HATEOAS"], resources: [{ title: "RESTful API Design Guide", type: "Article" }, { title: "API Best Practices", type: "Video" }], timeSpent: "12.5h", lastStudied: "2 days ago" },
  2: { subtopics: ["Normalization", "Indexing", "Transactions", "ACID Properties"], resources: [{ title: "DB Fundamentals Course", type: "Course" }, { title: "Schema Design Patterns", type: "Article" }], timeSpent: "8.2h", lastStudied: "4 days ago" },
  3: { subtopics: ["Service Mesh", "API Gateway", "Event-Driven", "Saga Pattern"], resources: [{ title: "Microservices with Node.js", type: "Course" }, { title: "Distributed Systems", type: "Book" }], timeSpent: "5.1h", lastStudied: "1 day ago" },
  4: { subtopics: ["Dockerfile", "Compose", "Volumes", "Networking"], resources: [{ title: "Docker in Practice", type: "Book" }, { title: "Container Orchestration", type: "Video" }], timeSpent: "7.8h", lastStudied: "3 days ago" },
  5: { subtopics: ["Query Plans", "Joins", "Window Functions", "Stored Procedures"], resources: [{ title: "SQL Performance Tuning", type: "Article" }, { title: "Advanced SQL", type: "Course" }], timeSpent: "3.4h", lastStudied: "1 week ago" },
  6: { subtopics: ["JWT Tokens", "OAuth2", "RBAC", "CORS"], resources: [{ title: "Web Security Handbook", type: "Book" }, { title: "Auth0 Quickstart", type: "Tutorial" }], timeSpent: "9.1h", lastStudied: "Yesterday" },
  7: { subtopics: ["GitHub Actions", "Jenkins", "Testing Pipeline", "Deploy Strategies"], resources: [{ title: "CI/CD with GitHub", type: "Tutorial" }, { title: "DevOps Roadmap", type: "Article" }], timeSpent: "6.3h", lastStudied: "5 days ago" },
  8: { subtopics: ["Round Robin", "Least Connections", "Health Checks", "Reverse Proxy"], resources: [{ title: "Nginx Guide", type: "Tutorial" }, { title: "High Availability", type: "Video" }], timeSpent: "4.0h", lastStudied: "1 week ago" },
  9: { subtopics: ["Redis", "Memcached", "Cache Invalidation", "CDN"], resources: [{ title: "Caching Strategies", type: "Article" }, { title: "Redis Deep Dive", type: "Course" }], timeSpent: "5.5h", lastStudied: "3 days ago" },
};

const nodeVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: (i: number) => ({
    scale: 1,
    opacity: 1,
    transition: { type: "spring", stiffness: 260, damping: 15, delay: 0.3 + i * 0.08 },
  }),
};

const edgeVariants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: (i: number) => ({
    pathLength: 1,
    opacity: 1,
    transition: { duration: 0.6, delay: 0.1 + i * 0.05, ease: "easeOut" },
  }),
};

const glowVariants = {
  idle: (mastery: number) => ({
    scale: [1, 1.3, 1],
    opacity: [mastery * 0.2, mastery * 0.35, mastery * 0.2],
    transition: { duration: 2.5 + Math.random(), repeat: Infinity, ease: "easeInOut" },
  }),
};

const typeColors: Record<string, string> = {
  Article: "text-lumina-info",
  Video: "text-lumina-warning",
  Course: "text-primary",
  Book: "text-lumina-success",
  Tutorial: "text-lumina-ghost",
};

export const KnowledgeGraph = () => {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

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
    <div className="bg-card rounded-xl border border-border p-6 animate-fade-in relative" style={{ animationDelay: "0.15s" }}>
      <h2 className="text-lg font-semibold text-foreground mb-1">Knowledge Graph</h2>
      <p className="text-sm text-muted-foreground mb-4">Click a node to explore — brighter = higher mastery</p>

      <div className="relative w-full aspect-[16/10] rounded-lg bg-muted/30 overflow-hidden">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {edges.map(([from, to], i) => {
            const a = nodes.find((n) => n.id === from);
            const b = nodes.find((n) => n.id === to);
            if (!a || !b) return null;
            return (
              <motion.line
                key={`edge-${i}`}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="hsl(228 15% 25%)" strokeWidth="0.4" strokeDasharray="1 0.8"
                variants={edgeVariants} custom={i} initial="hidden" animate="visible"
              />
            );
          })}
          {nodes.map((node, i) => (
            <motion.g
              key={node.id}
              className="cursor-pointer"
              variants={nodeVariants} custom={i} initial="hidden" animate="visible"
              style={{ originX: `${node.x}%`, originY: `${node.y}%` }}
              whileHover={{ scale: 1.15, transition: { type: "spring", stiffness: 400, damping: 10 } }}
              onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
            >
              <motion.circle
                cx={node.x} cy={node.y} r={node.size / 6 + 1.5}
                fill={`hsl(38 92% 55% / ${node.mastery * 0.2})`}
                variants={glowVariants} custom={node.mastery} animate="idle"
              />
              <circle
                cx={node.x} cy={node.y} r={node.size / 6}
                fill={`hsl(38 ${60 + node.mastery * 32}% ${30 + node.mastery * 30}% / 0.9)`}
                stroke={selectedNode?.id === node.id ? "hsl(38 92% 70%)" : `hsl(38 92% 55% / ${node.mastery})`}
                strokeWidth={selectedNode?.id === node.id ? "0.6" : "0.3"}
              />
              {node.label.split("\n").map((line: string, li: number) => (
                <text key={li} x={node.x} y={node.y + node.size / 6 + 3 + li * 3.5}
                  textAnchor="middle" fill="hsl(40 15% 75%)" fontSize="2.8" fontFamily="Space Grotesk">
                  {line}
                </text>
              ))}
            </motion.g>
          ))}
        </svg>

        {/* Node detail panel */}
        <AnimatePresence>
          {selectedNode && nodeDetails[selectedNode.id] && (
            <motion.div
              className="absolute inset-x-3 bottom-3 rounded-lg bg-card/95 backdrop-blur-md border border-border p-4 shadow-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{selectedNode.label.replace("\n", " ")}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground">
                      Mastery: <span className="text-primary font-medium">{Math.round(selectedNode.mastery * 100)}%</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Time: <span className="text-foreground">{nodeDetails[selectedNode.id].timeSpent}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Last: <span className="text-foreground">{nodeDetails[selectedNode.id].lastStudied}</span>
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedNode(null)}
                  className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Sub-topics</p>
                  <div className="space-y-0.5">
                    {nodeDetails[selectedNode.id].subtopics.map((s, i) => (
                      <p key={i} className="text-xs text-foreground">• {s}</p>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Resources</p>
                  <div className="space-y-1">
                    {nodeDetails[selectedNode.id].resources.map((r, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <BookOpen className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="text-xs text-foreground truncate">{r.title}</span>
                        <span className={`text-[9px] ${typeColors[r.type] || "text-muted-foreground"}`}>{r.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Default insight (shows when no node selected) */}
        {!selectedNode && (
          <motion.div
            className="absolute bottom-3 left-3 right-3 rounded-lg surface-glass border border-border p-3"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 0.5 }}
          >
            <p className="text-xs text-muted-foreground">
              <span className="text-lumina-warning font-medium">Insight:</span> Your struggle with{" "}
              <span className="text-foreground font-medium">Microservices</span> is linked to a{" "}
              <span className="text-primary font-medium">45% gap</span> in Database fundamentals.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

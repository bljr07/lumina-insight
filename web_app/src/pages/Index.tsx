import { DashboardSidebar } from "@/components/DashboardSidebar";
import { StatsBar } from "@/components/StatsBar";
import { PulseHeatmap } from "@/components/PulseHeatmap";
import { KnowledgeGraph } from "@/components/KnowledgeGraph";
import { GhostMode } from "@/components/GhostMode";
import { SkillRadar } from "@/components/SkillRadar";
import { ContextualNudges } from "@/components/ContextualNudges";

const Index = () => {
  return (
    <div className="min-h-screen bg-background lumina-gradient-bg">
      <DashboardSidebar />

      <main className="ml-64 p-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <p className="text-sm text-muted-foreground mb-1">Good evening, Alex</p>
          <h1 className="text-3xl font-bold text-foreground">
            Your Learning <span className="glow-text">Pulse</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Semester 2 · Week 9 · Microservices Architecture
          </p>
        </div>

        {/* Stats */}
        <StatsBar />

        {/* Main grid */}
        <div className="grid grid-cols-2 gap-6 mt-6">
          <PulseHeatmap />
          <KnowledgeGraph />
          <GhostMode />
          <div className="space-y-6">
            <SkillRadar />
            <ContextualNudges />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;

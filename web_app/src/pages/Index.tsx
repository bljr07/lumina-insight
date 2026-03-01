import { useState, useEffect } from "react";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { StatsBar } from "@/components/StatsBar";
import { PulseHeatmap } from "@/components/PulseHeatmap";
import { KnowledgeGraph } from "@/components/KnowledgeGraph";
import { GhostMode } from "@/components/GhostMode";
import { SkillRadar } from "@/components/SkillRadar";
import { ContextualNudges } from "@/components/ContextualNudges";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const Index = () => {
  const [firstName, setFirstName] = useState(() => {
    const name = localStorage.getItem("lumina-user-name") || "Alex Johnson";
    return name.split(" ")[0];
  });
  const [greeting, setGreeting] = useState(getGreeting);

  // Listen for localStorage changes from the Settings modal
  useEffect(() => {
    const handleStorage = () => {
      const name = localStorage.getItem("lumina-user-name") || "Alex Johnson";
      setFirstName(name.split(" ")[0]);
    };
    window.addEventListener("storage", handleStorage);

    // Also poll for same-tab localStorage changes (storage event only fires cross-tab)
    const interval = setInterval(() => {
      const name = localStorage.getItem("lumina-user-name") || "Alex Johnson";
      setFirstName(name.split(" ")[0]);
      setGreeting(getGreeting());
    }, 2000);

    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background lumina-gradient-bg">
      <DashboardSidebar />

      <main className="ml-64 p-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <p className="text-sm text-muted-foreground mb-1">{greeting}, {firstName}</p>
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
          <section id="pulse-dashboard" className="scroll-mt-8">
            <PulseHeatmap />
          </section>
          <section id="knowledge-graph" className="scroll-mt-8">
            <KnowledgeGraph />
          </section>
          <section id="ghost-mode" className="scroll-mt-8">
            <GhostMode />
          </section>
          <div className="space-y-6">
            <section id="skill-radar" className="scroll-mt-8">
              <SkillRadar />
            </section>
            <section id="nudges" className="scroll-mt-8">
              <ContextualNudges />
            </section>
          </div>
        </div>

        {/* Growth section */}
        <section id="growth" className="scroll-mt-8 mt-6">
          <div className="bg-card rounded-xl border border-border p-6 animate-fade-in">
            <h2 className="text-lg font-semibold text-foreground mb-1">Growth Trajectory</h2>
            <p className="text-sm text-muted-foreground">
              Your long-term learning patterns and milestones — coming soon.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;

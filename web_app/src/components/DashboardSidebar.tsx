import { Brain, LayoutDashboard, Ghost, Radar, Bell, TrendingUp, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Pulse Dashboard", active: true },
  { icon: Brain, label: "Knowledge Graph" },
  { icon: Ghost, label: "Ghost Mode" },
  { icon: Radar, label: "Skill Radar" },
  { icon: Bell, label: "Nudges" },
  { icon: TrendingUp, label: "Growth" },
];

export const DashboardSidebar = () => {
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-50">
      {/* Logo */}
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center glow-border">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground tracking-tight">Lumina</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Insight</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              item.active
                ? "bg-primary/10 text-primary glow-border"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {item.label}
          </button>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-sidebar-border">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
          <Settings className="w-4 h-4" />
          Settings
        </button>
        <div className="mt-3 px-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
              AJ
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">Alex Johnson</p>
              <p className="text-xs text-muted-foreground">Year 2 · CS</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

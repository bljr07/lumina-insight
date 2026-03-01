import { useState } from "react";
import { Brain, LayoutDashboard, Ghost, Radar, Bell, TrendingUp, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const navItems = [
  { icon: LayoutDashboard, label: "Pulse Dashboard", sectionId: "pulse-dashboard" },
  { icon: Brain, label: "Knowledge Graph", sectionId: "knowledge-graph" },
  { icon: Ghost, label: "Ghost Mode", sectionId: "ghost-mode" },
  { icon: Radar, label: "Skill Radar", sectionId: "skill-radar" },
  { icon: Bell, label: "Nudges", sectionId: "nudges" },
  { icon: TrendingUp, label: "Growth", sectionId: "growth" },
];

const educationLevels = [
  "Secondary School",
  "Junior College",
  "Polytechnic",
  "ITE",
  "Undergraduate",
  "Postgraduate",
  "PhD",
  "Other",
];

export const DashboardSidebar = () => {
  const [activeItem, setActiveItem] = useState("Pulse Dashboard");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Load saved user profile from localStorage
  const [userName, setUserName] = useState(() =>
    localStorage.getItem("lumina-user-name") || "Alex Johnson"
  );
  const [userCourse, setUserCourse] = useState(() =>
    localStorage.getItem("lumina-user-course") || "CS"
  );
  const [userEducation, setUserEducation] = useState(() =>
    localStorage.getItem("lumina-user-education") || "Undergraduate"
  );
  const [userYear, setUserYear] = useState(() =>
    localStorage.getItem("lumina-user-year") || "2"
  );

  // Temp state for the form inputs
  const [tempName, setTempName] = useState(userName);
  const [tempCourse, setTempCourse] = useState(userCourse);
  const [tempEducation, setTempEducation] = useState(userEducation);
  const [tempYear, setTempYear] = useState(userYear);

  const handleNavClick = (label: string, sectionId: string) => {
    setActiveItem(label);
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleOpenSettings = () => {
    setTempName(userName);
    setTempCourse(userCourse);
    setTempEducation(userEducation);
    setTempYear(userYear);
    setSettingsOpen(true);
  };

  const handleSaveSettings = () => {
    setUserName(tempName);
    setUserCourse(tempCourse);
    setUserEducation(tempEducation);
    setUserYear(tempYear);
    localStorage.setItem("lumina-user-name", tempName);
    localStorage.setItem("lumina-user-course", tempCourse);
    localStorage.setItem("lumina-user-education", tempEducation);
    localStorage.setItem("lumina-user-year", tempYear);
    setSettingsOpen(false);
  };

  // Derive initials from userName
  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Format the subtitle line
  const subtitle = `${userEducation} Y${userYear} · ${userCourse}`;

  const inputClass =
    "w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors";

  const selectClass =
    "w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors appearance-none cursor-pointer";

  return (
    <>
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
              onClick={() => handleNavClick(item.label, item.sectionId)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                activeItem === item.label
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
          <button
            onClick={handleOpenSettings}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <div className="mt-3 px-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{userName}</p>
                <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Profile Settings</DialogTitle>
            <DialogDescription>Update your profile information.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label htmlFor="settings-name" className="text-sm font-medium text-foreground">
                Full Name
              </label>
              <input
                id="settings-name"
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                placeholder="Enter your name"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label htmlFor="settings-education" className="text-sm font-medium text-foreground">
                  Education Level
                </label>
                <select
                  id="settings-education"
                  value={tempEducation}
                  onChange={(e) => setTempEducation(e.target.value)}
                  className={selectClass}
                >
                  {educationLevels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="settings-year" className="text-sm font-medium text-foreground">
                  Year of Study
                </label>
                <input
                  id="settings-year"
                  type="number"
                  min="1"
                  max="8"
                  value={tempYear}
                  onChange={(e) => setTempYear(e.target.value)}
                  placeholder="e.g. 2"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="settings-course" className="text-sm font-medium text-foreground">
                Course of Study
              </label>
              <input
                id="settings-course"
                type="text"
                value={tempCourse}
                onChange={(e) => setTempCourse(e.target.value)}
                placeholder="e.g. Computer Science, Engineering"
                className={inputClass}
              />
            </div>
          </div>

          <DialogFooter>
            <button
              onClick={() => setSettingsOpen(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveSettings}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Save Changes
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

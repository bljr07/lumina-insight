import { useState, useEffect } from "react";
import { upsertProfile } from "@/lib/supabase-service";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, ArrowRight, Sparkles, BookOpen, Rocket } from "lucide-react";

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

const steps = [
    {
        title: "Welcome to Lumina",
        subtitle: "Your intelligent learning companion",
        icon: Brain,
        content: "Lumina Insight adapts to your learning patterns, identifies knowledge gaps, and nudges you toward mastery — without the pressure of comparison.",
    },
    {
        title: "Tell Us About You",
        subtitle: "Let's personalize your experience",
        icon: Sparkles,
        content: "form", // special marker for the form step
    },
    {
        title: "Your Dashboard",
        subtitle: "Here's what you'll find",
        icon: BookOpen,
        content: "features",
    },
    {
        title: "You're All Set!",
        subtitle: "Let's start learning",
        icon: Rocket,
        content: "Your dashboard is ready. We'll track your learning patterns and provide personalized insights as you go. Remember — progress, not perfection.",
    },
];

const features = [
    { emoji: "📊", title: "Pulse Dashboard", desc: "Visualize your study activity over time" },
    { emoji: "🧠", title: "Knowledge Graph", desc: "See how your concepts connect" },
    { emoji: "👻", title: "Ghost Mode", desc: "Race against your past self" },
    { emoji: "🎯", title: "Skill Radar", desc: "Track diverse strengths beyond grades" },
    { emoji: "💬", title: "Smart Nudges", desc: "Empathetic interventions when you need them" },
];

interface OnboardingModalProps {
    open: boolean;
    onComplete: () => void;
}

export const OnboardingModal = ({ open, onComplete }: OnboardingModalProps) => {
    const [step, setStep] = useState(0);
    const [name, setName] = useState("");
    const [education, setEducation] = useState("Undergraduate");
    const [year, setYear] = useState("2");
    const [course, setCourse] = useState("");

    const current = steps[step];
    const isLast = step === steps.length - 1;
    const isFormStep = current.content === "form";

    const handleNext = () => {
        if (isFormStep && name.trim()) {
            // Save profile to localStorage
            localStorage.setItem("lumina-user-name", name.trim());
            localStorage.setItem("lumina-user-education", education);
            localStorage.setItem("lumina-user-year", year);
            if (course.trim()) localStorage.setItem("lumina-user-course", course.trim());
            // Notify other components immediately
            window.dispatchEvent(new Event("lumina-profile-updated"));
            // Save to Supabase
            upsertProfile({
                name: name.trim(),
                education,
                year: parseInt(year) || 2,
                course: course.trim(),
            });
        }
        if (isLast) {
            onComplete();
        } else {
            setStep(step + 1);
        }
    };

    const canProceed = !isFormStep || name.trim().length > 0;

    const inputClass =
        "w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors";
    const selectClass =
        "w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors appearance-none cursor-pointer";

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <motion.div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            />

            {/* Modal */}
            <motion.div
                className="relative w-full max-w-md mx-4 bg-card rounded-2xl border border-border shadow-2xl overflow-hidden"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
            >
                {/* Progress dots */}
                <div className="flex justify-center gap-2 pt-6">
                    {steps.map((_, i) => (
                        <div
                            key={i}
                            className={`w-2 h-2 rounded-full transition-all duration-300 ${i === step ? "bg-primary w-6" : i < step ? "bg-primary/40" : "bg-muted"
                                }`}
                        />
                    ))}
                </div>

                <div className="p-6 pt-4">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -30 }}
                            transition={{ duration: 0.25 }}
                        >
                            {/* Icon */}
                            <div className="flex justify-center mb-4">
                                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                                    <current.icon className="w-7 h-7 text-primary" />
                                </div>
                            </div>

                            {/* Title */}
                            <h2 className="text-xl font-bold text-foreground text-center">{current.title}</h2>
                            <p className="text-sm text-muted-foreground text-center mb-5">{current.subtitle}</p>

                            {/* Content */}
                            {current.content === "form" ? (
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">What's your name?</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Enter your full name"
                                            className={inputClass}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-muted-foreground">Education Level</label>
                                            <select value={education} onChange={(e) => setEducation(e.target.value)} className={selectClass}>
                                                {educationLevels.map((l) => <option key={l} value={l}>{l}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-medium text-muted-foreground">Year</label>
                                            <input type="number" min="1" max="8" value={year} onChange={(e) => setYear(e.target.value)} className={inputClass} />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-muted-foreground">Course of Study</label>
                                        <input
                                            type="text"
                                            value={course}
                                            onChange={(e) => setCourse(e.target.value)}
                                            placeholder="e.g. Computer Science"
                                            className={inputClass}
                                        />
                                    </div>
                                </div>
                            ) : current.content === "features" ? (
                                <div className="space-y-2">
                                    {features.map((f, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.08 }}
                                            className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30"
                                        >
                                            <span className="text-lg">{f.emoji}</span>
                                            <div>
                                                <p className="text-sm font-medium text-foreground">{f.title}</p>
                                                <p className="text-[11px] text-muted-foreground">{f.desc}</p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground text-center leading-relaxed">{current.content}</p>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Actions */}
                    <div className="flex items-center justify-between mt-6">
                        {step > 0 ? (
                            <button
                                onClick={() => setStep(step - 1)}
                                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Back
                            </button>
                        ) : (
                            <button
                                onClick={onComplete}
                                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                            >
                                Skip
                            </button>
                        )}

                        <motion.button
                            onClick={handleNext}
                            disabled={!canProceed}
                            whileTap={{ scale: 0.97 }}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${canProceed
                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                : "bg-muted text-muted-foreground cursor-not-allowed"
                                }`}
                        >
                            {isLast ? "Get Started" : "Continue"}
                            <ArrowRight className="w-4 h-4" />
                        </motion.button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X, ChevronLeft, ChevronRight,
    LayoutDashboard, Brain, Ghost, Radar, Bell, TrendingUp,
    Coffee, BookOpen, Zap, Eye, Sparkles,
} from "lucide-react";

interface Feature {
    icon: any;
    emoji: string;
    title: string;
    tagline: string;
    description: string;
    tip: string;
    color: string;
}

const features: Feature[] = [
    {
        icon: LayoutDashboard,
        emoji: "📊",
        title: "Pulse Dashboard",
        tagline: "Your learning heartbeat",
        description: "A GitHub-style heatmap that visualizes your study intensity over 12 weeks. Hover any cell to see exactly what you studied, for how long, and how deep you went. We even detect burnout zones and flow state peaks.",
        tip: "💡 The best students don't study more — they study consistently. Watch for gaps in your pulse.",
        color: "from-emerald-500/20 to-emerald-500/5",
    },
    {
        icon: Brain,
        emoji: "🧠",
        title: "Knowledge Graph",
        tagline: "See how your concepts connect",
        description: "An interactive network of everything you've learned. Click any node to dive into sub-topics, see your mastery percentage, and discover recommended resources. Brighter nodes = higher mastery.",
        tip: "💡 The insight bar reveals hidden connections between struggling areas. A weak node might be dragging others down.",
        color: "from-amber-500/20 to-amber-500/5",
    },
    {
        icon: Ghost,
        emoji: "👻",
        title: "Ghost Mode",
        tagline: "Race your past self",
        description: "Compare today's performance against your own historical data — not other students. See where you've improved and where you've slipped. It's competition without the toxicity.",
        tip: "💡 Your ghost is your best study partner. Beat yesterday's version of you.",
        color: "from-purple-500/20 to-purple-500/5",
    },
    {
        icon: Radar,
        emoji: "🎯",
        title: "Skill Radar",
        tagline: "Strengths beyond grades",
        description: "A multi-dimensional radar chart tracking skills that exams don't measure: pattern recognition, algorithmic thinking, syntax comprehension, debugging efficiency, and system design intuition.",
        tip: "💡 A lopsided radar isn't bad — it shows your unique strengths. Focus on filling the weakest axis.",
        color: "from-blue-500/20 to-blue-500/5",
    },
    {
        icon: Bell,
        emoji: "💬",
        title: "Smart Nudges",
        tagline: "Empathetic interventions, not corrections",
        description: "Three types of nudges that actually care about you: wellness breaks when cognitive load is high, bridging exercises to connect knowledge gaps, and flow state challenges when you're peaking.",
        tip: "💡 Nudges are triggered by your patterns, not arbitrary timers. Trust them.",
        color: "from-orange-500/20 to-orange-500/5",
    },
    {
        icon: Coffee,
        emoji: "☕",
        title: "Take a Breather",
        tagline: "Smart breaks, not lazy ones",
        description: "Choose from power nap (5 min) to deep reset (20 min). We recommend a duration based on how long you've been studying. Pick a ringtone, start the timer, and get an encouraging note when it ends.",
        tip: "💡 A 5-minute break after 25 minutes of deep work can boost retention by 20%.",
        color: "from-yellow-500/20 to-yellow-500/5",
    },
    {
        icon: BookOpen,
        emoji: "📚",
        title: "Bridging Exercise",
        tagline: "Flashcards that find your gaps",
        description: "Quick-fire flashcards targeting the concepts where your knowledge graph shows weakness. Flip to reveal, mark what you knew, and get scored. Perfect scores earn confetti! 🎉",
        tip: "💡 Spaced repetition works. Come back to bridging exercises after 24 hours for maximum retention.",
        color: "from-cyan-500/20 to-cyan-500/5",
    },
    {
        icon: Eye,
        emoji: "🎯",
        title: "Focus Mode",
        tagline: "Distraction-free deep work",
        description: "Dims everything except your content. A floating timer tracks your focus session. Press Esc anytime to exit. It's like noise-cancelling headphones, but for your screen.",
        tip: "💡 Try 25-minute focus sessions. Your brain treats them as sprints, not marathons.",
        color: "from-indigo-500/20 to-indigo-500/5",
    },
    {
        icon: TrendingUp,
        emoji: "📈",
        title: "Growth Trajectory",
        tagline: "Your learning arc, visualized",
        description: "A line chart showing your mastery percentage over months, with milestone markers for achievements. See exactly when breakthroughs happened and where plateaus formed.",
        tip: "💡 Plateaus are normal — they mean your brain is consolidating. The next spike is coming.",
        color: "from-green-500/20 to-green-500/5",
    },
];

interface FeatureGuideProps {
    open: boolean;
    onClose: () => void;
}

export const FeatureGuide = ({ open, onClose }: FeatureGuideProps) => {
    const [idx, setIdx] = useState(0);
    const [direction, setDirection] = useState(1);
    const feature = features[idx];

    const go = (newIdx: number) => {
        setDirection(newIdx > idx ? 1 : -1);
        setIdx(newIdx);
    };

    const next = () => go(Math.min(idx + 1, features.length - 1));
    const prev = () => go(Math.max(idx - 1, 0));

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <motion.div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={onClose}
            />

            <motion.div
                className="relative w-full max-w-lg mx-4 bg-card rounded-2xl border border-border shadow-2xl overflow-hidden"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
            >
                {/* Gradient header */}
                <div className={`h-24 bg-gradient-to-br ${feature.color} flex items-center justify-center relative`}>
                    <motion.div
                        key={idx}
                        initial={{ scale: 0, rotate: -20 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 15 }}
                        className="text-5xl"
                    >
                        {feature.emoji}
                    </motion.div>

                    {/* Counter */}
                    <div className="absolute top-3 left-4 text-[10px] text-muted-foreground/60 font-mono">
                        {idx + 1} / {features.length}
                    </div>

                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Progress bar */}
                <div className="w-full h-0.5 bg-muted">
                    <motion.div
                        className="h-full bg-primary"
                        animate={{ width: `${((idx + 1) / features.length) * 100}%` }}
                        transition={{ duration: 0.3 }}
                    />
                </div>

                <div className="p-6">
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={idx}
                            custom={direction}
                            initial={{ opacity: 0, x: direction * 40 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: direction * -40 }}
                            transition={{ duration: 0.2 }}
                        >
                            {/* Title */}
                            <div className="flex items-center gap-2 mb-1">
                                <feature.icon className="w-4 h-4 text-primary" />
                                <h2 className="text-lg font-bold text-foreground">{feature.title}</h2>
                            </div>
                            <p className="text-sm text-primary/80 font-medium mb-3">{feature.tagline}</p>

                            {/* Description */}
                            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                                {feature.description}
                            </p>

                            {/* Pro tip */}
                            <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
                                <p className="text-xs text-muted-foreground leading-relaxed">{feature.tip}</p>
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-5">
                        <button
                            onClick={prev}
                            disabled={idx === 0}
                            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors ${idx === 0 ? "text-muted-foreground/30 cursor-not-allowed" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                        >
                            <ChevronLeft className="w-4 h-4" /> Previous
                        </button>

                        {/* Dot indicators */}
                        <div className="flex gap-1">
                            {features.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => go(i)}
                                    className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? "bg-primary w-4" : i < idx ? "bg-primary/40" : "bg-muted-foreground/20"}`}
                                />
                            ))}
                        </div>

                        {idx < features.length - 1 ? (
                            <button
                                onClick={next}
                                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
                            >
                                Next <ChevronRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <motion.button
                                onClick={onClose}
                                whileTap={{ scale: 0.97 }}
                                className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                                <Sparkles className="w-4 h-4" /> Got it!
                            </motion.button>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

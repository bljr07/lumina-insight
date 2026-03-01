import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, X, Clock } from "lucide-react";
import { saveFocusSession } from "@/lib/supabase-service";

interface FocusModeProps {
    active: boolean;
    onExit: () => void;
}

export const FocusMode = ({ active, onExit }: FocusModeProps) => {
    const [elapsed, setElapsed] = useState(0);

    const handleExit = useCallback(() => {
        if (elapsed > 5) {
            saveFocusSession(elapsed);
        }
        onExit();
    }, [elapsed, onExit]);

    useEffect(() => {
        if (!active) {
            setElapsed(0);
            return;
        }
        const interval = setInterval(() => setElapsed((p) => p + 1), 1000);
        return () => clearInterval(interval);
    }, [active]);

    // Esc to exit
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Escape" && active) handleExit();
        },
        [active, handleExit]
    );

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;

    return (
        <AnimatePresence>
            {active && (
                <motion.div
                    className="fixed inset-0 z-[90] pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {/* Dim overlay on sides, leave center visible */}
                    <div className="absolute inset-0 pointer-events-auto" style={{ background: "radial-gradient(ellipse 80% 90% at 60% 50%, transparent 40%, rgba(0,0,0,0.6) 100%)" }} />

                    {/* Top bar */}
                    <motion.div
                        className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-3 px-4 py-2 rounded-full bg-card/90 backdrop-blur-md border border-primary/20 shadow-lg"
                        initial={{ y: -30, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        <Eye className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-primary">Focus Mode</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
                        </span>
                        <button
                            onClick={handleExit}
                            className="ml-2 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </motion.div>

                    {/* Floating tip */}
                    <motion.p
                        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs text-muted-foreground/60"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                    >
                        Press Esc to exit focus mode
                    </motion.p>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

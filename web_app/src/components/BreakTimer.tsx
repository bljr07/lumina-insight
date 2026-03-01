import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Pause, RotateCcw, Volume2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

const RINGTONES = [
    { id: "gentle-chime", label: "Gentle Chime" },
    { id: "soft-bell", label: "Soft Bell" },
    { id: "wind-down", label: "Wind Down" },
    { id: "sunrise", label: "Sunrise" },
];

const ENCOURAGEMENTS = [
    "You're doing amazing — small breaks lead to big breakthroughs! 💡",
    "Refreshed and ready! Your focus will be even sharper now. 🚀",
    "Rest is part of mastery. Let's get back to it, champ! 🏆",
    "Your brain just leveled up during that break. Time to shine! ✨",
    "Great discipline! Consistent breaks = sustainable greatness. 🌱",
    "That pause was powerful. You've got this! 💪",
];

// Generate ringtone sounds using Web Audio API
function playRingtone(id: string) {
    const ctx = new AudioContext();

    const playNote = (freq: number, start: number, dur: number, gain: number) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        g.gain.setValueAtTime(gain, ctx.currentTime + start);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
    };

    switch (id) {
        case "gentle-chime":
            playNote(880, 0, 0.6, 0.2);
            playNote(1108, 0.15, 0.6, 0.15);
            playNote(1320, 0.3, 0.8, 0.12);
            break;
        case "soft-bell":
            playNote(523, 0, 1.0, 0.2);
            playNote(659, 0.3, 0.8, 0.18);
            playNote(784, 0.6, 1.0, 0.15);
            playNote(1047, 0.9, 1.2, 0.1);
            break;
        case "wind-down":
            playNote(1047, 0, 0.5, 0.15);
            playNote(880, 0.25, 0.5, 0.15);
            playNote(659, 0.5, 0.5, 0.15);
            playNote(523, 0.75, 1.0, 0.12);
            break;
        case "sunrise":
            playNote(392, 0, 0.7, 0.12);
            playNote(523, 0.25, 0.7, 0.14);
            playNote(659, 0.5, 0.7, 0.16);
            playNote(784, 0.75, 0.7, 0.18);
            playNote(1047, 1.0, 1.2, 0.15);
            break;
        default:
            playNote(880, 0, 0.8, 0.2);
    }
}

interface BreakTimerProps {
    open: boolean;
    onClose: () => void;
    initialMinutes?: number;
}

export const BreakTimer = ({ open, onClose, initialMinutes = 5 }: BreakTimerProps) => {
    const [totalSeconds, setTotalSeconds] = useState(initialMinutes * 60);
    const [remaining, setRemaining] = useState(initialMinutes * 60);
    const [running, setRunning] = useState(false);
    const [done, setDone] = useState(false);
    const [ringtone, setRingtone] = useState("gentle-chime");
    const [encouragement, setEncouragement] = useState("");
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Reset when dialog opens
    useEffect(() => {
        if (open) {
            const secs = initialMinutes * 60;
            setTotalSeconds(secs);
            setRemaining(secs);
            setRunning(false);
            setDone(false);
            setEncouragement("");
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [open, initialMinutes]);

    // Countdown logic
    useEffect(() => {
        if (running && remaining > 0) {
            intervalRef.current = setInterval(() => {
                setRemaining((prev) => {
                    if (prev <= 1) {
                        clearInterval(intervalRef.current!);
                        setRunning(false);
                        setDone(true);
                        playRingtone(ringtone);
                        setEncouragement(ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [running, ringtone]);

    const toggleTimer = () => {
        if (done) return;
        setRunning(!running);
    };

    const resetTimer = () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setRemaining(totalSeconds);
        setRunning(false);
        setDone(false);
        setEncouragement("");
    };

    const previewRingtone = (id: string) => {
        playRingtone(id);
    };

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const progress = totalSeconds > 0 ? (totalSeconds - remaining) / totalSeconds : 0;

    // SVG circular progress
    const radius = 90;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - progress);

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>{done ? "Break Complete! 🎉" : "Take a Breather"}</DialogTitle>
                    <DialogDescription>
                        {done ? "You've earned it." : "Step away, rest your eyes, stretch a bit."}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center py-4">
                    {/* Circular timer */}
                    <div className="relative w-52 h-52">
                        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                            {/* Background ring */}
                            <circle
                                cx="100"
                                cy="100"
                                r={radius}
                                fill="none"
                                stroke="hsl(228 10% 15%)"
                                strokeWidth="6"
                            />
                            {/* Progress ring */}
                            <motion.circle
                                cx="100"
                                cy="100"
                                r={radius}
                                fill="none"
                                stroke={done ? "hsl(142 70% 50%)" : "hsl(38 92% 55%)"}
                                strokeWidth="6"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                initial={{ strokeDashoffset: circumference }}
                                animate={{ strokeDashoffset }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                            />
                        </svg>

                        {/* Time display */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <AnimatePresence mode="wait">
                                {done ? (
                                    <motion.div
                                        key="done"
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: "spring", stiffness: 200, damping: 12 }}
                                        className="text-4xl"
                                    >
                                        ✅
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="time"
                                        className="text-center"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                    >
                                        <span className="text-4xl font-bold text-foreground tabular-nums">
                                            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                                        </span>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {running ? "breathe..." : "ready"}
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Encouragement message */}
                    <AnimatePresence>
                        {done && encouragement && (
                            <motion.p
                                className="text-sm text-center text-foreground mt-4 px-4 leading-relaxed font-medium"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 15 }}
                            >
                                {encouragement}
                            </motion.p>
                        )}
                    </AnimatePresence>

                    {/* Controls */}
                    {!done && (
                        <div className="flex items-center gap-3 mt-5">
                            <button
                                onClick={resetTimer}
                                className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                                title="Reset"
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>
                            <motion.button
                                onClick={toggleTimer}
                                whileTap={{ scale: 0.92 }}
                                className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                            >
                                {running ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                            </motion.button>
                            <div className="w-10 h-10" /> {/* Spacer for symmetry */}
                        </div>
                    )}

                    {done && (
                        <motion.button
                            onClick={onClose}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="mt-5 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                            Back to Learning
                        </motion.button>
                    )}

                    {/* Ringtone picker */}
                    {!done && (
                        <div className="w-full mt-6 pt-4 border-t border-border">
                            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                <Volume2 className="w-3 h-3" />
                                Completion Sound
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                                {RINGTONES.map((tone) => (
                                    <button
                                        key={tone.id}
                                        onClick={() => {
                                            setRingtone(tone.id);
                                            previewRingtone(tone.id);
                                        }}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${ringtone === tone.id
                                                ? "bg-primary/10 text-primary border border-primary/20"
                                                : "bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent"
                                            }`}
                                    >
                                        {tone.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

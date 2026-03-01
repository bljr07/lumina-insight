import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveBreakLog } from "@/lib/supabase-service";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

const BREAK_OPTIONS = [
    { minutes: 5, label: "Power Nap", desc: "Quick mental reset", emoji: "⚡" },
    { minutes: 10, label: "Refresh", desc: "Recharge your focus", emoji: "🧘" },
    { minutes: 15, label: "Deep Rest", desc: "Full brain recovery", emoji: "🌿" },
    { minutes: 20, label: "Long Rest", desc: "Maximum restoration", emoji: "🌙" },
];

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

// Track how long the user has been on the page
let pageLoadTime = Date.now();

function getScreenTimeMinutes(): number {
    return Math.floor((Date.now() - pageLoadTime) / 60000);
}

function getSuggestedBreak(): number {
    const mins = getScreenTimeMinutes();
    if (mins < 30) return 5;
    if (mins < 60) return 10;
    if (mins < 90) return 15;
    return 20;
}

// Generate longer ringtone sounds using Web Audio API (3-5 seconds)
function playRingtone(id: string) {
    const ctx = new AudioContext();

    const playNote = (freq: number, start: number, dur: number, gain: number, type: OscillatorType = "sine") => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, ctx.currentTime + start);
        g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.05);
        g.gain.setValueAtTime(gain, ctx.currentTime + start + dur * 0.6);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
    };

    switch (id) {
        case "gentle-chime":
            // Three-note ascending chime, repeated twice
            [0, 2].forEach((offset) => {
                playNote(880, offset, 0.8, 0.15);
                playNote(1108, offset + 0.25, 0.8, 0.12);
                playNote(1320, offset + 0.5, 1.0, 0.1);
            });
            // Final sustained note
            playNote(1760, 4.0, 1.5, 0.08);
            break;

        case "soft-bell":
            // Rising bell sequence with harmonic overtones
            [0, 1.8].forEach((offset) => {
                playNote(523, offset, 1.2, 0.15);
                playNote(659, offset + 0.4, 1.0, 0.12);
                playNote(784, offset + 0.8, 1.0, 0.1);
                playNote(1047, offset + 1.2, 1.2, 0.08);
            });
            playNote(1047, 3.8, 1.5, 0.06, "triangle");
            break;

        case "wind-down":
            // Descending cascade repeated
            [0, 2.2].forEach((offset) => {
                playNote(1047, offset, 0.7, 0.12);
                playNote(880, offset + 0.3, 0.7, 0.12);
                playNote(659, offset + 0.6, 0.7, 0.12);
                playNote(523, offset + 0.9, 1.0, 0.1);
            });
            playNote(392, 4.2, 1.5, 0.08, "triangle");
            break;

        case "sunrise":
            // Slow rising arpeggio
            const notes = [392, 440, 523, 587, 659, 784, 880, 1047];
            notes.forEach((freq, i) => {
                playNote(freq, i * 0.45, 0.9, 0.08 + i * 0.01);
            });
            // Sustain the top note
            playNote(1047, notes.length * 0.45, 1.5, 0.1, "triangle");
            break;

        default:
            playNote(880, 0, 1.0, 0.2);
    }
}

interface BreakTimerProps {
    open: boolean;
    onClose: () => void;
}

export const BreakTimer = ({ open, onClose }: BreakTimerProps) => {
    const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);
    const [totalSeconds, setTotalSeconds] = useState(0);
    const [remaining, setRemaining] = useState(0);
    const [running, setRunning] = useState(false);
    const [done, setDone] = useState(false);
    const [ringtone, setRingtone] = useState("gentle-chime");
    const [encouragement, setEncouragement] = useState("");
    const [suggestedMinutes, setSuggestedMinutes] = useState(5);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Reset when dialog opens
    useEffect(() => {
        if (open) {
            setSuggestedMinutes(getSuggestedBreak());
            setSelectedMinutes(null);
            setTotalSeconds(0);
            setRemaining(0);
            setRunning(false);
            setDone(false);
            setEncouragement("");
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [open]);

    // Select a break duration
    const selectDuration = (mins: number) => {
        const secs = mins * 60;
        setSelectedMinutes(mins);
        setTotalSeconds(secs);
        setRemaining(secs);
        setRunning(false);
        setDone(false);
        setEncouragement("");
    };

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
                        // Save to Supabase
                        saveBreakLog({
                            durationMinutes: selectedMinutes || 5,
                            ringtone,
                            completed: true,
                        });
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
        if (selectedMinutes) {
            setRemaining(selectedMinutes * 60);
            setTotalSeconds(selectedMinutes * 60);
        }
        setRunning(false);
        setDone(false);
        setEncouragement("");
    };

    const goBack = () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setSelectedMinutes(null);
        setRunning(false);
        setDone(false);
    };

    const previewRingtone = (id: string) => {
        playRingtone(id);
    };

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const progress = totalSeconds > 0 ? (totalSeconds - remaining) / totalSeconds : 0;
    const screenTimeMins = getScreenTimeMinutes();

    // SVG circular progress
    const radius = 90;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - progress);

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="sm:max-w-sm">
                <AnimatePresence mode="wait">
                    {/* Phase 1: Duration picker */}
                    {selectedMinutes === null && (
                        <motion.div
                            key="picker"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <DialogHeader>
                                <DialogTitle>Take a Breather</DialogTitle>
                                <DialogDescription>Choose your break length</DialogDescription>
                            </DialogHeader>

                            {screenTimeMins > 0 && (
                                <p className="text-xs text-muted-foreground mt-3">
                                    You've been studying for <span className="text-primary font-medium">{screenTimeMins} min{screenTimeMins !== 1 ? "s" : ""}</span> —
                                    we recommend a <span className="text-primary font-medium">{suggestedMinutes}-min</span> break.
                                </p>
                            )}

                            <div className="grid grid-cols-2 gap-2 mt-4">
                                {BREAK_OPTIONS.map((opt) => (
                                    <motion.button
                                        key={opt.minutes}
                                        onClick={() => selectDuration(opt.minutes)}
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.97 }}
                                        className={cn(
                                            "relative rounded-xl border p-4 text-left transition-all",
                                            opt.minutes === suggestedMinutes
                                                ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                                                : "border-border bg-muted/30 hover:bg-muted/50"
                                        )}
                                    >
                                        {opt.minutes === suggestedMinutes && (
                                            <span className="absolute top-2 right-2 text-[9px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                                                Recommended
                                            </span>
                                        )}
                                        <span className="text-xl">{opt.emoji}</span>
                                        <p className="text-sm font-medium text-foreground mt-1">{opt.minutes} min</p>
                                        <p className="text-[11px] text-muted-foreground">{opt.label}</p>
                                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{opt.desc}</p>
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Phase 2: Countdown timer */}
                    {selectedMinutes !== null && (
                        <motion.div
                            key="timer"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <DialogHeader>
                                <DialogTitle>{done ? "Break Complete! 🎉" : "Take a Breather"}</DialogTitle>
                                <DialogDescription>
                                    {done ? "You've earned it." : `${selectedMinutes}-min ${BREAK_OPTIONS.find((o) => o.minutes === selectedMinutes)?.label || "break"}`}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex flex-col items-center py-4">
                                {/* Circular timer */}
                                <div className="relative w-48 h-48">
                                    <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                                        <circle cx="100" cy="100" r={radius} fill="none" stroke="hsl(228 10% 15%)" strokeWidth="6" />
                                        <motion.circle
                                            cx="100" cy="100" r={radius} fill="none"
                                            stroke={done ? "hsl(142 70% 50%)" : "hsl(38 92% 55%)"}
                                            strokeWidth="6" strokeLinecap="round"
                                            strokeDasharray={circumference}
                                            strokeDashoffset={strokeDashoffset}
                                            animate={{ strokeDashoffset }}
                                            transition={{ duration: 0.5, ease: "easeOut" }}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <AnimatePresence mode="wait">
                                            {done ? (
                                                <motion.div key="done" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 12 }} className="text-4xl">
                                                    ✅
                                                </motion.div>
                                            ) : (
                                                <motion.div key="time" className="text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                                    <span className="text-4xl font-bold text-foreground tabular-nums">
                                                        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                                                    </span>
                                                    <p className="text-xs text-muted-foreground mt-1">{running ? "breathe..." : "ready"}</p>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>

                                {/* Encouragement */}
                                <AnimatePresence>
                                    {done && encouragement && (
                                        <motion.p className="text-sm text-center text-foreground mt-4 px-4 leading-relaxed font-medium"
                                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 15 }}>
                                            {encouragement}
                                        </motion.p>
                                    )}
                                </AnimatePresence>

                                {/* Controls */}
                                {!done && (
                                    <div className="flex items-center gap-3 mt-4">
                                        <button onClick={resetTimer} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors" title="Reset">
                                            <RotateCcw className="w-4 h-4" />
                                        </button>
                                        <motion.button onClick={toggleTimer} whileTap={{ scale: 0.92 }}
                                            className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
                                            {running ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                                        </motion.button>
                                        <button onClick={goBack} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors" title="Change duration">
                                            Back
                                        </button>
                                    </div>
                                )}

                                {done && (
                                    <motion.button onClick={onClose} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                                        className="mt-5 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                                        Back to Learning
                                    </motion.button>
                                )}

                                {/* Ringtone picker */}
                                {!done && (
                                    <div className="w-full mt-5 pt-4 border-t border-border">
                                        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                            <Volume2 className="w-3 h-3" /> Completion Sound
                                        </p>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {RINGTONES.map((tone) => (
                                                <button key={tone.id}
                                                    onClick={() => { setRingtone(tone.id); previewRingtone(tone.id); }}
                                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${ringtone === tone.id
                                                        ? "bg-primary/10 text-primary border border-primary/20"
                                                        : "bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent"
                                                        }`}>
                                                    {tone.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    );
};

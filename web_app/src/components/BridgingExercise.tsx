import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Check, X, RotateCcw, BookOpen } from "lucide-react";
import { fireConfetti } from "@/lib/confetti";
import { saveQuizResult } from "@/lib/supabase-service";

interface Card {
    question: string;
    answer: string;
    topic: string;
    hint: string;
}

const cards: Card[] = [
    { topic: "REST APIs", question: "What is the difference between PUT and PATCH?", answer: "PUT replaces the entire resource, while PATCH only updates the fields you specify.", hint: "Think about full vs partial updates" },
    { topic: "Databases", question: "What does ACID stand for in database transactions?", answer: "Atomicity, Consistency, Isolation, Durability — guaranteeing reliable transaction processing.", hint: "Four properties that ensure data integrity" },
    { topic: "Microservices", question: "What is the Saga pattern?", answer: "A way to manage distributed transactions across microservices using a sequence of local transactions with compensating actions for rollback.", hint: "How do you undo across multiple services?" },
    { topic: "Docker", question: "What is the difference between an image and a container?", answer: "An image is a read-only template (blueprint). A container is a running instance of that image with its own writable layer.", hint: "Blueprint vs running instance" },
    { topic: "Auth", question: "How does JWT authentication work?", answer: "The server creates a signed token containing user claims. The client sends this token in subsequent requests. The server verifies the signature without needing to store session state.", hint: "Stateless authentication" },
    { topic: "SQL", question: "What is the difference between INNER JOIN and LEFT JOIN?", answer: "INNER JOIN returns only matching rows from both tables. LEFT JOIN returns all rows from the left table, with NULLs where there's no match in the right table.", hint: "What happens to unmatched rows?" },
];

interface BridgingExerciseProps {
    open: boolean;
    onClose: () => void;
}

export const BridgingExercise = ({ open, onClose }: BridgingExerciseProps) => {
    const [idx, setIdx] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [showHint, setShowHint] = useState(false);
    const [score, setScore] = useState({ correct: 0, total: 0 });
    const [done, setDone] = useState(false);
    const [cardResults, setCardResults] = useState<{ topic: string; question: string; knew: boolean }[]>([]);

    const card = cards[idx];

    const reset = () => {
        setIdx(0);
        setFlipped(false);
        setShowHint(false);
        setScore({ correct: 0, total: 0 });
        setDone(false);
        setCardResults([]);
    };

    const handleResponse = (knew: boolean) => {
        const newScore = { correct: score.correct + (knew ? 1 : 0), total: score.total + 1 };
        const newResults = [...cardResults, { topic: card.topic, question: card.question, knew }];
        setScore(newScore);
        setCardResults(newResults);
        setFlipped(false);
        setShowHint(false);
        if (idx + 1 >= cards.length) {
            setDone(true);
            // Fire confetti for great scores!
            if (newScore.correct >= cards.length * 0.8) {
                setTimeout(() => fireConfetti(), 300);
            }
            // Save to Supabase
            saveQuizResult({
                totalCards: cards.length,
                correct: newScore.correct,
                cardDetails: newResults,
            });
        } else {
            setIdx(idx + 1);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} />

            <motion.div
                className="relative w-full max-w-md mx-4 bg-card rounded-2xl border border-border shadow-2xl overflow-hidden"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
            >
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-lumina-info" />
                            <h2 className="text-lg font-semibold text-foreground">Bridging Exercise</h2>
                        </div>
                        <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {!done ? (
                        <>
                            {/* Progress */}
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs text-muted-foreground">{idx + 1} / {cards.length}</span>
                                <span className="text-xs text-primary px-2 py-0.5 rounded-full bg-primary/10">{card.topic}</span>
                            </div>
                            <div className="w-full h-1 rounded-full bg-muted mb-5">
                                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((idx + 1) / cards.length) * 100}%` }} />
                            </div>

                            {/* Card */}
                            <motion.div
                                className="min-h-[180px] rounded-xl border border-border p-5 flex flex-col justify-center cursor-pointer"
                                onClick={() => setFlipped(!flipped)}
                                whileTap={{ scale: 0.98 }}
                                style={{ background: flipped ? "hsl(var(--lumina-surface))" : "hsl(var(--muted) / 0.3)" }}
                            >
                                <AnimatePresence mode="wait">
                                    <motion.div key={flipped ? "answer" : "question"} initial={{ opacity: 0, rotateX: -10 }} animate={{ opacity: 1, rotateX: 0 }} exit={{ opacity: 0, rotateX: 10 }} transition={{ duration: 0.2 }}>
                                        {flipped ? (
                                            <div>
                                                <p className="text-[10px] text-lumina-success uppercase tracking-wider mb-2">Answer</p>
                                                <p className="text-sm text-foreground leading-relaxed">{card.answer}</p>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="text-[10px] text-primary uppercase tracking-wider mb-2">Question</p>
                                                <p className="text-sm text-foreground leading-relaxed font-medium">{card.question}</p>
                                            </div>
                                        )}
                                    </motion.div>
                                </AnimatePresence>
                            </motion.div>

                            {/* Hint */}
                            {!flipped && (
                                <button onClick={() => setShowHint(!showHint)} className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                    {showHint ? `💡 ${card.hint}` : "💡 Show hint"}
                                </button>
                            )}

                            {/* Actions */}
                            <div className="flex items-center justify-center gap-3 mt-5">
                                {!flipped ? (
                                    <button onClick={() => setFlipped(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                                        Reveal Answer <ArrowRight className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <>
                                        <motion.button onClick={() => handleResponse(false)} whileTap={{ scale: 0.95 }}
                                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors border border-destructive/20">
                                            <X className="w-4 h-4" /> Didn't know
                                        </motion.button>
                                        <motion.button onClick={() => handleResponse(true)} whileTap={{ scale: 0.95 }}
                                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-lumina-success/10 text-lumina-success text-sm font-medium hover:bg-lumina-success/20 transition-colors border border-lumina-success/20">
                                            <Check className="w-4 h-4" /> Knew it!
                                        </motion.button>
                                    </>
                                )}
                            </div>

                            <p className="text-[10px] text-muted-foreground text-center mt-3">Tap the card to flip • Press Space to reveal</p>
                        </>
                    ) : (
                        /* Done state */
                        <motion.div className="text-center py-4" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring" }}>
                            <div className="text-4xl mb-3">{score.correct >= cards.length * 0.8 ? "🎉" : score.correct >= cards.length * 0.5 ? "👍" : "💪"}</div>
                            <h3 className="text-xl font-bold text-foreground">{score.correct} / {score.total}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                {score.correct >= cards.length * 0.8
                                    ? "Outstanding! Your knowledge bridges are strong."
                                    : score.correct >= cards.length * 0.5
                                        ? "Good effort! Keep bridging those gaps."
                                        : "Great practice! Revisiting strengthens connections."}
                            </p>
                            <div className="flex justify-center gap-3 mt-5">
                                <button onClick={reset} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-foreground text-sm hover:bg-muted/80">
                                    <RotateCcw className="w-4 h-4" /> Try Again
                                </button>
                                <button onClick={onClose} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
                                    Done
                                </button>
                            </div>
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

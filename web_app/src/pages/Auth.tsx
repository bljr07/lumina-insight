import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "react-router-dom";

const Auth = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const { signIn, signUp } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setLoading(true);

        if (isLogin) {
            const { error } = await signIn(email, password);
            if (error) {
                setError(error);
            } else {
                navigate("/");
            }
        } else {
            const { error } = await signUp(email, password);
            if (error) {
                setError(error);
            } else {
                setSuccess("Account created! Check your email to verify, then sign in.");
                setIsLogin(true);
                setEmail("");
                setPassword("");
            }
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-background lumina-gradient-bg flex items-center justify-center px-4">
            {/* Ambient glow */}
            <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

            <motion.div
                className="w-full max-w-md"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
            >
                {/* Logo */}
                <div className="text-center mb-8">
                    <motion.div
                        className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4"
                        initial={{ scale: 0, rotate: -20 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
                    >
                        <Brain className="w-8 h-8 text-primary" />
                    </motion.div>
                    <h1 className="text-2xl font-bold text-foreground">
                        Lumina <span className="glow-text">Insight</span>
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Your intelligent learning companion</p>
                </div>

                {/* Card */}
                <div className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
                    {/* Tab switcher */}
                    <div className="flex border-b border-border">
                        <button
                            onClick={() => { setIsLogin(true); setError(null); setSuccess(null); }}
                            className={`flex-1 py-3.5 text-sm font-medium transition-colors relative ${isLogin ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            Sign In
                            {isLogin && <motion.div layoutId="tab-underline" className="absolute bottom-0 inset-x-0 h-0.5 bg-primary" />}
                        </button>
                        <button
                            onClick={() => { setIsLogin(false); setError(null); setSuccess(null); }}
                            className={`flex-1 py-3.5 text-sm font-medium transition-colors relative ${!isLogin ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            Create Account
                            {!isLogin && <motion.div layoutId="tab-underline" className="absolute bottom-0 inset-x-0 h-0.5 bg-primary" />}
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={isLogin ? "login" : "register"}
                                initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-4"
                            >
                                {/* Email */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@example.com"
                                            required
                                            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-muted/30 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                                        />
                                    </div>
                                </div>

                                {/* Password */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder={isLogin ? "Enter your password" : "Min 6 characters"}
                                            required
                                            minLength={6}
                                            className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-border bg-muted/30 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </AnimatePresence>

                        {/* Error */}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-lg bg-destructive/10 border border-destructive/20 p-3"
                            >
                                <p className="text-xs text-destructive">{error}</p>
                            </motion.div>
                        )}

                        {/* Success */}
                        {success && (
                            <motion.div
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-lg bg-lumina-success/10 border border-lumina-success/20 p-3"
                            >
                                <p className="text-xs text-lumina-success">{success}</p>
                            </motion.div>
                        )}

                        {/* Submit */}
                        <motion.button
                            type="submit"
                            disabled={loading}
                            whileTap={{ scale: 0.98 }}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    {isLogin ? "Sign In" : "Create Account"}
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </motion.button>
                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-[10px] text-muted-foreground/40 mt-6">
                    Lumina Insight · Progress, not perfection
                </p>
            </motion.div>
        </div>
    );
};

export default Auth;

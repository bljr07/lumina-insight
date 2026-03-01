/**
 * Lumina Insight — Supabase Service Layer
 *
 * All write operations to Supabase go through here.
 * Uses Supabase auth user ID to link data.
 */

import { supabase } from "@/lib/supabase";

/** Get the current auth user ID, or null */
async function getUserId(): Promise<string | null> {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
}

// ─── Profile ──────────────────────────────────────────

export async function upsertProfile(data: {
    name: string;
    education: string;
    year: number;
    course: string;
}) {
    const userId = await getUserId();
    if (!userId) return null;

    const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .single();

    if (existing) {
        await supabase
            .from("profiles")
            .update({ ...data, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        return existing.id;
    } else {
        const { data: row, error } = await supabase
            .from("profiles")
            .insert({ ...data, user_id: userId })
            .select("id")
            .single();
        if (error) {
            console.error("Profile insert error:", error);
            return null;
        }
        return row.id;
    }
}

// ─── Quiz / Bridging Exercise ─────────────────────────

export async function saveQuizResult(data: {
    totalCards: number;
    correct: number;
    cardDetails?: { topic: string; question: string; knew: boolean }[];
}) {
    const userId = await getUserId();
    if (!userId) return;

    const { error } = await supabase.from("quiz_results").insert({
        user_id: userId,
        total_cards: data.totalCards,
        correct: data.correct,
        card_details: data.cardDetails || [],
    });

    if (error) console.error("Quiz save error:", error);
}

// ─── Break Logs ───────────────────────────────────────

export async function saveBreakLog(data: {
    durationMinutes: number;
    ringtone: string;
    completed: boolean;
}) {
    const userId = await getUserId();
    if (!userId) return;

    const { error } = await supabase.from("break_logs").insert({
        user_id: userId,
        duration_minutes: data.durationMinutes,
        ringtone: data.ringtone,
        completed: data.completed,
    });

    if (error) console.error("Break log save error:", error);
}

// ─── Focus Sessions ───────────────────────────────────

export async function saveFocusSession(durationSeconds: number) {
    const userId = await getUserId();
    if (!userId) return;

    const { error } = await supabase.from("focus_sessions").insert({
        user_id: userId,
        duration_seconds: durationSeconds,
    });

    if (error) console.error("Focus session save error:", error);
}

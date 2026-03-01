/**
 * Lumina Insight — API Service Layer
 *
 * Centralises all API calls so components don't fetch directly.
 * When the backend is ready, just update the endpoint URLs here.
 * Falls back to mock data when the API is unreachable.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

async function fetchJSON<T>(path: string, fallback: T): Promise<T> {
    try {
        const res = await fetch(`${BASE_URL}${path}`);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
    } catch {
        // Backend not running — silently return fallback (mock data)
        return fallback;
    }
}

/* ─── Dashboard endpoints ─── */

import {
    mockStats,
    mockHeatmapData,
    mockKnowledgeGraph,
    mockGhostMode,
    mockSkillRadar,
    mockNudges,
} from "@/lib/mockData";

export const api = {
    /** Stats bar cards */
    getStats: () => fetchJSON("/stats", mockStats),

    /** Pulse heatmap grid */
    getHeatmap: () => fetchJSON("/pulse-heatmap", mockHeatmapData),

    /** Knowledge graph nodes + edges */
    getKnowledgeGraph: () => fetchJSON("/knowledge-graph", mockKnowledgeGraph),

    /** Ghost mode comparison data */
    getGhostMode: () => fetchJSON("/ghost-mode", mockGhostMode),

    /** Skill radar dimensions */
    getSkillRadar: () => fetchJSON("/skill-radar", mockSkillRadar),

    /** Contextual nudges */
    getNudges: () => fetchJSON("/nudges", mockNudges),
};

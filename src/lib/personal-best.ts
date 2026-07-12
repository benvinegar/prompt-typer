/**
 * Personal-best persistence for Prompt Faster. Stores the player's best run in localStorage so
 * the results card and start screen can show a target to beat. Client-only: every read/write is
 * guarded so it's a safe no-op during SSR or when storage is unavailable (private browsing,
 * quota exceeded, disabled storage).
 */
import { getRankForWpm } from '@/data/titles';
import type { GameStats } from '@/game/types';

/** localStorage key for the stored personal best. Bump the version suffix on shape changes. */
const STORAGE_KEY = 'prompt-faster:pb:v1';

/** The player's best-ever run, persisted across sessions. */
export interface PersonalBest {
    wpm: number;
    accuracy: number;
    tokensPerSecond: number;
    rankTitle: string;
    /** ISO 8601 timestamp of when this best was set. */
    dateISO: string;
}

function isPersonalBest(value: unknown): value is PersonalBest {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.wpm === 'number' &&
        typeof candidate.accuracy === 'number' &&
        typeof candidate.tokensPerSecond === 'number' &&
        typeof candidate.rankTitle === 'string' &&
        typeof candidate.dateISO === 'string'
    );
}

/**
 * Loads the stored personal best. Returns null when running server-side, when nothing has been
 * saved yet, or when the stored value is corrupt/unparseable — this function never throws.
 */
export function loadPersonalBest(): PersonalBest | null {
    if (typeof window === 'undefined') {
        return null;
    }
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return null;
        }
        const parsed: unknown = JSON.parse(raw);
        return isPersonalBest(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/**
 * Records a finished run as the new personal best when its WPM strictly exceeds the current
 * best (ties keep the existing best, since it was set earlier). Persists the result to
 * localStorage when it changes. Safe to call during SSR or with storage disabled — the returned
 * `pb` is still correct for the current render even if the write silently fails.
 */
export function recordRunIfBest(stats: GameStats): { pb: PersonalBest; isNew: boolean } {
    const current = loadPersonalBest();
    if (current && stats.wpm <= current.wpm) {
        return { pb: current, isNew: false };
    }

    const pb: PersonalBest = {
        wpm: stats.wpm,
        accuracy: stats.accuracy,
        tokensPerSecond: stats.tokensPerSecond,
        rankTitle: getRankForWpm(stats.wpm).title,
        dateISO: new Date().toISOString(),
    };

    if (typeof window !== 'undefined') {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pb));
        } catch {
            // Storage unavailable or full — the new best is still returned for this render.
        }
    }

    return { pb, isNew: true };
}

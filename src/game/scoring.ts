/**
 * Pure scoring math for Prompt Faster. No side effects, no state — every run's final
 * (or live) stats are derived from a handful of counters via {@link computeStats}.
 */

import { CHARS_PER_TOKEN, type GameStats } from '@/game/types';

/** Raw counters accumulated by the engine; the inputs to {@link computeStats}. */
export interface ComputeStatsInput {
    correctChars: number;
    errors: number;
    totalKeystrokes: number;
    promptsCompleted: number;
    activeTypingMs: number;
    tokensBurned: number;
    subagentCount: number;
}

/**
 * Derives display-ready {@link GameStats} from raw run counters. Guards divide-by-zero:
 * `wpm`/`tokensPerSecond` are 0 when no active typing time has elapsed, and `accuracy` is
 * 100 when no keystrokes have been recorded yet. `wpm`/`accuracy` are rounded to whole
 * numbers; `tokensPerSecond` is rounded to one decimal place.
 */
export function computeStats(input: ComputeStatsInput): GameStats {
    const { correctChars, errors, totalKeystrokes, promptsCompleted, activeTypingMs, tokensBurned, subagentCount } =
        input;

    const activeMinutes = activeTypingMs / 60_000;
    const activeSeconds = activeTypingMs / 1_000;

    const wpm = activeTypingMs > 0 ? Math.round(correctChars / 5 / activeMinutes) : 0;
    const tokensPerSecond =
        activeTypingMs > 0 ? Math.round((correctChars / CHARS_PER_TOKEN / activeSeconds) * 10) / 10 : 0;
    const accuracy = totalKeystrokes > 0 ? Math.round((totalKeystrokes - errors) / totalKeystrokes * 100) : 100;

    return {
        wpm,
        accuracy,
        tokensPerSecond,
        correctChars,
        errors,
        totalKeystrokes,
        promptsCompleted,
        activeTypingMs,
        tokensBurned: Math.floor(tokensBurned),
        subagentCount,
    };
}

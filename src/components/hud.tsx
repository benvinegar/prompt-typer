import { useState } from 'react';
import type { GamePhase } from '@/game/types';
import { isMuted, setMuted } from '@/lib/audio';
import { formatTokensCompact } from '@/lib/format';

const LOW_TIME_THRESHOLD_MS = 10_000;

/** Streak length required before the combo indicator appears at all. */
const COMBO_TIER_1_STREAK = 30;
/** Streak length that upgrades the combo indicator to its "hot" tier. */
const COMBO_TIER_2_STREAK = 60;
/** Streak length that upgrades the combo indicator to its "blazing" tier. */
const COMBO_TIER_3_STREAK = 100;

export interface HudProps {
    remainingMs: number;
    wpm: number;
    accuracy: number;
    tokensBurned: number;
    subagentCount: number;
    /** Current streak of consecutive correct keystrokes; drives the combo indicator. */
    streak: number;
    phase: GamePhase;
}

/** Formats milliseconds as "S.Ds" (one decimal place), e.g. 42734 -> "42.7s". */
function formatClock(ms: number): string {
    const seconds = Math.max(0, ms) / 1000;
    return `${seconds.toFixed(1)}s`;
}

interface ComboTier {
    label: string;
    colorClass: string;
    showFlame: boolean;
    /** Extra emphasis classes applied only at the top tier. */
    emphasisClass: string;
}

/** Below 30 there is no indicator at all; tiers upgrade color/emphasis at 60 and 100. */
function getComboTier(streak: number): ComboTier | null {
    if (streak < COMBO_TIER_1_STREAK) {
        return null;
    }
    const label = `${streak}x clean`;
    if (streak < COMBO_TIER_2_STREAK) {
        return { label, colorClass: 'text-success', showFlame: false, emphasisClass: '' };
    }
    if (streak < COMBO_TIER_3_STREAK) {
        return { label, colorClass: 'text-accent-bright', showFlame: true, emphasisClass: '' };
    }
    return {
        label,
        colorClass: 'text-accent-bright',
        showFlame: true,
        emphasisClass: 'font-bold drop-shadow-[0_0_6px_var(--color-accent)]',
    };
}

function FlameIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
            <path
                d="M12 2c1.2 3.2-2.6 4.4-2.6 8.2a2.6 2.6 0 0 0 5.2 0c0-.9-.6-1.7-.6-1.7 1.8.9 2.8 2.7 2.8 4.6a5.2 5.2 0 1 1-10.4 0C6.4 8.4 9.6 6 12 2Z"
                fill="currentColor"
            />
        </svg>
    );
}

/** A clean-streak combo chip: reserves its own space so it never shifts sibling layout on appear. */
function ComboIndicator({ streak }: { streak: number }) {
    const tier = getComboTier(streak);
    return (
        <span
            className={`hidden w-[112px] shrink-0 items-center justify-end gap-1 transition-opacity duration-200 sm:flex ${
                tier ? 'opacity-100' : 'opacity-0'
            } ${tier?.colorClass ?? ''} ${tier?.emphasisClass ?? ''}`}
            aria-hidden={tier ? undefined : true}
        >
            {tier?.showFlame && <FlameIcon className="h-3 w-3 shrink-0" />}
            <span className="whitespace-nowrap tabular-nums">{tier?.label ?? ''}</span>
        </span>
    );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
    if (muted) {
        return (
            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M4 9.5v5h3.5l4.5 3.5v-12L7.5 9.5H4Z" fill="currentColor" />
                <path d="m15.5 9.5 5 5M20.5 9.5l-5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
        );
    }
    return (
        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M4 9.5v5h3.5l4.5 3.5v-12L7.5 9.5H4Z" fill="currentColor" />
            <path
                d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
            />
        </svg>
    );
}

/** Small icon toggle for the synthesized sound effects. Persisted via `@/lib/audio`, unmuted by default. */
function MuteToggle() {
    const [muted, setMutedState] = useState(() => isMuted());

    const toggle = () => {
        const next = !muted;
        setMuted(next);
        setMutedState(next);
    };

    return (
        <button
            type="button"
            onClick={toggle}
            aria-pressed={muted}
            aria-label={muted ? 'Unmute sound effects' : 'Mute sound effects'}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-bg-panel text-ink-dim transition-colors hover:text-ink"
        >
            <SpeakerIcon muted={muted} />
        </button>
    );
}

/**
 * Top HUD bar: countdown clock, a "clock frozen" hint while the agent works, the comedic
 * ever-rising token-burn meter (with a subagent chip once the agent starts delegating),
 * a clean-streak combo indicator, live WPM/accuracy, and the sound mute toggle.
 */
export function Hud({ remainingMs, wpm, accuracy, tokensBurned, subagentCount, streak, phase }: HudProps) {
    const isLow = phase === 'typing' && remainingMs < LOW_TIME_THRESHOLD_MS;
    const isFrozen = phase === 'streaming' || phase === 'thinking';

    return (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-bg-elevated/80 px-4 py-3 backdrop-blur-sm sm:px-6">
            <div className="flex items-center gap-2">
                <span
                    className={`font-mono text-2xl font-semibold tabular-nums transition-colors sm:text-3xl ${
                        isLow ? 'animate-pulse-danger text-danger' : 'text-ink'
                    }`}
                >
                    {formatClock(remainingMs)}
                </span>
                {isFrozen && (
                    <span className="flex items-center gap-1 rounded-full border border-border bg-bg-panel px-2 py-0.5 text-[11px] font-medium text-ink-dim">
                        <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden="true">
                            <path
                                d="M12 2v20M4.5 6.5 19.5 17.5M19.5 6.5 4.5 17.5"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
                        </svg>
                        clock frozen
                    </span>
                )}
            </div>
            <div className="flex items-center gap-3 font-mono text-xs text-ink-dim sm:gap-4 sm:text-sm">
                <ComboIndicator streak={streak} />
                {subagentCount > 0 && (
                    <span className="flex items-center gap-1.5 rounded-full border border-accent-dim bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-bright">
                        <span
                            aria-hidden="true"
                            className="h-2.5 w-2.5 animate-spin rounded-full border border-accent-dim border-t-accent-bright"
                        />
                        <span className="tabular-nums">{subagentCount}</span> agents
                    </span>
                )}
                <span
                    className="inline-block min-w-[6ch] text-right tabular-nums"
                    title="tokens burned (they are not coming back)"
                >
                    <span
                        className={
                            subagentCount > 0
                                ? 'font-bold text-accent-bright drop-shadow-[0_0_6px_var(--color-accent)]'
                                : 'text-ink'
                        }
                    >
                        {formatTokensCompact(tokensBurned)}
                    </span>{' '}
                    tok
                </span>
                <span>
                    <span className="text-ink">{wpm}</span> wpm
                </span>
                <span className="hidden sm:inline">
                    <span className="text-ink">{accuracy}</span>% acc
                </span>
                <MuteToggle />
            </div>
        </div>
    );
}

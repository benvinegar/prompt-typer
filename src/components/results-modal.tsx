import { useState } from 'react';
import type { GameStats } from '@/game/types';
import { getRankForWpm } from '@/data/titles';

export interface ResultsModalProps {
    stats: GameStats;
    onPlayAgain: () => void;
    onClose: () => void;
}

/** Joke $/1M-token rate used for the fake bill. Precise-looking numbers are funnier. */
const FAKE_DOLLARS_PER_MILLION_TOKENS = 23.7;

function formatTokens(tokens: number): string {
    return Math.floor(tokens).toLocaleString('en-US');
}

function fakeCost(tokens: number): string {
    return `$${((tokens / 1_000_000) * FAKE_DOLLARS_PER_MILLION_TOKENS).toFixed(2)}`;
}

/** Builds the shareable brag text using the player's actual run stats. */
function buildShareText(stats: GameStats, title: string): string {
    const subagents = stats.subagentCount > 0 ? ` My copilot burned ${formatTokens(stats.tokensBurned)} tokens and left ${stats.subagentCount} subagents running.` : '';
    return `My vibe coding interview verdict: "${title}" — ${stats.wpm} WPM, ${stats.accuracy}% acc, ${stats.tokensPerSecond} tok/s.${subagents} Think you'd get the offer? Prompt Faster`;
}

/** Dark overlay + centered, screenshot-friendly card showing the final rank and stat grid. */
export function ResultsModal({ stats, onPlayAgain, onClose }: ResultsModalProps) {
    const [copied, setCopied] = useState(false);
    const rank = getRankForWpm(stats.wpm);

    const handleCopy = () => {
        const text = buildShareText(stats, rank.title);
        void navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="results-title"
        >
            <div className="relative w-full max-w-md animate-pop-in rounded-3xl border border-border-strong bg-bg-elevated p-6 shadow-2xl sm:p-8">
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close results"
                    className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-ink-dim transition-colors hover:bg-bg-panel hover:text-ink"
                >
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                        <path
                            d="m5 5 14 14M19 5 5 19"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                        />
                    </svg>
                </button>

                <div className="text-center">
                    <div className="text-6xl">{rank.emoji}</div>
                    <h1 id="results-title" className="mt-3 font-sans text-2xl font-bold text-ink">
                        {rank.title}
                    </h1>
                    <p className="mt-1 text-sm text-ink-dim">{rank.blurb}</p>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="col-span-2 rounded-2xl border border-accent-dim bg-accent-soft px-4 py-4 text-center">
                        <div className="font-mono text-5xl font-bold tabular-nums text-accent-bright">
                            {stats.wpm}
                        </div>
                        <div className="mt-1 text-xs tracking-wide text-ink-dim uppercase">WPM</div>
                    </div>

                    <div className="rounded-2xl border border-border bg-bg-panel px-3 py-3 text-center">
                        <div className="font-mono text-2xl font-semibold tabular-nums text-ink">
                            {stats.accuracy}%
                        </div>
                        <div className="mt-1 text-[11px] tracking-wide text-ink-dim uppercase">Accuracy</div>
                    </div>

                    <div className="rounded-2xl border border-border bg-bg-panel px-3 py-3 text-center">
                        <div className="font-mono text-2xl font-semibold tabular-nums text-ink">
                            {stats.tokensPerSecond}
                        </div>
                        <div className="mt-1 text-[11px] tracking-wide text-ink-dim uppercase">
                            est. output speed (tok/s)
                        </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-bg-panel px-3 py-3 text-center">
                        <div className="font-mono text-2xl font-semibold tabular-nums text-ink">
                            {stats.promptsCompleted}
                        </div>
                        <div className="mt-1 text-[11px] tracking-wide text-ink-dim uppercase">Prompts</div>
                    </div>

                    <div className="rounded-2xl border border-border bg-bg-panel px-3 py-3 text-center">
                        <div className="font-mono text-2xl font-semibold tabular-nums text-ink">
                            {stats.errors}
                        </div>
                        <div className="mt-1 text-[11px] tracking-wide text-ink-dim uppercase">Errors</div>
                    </div>

                    <div className="col-span-2 rounded-2xl border border-border bg-bg-panel px-4 py-3 text-center">
                        <div className="font-mono text-2xl font-semibold tabular-nums text-accent-bright">
                            {formatTokens(stats.tokensBurned)}
                        </div>
                        <div className="mt-1 text-[11px] tracking-wide text-ink-dim uppercase">
                            tokens burned by your copilot (est. {fakeCost(stats.tokensBurned)})
                        </div>
                    </div>
                </div>

                {stats.subagentCount > 0 && (
                    <p className="mt-3 text-center text-xs text-ink-faint">
                        * {stats.subagentCount} subagents are still running. This is now your problem.
                    </p>
                )}

                <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="flex-1 rounded-full border border-border-strong bg-bg-panel px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-bg-elevated"
                    >
                        {copied ? 'Copied!' : 'Copy result'}
                    </button>
                    <button
                        type="button"
                        onClick={onPlayAgain}
                        className="flex-1 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_-4px_var(--color-accent)] transition-colors hover:bg-accent-bright"
                    >
                        Run it back
                    </button>
                </div>
            </div>
        </div>
    );
}

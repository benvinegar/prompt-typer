import { useEffect, useRef, useState } from 'react';
import { getRankForWpm, RANK_TITLES } from '@/data/titles';
import type { GameStats } from '@/game/types';
import { loadPersonalBest, recordRunIfBest, type PersonalBest } from '@/lib/personal-best';
import { buildShareText, downloadCardAsPng, shareResult } from '@/lib/share';

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

/** Dark overlay + centered, screenshot-friendly card showing the final rank and stat grid. */
export function ResultsModal({ stats, onPlayAgain, onClose }: ResultsModalProps) {
    const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
    const [pbResult, setPbResult] = useState<{ pb: PersonalBest; isNew: boolean } | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    const rank = getRankForWpm(stats.wpm);
    const rankIndex = RANK_TITLES.findIndex((title) => title.title === rank.title);
    const nextRank = rankIndex >= 0 && rankIndex < RANK_TITLES.length - 1 ? RANK_TITLES[rankIndex + 1] : null;

    // Record this run against the stored personal best exactly once, for the run this modal is
    // displaying. `stats` is fixed for the lifetime of the modal (a new run remounts it). The ref
    // guard keeps StrictMode's double-invoked effect from recording twice (the second record
    // would see the just-saved PB and wrongly report isNew=false).
    const recordedRef = useRef<{ pb: PersonalBest; isNew: boolean } | null>(null);
    useEffect(() => {
        recordedRef.current ??= recordRunIfBest(stats);
        setPbResult(recordedRef.current);
    }, []);

    const isNewPb = pbResult?.isNew ?? false;
    const pb = pbResult?.pb ?? loadPersonalBest();

    const handleShare = () => {
        const text = buildShareText(stats, rank.title);
        void shareResult(text).then((result) => {
            if (result === 'copied') {
                setShareState('copied');
                window.setTimeout(() => setShareState('idle'), 2000);
            }
        });
    };

    const handleSaveCard = () => {
        if (!cardRef.current) {
            return;
        }
        setSaveState('saving');
        void downloadCardAsPng(cardRef.current, `prompt-faster-${stats.wpm}wpm.png`)
            .then(() => setSaveState('idle'))
            .catch(() => setSaveState('error'));
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

                {/* Capture target for "Save card" — rank + stats only, no action buttons. */}
                <div ref={cardRef}>
                    {isNewPb && (
                        <div className="mx-auto mb-4 flex w-fit animate-pulse items-center gap-1.5 rounded-full border border-accent-dim bg-accent-soft px-3 py-1 text-xs font-bold tracking-wide text-accent-bright uppercase">
                            <span aria-hidden="true">✨</span> New personal best
                        </div>
                    )}

                    <div className="text-center">
                        <div className="text-6xl">{rank.emoji}</div>
                        <h1 id="results-title" className="mt-3 font-sans text-2xl font-bold text-ink">
                            {rank.title}
                        </h1>
                        <p className="mt-1 text-sm text-ink-dim">{rank.blurb}</p>
                        {!isNewPb && pb && <p className="mt-2 text-xs text-ink-faint">PB: {pb.wpm} WPM</p>}
                    </div>

                    <div className="mt-5 flex items-center justify-center gap-1.5 rounded-2xl border border-border bg-bg-panel px-3 py-2.5">
                        {RANK_TITLES.map((title) => {
                            const earned = title.title === rank.title;
                            return (
                                <span
                                    key={title.title}
                                    title={`${title.title} (${title.minWpm}+ WPM)`}
                                    className={
                                        earned
                                            ? 'flex h-7 w-7 items-center justify-center rounded-full bg-accent text-base shadow-[0_0_12px_-2px_var(--color-accent)]'
                                            : 'flex h-7 w-7 items-center justify-center rounded-full text-base opacity-30 grayscale'
                                    }
                                >
                                    {title.emoji}
                                </span>
                            );
                        })}
                    </div>
                    {nextRank && (
                        <p className="mt-2 text-center text-xs text-ink-dim">
                            +{nextRank.minWpm - stats.wpm} WPM to &ldquo;{nextRank.title}&rdquo;
                        </p>
                    )}

                    <div className="mt-5 grid grid-cols-2 gap-3">
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
                </div>

                <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                    <button
                        type="button"
                        onClick={handleShare}
                        className="flex-1 rounded-full border border-border-strong bg-bg-panel px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-bg-elevated"
                    >
                        {shareState === 'copied' ? 'Copied!' : 'Share'}
                    </button>
                    <button
                        type="button"
                        onClick={handleSaveCard}
                        disabled={saveState === 'saving'}
                        aria-busy={saveState === 'saving'}
                        className="flex-1 rounded-full border border-border-strong bg-bg-panel px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-bg-elevated disabled:opacity-60"
                    >
                        {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Retry save' : 'Save card'}
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

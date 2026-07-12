import { useEffect, useRef, useState } from 'react';
import { SHAME_VERDICTS } from '@/data/shame-titles';
import { getRankForWpm, RANK_TITLES } from '@/data/titles';
import type { GameStats, RankTitle } from '@/game/types';
import { formatTokensCompact, formatTokensFull } from '@/lib/format';
import { loadPersonalBest, recordRunIfBest, type PersonalBest } from '@/lib/personal-best';
import { buildShareText, downloadCardAsPng, shareResult } from '@/lib/share';
import { TitleBorderPanel } from '@/components/title-border-panel';

export interface ResultsModalProps {
    stats: GameStats;
    onPlayAgain: () => void;
    onClose: () => void;
}

/** Joke $/1M-token rate used for the fake bill. Precise-looking numbers are funnier. */
const FAKE_DOLLARS_PER_MILLION_TOKENS = 23.7;

function fakeCost(tokens: number): string {
    const dollars = (tokens / 1_000_000) * FAKE_DOLLARS_PER_MILLION_TOKENS;
    return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** A bracketed, borderless mono action for the results card footer, e.g. `[ share ]`. */
function BracketButton({
    onClick,
    disabled,
    ariaBusy,
    children,
}: {
    onClick: () => void;
    disabled?: boolean;
    ariaBusy?: boolean;
    children: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-busy={ariaBusy}
            className="flex-1 border border-border-strong px-2 py-2 text-xs font-bold whitespace-nowrap text-accent transition-colors hover:border-accent hover:bg-accent-soft disabled:opacity-50 sm:text-sm"
        >
            [ {children} ]
        </button>
    );
}

/** Dark overlay + centered, screenshot-friendly card showing the final rank and stat grid. */
export function ResultsModal({ stats, onPlayAgain, onClose }: ResultsModalProps) {
    const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
    const [pbResult, setPbResult] = useState<{ pb: PersonalBest; isNew: boolean } | null>(null);
    /** Rank the player is exploring on the ladder (hover/focus/tap); null shows the default line. */
    const [inspectedRank, setInspectedRank] = useState<RankTitle | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    // A flagged run (`botVerdict` set) shows a shame verdict instead of the normal WPM rank, and
    // never records a personal best -- the rank ladder / PB machinery below is entirely bypassed.
    const isDisqualified = stats.botVerdict !== null;
    const shameVerdict = stats.botVerdict !== null ? SHAME_VERDICTS[stats.botVerdict] : null;

    const rank = getRankForWpm(stats.wpm);
    const rankIndex = RANK_TITLES.findIndex((title) => title.title === rank.title);
    const nextRank = rankIndex >= 0 && rankIndex < RANK_TITLES.length - 1 ? RANK_TITLES[rankIndex + 1] : null;

    const displayEmoji = shameVerdict?.emoji ?? rank.emoji;
    const displayTitle = shameVerdict?.title ?? rank.title;
    const displayBlurb = shameVerdict?.blurb ?? rank.blurb;

    // Record this run against the stored personal best exactly once, for the run this modal is
    // displaying. `stats` is fixed for the lifetime of the modal (a new run remounts it). The ref
    // guard keeps StrictMode's double-invoked effect from recording twice (the second record
    // would see the just-saved PB and wrongly report isNew=false). Disqualified runs never touch
    // the stored PB -- cheating yourself out of a real record isn't a record.
    const recordedRef = useRef<{ pb: PersonalBest; isNew: boolean } | null>(null);
    useEffect(() => {
        if (isDisqualified) {
            return;
        }
        recordedRef.current ??= recordRunIfBest(stats);
        setPbResult(recordedRef.current);
    }, []);

    const isNewPb = !isDisqualified && (pbResult?.isNew ?? false);
    const pb = pbResult?.pb ?? loadPersonalBest();

    const handleShare = () => {
        const text = buildShareText(stats, displayTitle, isDisqualified);
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
        void downloadCardAsPng(cardRef.current, `prompt-cardio-${stats.wpm}wpm.png`)
            .then(() => setSaveState('idle'))
            .catch(() => setSaveState('error'));
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 font-mono backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="results-title"
        >
            <div className="relative w-full max-w-md animate-pop-in">
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close results"
                    className="absolute -top-3 -right-2 z-10 flex h-7 w-7 items-center justify-center text-ink-dim transition-colors hover:text-ink-bright"
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

                <TitleBorderPanel title="session summary" className="bg-bg">
                    {/* Capture target for "Save card" — rank + stats only, no action buttons. Explicit
                        bg-bg keeps the exported PNG's background matching the page instead of transparent. */}
                    <div ref={cardRef} className="bg-bg">
                        {isNewPb && (
                            <p className="mb-3 text-center text-xs font-bold tracking-wide text-accent uppercase">
                                ✨ new record burn
                            </p>
                        )}

                        <div className="text-center">
                            <div className="text-5xl">{displayEmoji}</div>
                            <h1 id="results-title" className="mt-2 text-xl font-bold text-ink-bright">
                                {displayTitle}
                            </h1>
                            <p className="mt-1 text-sm text-ink-dim">{displayBlurb}</p>
                            {!isDisqualified && !isNewPb && pb && (
                                <p className="mt-2 text-xs text-ink-faint">
                                    record burn: {formatTokensCompact(pb.tokensBurned)} tokens
                                </p>
                            )}
                        </div>

                        {!isDisqualified && (
                            <div
                                className="mt-4 flex items-center justify-center gap-1.5"
                                onMouseLeave={() => setInspectedRank(null)}
                            >
                                {RANK_TITLES.map((title) => {
                                    const earned = title.title === rank.title;
                                    return (
                                        <button
                                            key={title.title}
                                            type="button"
                                            aria-label={`${title.title} (${title.minWpm}+ wpm)`}
                                            onMouseEnter={() => setInspectedRank(title)}
                                            onFocus={() => setInspectedRank(title)}
                                            onBlur={() => setInspectedRank(null)}
                                            onClick={() => setInspectedRank(title)}
                                            className={
                                                earned
                                                    ? 'rounded-full text-lg ring-1 ring-accent'
                                                    : 'rounded-full text-lg opacity-30 grayscale transition hover:opacity-100 hover:grayscale-0'
                                            }
                                        >
                                            {title.emoji}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {!isDisqualified && (
                            <p className="mt-2 min-h-[3em] text-center text-xs">
                                {inspectedRank ? (
                                    <>
                                        <span className="font-bold text-ink-bright">{inspectedRank.title}</span>
                                        <span className="text-ink-faint"> · {inspectedRank.minWpm}+ wpm</span>
                                        <br />
                                        <span className="text-ink-dim">{inspectedRank.blurb}</span>
                                    </>
                                ) : nextRank ? (
                                    <span className="text-ink-dim">
                                        +{nextRank.minWpm - stats.wpm} wpm to &ldquo;{nextRank.title}&rdquo;
                                        <br />
                                        <span className="text-ink-faint">hover the ladder to browse ranks</span>
                                    </span>
                                ) : (
                                    <span className="text-ink-dim">
                                        top of the ladder
                                        <br />
                                        <span className="text-ink-faint">hover the ladder to browse ranks</span>
                                    </span>
                                )}
                            </p>
                        )}

                        <div className="mt-5 border-y border-border py-4 text-center">
                            <div className="text-4xl font-bold text-accent tabular-nums sm:text-5xl">
                                {formatTokensFull(stats.tokensBurned)}
                            </div>
                            <div className="mt-1 text-xs tracking-wide text-ink-dim uppercase">
                                tokens burned by your copilot
                            </div>
                            <div className="mt-1 text-xs text-ink-faint">est. bill: {fakeCost(stats.tokensBurned)}</div>
                        </div>

                        <div className="grid grid-cols-2 divide-x divide-y divide-border border-b border-border">
                            <div className="px-2 py-3 text-center">
                                <div className="text-xl font-bold text-ink-bright tabular-nums">{stats.wpm}</div>
                                <div className="mt-1 text-[11px] tracking-wide text-ink-dim uppercase">wpm</div>
                            </div>

                            <div className="px-2 py-3 text-center">
                                <div className="text-xl font-bold text-ink-bright tabular-nums">
                                    {stats.tokensPerSecond}
                                </div>
                                <div className="mt-1 text-[11px] tracking-wide text-ink-dim uppercase">tok/s</div>
                            </div>

                            <div className="px-2 py-3 text-center">
                                <div className="text-xl font-bold text-ink-bright tabular-nums">
                                    {stats.accuracy}%
                                </div>
                                <div className="mt-1 text-[11px] tracking-wide text-ink-dim uppercase">accuracy</div>
                            </div>

                            <div className="px-2 py-3 text-center">
                                <div className="text-xl font-bold text-ink-bright tabular-nums">{stats.errors}</div>
                                <div className="mt-1 text-[11px] tracking-wide text-ink-dim uppercase">errors</div>
                            </div>
                        </div>

                        {stats.subagentCount > 0 && (
                            <p className="mt-3 text-center text-xs text-ink-faint">
                                * {stats.subagentCount} subagents are still running. this is now your problem.
                            </p>
                        )}
                        {isDisqualified && (
                            <p className="mt-3 text-center text-xs text-ink-faint">
                                * this run was disqualified. the transcript has been forwarded to compliance.
                            </p>
                        )}
                    </div>

                    <div className="mt-5 flex gap-2">
                        <BracketButton onClick={handleShare}>{shareState === 'copied' ? 'copied!' : 'share'}</BracketButton>
                        <BracketButton
                            onClick={handleSaveCard}
                            disabled={saveState === 'saving'}
                            ariaBusy={saveState === 'saving'}
                        >
                            {saveState === 'saving' ? 'saving…' : saveState === 'error' ? 'retry save' : 'save card'}
                        </BracketButton>
                        <BracketButton onClick={onPlayAgain}>run it back</BracketButton>
                    </div>
                </TitleBorderPanel>
            </div>
        </div>
    );
}

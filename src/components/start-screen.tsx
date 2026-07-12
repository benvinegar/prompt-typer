import { formatTokensCompact } from '@/lib/format';
import { loadPersonalBest } from '@/lib/personal-best';

export interface StartScreenProps {
    onStart: () => void;
}

function CheckIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0 text-accent-bright" aria-hidden="true">
            <path
                d="m5 13 4 4L19 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

/** Centered hero shown at phase 'idle': title, pitch, rules, and the START button. */
export function StartScreen({ onStart }: StartScreenProps) {
    const pb = loadPersonalBest();

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-bg-panel shadow-[0_0_32px_-8px_var(--color-accent)]">
                <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-accent-bright" aria-hidden="true">
                    <path
                        d="M12 2.5 14 9.5 21 12 14 14.5 12 21.5 10 14.5 3 12 10 9.5 12 2.5Z"
                        fill="currentColor"
                    />
                </svg>
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">Prompt Faster</h1>
            <p className="mt-3 max-w-md text-lg text-ink-dim">
                The vibe coding interview. You are the candidate.
            </p>

            <ul className="mt-8 flex w-full max-w-sm flex-col gap-3 text-left">
                <li className="flex items-start gap-2.5 text-sm text-ink-dim">
                    <CheckIcon />
                    <span>Your mission: make the AI burn as many tokens as possible. Speed feeds the fire.</span>
                </li>
                <li className="flex items-start gap-2.5 text-sm text-ink-dim">
                    <CheckIcon />
                    <span>Prompt your AI copilot through the tasks by typing the ghost text.</span>
                </li>
                <li className="flex items-start gap-2.5 text-sm text-ink-dim">
                    <CheckIcon />
                    <span>
                        2 minutes on the wall clock. It starts on your first keystroke — and the AI's
                        theatrics run YOUR clock.
                    </span>
                </li>
                <li className="flex items-start gap-2.5 text-sm text-ink-dim">
                    <CheckIcon />
                    <span>Wrong keys don't advance. The last key sends it — no Enter needed.</span>
                </li>
            </ul>

            {pb && (
                <p className="mt-6 text-sm text-ink-dim">
                    Your record burn:{' '}
                    <span className="font-mono font-semibold text-accent-bright">
                        {formatTokensCompact(pb.tokensBurned)} tokens
                    </span>
                    {' ('}
                    {pb.wpm} WPM{')'}
                </p>
            )}

            <button
                type="button"
                onClick={onStart}
                className="mt-10 rounded-full bg-accent px-10 py-3.5 text-lg font-semibold text-white shadow-[0_0_32px_-6px_var(--color-accent)] transition-transform hover:scale-[1.03] hover:bg-accent-bright active:scale-[0.98]"
            >
                START
            </button>
        </div>
    );
}

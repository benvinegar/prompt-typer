export interface TypingComposerProps {
    prompt: string | null;
    typedCount: number;
    lastKeyWasError: boolean;
    readyToSubmit: boolean;
}

/**
 * The chat-composer-styled ghost prompt: typed characters render bright, untyped characters
 * render dim, and the current character is underlined/highlighted. Flashes red and shakes
 * briefly on a wrong keystroke; glows and hints "press Enter" once the prompt is fully typed.
 */
export function TypingComposer({ prompt, typedCount, lastKeyWasError, readyToSubmit }: TypingComposerProps) {
    if (prompt === null) {
        return (
            <div className="rounded-2xl border border-border bg-bg-panel px-4 py-4 font-mono text-base text-ink-faint sm:px-5">
                waiting for the next prompt...
            </div>
        );
    }

    const typed = prompt.slice(0, typedCount);
    const current = prompt.slice(typedCount, typedCount + 1);
    const rest = prompt.slice(typedCount + 1);

    return (
        <div
            key={lastKeyWasError ? `error-${typedCount}` : undefined}
            className={`relative overflow-hidden rounded-2xl border px-4 py-4 font-mono text-base leading-relaxed transition-shadow sm:px-5 sm:text-lg ${
                lastKeyWasError
                    ? 'animate-shake border-danger bg-danger-soft'
                    : readyToSubmit
                      ? 'border-accent bg-accent-soft shadow-[0_0_0_1px_var(--color-accent),0_0_24px_-4px_var(--color-accent)]'
                      : 'border-border bg-bg-panel'
            }`}
        >
            <p className="break-words whitespace-pre-wrap">
                <span className="text-ink">{typed}</span>
                {current && (
                    <span
                        className={`relative rounded-[2px] underline decoration-2 underline-offset-4 ${
                            lastKeyWasError
                                ? 'bg-danger text-white decoration-danger'
                                : 'bg-accent/15 text-ink-dim decoration-accent-bright'
                        }`}
                    >
                        <span
                            aria-hidden="true"
                            className="animate-caret-blink absolute inset-y-0 -left-px w-0.5 rounded-full bg-accent-bright"
                        />
                        {current}
                    </span>
                )}
                <span className="text-ink-faint">{rest}</span>
            </p>

            {readyToSubmit && (
                <div className="mt-3 flex items-center justify-end gap-2">
                    <span className="animate-pulse text-xs font-medium text-accent-bright sm:text-sm">
                        press Enter to send
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white shadow-[0_0_16px_-2px_var(--color-accent)]">
                        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                            <path
                                d="M4 12h16M13 5l7 7-7 7"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </span>
                </div>
            )}
        </div>
    );
}

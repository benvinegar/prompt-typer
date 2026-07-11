import { useEffect, useRef, useState } from 'react';

const MIN_MS_PER_CHAR = 15;
const MAX_MS_PER_CHAR = 25;

/** Picks a fixed per-character reveal delay once per mount, within the natural typing range. */
function pickCharDelay(): number {
    return MIN_MS_PER_CHAR + Math.random() * (MAX_MS_PER_CHAR - MIN_MS_PER_CHAR);
}

export interface StreamingTextProps {
    text: string;
    /** Whether this text should still be revealing. When false, the full text renders immediately. */
    streaming: boolean;
    /** Called exactly once, when the full text has finished revealing. */
    onDone?: () => void;
    /** Fixed reveal speed override; when omitted, a natural 15-25ms/char delay is picked per mount. */
    msPerChar?: number;
}

/**
 * Reveals `text` character-by-character while `streaming` is true, then calls `onDone` exactly
 * once. Renders a blinking caret at the reveal point while still streaming.
 */
export function StreamingText({ text, streaming, onDone, msPerChar }: StreamingTextProps) {
    const [revealCount, setRevealCount] = useState(streaming ? 0 : text.length);
    const doneFiredRef = useRef(false);
    const charDelayRef = useRef(msPerChar ?? pickCharDelay());

    useEffect(() => {
        if (!streaming) {
            setRevealCount(text.length);
            return;
        }

        doneFiredRef.current = false;
        setRevealCount(0);

        // Reveal is a function of elapsed time, not tick count, so throttled timers (background
        // tabs, slow devices) catch up in one tick instead of crawling one char per tick.
        const startedAt = performance.now();
        let cancelled = false;

        const tick = () => {
            if (cancelled) {
                return;
            }
            const elapsed = performance.now() - startedAt;
            const revealed = Math.min(text.length, Math.max(1, Math.floor(elapsed / charDelayRef.current)));
            setRevealCount(revealed);
            if (revealed >= text.length) {
                return;
            }
            timeoutId = window.setTimeout(tick, charDelayRef.current);
        };

        let timeoutId = window.setTimeout(tick, charDelayRef.current);

        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [text, streaming]);

    useEffect(() => {
        if (streaming && revealCount >= text.length && !doneFiredRef.current) {
            doneFiredRef.current = true;
            onDone?.();
        }
    }, [streaming, revealCount, text.length, onDone]);

    const isRevealing = streaming && revealCount < text.length;

    return (
        <span>
            {text.slice(0, revealCount)}
            {isRevealing && (
                <span
                    aria-hidden="true"
                    className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] animate-caret-blink bg-accent-bright align-middle"
                />
            )}
        </span>
    );
}

/**
 * Share helpers for the results card: building the brag text, dispatching it via the native
 * share sheet or clipboard, and exporting the card as a downloadable PNG.
 */
import { toPng } from 'html-to-image';
import type { GameStats } from '@/game/types';
import { formatTokensFull } from '@/lib/format';

/** Joke $/1M-token rate used for the fake bill, mirrored from the results card. */
const FAKE_DOLLARS_PER_MILLION_TOKENS = 23.7;

/** Canonical game URL included with every share so a brag is also a link back in. */
const GAME_URL = 'https://benvinegar.github.io/prompt-typer/';

function fakeCost(tokens: number): string {
    const dollars = Math.round((tokens / 1_000_000) * FAKE_DOLLARS_PER_MILLION_TOKENS);
    return `$${dollars.toLocaleString('en-US')}`;
}

/**
 * Builds the shareable brag text, leading with the burn total (the actual score) since that's
 * the joke, then the rank verdict and typing stats as supporting detail.
 */
export function buildShareText(stats: GameStats, rankTitle: string): string {
    const subagents =
        stats.subagentCount > 0 ? ` ${stats.subagentCount} subagents still running.` : '';
    return `I made my copilot burn ${formatTokensFull(stats.tokensBurned)} tokens (est. ${fakeCost(stats.tokensBurned)}) in a 60 second interview — "${rankTitle}", ${stats.wpm} WPM, ${stats.accuracy}% acc.${subagents} Can you burn more?`;
}

/**
 * Shares text via the Web Share API when available (mobile browsers, mainly), falling back to
 * copying it to the clipboard on desktop.
 *
 * Contract: if the player dismisses the native share sheet (`AbortError`), this resolves as
 * `'shared'` without touching the clipboard — a cancelled share is a completed interaction, not
 * a failure, and callers should not surface a "Copied!" confirmation for it. Any other share
 * failure (e.g. no permission) falls through to the clipboard copy.
 */
export async function shareResult(text: string): Promise<'shared' | 'copied'> {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
            // The URL rides in its own field so share targets render it as a link exactly once.
            await navigator.share({ text, url: GAME_URL });
            return 'shared';
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                return 'shared';
            }
            // Fall through to the clipboard fallback for any other share failure.
        }
    }
    await navigator.clipboard.writeText(`${text} ${GAME_URL}`);
    return 'copied';
}

/**
 * Captures a DOM node as a PNG and triggers a browser download. Sets an explicit dark
 * background so the exported image isn't transparent, and renders at 2x pixel density for a
 * crisp screenshot regardless of the page's device pixel ratio.
 */
export async function downloadCardAsPng(node: HTMLElement, filename: string): Promise<void> {
    const dataUrl = await toPng(node, {
        backgroundColor: '#111116',
        pixelRatio: 2,
    });
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
}

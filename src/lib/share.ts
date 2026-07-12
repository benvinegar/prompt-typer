/**
 * Share helpers for the results card: building the brag text, dispatching it via the native
 * share sheet or clipboard, and exporting the card as a downloadable PNG.
 */
import { toPng } from 'html-to-image';
import type { GameStats } from '@/game/types';

function formatTokens(tokens: number): string {
    return Math.floor(tokens).toLocaleString('en-US');
}

/** Builds the shareable brag text using the player's actual run stats and earned rank title. */
export function buildShareText(stats: GameStats, rankTitle: string): string {
    const subagents =
        stats.subagentCount > 0
            ? ` My copilot burned ${formatTokens(stats.tokensBurned)} tokens and left ${stats.subagentCount} subagents running.`
            : '';
    return `My vibe coding interview verdict: "${rankTitle}" — ${stats.wpm} WPM, ${stats.accuracy}% acc, ${stats.tokensPerSecond} tok/s.${subagents} Think you'd get the offer? Prompt Faster`;
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
            await navigator.share({ text });
            return 'shared';
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                return 'shared';
            }
            // Fall through to the clipboard fallback for any other share failure.
        }
    }
    await navigator.clipboard.writeText(text);
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

import { useEffect, useRef, useState } from 'react';
import type { ResponseBeat } from '@/game/types';
import { BrailleSpinner } from '@/components/braille-spinner';
import { StreamingText } from '@/components/streaming-text';
import { AgentBulletLine } from '@/components/terminal-line';

/** Random breath between consecutive beats, so output doesn't machine-gun onto the screen. */
const BEAT_GAP_MIN_MS = 300;
const BEAT_GAP_MAX_MS = 700;

/** Spinner time for tool beats that don't specify their own duration. */
const DEFAULT_TOOL_MS = 700;
/** How long a subagents beat holds the sequence before handing control on (the spinner never stops). */
const DEFAULT_SUBAGENTS_MS = 1100;
/** Thinking blocks reveal faster than spoken text, like a model racing through reasoning. */
const THINKING_MS_PER_CHAR = 8;
/** Final reply text reveals slightly faster than plain messages to keep total playtime snappy. */
const TEXT_MS_PER_CHAR = 12;

/**
 * Splits a beat's `detail` string into the short command shown in parens next to the tool name
 * and the longer result note shown on the `⎿` line beneath it. Scenario data writes details as
 * `"<command>  (<result note>)"`; details without that trailing parenthetical (e.g. a bare `mv`
 * command) fall back to a plain "done" result line.
 */
function splitDetail(detail: string): { command: string; note: string | null } {
    const match = detail.match(/^(.*?)\s{2,}\((.*)\)$/);
    if (match) {
        return { command: match[1]!.trim(), note: match[2]!.trim() };
    }
    return { command: detail.replace(/\s{2,}/g, ' ').trim(), note: null };
}

/**
 * A fake tool-call line: `⏺ Name(command)`, spinner while "running", a green bullet once done,
 * and an indented `⎿` result line that only reveals on completion so it doesn't spoil the
 * punchline before the beat "finishes".
 */
function ToolRow({ name, detail, active }: { name: string; detail: string; active: boolean }) {
    const { command, note } = splitDetail(detail);
    return (
        <div className="flex animate-fade-up flex-col gap-0.5 text-[15px] leading-relaxed">
            <div className="flex min-w-0 items-baseline gap-1.5">
                {active ? (
                    <BrailleSpinner className="shrink-0 text-accent" />
                ) : (
                    <span className="shrink-0 text-success">⏺</span>
                )}
                <span className="shrink-0 font-bold text-ink-bright">{name}</span>
                <span className="min-w-0 break-words text-ink-dim">({command})</span>
            </div>
            {!active && (
                <div className="pl-5 break-words text-ink-dim">
                    <span className="text-ink-faint">⎿ </span>
                    {note ?? 'done'}
                </div>
            )}
        </div>
    );
}

/**
 * A "launching subagents" line. Unlike tool rows this never resolves to a checkmark — the
 * spinner rips forever and the result line always reads "still running," because the subagents
 * are, of course, never coming back.
 */
function SubagentsRow({ count, detail }: { count: number; detail: string }) {
    return (
        <div className="flex animate-fade-up flex-col gap-0.5 text-[15px] leading-relaxed">
            <div className="flex min-w-0 items-baseline gap-1.5">
                <BrailleSpinner className="shrink-0 text-accent" />
                <span className="shrink-0 font-bold text-ink-bright">Task</span>
                <span className="min-w-0 break-words text-ink-dim">
                    ({count} subagents: {detail})
                </span>
            </div>
            <div className="pl-5 break-words text-ink-dim">
                <span className="text-ink-faint">⎿ </span>
                still running <span className="text-ink-faint">· they will not be coming back</span>
            </div>
        </div>
    );
}

/** A fake chain-of-thought line: dim italic text behind an accent `✻ Thinking… ` prefix, streamed fast. */
function ThinkingBlock({ text, active, onDone }: { text: string; active: boolean; onDone: () => void }) {
    return (
        <div className="flex animate-fade-up gap-2 text-[15px] leading-relaxed text-ink-dim italic">
            <span className="not-italic shrink-0 text-accent">✻</span>
            <span className="min-w-0 break-words">
                Thinking…{' '}
                <StreamingText text={text} streaming={active} onDone={onDone} msPerChar={THINKING_MS_PER_CHAR} />
            </span>
        </div>
    );
}

export interface AgentResponseBeatsProps {
    beats: ResponseBeat[];
    /** True while the response is still playing out; false renders all beats complete instantly. */
    streaming: boolean;
    /** Called exactly once, when the final beat has finished playing. */
    onDone?: () => void;
}

/**
 * Plays a structured agent response beat-by-beat: thinking blocks and reply text stream in,
 * tool calls spin for their duration then check off. Completed beats stay visible; `onDone`
 * fires exactly once after the last beat.
 */
export function AgentResponseBeats({ beats, streaming, onDone }: AgentResponseBeatsProps) {
    const [playedCount, setPlayedCount] = useState(streaming ? 0 : beats.length);
    const doneFiredRef = useRef(false);

    // A completed beat doesn't reveal the next one instantly: a small random breath between
    // beats (like a model deciding what to do next) keeps the playback from feeling canned.
    const gapTimerRef = useRef<number | null>(null);
    const advance = () => {
        if (gapTimerRef.current !== null) {
            return;
        }
        gapTimerRef.current = window.setTimeout(
            () => {
                gapTimerRef.current = null;
                setPlayedCount((count) => Math.min(count + 1, beats.length));
            },
            BEAT_GAP_MIN_MS + Math.random() * (BEAT_GAP_MAX_MS - BEAT_GAP_MIN_MS),
        );
    };
    useEffect(() => {
        return () => {
            if (gapTimerRef.current !== null) {
                window.clearTimeout(gapTimerRef.current);
                gapTimerRef.current = null;
            }
        };
    }, []);

    // Tool and subagents beats complete on a timer (thinking/text beats advance via onDone).
    const activeBeat = streaming && playedCount < beats.length ? beats[playedCount] : undefined;
    useEffect(() => {
        if (activeBeat === undefined || (activeBeat.kind !== 'tool' && activeBeat.kind !== 'subagents')) {
            return;
        }
        const fallbackMs = activeBeat.kind === 'tool' ? DEFAULT_TOOL_MS : DEFAULT_SUBAGENTS_MS;
        const id = window.setTimeout(advance, activeBeat.durationMs ?? fallbackMs);
        return () => window.clearTimeout(id);
    }, [activeBeat]);

    useEffect(() => {
        if (streaming && playedCount >= beats.length && !doneFiredRef.current) {
            doneFiredRef.current = true;
            onDone?.();
        }
    }, [streaming, playedCount, beats.length, onDone]);

    const visibleBeats = streaming ? beats.slice(0, Math.min(playedCount + 1, beats.length)) : beats;

    return (
        <div className="flex flex-col gap-2">
            {visibleBeats.map((beat, index) => {
                const active = streaming && index === playedCount;
                switch (beat.kind) {
                    case 'thinking':
                        return <ThinkingBlock key={index} text={beat.text} active={active} onDone={advance} />;
                    case 'tool':
                        return <ToolRow key={index} name={beat.name} detail={beat.detail} active={active} />;
                    case 'subagents':
                        return <SubagentsRow key={index} count={beat.count} detail={beat.detail} />;
                    case 'text':
                        return (
                            <AgentBulletLine key={index}>
                                <StreamingText
                                    text={beat.text}
                                    streaming={active}
                                    onDone={advance}
                                    msPerChar={TEXT_MS_PER_CHAR}
                                />
                            </AgentBulletLine>
                        );
                }
            })}
        </div>
    );
}

import { useEffect, useRef, useState } from 'react';
import type { ResponseBeat } from '@/game/types';
import { StreamingText } from '@/components/streaming-text';

/** Spinner time for tool beats that don't specify their own duration. */
const DEFAULT_TOOL_MS = 700;
/** How long a subagents beat holds the sequence before handing control on (the spinner never stops). */
const DEFAULT_SUBAGENTS_MS = 1100;
/** Thinking blocks reveal faster than spoken text, like a model racing through reasoning. */
const THINKING_MS_PER_CHAR = 8;
/** Final reply text reveals slightly faster than plain messages to keep total playtime snappy. */
const TEXT_MS_PER_CHAR = 12;

function CheckIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true">
            <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function Spinner() {
    return (
        <span
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-[1.5px] border-border-strong border-t-accent-bright"
        />
    );
}

/** A fake tool-call row: spinner while "running", then a green check with the tool name + detail. */
function ToolRow({ name, detail, active }: { name: string; detail: string; active: boolean }) {
    return (
        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-bg-elevated px-2.5 py-1.5 font-mono text-[13px]">
            {active ? <Spinner /> : <CheckIcon />}
            <span className="shrink-0 font-semibold text-ink">{name}</span>
            <span className="truncate text-ink-dim">{detail}</span>
        </div>
    );
}

/**
 * A "launching subagents" row. Unlike tool rows this never resolves to a checkmark —
 * the spinner rips forever, because the subagents are, of course, still working.
 */
function SubagentsRow({ count, detail }: { count: number; detail: string }) {
    return (
        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-accent-dim bg-accent-soft px-2.5 py-1.5 font-mono text-[13px]">
            <Spinner />
            <span className="shrink-0 font-semibold text-accent-bright">
                Agents <span className="tabular-nums">x{count}</span>
            </span>
            <span className="truncate text-ink-dim">{detail}</span>
        </div>
    );
}

/** A fake chain-of-thought block: dim italic text behind a "Thinking" label, streamed fast. */
function ThinkingBlock({ text, active, onDone }: { text: string; active: boolean; onDone: () => void }) {
    return (
        <div className="border-l-2 border-border-strong pl-3">
            <div className={`mb-0.5 text-xs font-medium text-ink-faint ${active ? 'animate-pulse' : ''}`}>
                Thinking
            </div>
            <div className="text-[13px] leading-relaxed text-ink-dim italic">
                <StreamingText text={text} streaming={active} onDone={onDone} msPerChar={THINKING_MS_PER_CHAR} />
            </div>
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

    const advance = () => setPlayedCount((count) => Math.min(count + 1, beats.length));

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
                            <div key={index}>
                                <StreamingText
                                    text={beat.text}
                                    streaming={active}
                                    onDone={advance}
                                    msPerChar={TEXT_MS_PER_CHAR}
                                />
                            </div>
                        );
                }
            })}
        </div>
    );
}

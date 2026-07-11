/**
 * Engine hook for Prompt Faster. Owns the shuffled scenario queue, transcript, per-key
 * advance/error accounting, auto-submit on prompt completion, the frozen-while-streaming
 * countdown, phase transitions, and final stats. The clock only runs between the first
 * keystroke of a prompt and its submission, so reading time is free and WPM reflects true
 * typing speed. The UI owns the char-by-char reveal animation of agent messages and reports
 * completion via `onAgentStreamDone()`.
 */

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { OPENING_MESSAGES } from '@/data/greetings';
import { SCENARIOS } from '@/data/scenarios';
import { computeStats } from '@/game/scoring';
import {
    GAME_DURATION_MS,
    type ChatMessage,
    type GamePhase,
    type GameSnapshot,
    type ResponseBeat,
    type Scenario,
} from '@/game/types';

/** Interval cadence for the countdown timer while `phase === 'typing'`. */
const TICK_MS = 60;
/** Random delay range (inclusive) for the fake "thinking" pause after submit. */
const THINKING_DELAY_MIN_MS = 600;
const THINKING_DELAY_MAX_MS = 900;

/** Cadence of the comedic token-burn meter. */
const BURN_TICK_MS = 100;
/** Baseline tokens/sec burned while the agent is "working" (streaming or thinking). */
const BURN_RATE_AGENT_ACTIVE = 320;
/** Baseline tokens/sec while the agent idles waiting on the human (someone left the context on). */
const BURN_RATE_AGENT_IDLE = 6;
/** Additional tokens/sec burned by EACH ripping subagent, forever. */
const BURN_RATE_PER_SUBAGENT = 480;

/** The shape returned by {@link useGame}. */
export interface UseGameReturn {
    snapshot: GameSnapshot;
    /** idle/finished -> begins a fresh run. */
    start(): void;
    /** Back to idle. */
    reset(): void;
    /** Raw `KeyboardEvent.key` during 'typing'. */
    handleKey(key: string): void;
    /** UI calls when the streaming agent bubble finishes revealing. */
    onAgentStreamDone(): void;
}

/** What the streaming agent message currently represents, so onAgentStreamDone knows what's next. */
type StreamKind = 'opening' | 'setup' | 'response';

/** Internal mutable engine state, kept outside React state for cheap per-keystroke updates. */
interface EngineState {
    phase: GamePhase;
    messages: ChatMessage[];
    currentPrompt: string | null;
    typedCount: number;
    lastKeyWasError: boolean;
    remainingMs: number;

    correctChars: number;
    errors: number;
    totalKeystrokes: number;
    promptsCompleted: number;
    activeTypingMs: number;
    tokensBurned: number;
    subagentCount: number;

    /** Shuffled queue of scenarios; reshuffled and continued when exhausted. */
    queue: Scenario[];
    /** Index of the scenario currently being played (its prompt is `currentPrompt`). */
    queueIndex: number;
    /** What the in-flight streaming message represents. */
    streamKind: StreamKind | null;
}

/** Fisher-Yates shuffle; returns a new array, does not mutate the input. */
function shuffle<T>(items: readonly T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = result[i]!;
        result[i] = result[j]!;
        result[j] = tmp;
    }
    return result;
}

/** Builds a fresh, idle engine state (used both at module init and on reset). */
function createIdleState(): EngineState {
    return {
        phase: 'idle',
        messages: [],
        currentPrompt: null,
        typedCount: 0,
        lastKeyWasError: false,
        remainingMs: GAME_DURATION_MS,
        correctChars: 0,
        errors: 0,
        totalKeystrokes: 0,
        promptsCompleted: 0,
        activeTypingMs: 0,
        tokensBurned: 0,
        subagentCount: 0,
        queue: [],
        queueIndex: -1,
        streamKind: null,
    };
}

function randomId(): string {
    return Math.random().toString(36).slice(2);
}

function randomThinkingDelayMs(): number {
    return THINKING_DELAY_MIN_MS + Math.random() * (THINKING_DELAY_MAX_MS - THINKING_DELAY_MIN_MS);
}

/** Returns the next scenario in the queue, reshuffling (and continuing) when exhausted. */
function advanceQueue(state: EngineState): Scenario {
    const nextIndex = state.queueIndex + 1;
    if (nextIndex >= state.queue.length) {
        state.queue = shuffle(SCENARIOS);
        state.queueIndex = 0;
    } else {
        state.queueIndex = nextIndex;
    }
    return state.queue[state.queueIndex]!;
}

/**
 * Mutable engine driving Prompt Faster. Not itself a React hook — {@link useGame} adapts
 * it via `useSyncExternalStore` so per-keystroke updates avoid re-running the full hook body.
 */
class GameEngine {
    private state: EngineState = createIdleState();
    private listeners = new Set<() => void>();
    private cachedSnapshot: GameSnapshot;

    private tickHandle: ReturnType<typeof setInterval> | null = null;
    private lastTickAt = 0;
    private errorFlashHandle: ReturnType<typeof setTimeout> | null = null;
    private thinkingHandle: ReturnType<typeof setTimeout> | null = null;
    private burnHandle: ReturnType<typeof setInterval> | null = null;
    private lastBurnAt = 0;

    constructor() {
        this.cachedSnapshot = this.buildSnapshot();
    }

    subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    getSnapshot = (): GameSnapshot => this.cachedSnapshot;

    private buildSnapshot(): GameSnapshot {
        const s = this.state;
        return {
            phase: s.phase,
            messages: s.messages,
            currentPrompt: s.currentPrompt,
            typedCount: s.typedCount,
            lastKeyWasError: s.lastKeyWasError,
            remainingMs: s.remainingMs,
            subagentCount: s.subagentCount,
            stats: computeStats({
                correctChars: s.correctChars,
                errors: s.errors,
                totalKeystrokes: s.totalKeystrokes,
                promptsCompleted: s.promptsCompleted,
                activeTypingMs: s.activeTypingMs,
                tokensBurned: s.tokensBurned,
                subagentCount: s.subagentCount,
            }),
        };
    }

    private emit(): void {
        this.cachedSnapshot = this.buildSnapshot();
        for (const listener of this.listeners) {
            listener();
        }
    }

    private clearTimers(): void {
        if (this.tickHandle !== null) {
            clearInterval(this.tickHandle);
            this.tickHandle = null;
        }
        if (this.errorFlashHandle !== null) {
            clearTimeout(this.errorFlashHandle);
            this.errorFlashHandle = null;
        }
        if (this.thinkingHandle !== null) {
            clearTimeout(this.thinkingHandle);
            this.thinkingHandle = null;
        }
        this.stopBurn();
    }

    /** Starts the comedic token-burn meter; runs for the whole game regardless of phase. */
    private startBurn(): void {
        if (this.burnHandle !== null) {
            return;
        }
        this.lastBurnAt = Date.now();
        this.burnHandle = setInterval(this.onBurnTick, BURN_TICK_MS);
    }

    private stopBurn(): void {
        if (this.burnHandle !== null) {
            clearInterval(this.burnHandle);
            this.burnHandle = null;
        }
    }

    private onBurnTick = (): void => {
        const s = this.state;
        if (s.phase === 'idle' || s.phase === 'finished') {
            return;
        }
        const now = Date.now();
        const deltaSec = (now - this.lastBurnAt) / 1_000;
        this.lastBurnAt = now;

        const agentActive = s.phase === 'streaming' || s.phase === 'thinking';
        const baseRate = agentActive ? BURN_RATE_AGENT_ACTIVE : BURN_RATE_AGENT_IDLE;
        const rate = baseRate + s.subagentCount * BURN_RATE_PER_SUBAGENT;
        // Jitter makes the meter feel like real, slightly panicked usage telemetry.
        s.tokensBurned += rate * deltaSec * (0.7 + Math.random() * 0.6);

        this.emit();
    };

    /**
     * Enters 'typing' phase. The countdown does NOT start yet — reading the prompt is free.
     * The clock is armed by {@link startClock} on the first keystroke of the prompt.
     */
    private enterTyping(): void {
        this.state.phase = 'typing';
    }

    /** Starts the countdown interval (idempotent); called on the first keystroke of a prompt. */
    private startClock(): void {
        if (this.tickHandle !== null) {
            return;
        }
        this.lastTickAt = Date.now();
        this.tickHandle = setInterval(this.onTick, TICK_MS);
    }

    /** Stops the countdown interval, flushing the elapsed remainder so no typing time is dropped. */
    private stopClock(): void {
        if (this.tickHandle === null) {
            return;
        }
        clearInterval(this.tickHandle);
        this.tickHandle = null;

        const now = Date.now();
        const delta = now - this.lastTickAt;
        this.lastTickAt = now;
        this.state.activeTypingMs += delta;
        this.state.remainingMs = Math.max(0, this.state.remainingMs - delta);
    }

    private onTick = (): void => {
        if (this.state.phase !== 'typing') {
            return;
        }
        const now = Date.now();
        const delta = now - this.lastTickAt;
        this.lastTickAt = now;

        this.state.activeTypingMs += delta;
        this.state.remainingMs = Math.max(0, this.state.remainingMs - delta);

        if (this.state.remainingMs <= 0) {
            this.state.remainingMs = 0;
            this.stopClock();
            this.stopBurn();
            this.state.phase = 'finished';
            this.state.currentPrompt = null;
        }

        this.emit();
    };

    private pushStreamingAgentMessage(text: string, kind: StreamKind, beats?: ResponseBeat[]): void {
        const message: ChatMessage = { id: randomId(), role: 'agent', text, streaming: true };
        if (beats) {
            message.beats = beats;
        }
        this.state.messages = [...this.state.messages, message];
        this.state.streamKind = kind;
        this.state.phase = 'streaming';
    }

    start = (): void => {
        if (this.state.phase !== 'idle' && this.state.phase !== 'finished') {
            return;
        }
        this.clearTimers();

        const state = createIdleState();
        state.queue = shuffle(SCENARIOS);
        state.queueIndex = -1;
        this.state = state;

        const opening = OPENING_MESSAGES[Math.floor(Math.random() * OPENING_MESSAGES.length)] ?? '';
        this.pushStreamingAgentMessage(opening, 'opening');
        this.startBurn();

        this.emit();
    };

    reset = (): void => {
        this.clearTimers();
        this.state = createIdleState();
        this.emit();
    };

    onAgentStreamDone = (): void => {
        const s = this.state;
        if (s.phase !== 'streaming') {
            return;
        }

        // Mark the streaming message as done.
        const messages = s.messages;
        const lastIndex = messages.length - 1;
        if (lastIndex >= 0 && messages[lastIndex]!.streaming) {
            const last = messages[lastIndex]!;
            s.messages = [...messages.slice(0, lastIndex), { ...last, streaming: false }];
        }

        const finishedKind = s.streamKind;
        s.streamKind = null;

        if (finishedKind === 'opening' || finishedKind === 'response') {
            // Stream the next scenario's setup line.
            const scenario = advanceQueue(s);
            this.pushStreamingAgentMessage(scenario.agentSetup, 'setup');
        } else if (finishedKind === 'setup') {
            // Setup finished streaming -> move to typing the current scenario's prompt.
            const scenario = s.queue[s.queueIndex]!;
            s.currentPrompt = scenario.prompt;
            s.typedCount = 0;
            s.lastKeyWasError = false;
            this.enterTyping();
        }

        this.emit();
    };

    handleKey = (key: string): void => {
        const s = this.state;
        if (s.phase !== 'typing' || s.currentPrompt === null) {
            return;
        }
        // Ignore non-printable keys (Enter, Shift, Arrow*, Backspace, ...): with auto-submit
        // on the last character they have no role, so they neither advance nor count as errors.
        if (key.length > 1) {
            return;
        }

        // The clock is armed by the first keystroke of each prompt, so reading time is free
        // and WPM measures actual typing speed.
        this.startClock();

        const prompt = s.currentPrompt;
        const expected = prompt[s.typedCount];
        if (key === expected) {
            s.typedCount += 1;
            s.correctChars += 1;
            s.totalKeystrokes += 1;
            s.lastKeyWasError = false;
            if (this.errorFlashHandle !== null) {
                clearTimeout(this.errorFlashHandle);
                this.errorFlashHandle = null;
            }
            if (s.typedCount >= prompt.length) {
                // Last character typed -> auto-submit, no Enter required.
                this.submit();
                return;
            }
        } else {
            s.errors += 1;
            s.totalKeystrokes += 1;
            this.flashError();
        }

        this.emit();
    };

    private flashError(): void {
        this.state.lastKeyWasError = true;
        if (this.errorFlashHandle !== null) {
            clearTimeout(this.errorFlashHandle);
        }
        this.errorFlashHandle = setTimeout(() => {
            this.errorFlashHandle = null;
            this.state.lastKeyWasError = false;
            this.emit();
        }, 150);
    }

    private submit(): void {
        const s = this.state;
        const prompt = s.currentPrompt;
        const scenario = s.queue[s.queueIndex];
        if (prompt === null || !scenario) {
            return;
        }

        this.stopClock();

        s.promptsCompleted += 1;
        s.messages = [...s.messages, { id: randomId(), role: 'user', text: prompt }];
        s.currentPrompt = null;
        s.typedCount = 0;
        s.lastKeyWasError = false;

        // The flush above may have consumed the last of the clock on the final keystroke.
        if (s.remainingMs <= 0) {
            this.stopBurn();
            s.phase = 'finished';
            this.emit();
            return;
        }

        s.phase = 'thinking';

        this.emit();

        if (this.thinkingHandle !== null) {
            clearTimeout(this.thinkingHandle);
        }
        this.thinkingHandle = setTimeout(() => {
            this.thinkingHandle = null;
            if (this.state.phase !== 'thinking') {
                return;
            }
            // Any subagents "launched" by this response start burning tokens immediately (forever).
            for (const beat of scenario.response) {
                if (beat.kind === 'subagents') {
                    this.state.subagentCount += beat.count;
                }
            }
            this.pushStreamingAgentMessage('', 'response', scenario.response);
            this.emit();
        }, randomThinkingDelayMs());
    }

    /** Cleans up all pending timers; call on unmount. */
    dispose(): void {
        this.clearTimers();
    }
}

/**
 * React hook exposing the Prompt Faster game engine. State updates are driven by a
 * long-lived mutable {@link GameEngine} instance and surfaced via `useSyncExternalStore`
 * so per-keystroke updates stay cheap while snapshots remain referentially fresh on change.
 */
export function useGame(): UseGameReturn {
    const engineRef = useRef<GameEngine | null>(null);
    if (engineRef.current === null) {
        engineRef.current = new GameEngine();
    }
    const engine = engineRef.current;

    useEffect(() => {
        return () => {
            engine.dispose();
        };
    }, [engine]);

    const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);

    const start = useCallback(() => engine.start(), [engine]);
    const reset = useCallback(() => engine.reset(), [engine]);
    const handleKey = useCallback((key: string) => engine.handleKey(key), [engine]);
    const onAgentStreamDone = useCallback(() => engine.onAgentStreamDone(), [engine]);

    return useMemo(
        () => ({ snapshot, start, reset, handleKey, onAgentStreamDone }),
        [snapshot, start, reset, handleKey, onAgentStreamDone],
    );
}

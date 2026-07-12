/**
 * Engine hook for Prompt Faster. Owns the shuffled scenario queue, transcript, per-key
 * advance/error accounting, auto-submit on prompt completion, phase transitions, and final
 * stats. Two independent timers run here:
 *   - The wall clock (`remainingMs`, GAME_DURATION_MS budget) is armed by the first keystroke
 *     of the RUN and, once armed, ticks down continuously across every phase -- typing,
 *     streaming, thinking -- until it hits 0. It never pauses again. Reading the opening
 *     greeting before the player's very first keystroke is free; every reveal after that costs
 *     wall clock, even though the player isn't typing.
 *   - The typing timer (`activeTypingMs`) only accrues while `phase === 'typing'` AND the
 *     current prompt has been started (its own first keystroke), stopping at submit. This is
 *     what WPM is computed from, so it reflects true typing speed regardless of how much the
 *     agent's theatrics eat into the wall clock.
 * The UI owns the char-by-char reveal animation of agent messages and reports completion via
 * `onAgentStreamDone()`.
 */

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { buildReportBeats } from '@/data/agent-reports';
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

/** Interval cadence for the master wall-clock/typing-timer tick, once armed. */
const TICK_MS = 60;
/** Random delay range (inclusive) for the fake "thinking" pause after submit. */
const THINKING_DELAY_MIN_MS = 600;
const THINKING_DELAY_MAX_MS = 900;

/** Cadence of the comedic token-burn meter. */
const BURN_TICK_MS = 100;
/** Baseline tokens/sec burned while the agent is "working" (streaming or thinking). */
const BURN_RATE_AGENT_ACTIVE = 3200;
/** Baseline tokens/sec while the agent idles waiting on the human (someone left the context on). */
const BURN_RATE_AGENT_IDLE = 60;
/** Additional tokens/sec burned by EACH ripping subagent, forever. */
const BURN_RATE_PER_SUBAGENT = 4800;
/**
 * Per-prompt compounding multiplier applied to the burn rate: the deeper the interview goes,
 * the more recklessly the copilot spends. Rate is scaled by ESCALATION_PER_PROMPT raised to the
 * number of prompts completed so far, so burn is roughly linear early on and absurd by prompt 10+.
 */
const ESCALATION_PER_PROMPT = 1.6;

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
type StreamKind = 'opening' | 'setup' | 'response' | 'report' | 'timeup';

/**
 * Deadpan sign-off lines streamed once the clock hits zero, before the results modal appears.
 * Plain ASCII, written in the same smug-interviewer voice as the rest of the transcript.
 */
const TIMEUP_MESSAGES: string[] = [
    'Time. Pencils down. HR will be in touch.',
    'That is time. Please step away from the keyboard, candidate.',
    "Clock's out. We'll circle back on next steps, allegedly.",
    'Two minutes. Stop typing. The rubric has already judged you.',
];

/** How many further prompt submissions pass before a launched swarm "reports back". */
const REPORT_DUE_AFTER_PROMPTS = 2;

/** A scheduled "the subagents reported in, it's all rubbish" interstitial. */
interface PendingReport {
    count: number;
    /** Plays once `promptsCompleted` reaches this value. */
    dueAtPrompts: number;
}

/** Internal mutable engine state, kept outside React state for cheap per-keystroke updates. */
interface EngineState {
    phase: GamePhase;
    messages: ChatMessage[];
    currentPrompt: string | null;
    typedCount: number;
    lastKeyWasError: boolean;
    remainingMs: number;
    /** Current streak of consecutive correct keystrokes; reset on error and on run start only. */
    streak: number;

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
    /** Swarms that have been launched and will "report back" a few prompts later. */
    pendingReports: PendingReport[];

    /** True once the run-level wall clock has been armed by the first keystroke of the run. */
    clockStarted: boolean;
    /** True once the first keystroke of the CURRENT prompt has landed; gates activeTypingMs accrual. */
    promptStarted: boolean;
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
        streak: 0,
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
        pendingReports: [],
        clockStarted: false,
        promptStarted: false,
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
            clockStarted: s.clockStarted,
            subagentCount: s.subagentCount,
            streak: s.streak,
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
        this.stopMasterClock();
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
        const escalation = ESCALATION_PER_PROMPT ** s.promptsCompleted;
        const rate = (baseRate + s.subagentCount * BURN_RATE_PER_SUBAGENT) * escalation;
        // Jitter makes the meter feel like real, slightly panicked usage telemetry.
        s.tokensBurned += rate * deltaSec * (0.7 + Math.random() * 0.6);

        this.emit();
    };

    /** Enters 'typing' phase for the current prompt. Does not touch either timer. */
    private enterTyping(): void {
        this.state.phase = 'typing';
    }

    /**
     * Arms the run-level wall clock (idempotent past the first call): starts the master tick
     * interval that drives `remainingMs` down continuously from here on, across every phase,
     * until it hits 0. Called on the first keystroke of the RUN, so the opening greeting/setup
     * before the player ever types is free.
     */
    private armClock(): void {
        if (this.state.clockStarted) {
            return;
        }
        this.state.clockStarted = true;
        this.lastTickAt = Date.now();
        this.tickHandle = setInterval(this.onTick, TICK_MS);
    }

    /** Clears the master tick interval (idempotent). Does not flush -- callers sync first. */
    private stopMasterClock(): void {
        if (this.tickHandle === null) {
            return;
        }
        clearInterval(this.tickHandle);
        this.tickHandle = null;
    }

    /**
     * Flushes elapsed wall-clock time since the last sync into `remainingMs` (always, once
     * armed) and `activeTypingMs` (only while `phase === 'typing'` and the current prompt has
     * been started). A no-op before the clock is armed. Called on every master tick and at
     * phase-transition points (submit) so precision doesn't depend on tick cadence -- the same
     * "flush the sub-tick remainder" trick the old per-prompt clock used, now shared by both
     * timers.
     */
    private syncClock(now: number = Date.now()): void {
        if (this.tickHandle === null) {
            return;
        }
        const delta = now - this.lastTickAt;
        this.lastTickAt = now;

        this.state.remainingMs = Math.max(0, this.state.remainingMs - delta);
        if (this.state.phase === 'typing' && this.state.promptStarted) {
            this.state.activeTypingMs += delta;
        }
    }

    private onTick = (): void => {
        this.syncClock();
        if (this.state.remainingMs <= 0) {
            this.triggerTimeUp();
        }
        this.emit();
    };

    /**
     * Fires once when the wall clock hits zero, from ANY phase (typing, streaming, or
     * thinking): stops the master clock and burn meter (stats stop moving), cancels a pending
     * "thinking" timeout if one was in flight (the response never arrives -- time's up), clamps
     * `remainingMs` and clears the in-progress prompt so no further input registers, finalizes
     * an in-flight streaming message in place (without running its normal
     * `onAgentStreamDone` advancement -- it doesn't get to finish), and streams a deadpan
     * "time's up" sign-off before the results modal appears (via `onAgentStreamDone`). Guarded
     * against double-firing — the tick path, the submit-flush path, and (mid-stream) the master
     * clock ticking through 'streaming'/'thinking' can all observe `remainingMs <= 0`, but only
     * the first call should push the sign-off message.
     */
    private triggerTimeUp(): void {
        const s = this.state;
        if (s.streamKind === 'timeup') {
            return;
        }
        this.stopMasterClock();
        this.stopBurn();
        if (this.thinkingHandle !== null) {
            clearTimeout(this.thinkingHandle);
            this.thinkingHandle = null;
        }
        s.remainingMs = 0;
        s.currentPrompt = null;

        // A response/setup/report message may be mid-reveal in the UI. Finalize it in place so
        // the transcript doesn't leave a permanently-streaming bubble, but skip the normal
        // finishedKind handling (advancing the queue, queueing a report, etc.) -- time ran out
        // mid-sentence, so it doesn't get to complete.
        if (s.phase === 'streaming') {
            const messages = s.messages;
            const lastIndex = messages.length - 1;
            if (lastIndex >= 0 && messages[lastIndex]!.streaming) {
                const last = messages[lastIndex]!;
                s.messages = [...messages.slice(0, lastIndex), { ...last, streaming: false }];
            }
            s.streamKind = null;
        }

        const message = TIMEUP_MESSAGES[Math.floor(Math.random() * TIMEUP_MESSAGES.length)] ?? TIMEUP_MESSAGES[0]!;
        this.pushStreamingAgentMessage(message, 'timeup');
    }

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

        if (finishedKind === 'timeup') {
            // The deadpan sign-off has finished playing -> reveal the results modal.
            s.phase = 'finished';
        } else if (finishedKind === 'opening' || finishedKind === 'response' || finishedKind === 'report') {
            // A launched swarm may be due to "report back" before the next task.
            if (finishedKind === 'response') {
                const dueIndex = s.pendingReports.findIndex((report) => s.promptsCompleted >= report.dueAtPrompts);
                if (dueIndex !== -1) {
                    const report = s.pendingReports[dueIndex]!;
                    s.pendingReports = s.pendingReports.filter((_, index) => index !== dueIndex);
                    this.pushStreamingAgentMessage('', 'report', buildReportBeats(report.count));
                    this.emit();
                    return;
                }
            }
            // Stream the next scenario's setup line.
            const scenario = advanceQueue(s);
            this.pushStreamingAgentMessage(scenario.agentSetup, 'setup');
        } else if (finishedKind === 'setup') {
            // Setup finished streaming -> move to typing the current scenario's prompt. Fresh
            // prompt, so its own "has typing started" bookkeeping resets (the run-level wall
            // clock, if already armed, keeps running regardless).
            const scenario = s.queue[s.queueIndex]!;
            s.currentPrompt = scenario.prompt;
            s.typedCount = 0;
            s.lastKeyWasError = false;
            s.promptStarted = false;
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

        // Arms the run-level wall clock on the very first keystroke of the whole run (a no-op
        // after that -- it never re-arms per prompt). Marks that typing has begun on THIS
        // prompt, so activeTypingMs starts accruing for it and WPM measures true typing speed.
        this.armClock();
        s.promptStarted = true;

        const prompt = s.currentPrompt;
        const expected = prompt[s.typedCount];
        if (key === expected) {
            s.typedCount += 1;
            s.correctChars += 1;
            s.totalKeystrokes += 1;
            s.streak += 1;
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
            s.streak = 0;
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

        // Flush the sub-tick remainder so the exact submit instant is credited precisely to
        // both timers -- crucially, this stops crediting activeTypingMs the moment the phase
        // changes below, without stopping the master interval: the wall clock keeps running
        // straight through 'thinking' and the next 'streaming' setup.
        this.syncClock();

        s.promptsCompleted += 1;
        s.messages = [...s.messages, { id: randomId(), role: 'user', text: prompt }];
        s.currentPrompt = null;
        s.typedCount = 0;
        s.lastKeyWasError = false;
        s.promptStarted = false;

        // The flush above may have consumed the last of the clock on the final keystroke.
        if (s.remainingMs <= 0) {
            this.triggerTimeUp();
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
            // Any subagents "launched" by this response start burning tokens immediately (forever),
            // and are scheduled to "report back" a couple of tasks from now.
            for (const beat of scenario.response) {
                if (beat.kind === 'subagents') {
                    this.state.subagentCount += beat.count;
                    this.state.pendingReports.push({
                        count: beat.count,
                        dueAtPrompts: this.state.promptsCompleted + REPORT_DUE_AFTER_PROMPTS,
                    });
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

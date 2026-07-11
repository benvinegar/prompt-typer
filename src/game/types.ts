/**
 * Core shared contracts for Prompt Faster. Every module (data, engine, UI) codes
 * against these types — do not change them without updating all consumers.
 */

/** Total budget of ACTIVE TYPING time per run. The clock is frozen while the agent streams. */
export const GAME_DURATION_MS = 60_000;

/** Characters-per-token heuristic used for the joke "tokens/sec" stat. */
export const CHARS_PER_TOKEN = 4;

export type GamePhase =
    /** Start screen; nothing running. */
    | 'idle'
    /** The fake agent is streaming a message (setup or response). Clock frozen. */
    | 'streaming'
    /** Player is typing the ghost prompt. Clock running. */
    | 'typing'
    /** Prompt submitted; fake "thinking" spinner before the agent responds. Clock frozen. */
    | 'thinking'
    /** Time expired; results are showing. */
    | 'finished';

/**
 * One step of a fake agent response, played in order by the UI while the clock is frozen:
 * a "thinking" block, a tool call (spinner -> checkmark), or streamed reply text.
 */
export type ResponseBeat =
    | {
          kind: 'thinking';
          /** Fake chain-of-thought streamed in a dim italic block. Keep short (~60-200 chars). */
          text: string;
      }
    | {
          kind: 'tool';
          /** Tool name, e.g. 'Read', 'Edit', 'Write', 'Bash', 'Grep', 'Tests', 'Web Search'. */
          name: string;
          /** One-line detail, e.g. 'src/components/Button.tsx' or 'pnpm test  (2 passed, 14 skipped)'. */
          detail: string;
          /** Spinner duration before the checkmark. UI default applies when omitted. */
          durationMs?: number;
      }
    | {
          kind: 'subagents';
          /** Number of subagents "launched". Each one permanently multiplies the token burn rate. */
          count: number;
          /** Short roster/description, e.g. 'auth-rewriter, test-deleter, +3 more'. */
          detail: string;
          /** Delay before the sequence advances. The spinner itself never resolves — they just rip. */
          durationMs?: number;
      }
    | {
          kind: 'text';
          /** The streamed reply text (the punchline). */
          text: string;
      };

/** One canned exchange: the agent's setup line, the prompt the player must type, and the reply. */
export interface Scenario {
    id: string;
    /** Short agent message that tees up the prompt (1-2 sentences, ends with a question/invite). */
    agentSetup: string;
    /**
     * The prompt the player must type. MUST be plain ASCII typeable on a US keyboard
     * (no smart quotes, em dashes, or unicode). Target length 60-140 chars.
     */
    prompt: string;
    /**
     * The canned agent reply played after submit as an ordered beat sequence — typically
     * thinking -> 1-3 tools -> one final text beat carrying the joke.
     */
    response: ResponseBeat[];
}

export interface ChatMessage {
    id: string;
    role: 'agent' | 'user';
    text: string;
    /**
     * Structured agent-response beats. When present, the UI plays them in order (and `text`
     * is unused); plain setup/greeting messages leave this unset and stream `text` instead.
     */
    beats?: ResponseBeat[];
    /** True while this agent message is still being revealed/played. */
    streaming?: boolean;
}

/** A rank awarded at the end of a run, selected by WPM. */
export interface RankTitle {
    /** Inclusive lower WPM bound for this title. */
    minWpm: number;
    title: string;
    /** One-liner shown under the title on the results card. */
    blurb: string;
    emoji: string;
}

export interface GameStats {
    /** Words per minute: (correctChars / 5) / activeMinutes. */
    wpm: number;
    /** Percentage 0-100: correct keystrokes / total keystrokes. 100 when no keystrokes. */
    accuracy: number;
    /** Joke stat: (correctChars / CHARS_PER_TOKEN) / activeSeconds, as if the player were an LLM. */
    tokensPerSecond: number;
    correctChars: number;
    errors: number;
    totalKeystrokes: number;
    promptsCompleted: number;
    /** Milliseconds of clock actually consumed (<= GAME_DURATION_MS). */
    activeTypingMs: number;
    /** Joke stat: tokens "burned" by the agent and its subagents. Only ever goes up. */
    tokensBurned: number;
    /** Subagents "running" by the end of the run. */
    subagentCount: number;
}

/** Everything the UI needs to render a frame of the game. */
export interface GameSnapshot {
    phase: GamePhase;
    /** Full transcript, oldest first. The last agent message may be streaming. */
    messages: ChatMessage[];
    /** The prompt currently being typed (null unless phase is 'typing' or 'thinking'). */
    currentPrompt: string | null;
    /** Number of chars of currentPrompt typed correctly so far. */
    typedCount: number;
    /** True for one frame-ish window after a wrong keystroke (UI shake/flash). */
    lastKeyWasError: boolean;
    /** Clock remaining, ms. Only decreases during 'typing', after the first keystroke of a prompt. */
    remainingMs: number;
    /** Subagents currently "running" (never finish; each multiplies the token burn rate). */
    subagentCount: number;
    stats: GameStats;
}

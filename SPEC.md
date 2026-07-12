# Prompt Faster — Build Spec

A 100% client-side viral typing game: a fake AI chat where the *player* is the one being tested.
Theme: you are an engineering candidate being evaluated on your ability to VIBE CODE software
products — the agent is a smug interviewer/copilot, and the prompts you type are vibe-coding asks.
Vite + React 19 + TanStack Router + Tailwind CSS 4. No server, no persistence beyond localStorage.

## Game loop

Two independent timers drive the run: a **wall clock** (`remainingMs`, 120s budget) that, once
armed, ticks down continuously across every phase and never pauses again, and a **typing timer**
(`activeTypingMs`) that only accrues while the player is actively typing the current prompt. WPM
is computed from the typing timer alone, so the agent's streaming/thinking theatrics cost the
player wall clock but never distort their measured typing speed.

1. Start screen ("idle"). Big title, one-line pitch, START button. Explain: 2 minutes on the
   wall clock, armed by your first keystroke, running non-stop after that — including while the
   AI is busy showing off.
2. The fake agent streams a short setup message char-by-char (phase `streaming`). The wall clock
   is not yet armed before the player's very first keystroke of the run, so this opening reveal
   is free; every reveal after that costs wall clock even though the player isn't typing.
3. A ghost prompt appears in the chat input area, greyed out (like Nitrotype's upcoming text).
   Phase `typing`. The wall clock is armed by the FIRST keystroke of the RUN (not per prompt);
   the typing timer is armed by the first keystroke of THIS prompt, so WPM measures true typing
   speed even though reading a later prompt still burns wall clock. The player must type it
   exactly:
   - Correct keystroke → advances one char (rendered filled-in / highlighted).
   - Wrong keystroke → does NOT advance; recorded as an error; brief shake/red flash.
   - No backspace needed (you never advance on error). Ignore non-printable keys entirely.
4. The last correct keystroke AUTO-SUBMITS (no Enter): the prompt posts to the transcript as a
   user bubble, phase `thinking` (spinner, wall clock still running, ~600-900ms), then the agent
   streams its canned funny response (phase `streaming`, fast ~2s, wall clock still running),
   then the next ghost prompt → `typing`.
5. When the wall clock is exhausted (may happen mid-prompt, mid-stream, or mid-thinking), phase
   `finished`: any in-flight streaming message is finalized in place, a deadpan sign-off streams,
   then the results modal shows.

## Scoring

- WPM = (correctChars / 5) / (activeTypingMs / 60000) — `activeTypingMs` is the typing-only
  timer, not the 120s wall clock, so streaming/thinking time never dilutes WPM.
- accuracy = correctKeystrokes / totalKeystrokes * 100 (100 if none)
- tokens/sec = (correctChars / 4) / (activeTypingMs / 1000)
- Title: one of 10 ranks selected by WPM bands (see `src/data/titles.ts`).

## Module contracts (source of truth: `src/game/types.ts` — already written, do not modify)

### `src/data/` (content module)
- `scenarios.ts`: `export const SCENARIOS: Scenario[]` — at least 18 entries.
  Prompts are the text players type: plain ASCII only (no smart quotes/em dashes/unicode),
  60-140 chars, humorous "things people actually ask AI" energy.
- `titles.ts`: `export const RANK_TITLES: RankTitle[]` — exactly 10, sorted ascending by minWpm,
  first entry minWpm 0; and `export function getRankForWpm(wpm: number): RankTitle`.
- `greetings.ts`: `export const OPENING_MESSAGES: string[]` — 5+ short streamed intro lines the
  agent opens the game with (e.g. welcoming the player to their typing evaluation).

### `src/game/` (engine module)
- `scoring.ts`: pure `computeStats(input): GameStats` helpers.
- `use-game.ts`: `export function useGame(): UseGameReturn` where:

```ts
interface UseGameReturn {
    snapshot: GameSnapshot;            // see types.ts
    start(): void;                     // idle/finished -> begins a fresh run
    reset(): void;                     // back to idle
    handleKey(key: string): void;      // raw KeyboardEvent.key during 'typing'
    onAgentStreamDone(): void;         // UI calls when the streaming agent bubble finishes revealing
}
```

Engine owns: shuffled scenario queue, transcript messages, per-key advance/error logic, auto-submit,
phase transitions, and final stats -- across two independent timers. The UI owns the char-by-char
reveal animation of agent messages and reports completion via `onAgentStreamDone()`. The wall clock
(`remainingMs`, the 120s budget) is armed by the run's first keystroke and decrements in every phase
(typing, streaming, thinking) until it hits 0, at which point it clamps and the run resolves to
`finished` via a deadpan sign-off, even mid-stream or mid-think. The typing timer (`activeTypingMs`,
what WPM is derived from) only accrues while `phase === 'typing'` and the current prompt has been
started, so it measures true typing speed regardless of how the wall clock is spent. Use one
interval ~50-100ms driving both.

### `src/components/` (UI module)
- `game-screen.tsx`: `export function GameScreen()` — the single route component; composes
  everything, wires keyboard events (window keydown during typing) to `useGame`.
- Chat transcript with agent/user bubbles, streaming reveal for agent messages, thinking spinner,
  the ghost-prompt typing input, HUD (countdown + live WPM), start screen, results modal
  (WPM, accuracy, tokens/sec, prompts completed, rank title + emoji + blurb, share button that
  copies a share text via navigator.clipboard, play again button).
- Aesthetic: dark, modern AI-chat look (think Claude/ChatGPT), one accent color, monospace for
  the typed prompt. Tailwind 4 (`src/styles.css` uses `@import 'tailwindcss'`; add `@theme`
  tokens/keyframes there as needed).

## Conventions

- Path alias `@/` → `src/`. TypeScript strict; no `any`. 4-space indent, single quotes.
- Everything must pass `pnpm typecheck` and `pnpm build`.

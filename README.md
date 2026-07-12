# Prompt Faster

The vibe coding interview. A typing test disguised as an AI chat.

**[Play it →](https://benvinegar.github.io/prompt-typer/)**

![CI](https://github.com/benvinegar/prompt-typer/actions/workflows/ci.yml/badge.svg)

![Prompt Faster](public/og.png)

## How it works

You're an engineering candidate being evaluated on your ability to vibe code. A smug AI copilot
streams you a setup, then a ghost prompt appears in the composer — type it exactly to send it.
The goal: burn as many tokens as possible. Tokens burned is your score.

- **2 minutes on the wall clock.** It's armed by your first keystroke, then runs non-stop
  through everything — typing, the agent's streaming replies, its fake "thinking" pauses. The
  AI's theatrics run your clock, not a frozen one.
- **WPM is measured separately.** A dedicated typing timer only counts time you're actually
  typing the current prompt, so reading a setup line or watching the agent stall doesn't touch
  your typing speed — it just eats into your 2 minutes.
- **Wrong keys don't advance.** No backspacing — a bad keystroke just costs you.
- **The last correct key auto-sends** the prompt, no Enter required.
- **The burn rate compounds.** Every prompt you finish makes the copilot spend more
  recklessly than the last — plus fake subagent swarms that spin up and burn tokens forever,
  and other bits of copilot theater.
- At 0 seconds, you get a verdict: tokens burned (your score), WPM, accuracy, tokens/sec, and
  a rank from **Auto-Rejected by ATS** all the way up to **CTO of Vibes**.

100% client-side. No server, no accounts, no telemetry.

## Develop

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm typecheck
pnpm build      # static output in dist/
```

## Architecture

Vite + React 19 + TanStack Router + Tailwind CSS 4, TypeScript strict throughout.

- `src/game/types.ts` — shared contracts (phases, scenarios, stats)
- `src/game/` — engine: state machine, the wall clock + separate active-typing clock, scoring
- `src/data/` — scenarios (the funny prompts + replies), rank titles, greetings
- `src/components/` — chat UI, streaming reveal, ghost-prompt composer, results modal

See [`SPEC.md`](SPEC.md) for the full design.

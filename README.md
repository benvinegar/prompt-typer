# Prompt Faster

The vibe coding interview. A typing test disguised as an AI chat.

**[Play it →](https://benvinegar.github.io/prompt-typer/)**

![CI](https://github.com/benvinegar/prompt-typer/actions/workflows/ci.yml/badge.svg)

![Prompt Faster](public/og.png)

## How it works

You're an engineering candidate being evaluated on your ability to vibe code. A smug AI copilot
streams you a setup, then a ghost prompt appears in the composer — type it exactly to send it.

- **60 seconds of active typing time.** The clock only runs while you're typing; it freezes
  whenever the agent is streaming a response.
- **Wrong keys don't advance.** No backspacing — a bad keystroke just costs you.
- **The last correct key auto-sends** the prompt, no Enter required.
- Along the way: fake subagent swarms spinning up, a token meter ticking, and other bits of
  copilot theater.
- At 0 seconds, you get a verdict: WPM, accuracy, tokens/sec, and a rank from
  **Auto-Rejected by ATS** all the way up to **CTO of Vibes**.

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
- `src/game/` — engine: state machine, active-typing clock, scoring
- `src/data/` — scenarios (the funny prompts + replies), rank titles, greetings
- `src/components/` — chat UI, streaming reveal, ghost-prompt composer, results modal

See [`SPEC.md`](SPEC.md) for the full design.
